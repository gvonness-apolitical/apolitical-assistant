import { z } from 'zod';
import { defineHandlers, type HttpClient } from '@apolitical-assistant/mcp-shared';
import type { Severity } from './types.js';

// ==================== SCHEMAS ====================

export const ListSeveritiesSchema = z.object({});

// ==================== HANDLERS ====================

export async function handleListSeverities(
  _args: z.infer<typeof ListSeveritiesSchema>,
  client: HttpClient
): Promise<unknown> {
  const data = await client.get<{ severities: Severity[] }>('/severities');

  return data.severities.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    rank: s.rank,
  }));
}

// ==================== HANDLER BUNDLE ====================

export const severityDefs = defineHandlers<HttpClient>()({
  incidentio_list_severities: {
    description:
      'List available severity levels. Use this to get severity IDs for creating/updating incidents.',
    schema: ListSeveritiesSchema,
    handler: handleListSeverities,
  },
});
