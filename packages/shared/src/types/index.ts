/**
 * Shared Types
 *
 * Central export point for all shared types across the application.
 */

// Core types - Todo, Meeting, CommunicationLog, Briefing
export {
  // Schemas (Zod)
  CredentialKeySchema,
  TodoSourceSchema,
  TodoStatusSchema,
  TodoCategorySchema,
  TodoSchema,
  MeetingSchema,
  CommunicationLogSchema,
  // Types
  type CredentialKey,
  type TodoSource,
  type TodoStatus,
  type TodoCategory,
  type Todo,
  type Meeting,
  type CommunicationLog,
  type BriefingData,
  // Constants
  CREDENTIAL_DESCRIPTIONS,
} from './core.js';

// Collector types
export {
  CollectorSourceSchema,
  type CollectorSource,
  type CollectOptions,
  type CollectionResult,
  type CollectorCache,
  type RawTodoItem,
  type TodoCollector,
  type ProcessingStats,
} from './collector.js';
