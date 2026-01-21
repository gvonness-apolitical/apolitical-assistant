import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Todo } from '../types.js';
import {
  calculateEffectivePriority,
  explainPriority,
  generateFingerprint,
  normalizeForFingerprint,
  calculateSimilarity,
  findDuplicates,
  mergeDuplicates,
  getDaysUntilDate,
  formatDate,
  getRelativeDateDescription,
  addDays,
  getPriorityIndicator,
  getStatusIndicator,
  isStale,
  getTodoAgeDays,
  getTodosForBriefing,
} from '../todo-utils.js';

// Helper to create a todo with defaults
function createTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'test-id-123',
    title: 'Test TODO',
    priority: 3,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('todo-utils', () => {
  describe('calculateEffectivePriority', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return base priority for todo without deadline', () => {
      const todo = createTodo({ priority: 3 });
      expect(calculateEffectivePriority(todo)).toBe(3);
    });

    it('should boost priority for overdue items', () => {
      const todo = createTodo({
        priority: 3,
        deadline: '2026-01-20', // Yesterday
      });
      expect(calculateEffectivePriority(todo)).toBe(1); // Boosted significantly
    });

    it('should boost priority for items due tomorrow', () => {
      const todo = createTodo({
        priority: 3,
        deadline: '2026-01-22', // Tomorrow
      });
      expect(calculateEffectivePriority(todo)).toBe(1);
    });

    it('should boost priority for items due within 3 days', () => {
      const todo = createTodo({
        priority: 3,
        deadline: '2026-01-24', // 3 days away
      });
      expect(calculateEffectivePriority(todo)).toBe(2);
    });

    it('should return lowest priority for snoozed items', () => {
      const todo = createTodo({
        priority: 1, // High priority
        snoozedUntil: '2026-01-25', // Snoozed
      });
      expect(calculateEffectivePriority(todo)).toBe(5);
    });

    it('should consider urgency level', () => {
      const todo = createTodo({
        priority: 3,
        urgency: 1, // Very urgent
      });
      expect(calculateEffectivePriority(todo)).toBe(1);
    });

    it('should use basePriority if available', () => {
      const todo = createTodo({
        priority: 2,
        basePriority: 4,
      });
      expect(calculateEffectivePriority(todo)).toBe(4);
    });
  });

  describe('explainPriority', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should explain snoozed items', () => {
      const todo = createTodo({
        snoozedUntil: '2026-01-25',
      });
      const explanation = explainPriority(todo);
      expect(explanation.reasons).toContain('Snoozed until Jan 25');
    });

    it('should explain overdue items', () => {
      const todo = createTodo({
        deadline: '2026-01-15', // 6 days ago
      });
      const explanation = explainPriority(todo);
      expect(explanation.reasons.some((r) => r.includes('overdue'))).toBe(true);
    });

    it('should explain items due today', () => {
      const todo = createTodo({
        deadline: '2026-01-21',
      });
      const explanation = explainPriority(todo);
      expect(explanation.reasons.some((r) => r.includes('today'))).toBe(true);
    });

    it('should explain high urgency', () => {
      const todo = createTodo({
        urgency: 1,
      });
      const explanation = explainPriority(todo);
      expect(explanation.reasons.some((r) => r.includes('urgency'))).toBe(true);
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprints', () => {
      const fp1 = generateFingerprint('Review PR #123');
      const fp2 = generateFingerprint('Review PR #123');
      expect(fp1).toBe(fp2);
    });

    it('should generate same fingerprint for normalized variations', () => {
      const fp1 = generateFingerprint('Review the PR #123');
      const fp2 = generateFingerprint('review pr 123');
      expect(fp1).toBe(fp2);
    });

    it('should generate different fingerprints for different titles', () => {
      const fp1 = generateFingerprint('Review PR #123');
      const fp2 = generateFingerprint('Fix bug in authentication');
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('normalizeForFingerprint', () => {
    it('should lowercase text', () => {
      expect(normalizeForFingerprint('REVIEW CODE')).toBe('review code');
    });

    it('should remove punctuation', () => {
      expect(normalizeForFingerprint('Review PR #123!')).toBe('review pr 123');
    });

    it('should remove stop words', () => {
      expect(normalizeForFingerprint('Review the PR for approval')).toBe('review pr approval');
    });

    it('should collapse whitespace', () => {
      expect(normalizeForFingerprint('Review   code   now')).toBe('review code now');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('Review PR', 'Review PR')).toBe(1);
    });

    it('should return 1 for strings that normalize to the same', () => {
      expect(calculateSimilarity('Review the PR', 'review pr')).toBe(1);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = calculateSimilarity('Review PR #123', 'Review PR #124');
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return low similarity for different strings', () => {
      const similarity = calculateSimilarity('Review PR', 'Fix authentication bug');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle empty strings', () => {
      expect(calculateSimilarity('', 'test')).toBe(0);
      expect(calculateSimilarity('test', '')).toBe(0);
    });
  });

  describe('findDuplicates', () => {
    it('should find exact fingerprint matches', () => {
      const existing: Todo[] = [
        createTodo({
          id: '1',
          title: 'Review PR 123',
          fingerprint: generateFingerprint('Review PR 123'),
        }),
      ];

      const newTodo = { title: 'Review PR 123' };
      const duplicates = findDuplicates(newTodo, existing);
      expect(duplicates).toHaveLength(1);
    });

    it('should find fuzzy matches above threshold', () => {
      const existing: Todo[] = [
        createTodo({
          id: '1',
          title: 'Review PR 123',
        }),
      ];

      const newTodo = { title: 'Review PR 124' };
      const duplicates = findDuplicates(newTodo, existing, 0.8);
      expect(duplicates).toHaveLength(1);
    });

    it('should not find fuzzy matches below threshold', () => {
      const existing: Todo[] = [
        createTodo({
          id: '1',
          title: 'Review PR',
        }),
      ];

      const newTodo = { title: 'Fix authentication bug' };
      const duplicates = findDuplicates(newTodo, existing, 0.85);
      expect(duplicates).toHaveLength(0);
    });

    it('should find same source ID matches', () => {
      const existing: Todo[] = [
        createTodo({
          id: '1',
          title: 'Different title',
          source: 'github',
          sourceId: 'pr-123',
        }),
      ];

      const newTodo = {
        title: 'Another title entirely',
        source: 'github' as const,
        sourceId: 'pr-123',
      };
      const duplicates = findDuplicates(newTodo, existing);
      expect(duplicates).toHaveLength(1);
    });

    it('should skip completed items', () => {
      const existing: Todo[] = [
        createTodo({
          id: '1',
          title: 'Review PR 123',
          status: 'completed',
          fingerprint: generateFingerprint('Review PR 123'),
        }),
      ];

      const newTodo = { title: 'Review PR 123' };
      const duplicates = findDuplicates(newTodo, existing);
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('mergeDuplicates', () => {
    it('should combine source URLs', () => {
      const primary = createTodo({
        sourceUrl: 'https://github.com/pr/1',
      });
      const duplicates = [
        createTodo({
          sourceUrl: 'https://slack.com/msg/1',
        }),
      ];

      const merged = mergeDuplicates(primary, duplicates);
      expect(merged.sourceUrls).toContain('https://github.com/pr/1');
      expect(merged.sourceUrls).toContain('https://slack.com/msg/1');
    });

    it('should keep earliest request date', () => {
      const primary = createTodo({
        requestDate: '2026-01-20',
      });
      const duplicates = [
        createTodo({
          requestDate: '2026-01-15', // Earlier
        }),
      ];

      const merged = mergeDuplicates(primary, duplicates);
      expect(merged.requestDate).toBe('2026-01-15');
    });

    it('should keep most urgent deadline', () => {
      const primary = createTodo({
        deadline: '2026-01-30',
      });
      const duplicates = [
        createTodo({
          deadline: '2026-01-25', // Earlier/more urgent
        }),
      ];

      const merged = mergeDuplicates(primary, duplicates);
      expect(merged.deadline).toBe('2026-01-25');
    });

    it('should keep highest urgency', () => {
      const primary = createTodo({
        urgency: 3,
      });
      const duplicates = [
        createTodo({
          urgency: 1, // More urgent
        }),
      ];

      const merged = mergeDuplicates(primary, duplicates);
      expect(merged.urgency).toBe(1);
    });

    it('should combine tags', () => {
      const primary = createTodo({
        tags: ['urgent'],
      });
      const duplicates = [
        createTodo({
          tags: ['review', 'bug'],
        }),
      ];

      const merged = mergeDuplicates(primary, duplicates);
      expect(merged.tags).toContain('urgent');
      expect(merged.tags).toContain('review');
      expect(merged.tags).toContain('bug');
    });
  });

  describe('getDaysUntilDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return 0 for today', () => {
      expect(getDaysUntilDate('2026-01-21')).toBe(0);
    });

    it('should return 1 for tomorrow', () => {
      expect(getDaysUntilDate('2026-01-22')).toBe(1);
    });

    it('should return negative for past dates', () => {
      expect(getDaysUntilDate('2026-01-20')).toBe(-1);
      expect(getDaysUntilDate('2026-01-15')).toBe(-6);
    });

    it('should return positive for future dates', () => {
      expect(getDaysUntilDate('2026-01-28')).toBe(7);
    });
  });

  describe('formatDate', () => {
    it('should format date without year if same year', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21'));
      const result = formatDate('2026-06-15');
      expect(result).toBe('Jun 15');
      vi.useRealTimers();
    });

    it('should include year if different year', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21'));
      const result = formatDate('2027-06-15');
      expect(result).toBe('Jun 15, 2027');
      vi.useRealTimers();
    });
  });

  describe('getRelativeDateDescription', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "today" for today', () => {
      expect(getRelativeDateDescription('2026-01-21')).toBe('today');
    });

    it('should return "tomorrow" for tomorrow', () => {
      expect(getRelativeDateDescription('2026-01-22')).toBe('tomorrow');
    });

    it('should return "yesterday" for yesterday', () => {
      expect(getRelativeDateDescription('2026-01-20')).toBe('yesterday');
    });

    it('should return "in N days" for dates within a week', () => {
      expect(getRelativeDateDescription('2026-01-24')).toBe('in 3 days');
    });

    it('should return "N days ago" for past dates', () => {
      expect(getRelativeDateDescription('2026-01-18')).toBe('3 days ago');
    });
  });

  describe('addDays', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should add days correctly', () => {
      expect(addDays(1)).toBe('2026-01-22');
      expect(addDays(7)).toBe('2026-01-28');
      expect(addDays(30)).toBe('2026-02-20');
    });

    it('should handle negative days', () => {
      expect(addDays(-1)).toBe('2026-01-20');
    });
  });

  describe('getPriorityIndicator', () => {
    it('should return red circle for P1', () => {
      expect(getPriorityIndicator(1)).toBe('\u{1F534}');
    });

    it('should return orange circle for P2', () => {
      expect(getPriorityIndicator(2)).toBe('\u{1F7E0}');
    });

    it('should return yellow circle for P3', () => {
      expect(getPriorityIndicator(3)).toBe('\u{1F7E1}');
    });

    it('should return green circle for P4', () => {
      expect(getPriorityIndicator(4)).toBe('\u{1F7E2}');
    });

    it('should return white circle for P5', () => {
      expect(getPriorityIndicator(5)).toBe('\u{26AA}');
    });
  });

  describe('getStatusIndicator', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return ZZZ for snoozed items', () => {
      const todo = createTodo({ snoozedUntil: '2026-01-25' });
      expect(getStatusIndicator(todo)).toBe('\u{1F4A4}');
    });

    it('should return warning for overdue items', () => {
      const todo = createTodo({ deadline: '2026-01-20' });
      expect(getStatusIndicator(todo)).toBe('\u{26A0}\u{FE0F}');
    });

    it('should return check for completed items', () => {
      const todo = createTodo({ status: 'completed' });
      expect(getStatusIndicator(todo)).toBe('\u{2705}');
    });

    it('should return arrows for in_progress items', () => {
      const todo = createTodo({ status: 'in_progress' });
      expect(getStatusIndicator(todo)).toBe('\u{1F504}');
    });

    it('should return circle for pending items', () => {
      const todo = createTodo({ status: 'pending' });
      expect(getStatusIndicator(todo)).toBe('\u{2B55}');
    });
  });

  describe('isStale', () => {
    it('should return true for old pending items', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);
      const todo = createTodo({
        status: 'pending',
        updatedAt: oldDate.toISOString(),
      });
      expect(isStale(todo, 14)).toBe(true);
    });

    it('should return false for recent items', () => {
      const todo = createTodo({
        status: 'pending',
        updatedAt: new Date().toISOString(),
      });
      expect(isStale(todo, 14)).toBe(false);
    });

    it('should return false for completed items', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);
      const todo = createTodo({
        status: 'completed',
        updatedAt: oldDate.toISOString(),
      });
      expect(isStale(todo, 14)).toBe(false);
    });

    it('should return false for snoozed items', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const todo = createTodo({
        status: 'pending',
        updatedAt: oldDate.toISOString(),
        snoozedUntil: futureDate.toISOString(),
      });
      expect(isStale(todo, 14)).toBe(false);
    });
  });

  describe('getTodoAgeDays', () => {
    it('should return correct age in days', () => {
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - 10);
      const todo = createTodo({
        createdAt: createdDate.toISOString(),
      });
      expect(getTodoAgeDays(todo)).toBe(10);
    });

    it('should return 0 for items created today', () => {
      const todo = createTodo({
        createdAt: new Date().toISOString(),
      });
      expect(getTodoAgeDays(todo)).toBe(0);
    });
  });

  describe('getTodosForBriefing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-21T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should categorize overdue items', () => {
      const todos: Todo[] = [
        createTodo({
          id: '1',
          title: 'Overdue task',
          deadline: '2026-01-20',
        }),
      ];

      const result = getTodosForBriefing(todos);
      expect(result.overdue).toHaveLength(1);
      expect(result.overdue[0].title).toBe('Overdue task');
    });

    it('should categorize items due today', () => {
      const todos: Todo[] = [
        createTodo({
          id: '1',
          title: 'Due today',
          deadline: '2026-01-21',
        }),
      ];

      const result = getTodosForBriefing(todos);
      expect(result.dueToday).toHaveLength(1);
      expect(result.dueToday[0].title).toBe('Due today');
    });

    it('should categorize high priority items', () => {
      const todos: Todo[] = [
        createTodo({
          id: '1',
          title: 'High priority',
          priority: 1,
        }),
      ];

      const result = getTodosForBriefing(todos);
      expect(result.highPriority).toHaveLength(1);
    });

    it('should categorize stale items', () => {
      const oldDate = new Date('2026-01-01');
      const todos: Todo[] = [
        createTodo({
          id: '1',
          title: 'Stale task',
          updatedAt: oldDate.toISOString(),
        }),
      ];

      const result = getTodosForBriefing(todos, { staleDays: 14 });
      expect(result.stale).toHaveLength(1);
    });

    it('should exclude snoozed items', () => {
      const todos: Todo[] = [
        createTodo({
          id: '1',
          title: 'Snoozed task',
          priority: 1,
          snoozedUntil: '2026-01-25',
        }),
      ];

      const result = getTodosForBriefing(todos);
      expect(result.highPriority).toHaveLength(0);
    });

    it('should exclude completed items', () => {
      const todos: Todo[] = [
        createTodo({
          id: '1',
          title: 'Completed task',
          status: 'completed',
          deadline: '2026-01-20',
        }),
      ];

      const result = getTodosForBriefing(todos);
      expect(result.overdue).toHaveLength(0);
    });

    it('should respect limit option', () => {
      const todos: Todo[] = Array.from({ length: 10 }, (_, i) =>
        createTodo({
          id: `${i}`,
          title: `Task ${i}`,
          deadline: '2026-01-20',
        })
      );

      const result = getTodosForBriefing(todos, { limit: 3 });
      expect(result.overdue).toHaveLength(3);
    });
  });
});
