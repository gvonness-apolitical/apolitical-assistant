/**
 * Email Triage Configuration
 *
 * Configuration management for the email triage module.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  EmailTriageConfigSchema,
  ClassificationRuleSchema,
  type EmailTriageConfig,
  type ClassificationRule,
} from './types.js';
import { getProjectRoot } from '../config/load.js';

const PROJECT_ROOT = getProjectRoot();

/**
 * Get path to email triage config file
 */
export function getConfigPath(): string {
  return join(PROJECT_ROOT, 'email', 'config.json');
}

/**
 * Get path to default rules file
 */
export function getDefaultRulesPath(): string {
  return join(PROJECT_ROOT, 'email', 'rules', 'default.json');
}

/**
 * Get path to custom rules file
 */
export function getCustomRulesPath(): string {
  return join(PROJECT_ROOT, 'email', 'rules', 'custom.json');
}

/**
 * Get path to feedback log file
 */
export function getFeedbackLogPath(): string {
  return join(PROJECT_ROOT, 'email', 'feedback.jsonl');
}

let configCache: EmailTriageConfig | null = null;

/**
 * Load email triage configuration
 */
export function loadEmailTriageConfig(): EmailTriageConfig {
  if (configCache) {
    return configCache;
  }

  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    // Create default config
    const defaultConfig = EmailTriageConfigSchema.parse({});
    ensureDirectories();
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    configCache = defaultConfig;
    return defaultConfig;
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    configCache = EmailTriageConfigSchema.parse(raw);
    return configCache;
  } catch (error) {
    console.error('Error loading email triage config:', error);
    configCache = EmailTriageConfigSchema.parse({});
    return configCache;
  }
}

/**
 * Save email triage configuration
 */
export function saveEmailTriageConfig(config: Partial<EmailTriageConfig>): void {
  const current = loadEmailTriageConfig();
  const updated = { ...current, ...config };
  const validated = EmailTriageConfigSchema.parse(updated);

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

  const rulesDir = join(PROJECT_ROOT, 'email', 'rules');
  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true });
  }
}

let rulesCache: ClassificationRule[] | null = null;

/**
 * Load classification rules (default + custom)
 */
export function loadClassificationRules(): ClassificationRule[] {
  if (rulesCache) {
    return rulesCache;
  }

  const rules: ClassificationRule[] = [];

  // Load default rules
  const defaultRulesPath = getDefaultRulesPath();
  if (existsSync(defaultRulesPath)) {
    try {
      const raw = JSON.parse(readFileSync(defaultRulesPath, 'utf-8'));
      const defaultRules = (raw.rules || []).map((r: unknown) =>
        ClassificationRuleSchema.parse(r)
      );
      rules.push(...defaultRules);
    } catch (error) {
      console.error('Error loading default rules:', error);
    }
  }

  // Load custom rules (higher priority)
  const customRulesPath = getCustomRulesPath();
  if (existsSync(customRulesPath)) {
    try {
      const raw = JSON.parse(readFileSync(customRulesPath, 'utf-8'));
      const customRules = (raw.rules || []).map((r: unknown) =>
        ClassificationRuleSchema.parse(r)
      );
      // Custom rules get higher base priority
      rules.push(
        ...customRules.map((r: ClassificationRule) => ({
          ...r,
          priority: r.priority + 1000,
        }))
      );
    } catch (error) {
      console.error('Error loading custom rules:', error);
    }
  }

  // Sort by priority (descending)
  rules.sort((a, b) => b.priority - a.priority);

  rulesCache = rules;
  return rules;
}

/**
 * Clear rules cache
 */
export function clearRulesCache(): void {
  rulesCache = null;
}

/**
 * Add a custom rule
 */
export function addCustomRule(rule: ClassificationRule): void {
  const customRulesPath = getCustomRulesPath();
  ensureDirectories();

  let existing: { rules: ClassificationRule[] } = { rules: [] };

  if (existsSync(customRulesPath)) {
    try {
      existing = JSON.parse(readFileSync(customRulesPath, 'utf-8'));
    } catch {
      // Start fresh if file is invalid
    }
  }

  // Check for duplicate ID
  const existingIndex = existing.rules.findIndex(r => r.id === rule.id);
  if (existingIndex >= 0) {
    existing.rules[existingIndex] = rule;
  } else {
    existing.rules.push(rule);
  }

  writeFileSync(customRulesPath, JSON.stringify(existing, null, 2));
  clearRulesCache();
}

/**
 * Remove a custom rule
 */
export function removeCustomRule(ruleId: string): boolean {
  const customRulesPath = getCustomRulesPath();

  if (!existsSync(customRulesPath)) {
    return false;
  }

  try {
    const existing = JSON.parse(readFileSync(customRulesPath, 'utf-8'));
    const initialLength = existing.rules?.length || 0;
    existing.rules = (existing.rules || []).filter(
      (r: ClassificationRule) => r.id !== ruleId
    );

    if (existing.rules.length === initialLength) {
      return false; // Rule not found
    }

    writeFileSync(customRulesPath, JSON.stringify(existing, null, 2));
    clearRulesCache();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a rule by ID
 */
export function getRuleById(ruleId: string): ClassificationRule | undefined {
  const rules = loadClassificationRules();
  return rules.find(r => r.id === ruleId);
}

/**
 * Enable/disable a rule
 */
export function toggleRule(ruleId: string, enabled: boolean): boolean {
  const rule = getRuleById(ruleId);
  if (!rule) {
    return false;
  }

  // If it's a default rule, we need to create a custom override
  const customRulesPath = getCustomRulesPath();
  let existing: { rules: ClassificationRule[] } = { rules: [] };

  if (existsSync(customRulesPath)) {
    try {
      existing = JSON.parse(readFileSync(customRulesPath, 'utf-8'));
    } catch {
      // Start fresh
    }
  }

  const existingIndex = existing.rules.findIndex(r => r.id === ruleId);
  if (existingIndex >= 0) {
    existing.rules[existingIndex] = { ...existing.rules[existingIndex], enabled };
  } else {
    existing.rules.push({ ...rule, enabled });
  }

  ensureDirectories();
  writeFileSync(customRulesPath, JSON.stringify(existing, null, 2));
  clearRulesCache();
  return true;
}
