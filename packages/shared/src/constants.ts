/**
 * Application Constants
 *
 * Centralized configuration defaults and magic numbers used across the codebase.
 */

/**
 * TODO-related default values
 */
export const TODO_DEFAULTS = {
  /** Days without update before a TODO is flagged as stale */
  STALE_DAYS: 14,
  /** Days after completion before auto-archiving */
  ARCHIVE_AFTER_DAYS: 14,
  /** Default priority level (1=highest, 5=lowest) */
  DEFAULT_PRIORITY: 3,
  /** Default urgency level (1=urgent, 5=not urgent) */
  DEFAULT_URGENCY: 3,
} as const;

/**
 * Deduplication settings
 */
export const DEDUPLICATION = {
  /** Similarity threshold for fuzzy matching (0-1) */
  FUZZY_THRESHOLD: 0.85,
  /** Whether deduplication is enabled by default */
  ENABLED: true,
} as const;

/**
 * Briefing configuration defaults
 */
export const BRIEFING_DEFAULTS = {
  /** Maximum number of TODOs to include in a briefing */
  MAX_TODOS: 5,
  /** Days to look back for completed TODOs */
  COMPLETED_LOOKBACK_DAYS: 7,
  /** Days to look back for recent activity */
  RECENT_ACTIVITY_DAYS: 7,
} as const;

/**
 * Collection settings
 */
export const COLLECTION_DEFAULTS = {
  /** Maximum items to collect per source */
  MAX_ITEMS_PER_SOURCE: 100,
  /** Cache TTL in milliseconds (5 minutes) */
  CACHE_TTL_MS: 5 * 60 * 1000,
  /** Delay between low-rate API calls (ms) */
  LOW_RATE_DELAY_MS: 1000,
} as const;

/**
 * Rate limiting profiles
 */
export const RATE_LIMITS = {
  /** High rate limit concurrency */
  HIGH_CONCURRENCY: 10,
  /** Medium rate limit concurrency */
  MEDIUM_CONCURRENCY: 3,
  /** Low rate limit concurrency */
  LOW_CONCURRENCY: 1,
} as const;

/**
 * Retry settings
 */
export const RETRY_DEFAULTS = {
  /** Maximum number of retry attempts */
  MAX_RETRIES: 3,
  /** Base delay between retries (ms) */
  BASE_DELAY_MS: 1000,
  /** Maximum delay between retries (ms) */
  MAX_DELAY_MS: 30000,
} as const;

/**
 * Display settings
 */
export const DISPLAY_DEFAULTS = {
  /** Default number of items to show in lists */
  DEFAULT_LIMIT: 10,
  /** Maximum items to show per page */
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Summary settings
 */
export const SUMMARY_DEFAULTS = {
  /** Default summary period type */
  DEFAULT_FIDELITY: 'weekly' as const,
} as const;
