import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';
import type { Severity } from './types.js';

// ==================== TOOL DEFINITIONS ====================

export const severityTools: Tool[] = [
  {
    name: 'incidentio_list_severities',
    description:
      'List available severity levels. Use this to get severity IDs for creating/updating incidents.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
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
