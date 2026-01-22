/**
 * Task Helper Configuration
 *
 * Configuration loading and management for the task helper module.
 */

import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { z } from 'zod';
import {
  getProjectRoot,
  DB_PATH as SHARED_DB_PATH,
  TASK_HELPER_CACHE_DIR,
  CONFIG_DIR,
} from '@apolitical-assistant/shared';
import type { HelperMode, OutputType, ContextDepth } from './types.js';

const PROJECT_ROOT = getProjectRoot();

export const DB_PATH = SHARED_DB_PATH;
export const TASK_HELPER_DIR = join(CONFIG_DIR, 'task-helper');
export const CONFIG_PATH = join(TASK_HELPER_DIR, 'config.json');
export const CACHE_DIR = TASK_HELPER_CACHE_DIR;

/**
 * Context cache TTL by source (in minutes)
 */
export const CONTEXT_CACHE_TTL: Record<string, number> = {
  github: 5,        // PRs can update frequently during review
  linear: 10,       // Issues change less frequently
  email: 30,        // Email threads are more stable
  slack: 5,         // Slack threads can be active
  notion: 30,       // Pages change infrequently
  'meeting-prep': 60, // Meeting context is stable
  calendar: 60,     // Calendar context is stable
  'incident-io': 2, // Incidents need near-real-time
  default: 15,
};

/**
 * Source defaults configuration schema
 */
const SourceDefaultsSchema = z.object({
  preferredMode: z.enum(['respond', 'review', 'summarize', 'schedule', 'research', 'complete', 'delegate', 'custom']).optional(),
  preferredOutput: z.enum(['mcp', 'clipboard', 'file', 'display']).optional(),
});

/**
 * Task helper configuration schema
 */
export const TaskHelperConfigSchema = z.object({
  defaults: z.object({
    mode: z.enum(['respond', 'review', 'summarize', 'schedule', 'research', 'complete', 'delegate', 'custom']).default('respond'),
    outputType: z.enum(['mcp', 'clipboard', 'file', 'display']).default('display'),
    depth: z.enum(['minimal', 'standard', 'comprehensive']).default('standard'),
    options: z.object({
      includeThread: z.boolean().default(true),
      includeRelated: z.boolean().default(true),
      includePeople: z.boolean().default(true),
      includeCalendar: z.boolean().default(false),
      includeWider: z.boolean().default(false),
      maxThreadMessages: z.number().default(20),
      maxRelatedItems: z.number().default(10),
    }).default({}),
  }).default({}),

  sourceDefaults: z.record(SourceDefaultsSchema).default({}),

  cache: z.object({
    enabled: z.boolean().default(true),
    ttlMinutes: z.record(z.number()).default({}),
  }).default({}),

  prompts: z.object({
    tone: z.enum(['professional', 'casual', 'technical']).default('professional'),
    includeSignature: z.boolean().default(false),
    signature: z.string().optional(),
  }).default({}),
});

export type TaskHelperConfig = z.infer<typeof TaskHelperConfigSchema>;

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TaskHelperConfig = {
  defaults: {
    mode: 'respond',
    outputType: 'display',
    depth: 'standard',
    options: {
      includeThread: true,
      includeRelated: true,
      includePeople: true,
      includeCalendar: false,
      includeWider: false,
      maxThreadMessages: 20,
      maxRelatedItems: 10,
    },
  },
  sourceDefaults: {
    github: { preferredMode: 'review', preferredOutput: 'mcp' },
    linear: { preferredMode: 'respond', preferredOutput: 'mcp' },
    email: { preferredMode: 'respond', preferredOutput: 'clipboard' },
    slack: { preferredMode: 'respond', preferredOutput: 'clipboard' },
    notion: { preferredMode: 'summarize', preferredOutput: 'display' },
    'meeting-prep': { preferredMode: 'schedule', preferredOutput: 'display' },
    'incident-io': { preferredMode: 'summarize', preferredOutput: 'display' },
  },
  cache: {
    enabled: true,
    ttlMinutes: {},
  },
  prompts: {
    tone: 'professional',
    includeSignature: false,
  },
};

let cachedConfig: TaskHelperConfig | null = null;

/**
 * Ensure required directories exist
 */
export function ensureDirectories(): void {
  mkdirSync(TASK_HELPER_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Load task helper configuration from file
 */
export function loadConfig(): TaskHelperConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!existsSync(CONFIG_PATH)) {
    // Create default config if it doesn't exist
    ensureDirectories();
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }

  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const result = TaskHelperConfigSchema.safeParse(raw);

    if (!result.success) {
      console.warn('Invalid task helper config, using defaults:', result.error.message);
      cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }

    cachedConfig = result.data;
    return result.data;
  } catch (error) {
    console.warn('Error loading task helper config, using defaults:', error);
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

/**
 * Save task helper configuration to file
 */
export function saveConfig(config: TaskHelperConfig): void {
  ensureDirectories();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  cachedConfig = config;
}

/**
 * Clear the cached configuration
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get the preferred mode for a source
 */
export function getPreferredMode(source: string): HelperMode {
  const config = loadConfig();
  const sourceConfig = config.sourceDefaults[source];
  if (sourceConfig?.preferredMode) {
    return sourceConfig.preferredMode;
  }
  return config.defaults.mode;
}

/**
 * Get the preferred output type for a source
 */
export function getPreferredOutput(source: string): OutputType {
  const config = loadConfig();
  const sourceConfig = config.sourceDefaults[source];
  if (sourceConfig?.preferredOutput) {
    return sourceConfig.preferredOutput;
  }
  return config.defaults.outputType;
}

/**
 * Get the context cache TTL for a source
 */
export function getCacheTTL(source: string): number {
  const config = loadConfig();
  const customTTL = config.cache.ttlMinutes[source];
  if (customTTL !== undefined) {
    return customTTL;
  }
  return CONTEXT_CACHE_TTL[source] ?? CONTEXT_CACHE_TTL.default ?? 15;
}

/**
 * Get the default depth for a mode
 */
export function getDefaultDepth(mode: HelperMode): ContextDepth {
  // Import dynamically to avoid circular dependency
  const depthMap: Record<HelperMode, ContextDepth> = {
    respond: 'standard',
    review: 'comprehensive',
    summarize: 'comprehensive',
    schedule: 'standard',
    research: 'comprehensive',
    complete: 'minimal',
    delegate: 'standard',
    custom: 'comprehensive',
  };
  return depthMap[mode];
}

/**
 * Get all paths used by the module
 */
export function getPaths() {
  return {
    projectRoot: PROJECT_ROOT,
    dbPath: DB_PATH,
    taskHelperDir: TASK_HELPER_DIR,
    configPath: CONFIG_PATH,
    cacheDir: CACHE_DIR,
  };
}
