import { z } from 'zod';
import { createToolDefinition, type HttpClient } from '@apolitical-assistant/mcp-shared';
import type { Severity } from './types.js';

// ==================== SCHEMAS ====================

export const ListSeveritiesSchema = z.object({});

// ==================== TOOL DEFINITIONS ====================

export const severityTools = [
  createToolDefinition(
    'incidentio_list_severities',
    'List available severity levels. Use this to get severity IDs for creating/updating incidents.',
    ListSeveritiesSchema
  ),
];

// ==================== HANDLERS ====================

export async function handleListSeverities(client: HttpClient): Promise<unknown> {
  const data = await client.get<{ severities: Severity[] }>('/severities');

  return data.severities.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    rank: s.rank,
  }));
}
