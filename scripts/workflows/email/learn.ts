/**
 * Email Classification Learning
 *
 * Track user feedback and suggest new rules based on patterns.
 */

import { existsSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import type {
  TriagedEmail,
  ClassificationFeedback,
  ClassificationRule,
  EmailCategory,
} from './types.js';
import { ClassificationFeedbackSchema } from './types.js';
import {
  getFeedbackLogPath,
  ensureDirectories,
  loadEmailTriageConfig,
  addCustomRule,
} from './config.js';

/**
 * Record classification feedback when user corrects a classification
 */
export function recordFeedback(
  email: TriagedEmail,
  actualCategory: EmailCategory,
  sessionId?: string
): ClassificationFeedback {
  const feedback: ClassificationFeedback = {
    emailId: email.id,
    threadId: email.threadId,
    from: email.from,
    subject: email.subject,
    predictedCategory: email.classification.category,
    predictedConfidence: email.classification.confidence,
    predictedBy: email.classification.classifiedBy,
    ruleId: email.classification.ruleId,
    actualCategory,
    correctedBy: 'user',
    timestamp: new Date().toISOString(),
    sessionId,
  };

  // Append to feedback log
  ensureDirectories();
  const feedbackPath = getFeedbackLogPath();
  appendFileSync(feedbackPath, JSON.stringify(feedback) + '\n');

  return feedback;
}

/**
 * Load all feedback from the log
 */
export function loadFeedback(): ClassificationFeedback[] {
  const feedbackPath = getFeedbackLogPath();

  if (!existsSync(feedbackPath)) {
    return [];
  }

  const content = readFileSync(feedbackPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const feedback: ClassificationFeedback[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      feedback.push(ClassificationFeedbackSchema.parse(parsed));
    } catch {
      // Skip invalid lines
    }
  }

  return feedback;
}

/**
 * Analyze feedback to find patterns for new rules
 */
export function analyzeFeedback(): {
  suggestedRules: ClassificationRule[];
  ruleAccuracy: Map<string, { correct: number; incorrect: number; accuracy: number }>;
  commonCorrections: Map<string, { from: EmailCategory; to: EmailCategory; count: number }[]>;
} {
  const config = loadEmailTriageConfig();
  const feedback = loadFeedback();

  // Group feedback by rule
  const ruleStats = new Map<string, { correct: number; incorrect: number }>();

  // Group by sender domain for pattern detection
  const senderPatterns = new Map<string, Map<EmailCategory, number>>();

  // Track common corrections
  const corrections = new Map<string, Map<string, number>>();

  for (const entry of feedback) {
    const isCorrect = entry.predictedCategory === entry.actualCategory;

    // Track rule accuracy
    if (entry.ruleId) {
      const stats = ruleStats.get(entry.ruleId) || { correct: 0, incorrect: 0 };
      if (isCorrect) {
        stats.correct++;
      } else {
        stats.incorrect++;
      }
      ruleStats.set(entry.ruleId, stats);
    }

    // Track sender patterns
    const domain = entry.from.split('@')[1] || entry.from;
    if (!senderPatterns.has(domain)) {
      senderPatterns.set(domain, new Map());
    }
    const domainCategories = senderPatterns.get(domain)!;
    domainCategories.set(
      entry.actualCategory,
      (domainCategories.get(entry.actualCategory) || 0) + 1
    );

    // Track corrections
    if (!isCorrect) {
      const key = `${entry.predictedCategory}`;
      if (!corrections.has(key)) {
        corrections.set(key, new Map());
      }
      const correctionMap = corrections.get(key)!;
      correctionMap.set(
        entry.actualCategory,
        (correctionMap.get(entry.actualCategory) || 0) + 1
      );
    }
  }

  // Calculate rule accuracy
  const ruleAccuracy = new Map<string, { correct: number; incorrect: number; accuracy: number }>();
  for (const [ruleId, stats] of ruleStats) {
    const total = stats.correct + stats.incorrect;
    const accuracy = total > 0 ? stats.correct / total : 0;
    ruleAccuracy.set(ruleId, { ...stats, accuracy });
  }

  // Find sender patterns that could become rules
  const suggestedRules: ClassificationRule[] = [];
  const minFeedback = config.minFeedbackForSuggestion;

  for (const [domain, categories] of senderPatterns) {
    const total = Array.from(categories.values()).reduce((a, b) => a + b, 0);

    if (total >= minFeedback) {
      // Find dominant category
      let maxCategory: EmailCategory = 'archive';
      let maxCount = 0;

      for (const [category, count] of categories) {
        if (count > maxCount) {
          maxCount = count;
          maxCategory = category;
        }
      }

      // Suggest rule if high consistency
      const consistency = maxCount / total;
      if (consistency >= 0.8) {
        suggestedRules.push({
          id: `suggested-${domain.replace(/[^a-z0-9]/gi, '-')}`,
          name: `Suggested: ${domain} emails`,
          description: `Based on ${total} classifications with ${Math.round(consistency * 100)}% consistency`,
          priority: 55,
          enabled: false,
          conditions: {
            from: [domain],
          },
          category: maxCategory,
          confidence: consistency >= 0.95 ? 'high' : 'medium',
        });
      }
    }
  }

  // Format common corrections
  const commonCorrections = new Map<string, { from: EmailCategory; to: EmailCategory; count: number }[]>();
  for (const [from, toMap] of corrections) {
    const correctionList = Array.from(toMap.entries())
      .map(([to, count]) => ({
        from: from as EmailCategory,
        to: to as EmailCategory,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    commonCorrections.set(from, correctionList);
  }

  return {
    suggestedRules,
    ruleAccuracy,
    commonCorrections,
  };
}

/**
 * Apply a suggested rule (enable it)
 */
export function applySuggestedRule(rule: ClassificationRule): void {
  const enabledRule = { ...rule, enabled: true };
  addCustomRule(enabledRule);
}

/**
 * Get feedback statistics
 */
export function getFeedbackStats(): {
  total: number;
  byPredictedCategory: Record<EmailCategory, number>;
  byActualCategory: Record<EmailCategory, number>;
  correctionRate: number;
  recentFeedback: ClassificationFeedback[];
} {
  const feedback = loadFeedback();

  const stats = {
    total: feedback.length,
    byPredictedCategory: {
      delete: 0,
      archive: 0,
      fyi: 0,
      respond: 0,
      delegate: 0,
      review: 0,
    } as Record<EmailCategory, number>,
    byActualCategory: {
      delete: 0,
      archive: 0,
      fyi: 0,
      respond: 0,
      delegate: 0,
      review: 0,
    } as Record<EmailCategory, number>,
    correctionRate: 0,
    recentFeedback: feedback.slice(-10),
  };

  let corrections = 0;
  for (const entry of feedback) {
    stats.byPredictedCategory[entry.predictedCategory]++;
    stats.byActualCategory[entry.actualCategory]++;

    if (entry.predictedCategory !== entry.actualCategory) {
      corrections++;
    }
  }

  stats.correctionRate = feedback.length > 0 ? corrections / feedback.length : 0;

  return stats;
}

/**
 * Format feedback analysis for display
 */
export function formatFeedbackAnalysis(): string {
  const analysis = analyzeFeedback();
  const stats = getFeedbackStats();
  const lines: string[] = [];

  lines.push(`## Feedback Analysis`);
  lines.push(``);
  lines.push(`**Total Feedback:** ${stats.total}`);
  lines.push(`**Correction Rate:** ${Math.round(stats.correctionRate * 100)}%`);
  lines.push(``);

  // Rule accuracy
  if (analysis.ruleAccuracy.size > 0) {
    lines.push(`### Rule Accuracy`);
    for (const [ruleId, accuracy] of analysis.ruleAccuracy) {
      lines.push(
        `- **${ruleId}:** ${Math.round(accuracy.accuracy * 100)}% (${accuracy.correct}/${accuracy.correct + accuracy.incorrect})`
      );
    }
    lines.push(``);
  }

  // Common corrections
  if (analysis.commonCorrections.size > 0) {
    lines.push(`### Common Corrections`);
    for (const [from, corrections] of analysis.commonCorrections) {
      lines.push(`- From **${from}**:`);
      for (const correction of corrections.slice(0, 3)) {
        lines.push(`  - → ${correction.to}: ${correction.count} times`);
      }
    }
    lines.push(``);
  }

  // Suggested rules
  if (analysis.suggestedRules.length > 0) {
    lines.push(`### Suggested Rules`);
    for (const rule of analysis.suggestedRules) {
      lines.push(`- **${rule.name}**`);
      lines.push(`  - Category: ${rule.category}`);
      lines.push(`  - Confidence: ${rule.confidence}`);
      lines.push(`  - ${rule.description}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}

/**
 * Clear feedback log
 */
export function clearFeedback(): void {
  const feedbackPath = getFeedbackLogPath();
  if (existsSync(feedbackPath)) {
    writeFileSync(feedbackPath, '');
  }
}
