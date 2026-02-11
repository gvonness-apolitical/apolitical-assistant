import { z } from 'zod';
import { defineHandlers, createImageResponse, RawResponse } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';

// ==================== ZOD SCHEMAS ====================

export const SlidesGetPresentationSchema = z.object({
  presentationId: z.string().describe('The Google Slides presentation ID'),
});

const SlideContentSchema = z.object({
  title: z.string().optional().describe('Slide title'),
  body: z.string().optional().describe('Slide body text (supports bullet points with - prefix)'),
  notes: z.string().optional().describe('Speaker notes for this slide'),
  layout: z
    .enum(['TITLE', 'TITLE_AND_BODY', 'TITLE_ONLY', 'BLANK'])
    .optional()
    .default('TITLE_AND_BODY')
    .describe('Slide layout type'),
});

export const SlidesCreateSchema = z.object({
  title: z.string().describe('The title for the new presentation'),
  slides: z
    .array(SlideContentSchema)
    .optional()
    .describe('Array of slides to create (each with title, body, notes, layout)'),
});

export const SlidesAddSlideSchema = z.object({
  presentationId: z.string().describe('The Google Slides presentation ID'),
  title: z.string().optional().describe('Slide title'),
  body: z.string().optional().describe('Slide body text'),
  notes: z.string().optional().describe('Speaker notes'),
  layout: z
    .enum(['TITLE', 'TITLE_AND_BODY', 'TITLE_ONLY', 'BLANK'])
    .optional()
    .default('TITLE_AND_BODY')
    .describe('Slide layout type'),
  insertionIndex: z
    .number()
    .optional()
    .describe('Position to insert slide (0-indexed, omit to append)'),
});

export const SlidesGetThumbnailSchema = z.object({
  presentationId: z.string().describe('The Google Slides presentation ID'),
  pageObjectId: z
    .string()
    .describe('The slide page object ID (from slides_get_presentation response)'),
  thumbnailSize: z
    .enum(['LARGE', 'MEDIUM', 'SMALL'])
    .optional()
    .default('LARGE')
    .describe('Thumbnail size: LARGE (1600px), MEDIUM (800px), or SMALL (200px)'),
});

// ==================== HANDLER FUNCTIONS ====================

export async function handleSlidesGetPresentation(
  args: z.infer<typeof SlidesGetPresentationSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://slides.googleapis.com/v1/presentations/${args.presentationId}`;
  const response = await auth.fetch(url);
  if (!response.ok) throw new Error(`Slides API error: ${response.status}`);

  const presentation = (await response.json()) as {
    title: string;
    slides: Array<{
      objectId: string;
      pageElements?: Array<{
        shape?: {
          text?: {
            textElements?: Array<{
              textRun?: { content: string };
            }>;
          };
        };
      }>;
    }>;
  };

  // Extract text from slides
  const slides = presentation.slides.map((slide, index) => {
    const textContent =
      slide.pageElements
        ?.filter((el) => el.shape?.text)
        .map(
          (el) =>
            el.shape!.text!.textElements?.map((te) => te.textRun?.content || '').join('') || ''
        )
        .join('\n') || '';

    return {
      slideNumber: index + 1,
      id: slide.objectId,
      content: textContent,
    };
  });

  return {
    title: presentation.title,
    slideCount: slides.length,
    slides,
  };
}

// Layout mapping to predefined layout object IDs (Google Slides uses these)
const LAYOUT_MAPPINGS: Record<string, string> = {
  TITLE: 'TITLE',
  TITLE_AND_BODY: 'TITLE_AND_BODY',
  TITLE_ONLY: 'TITLE_ONLY',
  BLANK: 'BLANK',
};

