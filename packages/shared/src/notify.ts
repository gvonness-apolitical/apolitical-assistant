import { execSync } from 'node:child_process';

export interface NotificationOptions {
  title: string;
  message: string;
  subtitle?: string;
  sound?: 'default' | 'Basso' | 'Blow' | 'Bottle' | 'Frog' | 'Funk' | 'Glass' | 'Hero' | 'Morse' | 'Ping' | 'Pop' | 'Purr' | 'Sosumi' | 'Submarine' | 'Tink';
  open?: string; // URL or file path to open when clicked
}

/**
 * Send a macOS notification using osascript
 */
export function notify(options: NotificationOptions): void {
  const { title, message, subtitle, sound = 'default', open } = options;

  let script = `display notification "${escapeForAppleScript(message)}"`;
  script += ` with title "${escapeForAppleScript(title)}"`;

  if (subtitle) {
    script += ` subtitle "${escapeForAppleScript(subtitle)}"`;
  }

  if (sound) {
    script += ` sound name "${sound}"`;
  }

  try {
    execSync(`osascript -e '${script}'`, { encoding: 'utf-8' });

    // If open URL is provided, open it in a separate command
    if (open) {
      execSync(`open "${open}"`, { encoding: 'utf-8' });
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

/**
 * Show a dialog box with OK/Cancel buttons
 */
export function showDialog(
  message: string,
  title: string = 'Apolitical Assistant'
): boolean {
  const script = `display dialog "${escapeForAppleScript(message)}" with title "${escapeForAppleScript(title)}" buttons {"Cancel", "OK"} default button "OK"`;

  try {
    execSync(`osascript -e '${script}'`, { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Show a dialog box asking for text input
 */
export function promptForInput(
  message: string,
  defaultValue: string = '',
  title: string = 'Apolitical Assistant'
): string | null {
  const script = `display dialog "${escapeForAppleScript(message)}" default answer "${escapeForAppleScript(defaultValue)}" with title "${escapeForAppleScript(title)}" buttons {"Cancel", "OK"} default button "OK"`;

  try {
    const result = execSync(`osascript -e '${script}'`, { encoding: 'utf-8' });
    const match = result.match(/text returned:(.+)/);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Show a list selection dialog
 */
export function showListDialog(
  items: string[],
  prompt: string = 'Select an item:',
  title: string = 'Apolitical Assistant'
): string | null {
  const itemList = items.map((item) => `"${escapeForAppleScript(item)}"`).join(', ');
  const script = `choose from list {${itemList}} with prompt "${escapeForAppleScript(prompt)}" with title "${escapeForAppleScript(title)}"`;

  try {
    const result = execSync(`osascript -e '${script}'`, { encoding: 'utf-8' });
    const selected = result.trim();
    return selected === 'false' ? null : selected;
  } catch {
    return null;
  }
}

/**
 * Send a notification for the morning briefing
 */
export function notifyBriefingReady(briefingPath: string): void {
  notify({
    title: 'Morning Briefing Ready',
    message: 'Your daily briefing has been generated.',
    subtitle: 'Click to open',
    sound: 'default',
    open: briefingPath,
  });
}

/**
 * Send a notification for email cleanup suggestions
 */
export function notifyEmailCleanup(count: number): void {
  notify({
    title: 'Email Cleanup',
    message: `${count} emails suggested for cleanup. Review pending.`,
    sound: 'Ping',
  });
}

/**
 * Send a notification for EOD summary
 */
export function notifyEODSummary(summaryPath: string): void {
  notify({
    title: 'End of Day Summary',
    message: 'Your daily summary has been generated.',
    subtitle: 'Click to open',
    sound: 'default',
    open: summaryPath,
  });
}

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
