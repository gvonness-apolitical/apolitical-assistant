/**
 * Meeting Configuration
 *
 * Configuration management for the meetings module.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { MeetingConfigSchema, type MeetingConfig } from './types.js';
import { getProjectRoot } from '../config/load.js';

const PROJECT_ROOT = getProjectRoot();

/**
 * Get path to meetings config file
 */
export function getConfigPath(): string {
  return join(PROJECT_ROOT, 'meetings', 'config.json');
}

/**
 * Get path to meetings output directory
 */
export function getOutputPath(subdir?: 'agendas' | 'one-on-ones'): string {
  const config = loadMeetingConfig();
  const basePath = join(PROJECT_ROOT, config.outputPath);

  if (subdir) {
    return join(basePath, subdir);
  }

  return basePath;
}

/**
 * Get path for a specific meeting prep file
 */
export function getMeetingPrepPath(date: string, eventId: string): string {
  return join(getOutputPath('agendas'), `${date}-${eventId.slice(0, 8)}.md`);
}

/**
 * Get path for a 1:1 prep file
 */
export function get121PrepPath(date: string, attendeeEmail: string): string {
  const safeEmail = attendeeEmail.replace(/@/g, '_at_').replace(/\./g, '_');
  return join(getOutputPath('one-on-ones'), `${date}-${safeEmail}.md`);
}

let configCache: MeetingConfig | null = null;

/**
 * Load meeting configuration
 */
export function loadMeetingConfig(): MeetingConfig {
  if (configCache) {
    return configCache;
  }

  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    // Create default config
    const defaultConfig = MeetingConfigSchema.parse({});
    ensureDirectories();
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    configCache = defaultConfig;
    return defaultConfig;
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    configCache = MeetingConfigSchema.parse(raw);
    return configCache;
  } catch (error) {
    console.error('Error loading meeting config:', error);
    configCache = MeetingConfigSchema.parse({});
    return configCache;
  }
}

/**
 * Save meeting configuration
 */
export function saveMeetingConfig(config: Partial<MeetingConfig>): void {
  const current = loadMeetingConfig();
  const updated = { ...current, ...config };
  const validated = MeetingConfigSchema.parse(updated);

  const configPath = getConfigPath();
  ensureDirectories();
  writeFileSync(configPath, JSON.stringify(validated, null, 2));
  configCache = validated;
}

/**
 * Clear config cache
 */
export function clearConfigCache(): void {
  configCache = null;
}

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const agendasDir = getOutputPath('agendas');
  if (!existsSync(agendasDir)) {
    mkdirSync(agendasDir, { recursive: true });
  }

  const oneOnOnesDir = getOutputPath('one-on-ones');
  if (!existsSync(oneOnOnesDir)) {
    mkdirSync(oneOnOnesDir, { recursive: true });
  }
}

/**
 * Check if meeting prep exists
 */
export function meetingPrepExists(date: string, eventId: string): boolean {
  return existsSync(getMeetingPrepPath(date, eventId));
}

/**
 * Check if 1:1 prep exists
 */
export function oneOnOnePrepExists(date: string, attendeeEmail: string): boolean {
  return existsSync(get121PrepPath(date, attendeeEmail));
}