// Helper to generate unique object IDs
function generateObjectId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to create text insertion requests for a shape
function createTextRequests(
  objectId: string,
  text: string,
  isBulletList: boolean = false
): Array<Record<string, unknown>> {
  const requests: Array<Record<string, unknown>> = [];

  // Insert text
  requests.push({
    insertText: {
      objectId,
      text,
      insertionIndex: 0,
    },
  });

  // If it looks like bullet points, create a bulleted list
  if (isBulletList && text.includes('\n')) {
    requests.push({
      createParagraphBullets: {
        objectId,
        textRange: { type: 'ALL' },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
      },
    });
  }

  return requests;
}

// Helper to parse body text and detect bullet points
function parseBodyText(body: string): { text: string; isBulletList: boolean } {
  const lines = body.split('\n');
  const isBulletList = lines.some(
    (line) => line.trim().startsWith('- ') || line.trim().startsWith('• ')
  );

  // Clean up bullet prefixes for Slides (it will add its own bullets)
  const cleanedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) return trimmed.substring(2);
    if (trimmed.startsWith('• ')) return trimmed.substring(2);
    return trimmed;
  });

  return {
    text: cleanedLines.join('\n'),
    isBulletList,
  };
}

export async function handleSlidesCreate(
  args: z.infer<typeof SlidesCreateSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // Step 1: Create the presentation
  const createUrl = 'https://slides.googleapis.com/v1/presentations';
  const createResponse = await auth.fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: args.title }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Slides API error creating presentation: ${createResponse.status} - ${error}`);
  }

  const presentation = (await createResponse.json()) as {
    presentationId: string;
    title: string;
    slides: Array<{ objectId: string }>;
  };

  // Step 2: If slides provided, add them
  if (args.slides && args.slides.length > 0) {
    const requests: Array<Record<string, unknown>> = [];
    const slidesToAdd = args.slides;

    // Delete the default blank slide that Google creates
    const firstSlide = presentation.slides?.[0];
    if (firstSlide) {
      requests.push({
        deleteObject: { objectId: firstSlide.objectId },
      });
    }

    // Create each slide
    slidesToAdd.forEach((slide, i) => {
      const slideId = generateObjectId();
      const titleId = `${slideId}_title`;
      const bodyId = `${slideId}_body`;
      const layout = slide.layout || 'TITLE_AND_BODY';

      // Create the slide with a predefined layout
      requests.push({
        createSlide: {
          objectId: slideId,
          insertionIndex: i,
          slideLayoutReference: {
            predefinedLayout: LAYOUT_MAPPINGS[layout],
          },
          placeholderIdMappings: [
            ...(slide.title ? [{ layoutPlaceholder: { type: 'TITLE' }, objectId: titleId }] : []),
            ...(slide.body && layout !== 'TITLE_ONLY' && layout !== 'TITLE'
              ? [{ layoutPlaceholder: { type: 'BODY' }, objectId: bodyId }]
              : []),
          ],
        },
      });

      // Add title text if provided
      if (slide.title) {
        requests.push({
          insertText: {
            objectId: titleId,
            text: slide.title,
            insertionIndex: 0,
          },
        });
      }

      // Add body text if provided
      if (slide.body && layout !== 'TITLE_ONLY' && layout !== 'TITLE') {
        const { text, isBulletList } = parseBodyText(slide.body);
        requests.push(...createTextRequests(bodyId, text, isBulletList));
      }

      // Add speaker notes if provided
      if (slide.notes) {
        requests.push({
          insertText: {
            objectId: `${slideId}_notes`,
            text: slide.notes,
            insertionIndex: 0,
          },
        });
      }
    });

    // Execute batch update
    const updateUrl = `https://slides.googleapis.com/v1/presentations/${presentation.presentationId}:batchUpdate`;
    const updateResponse = await auth.fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Slides API error adding slides: ${updateResponse.status} - ${error}`);
    }
  }

  return {
    presentationId: presentation.presentationId,
    title: presentation.title,
    url: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`,
    slideCount: args.slides?.length || 1,
  };
}

