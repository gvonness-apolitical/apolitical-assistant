/**
 * TODO Collector Types
 *
 * Re-exports collector types from the shared package for backwards compatibility.
 */

// Re-export all collector types from shared package
export type {
  CollectOptions,
  CollectionResult,
  CollectorCache,
  RawTodoItem,
  TodoCollector,
  ProcessingStats,
} from '@apolitical-assistant/shared';

// Re-export core types commonly used by collectors
export type { Todo, TodoSource } from '@apolitical-assistant/shared';
