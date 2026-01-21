/**
 * Classification Rules Engine
 *
 * Rule-based email classification using pattern matching.
 */

import type {
  Email,
  ClassificationRule,
  ClassificationResult,
  RuleConditions,
} from './types.js';
import { loadClassificationRules } from './config.js';

/**
 * Classify an email using rules
 * Returns null if no rule matches
 */
export function classifyWithRules(email: Email): ClassificationResult | null {
  const rules = loadClassificationRules();

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    if (matchesRule(email, rule)) {
      return {
        category: rule.category,
        confidence: rule.confidence,
        classifiedBy: 'rule',
        ruleId: rule.id,
        reason: rule.name,
      };
    }
  }

  return null;
}

/**
 * Check if an email matches a rule's conditions
 */
function matchesRule(email: Email, rule: ClassificationRule): boolean {
  const conditions = rule.conditions;

  // All specified conditions must match (AND logic)
  if (conditions.from && !matchesPatterns(email.from, conditions.from)) {
    return false;
  }

  if (conditions.to && !matchesAnyPattern(email.to, conditions.to)) {
    return false;
  }

  if (conditions.cc && email.cc && !matchesAnyPattern(email.cc, conditions.cc)) {
    return false;
  }

  if (conditions.subject && !matchesPatterns(email.subject, conditions.subject)) {
    return false;
  }

  if (conditions.body && email.body && !matchesPatterns(email.body, conditions.body)) {
    return false;
  }

  if (conditions.labels && !hasAnyLabel(email.labels, conditions.labels)) {
    return false;
  }

  if (conditions.hasAttachment !== undefined && email.hasAttachment !== conditions.hasAttachment) {
    return false;
  }

  if (conditions.isUnread !== undefined && !email.isRead !== conditions.isUnread) {
    return false;
  }

  // All conditions matched
  return true;
}

/**
 * Check if a string matches any of the patterns
 */
function matchesPatterns(text: string, patterns: string[]): boolean {
  const lowerText = text.toLowerCase();

  return patterns.some(pattern => {
    try {
      // Try as regex first
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    } catch {
      // Fall back to substring match
      return lowerText.includes(pattern.toLowerCase());
    }
  });
}

/**
 * Check if any string in array matches any pattern
 */
function matchesAnyPattern(texts: string[], patterns: string[]): boolean {
  return texts.some(text => matchesPatterns(text, patterns));
}

/**
 * Check if email has any of the specified labels
 */
function hasAnyLabel(emailLabels: string[], requiredLabels: string[]): boolean {
  const normalizedEmailLabels = emailLabels.map(l => l.toLowerCase());
  return requiredLabels.some(label =>
    normalizedEmailLabels.includes(label.toLowerCase())
  );
}

/**
 * Get all rules that would match an email
 */
export function getMatchingRules(email: Email): ClassificationRule[] {
  const rules = loadClassificationRules();
  return rules.filter(rule => rule.enabled && matchesRule(email, rule));
}

/**
 * Test a rule against an email without applying it
 */
export function testRule(
  email: Email,
  rule: ClassificationRule
): { matches: boolean; matchedConditions: string[] } {
  const matchedConditions: string[] = [];
  const conditions = rule.conditions;

  if (conditions.from) {
    if (matchesPatterns(email.from, conditions.from)) {
      matchedConditions.push(`from: ${email.from}`);
    }
  }

  if (conditions.to) {
    if (matchesAnyPattern(email.to, conditions.to)) {
      matchedConditions.push(`to: ${email.to.join(', ')}`);
    }
  }

  if (conditions.subject) {
    if (matchesPatterns(email.subject, conditions.subject)) {
      matchedConditions.push(`subject: ${email.subject.substring(0, 50)}`);
    }
  }

  if (conditions.labels) {
    if (hasAnyLabel(email.labels, conditions.labels)) {
      matchedConditions.push(`labels: ${email.labels.join(', ')}`);
    }
  }

  if (conditions.hasAttachment !== undefined) {
    if (email.hasAttachment === conditions.hasAttachment) {
      matchedConditions.push(`hasAttachment: ${email.hasAttachment}`);
    }
  }

  const matches = matchesRule(email, rule);
  return { matches, matchedConditions };
}

/**
 * Explain why an email was classified a certain way
 */
export function explainClassification(
  email: Email,
  result: ClassificationResult
): string {
  if (result.classifiedBy === 'rule' && result.ruleId) {
    const rules = loadClassificationRules();
    const rule = rules.find(r => r.id === result.ruleId);

    if (rule) {
      const { matchedConditions } = testRule(email, rule);
      return [
        `Rule: ${rule.name}`,
        `Category: ${result.category}`,
        `Confidence: ${result.confidence}`,
        `Matched conditions:`,
        ...matchedConditions.map(c => `  - ${c}`),
      ].join('\n');
    }
  }

  if (result.classifiedBy === 'llm') {
    return [
      `Classified by AI`,
      `Category: ${result.category}`,
      `Confidence: ${result.confidence}`,
      result.reason ? `Reason: ${result.reason}` : '',
    ].filter(Boolean).join('\n');
  }

  if (result.classifiedBy === 'user') {
    return `Manually classified as ${result.category}`;
  }

  return `Unknown classification method`;
}

/**
 * Suggest a new rule based on an email
 */
export function suggestRule(
  email: Email,
  category: ClassificationResult['category']
): ClassificationRule {
  // Extract patterns from the email
  const fromDomain = email.from.split('@')[1] || email.from;
  const subjectPrefix = email.subject.split(/[\s:]/)[0];

  return {
    id: `suggested-${Date.now()}`,
    name: `Auto-suggested: ${email.from.split('@')[0]} emails`,
    description: `Suggested based on email from ${email.from}`,
    priority: 60,  // Medium-high priority
    enabled: false,  // Disabled by default until confirmed
    conditions: {
      from: [fromDomain],
      subject: subjectPrefix.length > 3 ? [subjectPrefix] : undefined,
    },
    category,
    confidence: 'medium',
  };
}

/**
 * Validate a rule's conditions
 */
export function validateRuleConditions(conditions: RuleConditions): string[] {
  const errors: string[] = [];

  // Check that at least one condition is specified
  const hasCondition =
    conditions.from ||
    conditions.to ||
    conditions.cc ||
    conditions.subject ||
    conditions.body ||
    conditions.labels ||
    conditions.hasAttachment !== undefined ||
    conditions.isUnread !== undefined;

  if (!hasCondition) {
    errors.push('At least one condition must be specified');
  }

  // Validate regex patterns
  const patternFields = ['from', 'to', 'cc', 'subject', 'body'] as const;
  for (const field of patternFields) {
    const patterns = conditions[field];
    if (patterns) {
      for (const pattern of patterns) {
        try {
          new RegExp(pattern);
        } catch {
          errors.push(`Invalid regex in ${field}: ${pattern}`);
        }
      }
    }
  }

  return errors;
}
