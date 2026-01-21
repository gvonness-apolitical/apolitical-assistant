/**
 * Notification Utilities
 *
 * Cross-module notification utilities for alerts and reminders.
 */

import { execSync } from 'node:child_process';

/**
 * Notification options
 */
export interface NotificationOptions {
  title: string;
  message: string;
  subtitle?: string;
  sound?: boolean;
  open?: string; // URL to open when clicked
}

/**
 * Send a macOS notification
 */
export function sendNotification(options: NotificationOptions): void {
  const { title, message, subtitle, sound, open } = options;

  // Build AppleScript
  let script = `display notification "${escapeAppleScript(message)}"`;
  script += ` with title "${escapeAppleScript(title)}"`;

  if (subtitle) {
    script += ` subtitle "${escapeAppleScript(subtitle)}"`;
  }

  if (sound) {
    script += ' sound name "default"';
  }

  try {
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });

    // Open URL if specified (separate action)
    if (open) {
      execSync(`open "${open}"`, { stdio: 'ignore' });
    }
  } catch {
    // Silently fail - notifications are best-effort
  }
}

/**
 * Escape string for AppleScript
 */
function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Priority-based notification
 */
export function notifyByPriority(
  priority: 'P0' | 'P1' | 'P2' | 'P3',
  title: string,
  message: string,
  options?: { open?: string }
): void {
  const priorityConfig = {
    P0: { prefix: '🚨 CRITICAL', sound: true },
    P1: { prefix: '⚠️ HIGH', sound: true },
    P2: { prefix: '📋', sound: false },
    P3: { prefix: '📝', sound: false },
  };

  const config = priorityConfig[priority];

  sendNotification({
    title: `${config.prefix} ${title}`,
    message,
    sound: config.sound,
    open: options?.open,
  });
}

/**
 * Send a briefing notification
 */
export function notifyBriefingReady(type: 'morning' | 'eod' | 'weekly', path: string): void {
  const titles = {
    morning: '☀️ Morning Briefing Ready',
    eod: '🌙 End of Day Summary Ready',
    weekly: '📊 Weekly Review Ready',
  };

  sendNotification({
    title: titles[type],
    message: `Your ${type} briefing has been generated.`,
    subtitle: 'Click to view',
    sound: false,
    open: `file://${path}`,
  });
}

/**
 * Send a todo deadline notification
 */
export function notifyTodoDeadline(
  todoTitle: string,
  daysUntil: number,
  options?: { url?: string }
): void {
  let title: string;
  let sound: boolean;

  if (daysUntil < 0) {
    title = `⏰ Overdue: ${todoTitle}`;
    sound = true;
  } else if (daysUntil === 0) {
    title = `⏰ Due Today: ${todoTitle}`;
    sound = true;
  } else if (daysUntil === 1) {
    title = `📅 Due Tomorrow: ${todoTitle}`;
    sound = false;
  } else {
    title = `📅 Due in ${daysUntil} days: ${todoTitle}`;
    sound = false;
  }

  sendNotification({
    title,
    message: todoTitle,
    sound,
    open: options?.url,
  });
}

/**
 * Send an incident notification
 */
export function notifyIncident(
  severity: string,
  title: string,
  options?: { url?: string }
): void {
  const isCritical = severity.toLowerCase().includes('sev1') || severity.toLowerCase().includes('critical');

  sendNotification({
    title: `${isCritical ? '🚨' : '⚠️'} Incident: ${severity}`,
    message: title,
    sound: isCritical,
    open: options?.url,
  });
}

/**
 * Send a collection complete notification
 */
export function notifyCollectionComplete(
  totalItems: number,
  newItems: number,
  errors: number
): void {
  let message = `Collected ${totalItems} items`;
  if (newItems > 0) {
    message += ` (${newItems} new)`;
  }
  if (errors > 0) {
    message += ` with ${errors} errors`;
  }

  sendNotification({
    title: '✅ Collection Complete',
    message,
    sound: false,
  });
}
