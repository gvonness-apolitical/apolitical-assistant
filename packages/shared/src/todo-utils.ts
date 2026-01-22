import { createHash } from 'node:crypto';
import type { Todo, TodoSource } from './types.js';
import { TODO_DEFAULTS, DEDUPLICATION, BRIEFING_DEFAULTS } from './constants.js';

// ==================== PRIORITY CALCULATION ====================

export interface PriorityExplanation {
  effectivePriority: number;
  reasons: string[];
}

/**
 * Calculate effective priority based on deadline proximity and urgency.
 * Lower number = higher priority (1 is most urgent, 5 is least).
 */
export function calculateEffectivePriority(todo: Todo): number {
  // Snoozed TODOs get lowest priority
  if (todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date()) {
    return 5;
  }

  let priority = todo.basePriority ?? todo.priority;
  const targetDate = todo.deadline || todo.dueDate;

  if (targetDate) {
    const daysRemaining = getDaysUntilDate(targetDate);

    if (daysRemaining <= 0) {
      // Overdue - major boost
      priority = Math.max(1, priority - 3);
    } else if (daysRemaining === 1) {
      // Tomorrow
      priority = Math.max(1, priority - 2);
    } else if (daysRemaining <= 3) {
      // Within 3 days
      priority = Math.max(1, priority - 1);
    } else if (daysRemaining <= 7 && todo.deadline) {
      // Within a week (only for hard deadlines)
      priority = Math.max(1, priority - 0.5);
    }
  }

  // Factor in urgency (1=urgent, 5=not urgent)
  if (todo.urgency && todo.urgency <= 2) {
    priority = Math.max(1, priority - (3 - todo.urgency));
  }

  return Math.max(1, Math.min(5, Math.round(priority)));
}

/**
 * Get a human-readable explanation of why a TODO has its current priority.
 */
export function explainPriority(todo: Todo): PriorityExplanation {
  const reasons: string[] = [];
  const effectivePriority = calculateEffectivePriority(todo);
  const basePriority = todo.basePriority ?? todo.priority;

  if (todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date()) {
    reasons.push(`Snoozed until ${formatDate(todo.snoozedUntil)}`);
    return { effectivePriority, reasons };
  }

  const targetDate = todo.deadline || todo.dueDate;
  if (targetDate) {
    const daysRemaining = getDaysUntilDate(targetDate);
    const dateType = todo.deadline ? 'Deadline' : 'Due';

    if (daysRemaining < 0) {
      reasons.push(`${dateType} overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`);
    } else if (daysRemaining === 0) {
      reasons.push(`${dateType} is today`);
    } else if (daysRemaining === 1) {
      reasons.push(`${dateType} is tomorrow`);
    } else if (daysRemaining <= 3) {
      reasons.push(`${dateType} in ${daysRemaining} days`);
    } else if (daysRemaining <= 7) {
      reasons.push(`${dateType} within a week`);
    }
  }

  if (todo.urgency && todo.urgency <= 2) {
    reasons.push(`High urgency (${todo.urgency}/5)`);
  }

  if (effectivePriority !== basePriority) {
    reasons.push(`Originally P${basePriority}`);
  }

  if (reasons.length === 0) {
    reasons.push(`Base priority P${basePriority}`);
  }

  return { effectivePriority, reasons };
}

// ==================== DEDUPLICATION ====================

/**
 * Generate a fingerprint for deduplication based on normalized title.
 */