export async function handleSlidesAddSlide(
  args: z.infer<typeof SlidesAddSlideSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const slideId = generateObjectId();
  const titleId = `${slideId}_title`;
  const bodyId = `${slideId}_body`;

  const requests: Array<Record<string, unknown>> = [];

  // Create the slide
  requests.push({
    createSlide: {
      objectId: slideId,
      ...(args.insertionIndex !== undefined && { insertionIndex: args.insertionIndex }),
      slideLayoutReference: {
        predefinedLayout: LAYOUT_MAPPINGS[args.layout || 'TITLE_AND_BODY'],
      },
      placeholderIdMappings: [
        ...(args.title ? [{ layoutPlaceholder: { type: 'TITLE' }, objectId: titleId }] : []),
        ...(args.body && args.layout !== 'TITLE_ONLY' && args.layout !== 'TITLE'
          ? [{ layoutPlaceholder: { type: 'BODY' }, objectId: bodyId }]
          : []),
      ],
    },
  });

  // Add title text
  if (args.title) {
    requests.push({
      insertText: {
        objectId: titleId,
        text: args.title,
        insertionIndex: 0,
      },
    });
  }

  // Add body text
  if (args.body && args.layout !== 'TITLE_ONLY' && args.layout !== 'TITLE') {
    const { text, isBulletList } = parseBodyText(args.body);
    requests.push(...createTextRequests(bodyId, text, isBulletList));
  }

  // Execute batch update
  const updateUrl = `https://slides.googleapis.com/v1/presentations/${args.presentationId}:batchUpdate`;
  const updateResponse = await auth.fetch(updateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    throw new Error(`Slides API error adding slide: ${updateResponse.status} - ${error}`);
  }

  return {
    presentationId: args.presentationId,
    slideId,
    url: `https://docs.google.com/presentation/d/${args.presentationId}/edit`,
  };
}

export async function handleSlidesGetThumbnail(
  args: z.infer<typeof SlidesGetThumbnailSchema>,
  auth: GoogleAuth
): Promise<RawResponse> {
  // 1. Get the thumbnail URL from the Slides API
  const url = `https://slides.googleapis.com/v1/presentations/${args.presentationId}/pages/${args.pageObjectId}/thumbnail?thumbnailProperties.thumbnailSize=${args.thumbnailSize}`;
  const response = await auth.fetch(url);
  if (!response.ok) throw new Error(`Slides thumbnail API error: ${response.status}`);

  const thumbnail = (await response.json()) as {
    contentUrl: string;
    width: number;
    height: number;
  };

  // 2. Download the image from the temporary URL
  const imageResponse = await auth.fetch(thumbnail.contentUrl);
  if (!imageResponse.ok) throw new Error(`Failed to download thumbnail: ${imageResponse.status}`);

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const base64 = imageBuffer.toString('base64');

  // 3. Return as MCP image content
  const caption = `Slide thumbnail (${thumbnail.width}x${thumbnail.height})`;
  return new RawResponse(createImageResponse(base64, 'image/png', caption));
}

// ==================== HANDLER BUNDLE ====================

export const slidesDefs = defineHandlers<GoogleAuth>()({
  slides_get_presentation: {
    description: 'Get the content and structure of a Google Slides presentation',
    schema: SlidesGetPresentationSchema,
    handler: handleSlidesGetPresentation,
  },
  slides_create: {
    description:
      'Create a new Google Slides presentation with optional slides (each slide can have title, body with bullet points, speaker notes, and layout)',
    schema: SlidesCreateSchema,
    handler: handleSlidesCreate,
  },
  slides_add_slide: {
    description: 'Add a slide to an existing Google Slides presentation',
    schema: SlidesAddSlideSchema,
    handler: handleSlidesAddSlide,
  },
  slides_get_thumbnail: {
    description:
      'Get a rendered thumbnail image of a specific slide. Returns the image inline for visual analysis. Use slides_get_presentation first to get page object IDs.',
    schema: SlidesGetThumbnailSchema,
    handler: handleSlidesGetThumbnail,
  },
});
