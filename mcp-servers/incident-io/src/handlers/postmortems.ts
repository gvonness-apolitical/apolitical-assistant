import { z } from 'zod';
import { defineHandlers, type HttpClient } from '@apolitical-assistant/mcp-shared';
import type { Incident } from './types.js';

// ==================== SCHEMAS ====================

export const GetPostmortemSchema = z.object({
  incidentId: z.string().describe('The incident ID to get postmortem for'),
});

// ==================== HANDLERS ====================

export async function handleGetPostmortem(
  args: z.infer<typeof GetPostmortemSchema>,
  client: HttpClient
): Promise<unknown> {
  const data = await client.get<{ incident: Incident }>(`/incidents/${args.incidentId}`);
  const incident = data.incident;

  // Try to get postmortem content from custom fields or summary
  return {
    incidentId: incident.id,
    incidentName: incident.name,
    postmortemUrl: incident.postmortem_document_url,
    summary: incident.summary,
    customFields: incident.custom_field_entries?.reduce(
      (acc, entry) => {
        acc[entry.custom_field.name] = entry.values
          .map((v) => v.value_text)
          .filter(Boolean)
          .join(', ');
        return acc;
      },
      {} as Record<string, string>
    ),
  };
}

// ==================== HANDLER BUNDLE ====================

export const postmortemDefs = defineHandlers<HttpClient>()({
  incidentio_get_postmortem: {
    description:
      'Get the postmortem/retrospective document for a resolved incident. Contains root cause analysis, timeline, and learnings.',
    schema: GetPostmortemSchema,
    handler: handleGetPostmortem,
  },
});
