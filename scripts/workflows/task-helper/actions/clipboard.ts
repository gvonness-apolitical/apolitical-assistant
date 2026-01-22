/**
 * Task Helper - Clipboard Operations
 *
 * Handles copying content to the system clipboard.
 */

import { execSync, exec } from 'node:child_process';
import { platform } from 'node:os';

/**
 * Check if clipboard is available in the current environment
 */
export function isClipboardAvailable(): boolean {
  const os = platform();

  switch (os) {
    case 'darwin':
      // macOS - pbcopy is always available
      return true;

    case 'linux':
      // Linux - check for xclip or xsel
      try {
        execSync('which xclip', { stdio: 'ignore' });
        return true;
      } catch {
        try {
          execSync('which xsel', { stdio: 'ignore' });
          return true;
        } catch {
          // Also check for wl-copy (Wayland)
          try {
            execSync('which wl-copy', { stdio: 'ignore' });
            return true;
          } catch {
            return false;
          }
        }
      }

    case 'win32':
      // Windows - clip.exe is always available
      return true;

    default:
      return false;
  }
}

/**
 * Get the clipboard command for the current platform
 */
function getClipboardCommand(): string | null {
  const os = platform();

  switch (os) {
    case 'darwin':
      return 'pbcopy';

    case 'linux':
      // Try xclip first, then xsel, then wl-copy
      try {
        execSync('which xclip', { stdio: 'ignore' });
        return 'xclip -selection clipboard';
      } catch {
        try {
          execSync('which xsel', { stdio: 'ignore' });
          return 'xsel --clipboard --input';
        } catch {
          try {
            execSync('which wl-copy', { stdio: 'ignore' });
            return 'wl-copy';
          } catch {
            return null;
          }
        }
      }

    case 'win32':
      return 'clip';

    default:
      return null;
  }
}

/**
 * Write content to the system clipboard
 */
export async function writeToClipboard(content: string): Promise<boolean> {
  const command = getClipboardCommand();

  if (!command) {
    return false;
  }

  return new Promise((resolve) => {
    const child = exec(command, (error) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });

    if (child.stdin) {
      child.stdin.write(content);
      child.stdin.end();
    } else {
      resolve(false);
    }
  });
}

/**
 * Write content to clipboard synchronously
 */
export function writeToClipboardSync(content: string): boolean {
  const command = getClipboardCommand();

  if (!command) {
    return false;
  }

  try {
    execSync(command, {
      input: content,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read content from the system clipboard
 */
export async function readFromClipboard(): Promise<string | null> {
  const os = platform();
  let command: string;

  switch (os) {
    case 'darwin':
      command = 'pbpaste';
      break;

    case 'linux':
      try {
        execSync('which xclip', { stdio: 'ignore' });
        command = 'xclip -selection clipboard -o';
      } catch {
        try {
          execSync('which xsel', { stdio: 'ignore' });
          command = 'xsel --clipboard --output';
        } catch {
          try {
            execSync('which wl-paste', { stdio: 'ignore' });
            command = 'wl-paste';
          } catch {
            return null;
          }
        }
      }
      break;

    case 'win32':
      // Windows doesn't have a simple paste command
      command = 'powershell -command "Get-Clipboard"';
      break;

    default:
      return null;
  }

  return new Promise((resolve) => {
    exec(command, (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Format content for clipboard with optional markdown conversion
 */
export function formatForClipboard(
  content: string,
  options: { stripMarkdown?: boolean; addHeader?: string } = {}
): string {
  let formatted = content;

  // Add header if specified
  if (options.addHeader) {
    formatted = `${options.addHeader}\n\n${formatted}`;
  }

  // Strip markdown if requested
  if (options.stripMarkdown) {
    formatted = stripMarkdown(formatted);
  }

  return formatted;
}

/**
 * Basic markdown stripping for plain text contexts
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold
      .replace(/\*\*(.+?)\*\*/g, '$1')
      // Remove italic
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
