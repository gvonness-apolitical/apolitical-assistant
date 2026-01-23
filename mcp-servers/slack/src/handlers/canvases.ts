import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { slackApi, type SlackResponse } from './api.js';

// ==================== SCHEMAS ====================

export const GetCanvasSchema = z.object({
  canvas_id: z.string().describe('The canvas ID (e.g., F0123456789)'),
});

export const UpdateCanvasSchema = z.object({
  canvas_id: z.string().describe('The canvas ID to update'),
  changes: z
    .array(
      z.object({
        operation: z
          .enum(['insert_at_start', 'insert_at_end', 'replace', 'delete'])
          .describe('The operation to perform'),
        section_id: z.string().optional().describe('Section ID for replace/delete operations'),
        document_content: z
          .object({
            type: z.literal('markdown'),
            markdown: z.string().describe('Markdown content to insert'),
          })
          .optional()
          .describe('Content for insert/replace operations'),
      })
    )
    .describe('Array of changes to apply to the canvas'),
});

export const CreateCanvasSchema = z.object({
  title: z.string().describe('Title of the canvas'),
  document_content: z
    .object({
      type: z.literal('markdown'),
      markdown: z.string().describe('Initial markdown content'),
    })
    .optional()
    .describe('Initial content for the canvas'),
  channel_id: z.string().optional().describe('Channel or DM ID to attach the canvas to'),
});

export const ListCanvasesSchema = z.object({
  channel_id: z.string().describe('Channel or DM ID to list canvases from'),
  limit: z.number().optional().default(20).describe('Maximum number of canvases to return'),
});

// ==================== RESPONSE TYPES ====================

interface CanvasContent {
  type: string;
  markdown?: string;
  elements?: Array<{
    type: string;
    elements?: Array<{
      type: string;
      text?: string;
      style?: Record<string, boolean>;
    }>;
  }>;
}

interface CanvasSection {
  id: string;
  type: string;
  content?: CanvasContent;
}

interface Canvas {
  id: string;
  title?: string;
  document_content?: CanvasContent;
  sections?: CanvasSection[];
  channel_id?: string;
  created?: number;
  updated?: number;
}

interface CanvasReadResponse extends SlackResponse {
  canvas_id: string;
  markdown?: string;
  content?: CanvasContent;
}

interface CanvasEditResponse extends SlackResponse {
  canvas_id: string;
}

interface CanvasCreateResponse extends SlackResponse {
  canvas_id: string;
}

interface CanvasListResponse extends SlackResponse {
  canvases: Canvas[];
  response_metadata?: {
    next_cursor?: string;
  };
}

// ==================== TOOL DEFINITIONS ====================

export const canvasTools: Tool[] = [
  {
    name: 'slack_get_canvas',
    description:
      'Read canvas content from a Slack channel or DM. Returns the canvas content in markdown format.',
    inputSchema: {
      type: 'object',
      properties: {
        canvas_id: {
          type: 'string',
          description: 'The canvas ID (e.g., F0123456789)',
        },
      },
      required: ['canvas_id'],
    },
  },
  {
    name: 'slack_update_canvas',
    description:
      'Update canvas content. Supports inserting at start/end, replacing sections, or deleting sections.',
    inputSchema: {
      type: 'object',
      properties: {
        canvas_id: {
          type: 'string',
          description: 'The canvas ID to update',
        },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['insert_at_start', 'insert_at_end', 'replace', 'delete'],
                description: 'The operation to perform',
              },
              section_id: {
                type: 'string',
                description: 'Section ID for replace/delete operations',
              },
              document_content: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['markdown'] },
                  markdown: { type: 'string', description: 'Markdown content' },
                },
                description: 'Content for insert/replace operations',
              },
            },
            required: ['operation'],
          },
          description: 'Array of changes to apply',
        },
      },
      required: ['canvas_id', 'changes'],
    },
  },
  {
    name: 'slack_create_canvas',
    description: 'Create a new canvas, optionally attached to a channel or DM.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the canvas',
        },
        document_content: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['markdown'] },
            markdown: { type: 'string', description: 'Initial markdown content' },
          },
          description: 'Initial content for the canvas',
        },
        channel_id: {
          type: 'string',
          description: 'Channel or DM ID to attach the canvas to',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'slack_list_canvases',
    description: 'List canvases in a channel or DM conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: {
          type: 'string',
          description: 'Channel or DM ID to list canvases from',
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Maximum number of canvases to return',
        },
      },
      required: ['channel_id'],
    },
  },
];

// ==================== HANDLERS ====================

export async function handleGetCanvas(
  args: z.infer<typeof GetCanvasSchema>,
  token: string
): Promise<unknown> {
  const data = await slackApi<CanvasReadResponse>('canvases.read', token, {
    canvas_id: args.canvas_id,
  });

  return {
    canvasId: data.canvas_id,
    markdown: data.markdown,
    content: data.content,
  };
}

export async function handleUpdateCanvas(
  args: z.infer<typeof UpdateCanvasSchema>,
  token: string
): Promise<unknown> {
  // Build the changes array for the API
  const changes = args.changes.map((change) => {
    const apiChange: Record<string, unknown> = {
      operation: change.operation,
    };

    if (change.section_id) {
      apiChange.section_id = change.section_id;
    }

    if (change.document_content) {
      apiChange.document_content = change.document_content;
    }

    return apiChange;
  });

  const data = await slackApi<CanvasEditResponse>('canvases.edit', token, {
    canvas_id: args.canvas_id,
    changes: JSON.stringify(changes),
  });

  return {
    canvasId: data.canvas_id,
    success: true,
  };
}

export async function handleCreateCanvas(
  args: z.infer<typeof CreateCanvasSchema>,
  token: string
): Promise<unknown> {
  const params: Record<string, string | number | boolean> = {
    title: args.title,
  };

  if (args.document_content) {
    params.document_content = JSON.stringify(args.document_content);
  }

  const data = await slackApi<CanvasCreateResponse>('canvases.create', token, params);

  // If channel_id provided, set the canvas access for that channel
  if (args.channel_id && data.canvas_id) {
    try {
      await slackApi<SlackResponse>('canvases.access.set', token, {
        canvas_id: data.canvas_id,
        channel_ids: JSON.stringify([args.channel_id]),
        access_level: 'write',
      });
    } catch {
      // Canvas created but access setting failed - return canvas ID anyway
    }
  }

  return {
    canvasId: data.canvas_id,
    success: true,
  };
}

export async function handleListCanvases(
  args: z.infer<typeof ListCanvasesSchema>,
  token: string
): Promise<unknown> {
  const data = await slackApi<CanvasListResponse>('conversations.canvases.list', token, {
    channel: args.channel_id,
    limit: args.limit,
  });

  return {
    canvases: data.canvases.map((canvas) => ({
      id: canvas.id,
      title: canvas.title,
      created: canvas.created ? new Date(canvas.created * 1000).toISOString() : undefined,
      updated: canvas.updated ? new Date(canvas.updated * 1000).toISOString() : undefined,
    })),
  };
}
