/**
 * Task Helper - Incident Context Gatherer
 *
 * Gathers context from incident.io incidents.
 */

import type { Todo } from '@apolitical-assistant/shared';
import type {
  GatherOptions,
  GatheringStatus,
  SourceDetails,
  ThreadItem,
  RelatedItem,
  PersonContext,
} from '../types.js';

/**
 * Incident context result
 */
export interface IncidentContextResult {
  sourceDetails: SourceDetails;
  thread?: ThreadItem[];
  relatedItems?: RelatedItem[];
  people?: PersonContext[];
  status: GatheringStatus;
}

/**
 * Parse incident URL to extract incident ID
 */
function parseIncidentUrl(url: string): { incidentId?: string } | null {
  // Match patterns like:
  // https://app.incident.io/org/incidents/123
  const match = url.match(/incident\.io\/[^/]+\/incidents\/(\d+)/i);
  if (match) {
    return {
      incidentId: match[1],
    };
  }

  return null;
}

/**
 * Gather context from incident.io
 *
 * Note: This implementation provides the structure for MCP-based gathering.
 * The actual MCP calls would be made by the CLI when this runs in Claude Code.
 */
export async function gatherIncidentContext(
  todo: Todo,
  options: GatherOptions
): Promise<IncidentContextResult> {
  const startTime = Date.now();

  // Parse incident URL
  const url = todo.sourceUrl;
  const parsed = url ? parseIncidentUrl(url) : null;

  // Try to extract severity from title or tags
  let severity: string | undefined;
  if (todo.tags) {
    const sevTag = todo.tags.find((t) => t.toLowerCase().startsWith('sev'));
    if (sevTag) {
      severity = sevTag;
    }
  }
  if (!severity) {
    const sevMatch = todo.title.match(/\b(SEV[0-5]|P[0-5])\b/i);
    if (sevMatch) {
      severity = sevMatch[1].toUpperCase();
    }
  }

  // Build source details from TODO
  const sourceDetails: SourceDetails = {
    title: todo.title,
    description: todo.description,
    url: todo.sourceUrl,
    status: todo.status,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    severity,
    incidentStatus: todo.status === 'completed' ? 'resolved' : 'active',
    metadata: parsed
      ? {
          incidentId: parsed.incidentId,
        }
      : undefined,
  };

  // Extract labels from tags if available
  if (todo.tags && todo.tags.length > 0) {
    sourceDetails.labels = todo.tags;
  }

  // Build thread from description (incident timeline)
  const thread: ThreadItem[] = [];
  if (todo.description) {
    thread.push({
      author: 'incident',
      content: todo.description,
      date: todo.createdAt,
      type: 'note',
    });
  }

  // Related items (follow-ups, postmortem, etc.)
  const relatedItems: RelatedItem[] = [];

  // People context (incident responders)
  const people: PersonContext[] = [];

  return {
    sourceDetails,
    thread: options.includeThread ? thread : undefined,
    relatedItems: options.includeRelated ? relatedItems : undefined,
    people: options.includePeople ? people : undefined,
    status: {
      source: 'incident-io',
      status: 'success',
      itemCount: thread.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Get incident severity context
 */
export function getSeverityContext(sourceDetails: SourceDetails): {
  severity: string | undefined;
  isActive: boolean;
  isResolved: boolean;
  isCritical: boolean;
} {
  const severity = sourceDetails.severity?.toUpperCase();
  return {
    severity,
    isActive: sourceDetails.incidentStatus === 'active',
    isResolved: sourceDetails.incidentStatus === 'resolved',
    isCritical: severity === 'SEV1' || severity === 'SEV0' || severity === 'P0' || severity === 'P1',
  };
}

/**
 * Format incident context for prompt
 */
export function formatIncidentContextForPrompt(result: IncidentContextResult): string {
  const lines: string[] = [];

  const { sourceDetails, thread, relatedItems, people } = result;

  // Header
  lines.push('## Incident Context');
  lines.push('');

  // Basic info
  lines.push(`**Incident:** ${sourceDetails.title}`);

  const metadata = sourceDetails.metadata as { incidentId?: string } | undefined;
  if (metadata?.incidentId) {
    lines.push(`**Incident ID:** ${metadata.incidentId}`);
  }

  if (sourceDetails.url) {
    lines.push(`**URL:** ${sourceDetails.url}`);
  }

  if (sourceDetails.severity) {
    const severityIcon = getSeverityIcon(sourceDetails.severity);
    lines.push(`**Severity:** ${severityIcon} ${sourceDetails.severity}`);
  }

  if (sourceDetails.incidentStatus) {
    const statusIcon = sourceDetails.incidentStatus === 'resolved' ? '\u{2705}' : '\u{1F534}';
    lines.push(`**Status:** ${statusIcon} ${sourceDetails.incidentStatus}`);
  }

  if (sourceDetails.labels && sourceDetails.labels.length > 0) {
    lines.push(`**Labels:** ${sourceDetails.labels.join(', ')}`);
  }

  // Incident description
  if (sourceDetails.description) {
    lines.push('');
    lines.push('### Summary');
    lines.push(sourceDetails.description);
  }

  // Timeline
  if (thread && thread.length > 0) {
    lines.push('');
    lines.push('### Timeline');
    for (const item of thread) {
      lines.push(`**${item.date}:**`);
      lines.push(item.content);
      lines.push('');
    }
  }

  // Responders
  if (people && people.length > 0) {
    lines.push('');
    lines.push('### Responders');
    for (const person of people) {
      let line = `- **${person.name}**`;
      if (person.role) {
        line += ` (${person.role})`;
      }
      lines.push(line);
    }
  }

  // Follow-ups and related items
  if (relatedItems && relatedItems.length > 0) {
    lines.push('');
    lines.push('### Follow-ups & Related');
    for (const item of relatedItems) {
      lines.push(`- [${item.type}] ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get severity icon
 */
function getSeverityIcon(severity: string): string {
  const upper = severity.toUpperCase();
  if (upper === 'SEV0' || upper === 'P0') return '\u{1F6A8}';
  if (upper === 'SEV1' || upper === 'P1') return '\u{1F534}';
  if (upper === 'SEV2' || upper === 'P2') return '\u{1F7E0}';
  if (upper === 'SEV3' || upper === 'P3') return '\u{1F7E1}';
  return '\u{1F7E2}';
}
