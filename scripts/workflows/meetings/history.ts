/**
 * Previous 1:1 Notes Discovery
 *
 * Find and parse previous 1:1 notes from Notion and Google Docs.
 */

import type { Previous121Note, ActionItemTracking } from './types.js';

/**
 * Find previous 1:1 notes for an attendee
 */
export async function findPrevious121Notes(attendeeEmail: string): Promise<Previous121Note[]> {
  const notes: Previous121Note[] = [];

  // Try to find notes from Notion
  try {
    const notionNotes = await findNotionNotes(attendeeEmail);
    notes.push(...notionNotes);
  } catch {
    // Ignore errors - Notion might not be available
  }

  // Try to find notes from Google Docs
  try {
    const docsNotes = await findGoogleDocsNotes(attendeeEmail);
    notes.push(...docsNotes);
  } catch {
    // Ignore errors - Google Docs might not be available
  }

  // Sort by date, most recent first
  return notes.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Find 1:1 notes in Notion
 */
async function findNotionNotes(_attendeeEmail: string): Promise<Previous121Note[]> {
  // TODO: Implement Notion search for 1:1 notes via MCP
  // Search patterns:
  // - "{name} 1:1"
  // - "1:1 {name}"
  // - "One on one {name}"

  // For now, return empty array
  return [];
}

/**
 * Find 1:1 notes in Google Docs
 */
async function findGoogleDocsNotes(_attendeeEmail: string): Promise<Previous121Note[]> {
  // TODO: Implement Google Docs search for 1:1 notes via MCP
  // Search patterns:
  // - "{name} AND (1:1 OR one on one)"

  // For now, return empty array
  return [];
}

/**
 * Parse action items from note content
 */
export function parseActionItems(
  content: string,
  attendeeEmail: string,
  noteUrl: string,
  noteDate: string
): ActionItemTracking[] {
  const items: ActionItemTracking[] = [];

  // Look for common action item patterns
  const patterns = [
    /- \[ \] (.+)/g,           // Markdown unchecked checkbox
    /- \[x\] (.+)/g,           // Markdown checked checkbox (completed)
    /TODO: (.+)/gi,            // TODO: prefix
    /Action: (.+)/gi,          // Action: prefix
    /AI: (.+)/gi,              // AI: prefix (action item)
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const text = match[1].trim();
      if (text.length > 5) { // Ignore very short items
        const isCompleted = pattern.source.includes('\\[x\\]');

        items.push({
          id: `${noteDate}-${items.length}`,
          text,
          createdAt: noteDate,
          createdIn121With: attendeeEmail,
          source: noteUrl,
          status: isCompleted ? 'completed' : 'open',
          staleAfterDays: 14,
        });
      }
    }
  }

  return items;
}

/**
 * Extract topics from note content
 */
export function extractTopicsFromNote(content: string): string[] {
  const topics: string[] = [];

  // Look for headers
  const headerPattern = /^#+\s*(.+)$/gm;
  let match;
  while ((match = headerPattern.exec(content)) !== null) {
    const topic = match[1].trim();
    if (
      topic.length > 3 &&
      !topic.toLowerCase().includes('action item') &&
      !topic.toLowerCase().includes('follow up')
    ) {
      topics.push(topic);
    }
  }

  // Look for bullet points at the start
  const bulletPattern = /^[-*]\s*\*\*(.+?)\*\*/gm;
  while ((match = bulletPattern.exec(content)) !== null) {
    const topic = match[1].trim();
    if (topic.length > 3) {
      topics.push(topic);
    }
  }

  return [...new Set(topics)].slice(0, 10);
}

/**
 * Get the most recent 1:1 date with an attendee
 */
export async function getLastMeetingDate(attendeeEmail: string): Promise<string | null> {
  const notes = await findPrevious121Notes(attendeeEmail);

  if (notes.length > 0) {
    return notes[0].date;
  }

  return null;
}

/**
 * Format previous notes summary
 */
export function formatPreviousNotesSummary(notes: Previous121Note[]): string {
  if (notes.length === 0) {
    return '*No previous 1:1 notes found*';
  }

  const lines: string[] = [];
  lines.push(`Found ${notes.length} previous 1:1 note(s)\n`);

  // Show summary of most recent notes
  for (const note of notes.slice(0, 3)) {
    lines.push(`### ${note.date}`);
    lines.push(`Source: ${note.source}`);

    if (note.topics.length > 0) {
      lines.push(`Topics: ${note.topics.slice(0, 3).join(', ')}`);
    }

    if (note.actionItems.length > 0) {
      const open = note.actionItems.filter(i => i.status === 'open').length;
      const completed = note.actionItems.filter(i => i.status === 'completed').length;
      lines.push(`Action items: ${open} open, ${completed} completed`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
