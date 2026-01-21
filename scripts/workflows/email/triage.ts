/**
 * Email Triage Session
 *
 * Manage triage sessions for processing emails.
 */

import { randomUUID } from 'node:crypto';
import type {
  Email,
  TriagedEmail,
  TriageSession,
  ClassificationResult,
  EmailCategory,
} from './types.js';
import { classifyEmail, getClassificationStats } from './classify.js';
import { loadEmailTriageConfig } from './config.js';

/**
 * Create a new triage session
 */
export async function createTriageSession(
  emails: Email[],
  query?: string
): Promise<TriageSession> {
  const sessionId = randomUUID();
  const startedAt = new Date().toISOString();

  // Classify all emails
  const classifications = new Map<string, ClassificationResult>();
  for (const email of emails) {
    const result = await classifyEmail(email);
    classifications.set(email.id, result);
  }

  // Group emails by category
  const groups: TriageSession['groups'] = {
    delete: [],
    archive: [],
    fyi: [],
    respond: [],
    delegate: [],
    review: [],
    uncategorized: [],
  };

  for (const email of emails) {
    const classification = classifications.get(email.id);
    if (!classification) {
      groups.uncategorized.push({
        ...email,
        classification: {
          category: 'archive',
          confidence: 'low',
          classifiedBy: 'llm',
          reason: 'No classification available',
        },
      });
      continue;
    }

    const triagedEmail: TriagedEmail = {
      ...email,
      classification,
    };

    groups[classification.category].push(triagedEmail);
  }

  // Calculate stats
  const classificationStats = getClassificationStats(classifications);

  const session: TriageSession = {
    id: sessionId,
    startedAt,
    query,
    emailCount: emails.length,
    groups,
    stats: {
      total: emails.length,
      byCategory: classificationStats.byCategory,
      byConfidence: classificationStats.byConfidence,
      byMethod: classificationStats.byMethod,
      processed: 0,
      skipped: 0,
    },
  };

  return session;
}

/**
 * Get high-confidence emails from a category
 */
export function getHighConfidenceEmails(
  session: TriageSession,
  category: EmailCategory
): TriagedEmail[] {
  return session.groups[category].filter(
    email => email.classification.confidence === 'high'
  );
}

/**
 * Get emails needing review (medium/low confidence)
 */
export function getEmailsNeedingReview(
  session: TriageSession,
  category: EmailCategory
): TriagedEmail[] {
  return session.groups[category].filter(
    email => email.classification.confidence !== 'high'
  );
}

/**
 * Update email classification in session
 */
export function updateEmailClassification(
  session: TriageSession,
  emailId: string,
  newCategory: EmailCategory
): TriageSession {
  // Find the email in current category
  let email: TriagedEmail | undefined;
  let oldCategory: EmailCategory | 'uncategorized' | undefined;

  for (const [category, emails] of Object.entries(session.groups)) {
    const index = emails.findIndex(e => e.id === emailId);
    if (index >= 0) {
      email = emails[index];
      oldCategory = category as EmailCategory | 'uncategorized';
      emails.splice(index, 1);
      break;
    }
  }

  if (!email || !oldCategory) {
    return session; // Email not found
  }

  // Update classification
  const updatedEmail: TriagedEmail = {
    ...email,
    classification: {
      ...email.classification,
      category: newCategory,
      classifiedBy: 'user',
    },
  };

  // Move to new category
  session.groups[newCategory].push(updatedEmail);

  // Update stats
  if (oldCategory !== 'uncategorized') {
    session.stats.byCategory[oldCategory]--;
  }
  session.stats.byCategory[newCategory]++;

  return session;
}

/**
 * Mark email as processed in session
 */
export function markEmailProcessed(
  session: TriageSession,
  emailId: string,
  actionTaken: TriagedEmail['actionTaken']
): TriageSession {
  for (const emails of Object.values(session.groups)) {
    const email = emails.find(e => e.id === emailId);
    if (email) {
      email.actionTaken = actionTaken;
      session.stats.processed++;
      break;
    }
  }

  return session;
}

/**
 * Mark email as skipped
 */
export function markEmailSkipped(
  session: TriageSession,
  emailId: string
): TriageSession {
  for (const emails of Object.values(session.groups)) {
    const email = emails.find(e => e.id === emailId);
    if (email) {
      email.actionTaken = 'none';
      session.stats.skipped++;
      break;
    }
  }

  return session;
}

