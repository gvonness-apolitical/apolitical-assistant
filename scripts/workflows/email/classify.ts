/**
 * LLM-Based Email Classification
 *
 * Use Claude to classify emails that don't match any rules.
 */

import type { Email, ClassificationResult, EmailCategory } from './types.js';
import { classifyWithRules } from './rules.js';

/**
 * Classify an email using rules first, then LLM if needed
 */
export async function classifyEmail(email: Email): Promise<ClassificationResult> {
  // Try rules first
  const ruleResult = classifyWithRules(email);
  if (ruleResult) {
    return ruleResult;
  }

  // Fall back to LLM classification
  return classifyWithLLM(email);
}

/**
 * Classify multiple emails
 */
export async function classifyEmails(
  emails: Email[]
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  for (const email of emails) {
    const result = await classifyEmail(email);
    results.set(email.id, result);
  }

  return results;
}

/**
 * Classify an email using LLM
 */
async function classifyWithLLM(email: Email): Promise<ClassificationResult> {
  // TODO: Implement actual LLM call via Claude
  // For now, use heuristics as a fallback

  const category = classifyByHeuristics(email);

  return {
    category,
    confidence: 'low',
    classifiedBy: 'llm',
    reason: 'Classified by heuristics (LLM not yet integrated)',
  };
}

/**
 * Simple heuristic classification when LLM is not available
 */
function classifyByHeuristics(email: Email): EmailCategory {
  const subject = email.subject.toLowerCase();
  const from = email.from.toLowerCase();
  const snippet = email.snippet.toLowerCase();

  // Delete patterns - automated notifications
  const deletePatterns = [
    'noreply@',
    'no-reply@',
    'notifications@',
    'alerts@',
    'builds@',
    'ci@',
    'automated',
    'do not reply',
  ];

  if (deletePatterns.some(p => from.includes(p) || subject.includes(p))) {
    return 'delete';
  }

  // FYI patterns - newsletters, updates
  const fyiPatterns = [
    'newsletter',
    'weekly update',
    'monthly update',
    'digest',
    'summary',
    'roundup',
    'fyi',
    'for your information',
  ];

  if (fyiPatterns.some(p => subject.includes(p) || snippet.includes(p))) {
    return 'fyi';
  }

  // Respond patterns - questions, requests
  const respondPatterns = [
    '?',
    'please review',
    'action required',
    'action needed',
    'need your',
    'could you',
    'can you',
    'would you',
    'request',
    'urgent',
  ];

  if (respondPatterns.some(p => subject.includes(p) || snippet.includes(p))) {
    return 'respond';
  }

  // Review patterns - documents, PRs
  const reviewPatterns = [
    'review request',
    'please review',
    'pr:',
    'pull request',
    'document shared',
    'shared a document',
    'feedback requested',
  ];

  if (reviewPatterns.some(p => subject.includes(p) || snippet.includes(p))) {
    return 'review';
  }

  // Delegate patterns - not addressed to me directly
  // This is harder to detect without knowing the user's email
  // Would need context about the user

  // Default to archive - safe option
  return 'archive';
}

/**
 * Build the LLM prompt for email classification
 */
export function buildClassificationPrompt(email: Email): string {
  return `
Classify this email for a Director of Engineering:

From: ${email.from}
To: ${email.to.join(', ')}
${email.cc?.length ? `CC: ${email.cc.join(', ')}` : ''}
Subject: ${email.subject}
Date: ${email.date}
Labels: ${email.labels.join(', ') || 'None'}
Has Attachment: ${email.hasAttachment}

Preview:
${email.snippet}

${email.body ? `Full Body (truncated):\n${email.body.substring(0, 1000)}` : ''}

---

Classify this email into ONE of these categories:

1. **delete** - Automated alerts, notifications, CI/CD emails that don't need keeping
   Examples: GitHub notifications, build alerts, calendar reminders

2. **archive** - Reference material, useful to keep but no action needed
   Examples: Completed PR notifications, meeting notes shared, announcements

3. **fyi** - Keeping me in the loop, should be summarized but no action needed
   Examples: Team updates, newsletters, CC'd on threads

4. **respond** - Requires my direct response
   Examples: Questions, requests, approvals needed

5. **delegate** - Should be handled by someone else on my team
   Examples: Technical questions for specific team members

6. **review** - Needs my attention/decision but no reply needed
   Examples: Documents to review, RFCs, proposals

Return ONLY a JSON object with this exact format:
{
  "category": "delete" | "archive" | "fyi" | "respond" | "delegate" | "review",
  "confidence": "high" | "medium" | "low",
  "reason": "Brief explanation"
}
`;
}

/**
 * Parse LLM response into classification result
 */
export function parseLLMResponse(response: string): ClassificationResult | null {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate category
    const validCategories = ['delete', 'archive', 'fyi', 'respond', 'delegate', 'review'];
    if (!validCategories.includes(parsed.category)) {
      return null;
    }

    // Validate confidence
    const validConfidences = ['high', 'medium', 'low'];
    if (!validConfidences.includes(parsed.confidence)) {
      parsed.confidence = 'medium';
    }

    return {
      category: parsed.category as EmailCategory,
      confidence: parsed.confidence,
      classifiedBy: 'llm',
      reason: parsed.reason || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get classification statistics for a set of results
 */
export function getClassificationStats(
  results: Map<string, ClassificationResult>
): {
  total: number;
  byCategory: Record<EmailCategory, number>;
  byConfidence: Record<string, number>;
  byMethod: Record<string, number>;
} {
  const stats = {
    total: results.size,
    byCategory: {
      delete: 0,
      archive: 0,
      fyi: 0,
      respond: 0,
      delegate: 0,
      review: 0,
    } as Record<EmailCategory, number>,
    byConfidence: {
      high: 0,
      medium: 0,
      low: 0,
    },
    byMethod: {
      rule: 0,
      llm: 0,
      user: 0,
    },
  };

  for (const result of results.values()) {
    stats.byCategory[result.category]++;
    stats.byConfidence[result.confidence]++;
    stats.byMethod[result.classifiedBy]++;
  }

  return stats;
}
