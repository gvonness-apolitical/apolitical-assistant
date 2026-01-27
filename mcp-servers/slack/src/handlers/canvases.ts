/**
 * Slack Canvas Handlers
 *
 * IMPORTANT: Canvas Reading Strategy
 * ----------------------------------
 * Despite the `canvases:read` OAuth scope existing, there is NO public API method
 * to read canvas content. The scope only enables `canvases.sections.lookup` which
 * returns section IDs, not actual content.
 *
 * We read canvas content using a workaround:
 *   1. Call `files.info` with the canvas ID (canvases are stored as files)
 *   2. Get `url_private_download` from the response
 *   3. Fetch the content with Authorization header
 *
 * This requires only the `files:read` scope, not `canvases:read`.
 *
 * For writing, we use the standard `canvases.edit` API (requires `canvases:write`).
 *
 * References:
 * - https://github.com/slackapi/node-slack-sdk/blob/main/packages/web-api/src/methods.ts
 * - https://www.joshuadanpeterson.me/posts/mastering-slack-canvas-automation-a-journey-through-api-quirks
 */

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

export const DeleteCanvasSchema = z.object({
  canvas_id: z.string().describe('The canvas ID to delete (e.g., F0123456789)'),
});

// ==================== RESPONSE TYPES ====================

interface CanvasEditResponse extends SlackResponse {
  canvas_id: string;
}

interface CanvasCreateResponse extends SlackResponse {
  canvas_id: string;
}

// Response type for files.info API
interface FileInfoResponse extends SlackResponse {
  file: {
    id: string;
    name: string;
    title: string;
    filetype: string;
    mimetype: string;
    created: number;
    updated: number;
    user: string;
    url_private?: string;
    url_private_download?: string;
    permalink?: string;
  };
}

// Response type for files.list API
interface FilesListResponse extends SlackResponse {
  files: Array<{
    id: string;
    name: string;
    title: string;
    filetype: string;
    created: number;
    updated: number;
    user: string;
  }>;
}

// ==================== TOOL DEFINITIONS ====================

export const canvasTools: Tool[] = [
  {
    name: 'slack_get_canvas',
    description:
      'Read canvas content from Slack. Uses files.info API to get file metadata and downloads content via url_private_download.',
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
    description:
      'List all canvases in a channel or DM. Returns both the built-in channel canvas (if any) and standalone canvases shared in the channel.',
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
  {
    name: 'slack_delete_canvas',
    description:
      'Delete a canvas. Use with caution - this permanently removes the canvas and its content.',
    inputSchema: {
      type: 'object',
      properties: {
        canvas_id: {
          type: 'string',
          description: 'The canvas ID to delete (e.g., F0123456789)',
        },
      },
      required: ['canvas_id'],
    },
  },
];

// ==================== HANDLERS ====================

export async function handleGetCanvas(
  args: z.infer<typeof GetCanvasSchema>,
  token: string
): Promise<unknown> {
  // Strategy: Use files.info to get the download URL, then fetch the content.
  // Canvases are stored as files with filetype 'quip' and mimetype 'application/vnd.slack-docs'.

  // 1. Get file info including download URL
  const fileInfo = await slackApi<FileInfoResponse>('files.info', token, {
    file: args.canvas_id,
  });

  const file = fileInfo.file;

  // 2. If there's a download URL, fetch the content
  let content: string | null = null;
  let contentType: string | null = null;

  if (file.url_private_download) {
    try {
      const response = await fetch(file.url_private_download, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        contentType = response.headers.get('content-type');
        content = await response.text();
      }
    } catch {
      // Download failed, continue without content
    }
  }

  return {
    canvasId: args.canvas_id,
    title: file.title,
    filetype: file.filetype,
    mimetype: file.mimetype,
    created: file.created,
    updated: file.updated,
    permalink: file.permalink,
    content,
    contentType,
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

interface ConversationInfoResponse extends SlackResponse {
  channel: {
    id: string;
    name?: string;
    properties?: {
      canvas?: {
        file_id: string;
        is_empty?: boolean;
        quip_thread_id?: string;
      };
    };
  };
}

export async function handleListCanvases(
  args: z.infer<typeof ListCanvasesSchema>,
  token: string
): Promise<unknown> {
  const canvases: Array<{
    id: string;
    title?: string;
    type: 'channel_canvas' | 'standalone';
    isEmpty?: boolean;
    created?: number;
    updated?: number;
  }> = [];
  const seenIds = new Set<string>();

  // 1. Check for built-in channel canvas via conversations.info
  try {
    const convData = await slackApi<ConversationInfoResponse>('conversations.info', token, {
      channel: args.channel_id,
    });

    if (convData.channel?.properties?.canvas?.file_id) {
      const canvasId = convData.channel.properties.canvas.file_id;
      seenIds.add(canvasId);
      canvases.push({
        id: canvasId,
        type: 'channel_canvas',
        isEmpty: convData.channel.properties.canvas.is_empty,
      });
    }
  } catch {
    // conversations.info may fail for some channel types, continue to files.list
  }

  // 2. Find standalone canvases shared in the channel via files.list
  try {
    const filesData = await slackApi<FilesListResponse>('files.list', token, {
      channel: args.channel_id,
      types: 'canvas',
      count: args.limit || 20,
    });

    for (const file of filesData.files || []) {
      // Skip if we already have this canvas from channel properties
      if (seenIds.has(file.id)) continue;

      seenIds.add(file.id);
      canvases.push({
        id: file.id,
        title: file.title || file.name,
        type: 'standalone',
        created: file.created,
        updated: file.updated,
      });
    }
  } catch {
    // files.list may fail if scope not available, return what we have
  }

  return {
    canvases,
    channelId: args.channel_id,
  };
}

export async function handleDeleteCanvas(
  args: z.infer<typeof DeleteCanvasSchema>,
  token: string
): Promise<unknown> {
  await slackApi<SlackResponse>('canvases.delete', token, {
    canvas_id: args.canvas_id,
  });

  return {
    canvasId: args.canvas_id,
    success: true,
    deleted: true,
  };
}