/**
 * Complete a triage session
 */
export function completeSession(session: TriageSession): TriageSession {
  return {
    ...session,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Get session summary
 */
export function getSessionSummary(session: TriageSession): string {
  const lines: string[] = [];
  const _config = loadEmailTriageConfig();

  lines.push(`## Email Triage Summary`);
  lines.push(``);
  lines.push(`**Session:** ${session.id}`);
  lines.push(`**Started:** ${new Date(session.startedAt).toLocaleString()}`);
  if (session.completedAt) {
    lines.push(`**Completed:** ${new Date(session.completedAt).toLocaleString()}`);
  }
  lines.push(``);

  lines.push(`### Overview`);
  lines.push(`- **Total emails:** ${session.emailCount}`);
  lines.push(`- **Processed:** ${session.stats.processed}`);
  lines.push(`- **Skipped:** ${session.stats.skipped}`);
  lines.push(``);

  lines.push(`### By Category`);
  for (const [category, count] of Object.entries(session.stats.byCategory)) {
    if (count > 0) {
      lines.push(`- **${category}:** ${count}`);
    }
  }
  lines.push(``);

  lines.push(`### By Confidence`);
  for (const [confidence, count] of Object.entries(session.stats.byConfidence)) {
    if (count > 0) {
      lines.push(`- **${confidence}:** ${count}`);
    }
  }
  lines.push(``);

  lines.push(`### By Classification Method`);
  for (const [method, count] of Object.entries(session.stats.byMethod)) {
    if (count > 0) {
      lines.push(`- **${method}:** ${count}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get action recommendations for a session
 */
export function getActionRecommendations(session: TriageSession): {
  autoDelete: TriagedEmail[];
  autoArchive: TriagedEmail[];
  createTodos: TriagedEmail[];
  needsReview: TriagedEmail[];
} {
  const config = loadEmailTriageConfig();

  return {
    autoDelete: config.autoDeleteHighConfidence
      ? getHighConfidenceEmails(session, 'delete')
      : [],
    autoArchive: config.autoArchiveHighConfidence
      ? getHighConfidenceEmails(session, 'archive')
      : [],
    createTodos: config.categorySettings.respond.createTodos
      ? session.groups.respond
      : [],
    needsReview: [
      ...getEmailsNeedingReview(session, 'delete'),
      ...getEmailsNeedingReview(session, 'archive'),
      ...getEmailsNeedingReview(session, 'respond'),
      ...getEmailsNeedingReview(session, 'delegate'),
      ...session.groups.uncategorized,
    ],
  };
}

/**
 * Format session for display
 */
export function formatSessionForDisplay(session: TriageSession): string {
  const lines: string[] = [];

  lines.push(`=== Email Triage Session ===`);
  lines.push(`Found ${session.emailCount} emails`);
  lines.push(``);

  const categoryOrder: EmailCategory[] = ['delete', 'archive', 'fyi', 'respond', 'delegate', 'review'];

  for (const category of categoryOrder) {
    const emails = session.groups[category];
    if (emails.length === 0) continue;

    const highConfidence = emails.filter(e => e.classification.confidence === 'high');
    const other = emails.filter(e => e.classification.confidence !== 'high');

    lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)} (${emails.length} emails)`);

    if (highConfidence.length > 0) {
      lines.push(`  High confidence: ${highConfidence.length}`);
    }
    if (other.length > 0) {
      lines.push(`  Needs review: ${other.length}`);
    }

    // Show first few emails
    for (const email of emails.slice(0, 3)) {
      const confidence = email.classification.confidence;
      lines.push(`    [${confidence}] ${email.subject.substring(0, 50)}...`);
      lines.push(`      From: ${email.from}`);
    }

    if (emails.length > 3) {
      lines.push(`    ... and ${emails.length - 3} more`);
    }

    lines.push(``);
  }

  if (session.groups.uncategorized.length > 0) {
    lines.push(`## Uncategorized (${session.groups.uncategorized.length} emails)`);
    for (const email of session.groups.uncategorized.slice(0, 3)) {
      lines.push(`    ${email.subject.substring(0, 50)}...`);
      lines.push(`      From: ${email.from}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}