export function generateFingerprint(title: string): string {
  const normalized = normalizeForFingerprint(title);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Normalize title for fingerprint comparison.
 * - Lowercase
 * - Remove punctuation
 * - Collapse whitespace
 * - Remove common stop words
 */
export function normalizeForFingerprint(title: string): string {
  const stopWords = new Set([
    'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at', 'and', 'or',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'this', 'that', 'these', 'those', 'my', 'your', 'our', 'their',
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .join(' ')
    .trim();
}

/**
 * Calculate similarity between two strings using Levenshtein distance.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeForFingerprint(str1);
  const s2 = normalizeForFingerprint(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * Find potential duplicate TODOs based on fingerprint and fuzzy matching.
 */
export function findDuplicates(
  newTodo: { title: string; sourceId?: string; source?: TodoSource },
  existing: Todo[],
  threshold: number = DEDUPLICATION.FUZZY_THRESHOLD
): Todo[] {
  const newFingerprint = generateFingerprint(newTodo.title);
  const duplicates: Todo[] = [];

  for (const todo of existing) {
    // Skip completed/archived
    if (todo.status === 'completed' || todo.status === 'archived') continue;

    // Check exact fingerprint match
    if (todo.fingerprint === newFingerprint) {
      duplicates.push(todo);
      continue;
    }

    // Check same source ID (same item from same source)
    if (newTodo.sourceId && newTodo.source && todo.sourceId === newTodo.sourceId && todo.source === newTodo.source) {
      duplicates.push(todo);
      continue;
    }

    // Check fuzzy title similarity
    const similarity = calculateSimilarity(newTodo.title, todo.title);
    if (similarity >= threshold) {
      duplicates.push(todo);
    }
  }

  return duplicates;
}

/**
 * Merge duplicate TODOs into a single TODO.
 * Keeps the earliest request date, most urgent deadline, and combines all source URLs.
 */
export function mergeDuplicates(primary: Todo, duplicates: Todo[]): Partial<Todo> {
  const allUrls = new Set<string>();
  if (primary.sourceUrl) allUrls.add(primary.sourceUrl);
  if (primary.sourceUrls) primary.sourceUrls.forEach((url) => allUrls.add(url));

  let earliestRequestDate = primary.requestDate;
  let mostUrgentDeadline = primary.deadline;
  let highestUrgency = primary.urgency ?? 3;
  const allTags = new Set<string>(primary.tags ?? []);

  for (const dup of duplicates) {
    // Collect all source URLs
    if (dup.sourceUrl) allUrls.add(dup.sourceUrl);
    if (dup.sourceUrls) dup.sourceUrls.forEach((url) => allUrls.add(url));

    // Keep earliest request date
    if (dup.requestDate && (!earliestRequestDate || dup.requestDate < earliestRequestDate)) {
      earliestRequestDate = dup.requestDate;
    }

    // Keep most urgent deadline
    if (dup.deadline && (!mostUrgentDeadline || dup.deadline < mostUrgentDeadline)) {
      mostUrgentDeadline = dup.deadline;
    }

    // Keep highest urgency (lower number = more urgent)
    if (dup.urgency && dup.urgency < highestUrgency) {
      highestUrgency = dup.urgency;
    }

    // Combine tags
    if (dup.tags) dup.tags.forEach((tag) => allTags.add(tag));
  }

  return {
    sourceUrls: Array.from(allUrls),
    requestDate: earliestRequestDate,
    deadline: mostUrgentDeadline,
    urgency: highestUrgency,
    tags: allTags.size > 0 ? Array.from(allTags) : undefined,
  };
}

// ==================== DATE HELPERS ====================

/**
 * Get the number of days until a date. Negative if in the past.
 */
export function getDaysUntilDate(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  // Reset time to compare dates only
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format a date string for display.
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get a relative date description (e.g., "today", "tomorrow", "in 3 days").
 */
export function getRelativeDateDescription(dateString: string): string {
  const days = getDaysUntilDate(dateString);

  if (days < 0) {
    const absDays = Math.abs(days);
    return absDays === 1 ? 'yesterday' : `${absDays} days ago`;
  } else if (days === 0) {
    return 'today';
  } else if (days === 1) {
    return 'tomorrow';
  } else if (days <= 7) {
    return `in ${days} days`;
  } else {
    return formatDate(dateString);
  }
}

/**
 * Add days to today's date and return ISO string.
 */
export function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0]!;
}

// ==================== DISPLAY HELPERS ====================

/**
 * Get priority indicator emoji.
 */
export function getPriorityIndicator(priority: number): string {
  switch (priority) {
    case 1:
      return '\u{1F534}'; // Red circle
    case 2:
      return '\u{1F7E0}'; // Orange circle
    case 3:
      return '\u{1F7E1}'; // Yellow circle
    case 4:
      return '\u{1F7E2}'; // Green circle
    case 5:
      return '\u{26AA}'; // White circle
    default:
      return '\u{26AA}';
  }
}

/**
 * Get status indicator.
 */
export function getStatusIndicator(todo: Todo): string {
  if (todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date()) {
    return '\u{1F4A4}'; // ZZZ
  }

  const targetDate = todo.deadline || todo.dueDate;
  if (targetDate) {
    const days = getDaysUntilDate(targetDate);
    if (days < 0) return '\u{26A0}\u{FE0F}'; // Warning - overdue
  }

  switch (todo.status) {
    case 'completed':
      return '\u{2705}'; // Check mark
    case 'in_progress':
      return '\u{1F504}'; // Arrows
    case 'archived':
      return '\u{1F4E6}'; // Package
    default:
      return '\u{2B55}'; // Circle
  }
}

/**
 * Format a TODO for display output.
 */
export function formatTodoForDisplay(todo: Todo, options: { verbose?: boolean } = {}): string {
  const priority = calculateEffectivePriority(todo);
  const indicator = getPriorityIndicator(priority);
  const statusIndicator = getStatusIndicator(todo);

  let output = `${statusIndicator} ${indicator} [P${priority}] ${todo.title}`;
  output += `\n   ID: ${todo.id.slice(0, 8)} | [${todo.source || 'manual'}]`;

  // Add deadline/due date info
  const targetDate = todo.deadline || todo.dueDate;
  if (targetDate) {
    const relative = getRelativeDateDescription(targetDate);
    const dateType = todo.deadline ? 'Deadline' : 'Due';
    output += ` | ${dateType}: ${relative}`;
  }

  // Snooze info
  if (todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date()) {
    output += ` | Snoozed until ${formatDate(todo.snoozedUntil)}`;
  }

  // Verbose mode: show priority explanation
  if (options.verbose) {
    const explanation = explainPriority(todo);
    if (explanation.reasons.length > 0) {
      output += `\n   Why P${priority}: ${explanation.reasons.join(', ')}`;
    }
  }

  // Source URL(s)
  const urls = todo.sourceUrls && todo.sourceUrls.length > 0 ? todo.sourceUrls : todo.sourceUrl ? [todo.sourceUrl] : [];
  if (urls.length === 1) {
    output += `\n   Link: ${urls[0]}`;
  } else if (urls.length > 1) {
    output += `\n   Links: ${urls.join(', ')}`;
  }

  return output;
}

// ==================== STALE DETECTION ====================

/**
 * Check if a TODO is considered stale.
 */
export function isStale(todo: Todo, staleDays: number = TODO_DEFAULTS.STALE_DAYS): boolean {
  // Only pending/in_progress can be stale
  if (todo.status !== 'pending' && todo.status !== 'in_progress') return false;

  // Snoozed items are not stale
  if (todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date()) return false;

  // Check if updated_at is older than staleDays
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);
  return new Date(todo.updatedAt) < cutoff;
}

/**
 * Get the age of a TODO in days since creation.
 */
export function getTodoAgeDays(todo: Todo): number {
  const created = new Date(todo.createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

// ==================== MORNING BRIEFING HELPERS ====================

export interface TodosForBriefing {
  overdue: Todo[];
  dueToday: Todo[];
  highPriority: Todo[];
  stale: Todo[];
}

/**
 * Get TODOs organized for morning briefing.
 */
export function getTodosForBriefing(todos: Todo[], options: { limit?: number; staleDays?: number } = {}): TodosForBriefing {
  const { limit = BRIEFING_DEFAULTS.MAX_TODOS, staleDays = TODO_DEFAULTS.STALE_DAYS } = options;
  const now = new Date();

  // Filter out completed/archived and snoozed
  const activeTodos = todos.filter((t) => {
    if (t.status === 'completed' || t.status === 'archived') return false;
    if (t.snoozedUntil && new Date(t.snoozedUntil) > now) return false;
    return true;
  });

  // Overdue items
  const overdue = activeTodos
    .filter((t) => {
      const targetDate = t.deadline || t.dueDate;
      return targetDate && getDaysUntilDate(targetDate) < 0;
    })
    .slice(0, limit);

  // Due today
  const dueToday = activeTodos
    .filter((t) => {
      const targetDate = t.deadline || t.dueDate;
      return targetDate && getDaysUntilDate(targetDate) === 0;
    })
    .slice(0, limit);

  // High priority (P1 or P2)
  const highPriority = activeTodos
    .filter((t) => calculateEffectivePriority(t) <= 2)
    .filter((t) => !overdue.includes(t) && !dueToday.includes(t))
    .slice(0, limit);

  // Stale items
  const stale = activeTodos.filter((t) => isStale(t, staleDays)).slice(0, limit);

  return { overdue, dueToday, highPriority, stale };
}
