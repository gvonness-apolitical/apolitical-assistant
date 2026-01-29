import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';

// ==================== ZOD SCHEMAS ====================

export const SlidesGetPresentationSchema = z.object({
  presentationId: z.string().describe('The Google Slides presentation ID'),
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

// ==================== HANDLER BUNDLE ====================

export const slidesDefs = defineHandlers<GoogleAuth>()({
  slides_get_presentation: {
    description: 'Get the content and structure of a Google Slides presentation',
    schema: SlidesGetPresentationSchema,
    handler: handleSlidesGetPresentation,
  },
});
