/**
 * Notification Utility Tests
 *
 * Tests the macOS notification functions using osascript.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'node:child_process';
import {
  notify,
  showDialog,
  promptForInput,
  showListDialog,
  notifyBriefingReady,
  notifyEmailCleanup,
  notifyEODSummary,
} from '../notify.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('notify()', () => {
    it('sends a basic notification', () => {
      notify({
        title: 'Test Title',
        message: 'Test message',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('display notification "Test message"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "Test Title"'),
        { encoding: 'utf-8' }
      );
    });

    it('includes subtitle when provided', () => {
      notify({
        title: 'Test Title',
        message: 'Test message',
        subtitle: 'Test subtitle',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('subtitle "Test subtitle"'),
        { encoding: 'utf-8' }
      );
    });

    it('includes default sound', () => {
      notify({
        title: 'Test Title',
        message: 'Test message',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('sound name "default"'),
        { encoding: 'utf-8' }
      );
    });

    it('uses custom sound when specified', () => {
      notify({
        title: 'Test Title',
        message: 'Test message',
        sound: 'Ping',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('sound name "Ping"'),
        { encoding: 'utf-8' }
      );
    });

    it('opens URL when provided', () => {
      notify({
        title: 'Test Title',
        message: 'Test message',
        open: 'https://example.com',
      });

      expect(mockExecSync).toHaveBeenCalledTimes(2);
      expect(mockExecSync).toHaveBeenCalledWith(
        'open "https://example.com"',
        { encoding: 'utf-8' }
      );
    });

    it('opens file path when provided', () => {
      notify({
        title: 'Test Title',
        message: 'Test message',
        open: '/path/to/file.md',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        'open "/path/to/file.md"',
        { encoding: 'utf-8' }
      );
    });

    it('escapes special characters in message', () => {
      notify({
        title: 'Test Title',
        message: 'Message with "quotes" and \\backslashes\\',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('Message with \\"quotes\\" and \\\\backslashes\\\\'),
        { encoding: 'utf-8' }
      );
    });

    it('escapes special characters in title', () => {
      notify({
        title: 'Title with "quotes"',
        message: 'Test message',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "Title with \\"quotes\\""'),
        { encoding: 'utf-8' }
      );
    });

    it('escapes special characters in subtitle', () => {
      notify({
        title: 'Test Title',
        message: 'Test message',
        subtitle: 'Subtitle with "quotes"',
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('subtitle "Subtitle with \\"quotes\\""'),
        { encoding: 'utf-8' }
      );
    });

    it('handles errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecSync.mockImplementation(() => {
        throw new Error('osascript error');
      });

      // Should not throw
      notify({
        title: 'Test Title',
        message: 'Test message',
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to send notification:', expect.any(Error));
    });
  });

  describe('showDialog()', () => {
    it('shows a dialog with message and default title', () => {
      mockExecSync.mockReturnValue('button returned:OK');

      const result = showDialog('Are you sure?');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('display dialog "Are you sure?"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "Apolitical Assistant"'),
        { encoding: 'utf-8' }
      );
    });

    it('uses custom title when provided', () => {
      mockExecSync.mockReturnValue('button returned:OK');

      showDialog('Are you sure?', 'Custom Title');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "Custom Title"'),
        { encoding: 'utf-8' }
      );
    });

    it('returns true when user clicks OK', () => {
      mockExecSync.mockReturnValue('button returned:OK');

      const result = showDialog('Are you sure?');

      expect(result).toBe(true);
    });

    it('returns false when user clicks Cancel', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('User canceled');
      });

      const result = showDialog('Are you sure?');

      expect(result).toBe(false);
    });

    it('includes OK and Cancel buttons', () => {
      mockExecSync.mockReturnValue('button returned:OK');

      showDialog('Are you sure?');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('buttons {"Cancel", "OK"}'),
        { encoding: 'utf-8' }
      );
    });

    it('escapes special characters', () => {
      mockExecSync.mockReturnValue('button returned:OK');

      showDialog('Delete "file.txt"?', 'Confirm "Delete"');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('Delete \\"file.txt\\"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('Confirm \\"Delete\\"'),
        { encoding: 'utf-8' }
      );
    });
  });

  describe('promptForInput()', () => {
    it('shows a prompt with default values', () => {
      mockExecSync.mockReturnValue('button returned:OK, text returned:user input');

      const result = promptForInput('Enter your name:');

      expect(result).toBe('user input');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('display dialog "Enter your name:"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('default answer ""'),
        { encoding: 'utf-8' }
      );
    });

    it('uses custom default value', () => {
      mockExecSync.mockReturnValue('button returned:OK, text returned:new value');

      promptForInput('Enter your name:', 'Default Name');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('default answer "Default Name"'),
        { encoding: 'utf-8' }
      );
    });

    it('uses custom title', () => {
      mockExecSync.mockReturnValue('button returned:OK, text returned:value');

      promptForInput('Enter your name:', '', 'Custom Title');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "Custom Title"'),
        { encoding: 'utf-8' }
      );
    });

    it('returns null when user cancels', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('User canceled');
      });

      const result = promptForInput('Enter your name:');

      expect(result).toBeNull();
    });

    it('returns null when no text returned', () => {
      mockExecSync.mockReturnValue('button returned:OK');

      const result = promptForInput('Enter your name:');

      expect(result).toBeNull();
    });

    it('trims the returned value', () => {
      mockExecSync.mockReturnValue('button returned:OK, text returned:  trimmed value  ');

      const result = promptForInput('Enter your name:');

      expect(result).toBe('trimmed value');
    });

    it('escapes special characters', () => {
      mockExecSync.mockReturnValue('button returned:OK, text returned:result');

      promptForInput('Enter "value":', 'default "value"', 'Title "quoted"');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('Enter \\"value\\"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('default \\"value\\"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('Title \\"quoted\\"'),
        { encoding: 'utf-8' }
      );
    });
  });

  describe('showListDialog()', () => {
    it('shows a list dialog with items', () => {
      mockExecSync.mockReturnValue('Item 1\n');

      const result = showListDialog(['Item 1', 'Item 2', 'Item 3']);

      expect(result).toBe('Item 1');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('choose from list {"Item 1", "Item 2", "Item 3"}'),
        { encoding: 'utf-8' }
      );
    });

    it('uses default prompt', () => {
      mockExecSync.mockReturnValue('Item\n');

      showListDialog(['Item']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with prompt "Select an item:"'),
        { encoding: 'utf-8' }
      );
    });

    it('uses custom prompt', () => {
      mockExecSync.mockReturnValue('Item\n');

      showListDialog(['Item'], 'Choose wisely:');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with prompt "Choose wisely:"'),
        { encoding: 'utf-8' }
      );
    });

    it('uses custom title', () => {
      mockExecSync.mockReturnValue('Item\n');

      showListDialog(['Item'], 'Select:', 'Custom Title');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "Custom Title"'),
        { encoding: 'utf-8' }
      );
    });

    it('returns null when user cancels (returns false)', () => {
      mockExecSync.mockReturnValue('false\n');

      const result = showListDialog(['Item 1', 'Item 2']);

      expect(result).toBeNull();
    });

    it('returns null on error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('User canceled');
      });

      const result = showListDialog(['Item 1', 'Item 2']);

      expect(result).toBeNull();
    });

    it('trims the selected value', () => {
      mockExecSync.mockReturnValue('  Selected Item  \n');

      const result = showListDialog(['Selected Item']);

      expect(result).toBe('Selected Item');
    });

    it('escapes special characters in items', () => {
      mockExecSync.mockReturnValue('Item\n');

      showListDialog(['Item "A"', 'Item "B"']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('"Item \\"A\\""'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('"Item \\"B\\""'),
        { encoding: 'utf-8' }
      );
    });
  });

  describe('notifyBriefingReady()', () => {
    it('sends notification with correct parameters', () => {
      notifyBriefingReady('/path/to/briefing.md');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "Morning Briefing Ready"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('display notification "Your daily briefing has been generated."'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('subtitle "Click to open"'),
        { encoding: 'utf-8' }
      );
    });

    it('opens the briefing file', () => {
      notifyBriefingReady('/path/to/briefing.md');

      expect(mockExecSync).toHaveBeenCalledWith(
        'open "/path/to/briefing.md"',
        { encoding: 'utf-8' }
      );
    });
  });

  describe('notifyEmailCleanup()', () => {
    it('sends notification with correct count', () => {
      notifyEmailCleanup(15);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "Email Cleanup"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('display notification "15 emails suggested for cleanup. Review pending."'),
        { encoding: 'utf-8' }
      );
    });

    it('uses Ping sound', () => {
      notifyEmailCleanup(5);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('sound name "Ping"'),
        { encoding: 'utf-8' }
      );
    });

    it('does not open any URL', () => {
      notifyEmailCleanup(10);

      // Should only be called once (for notification), not twice (no open command)
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifyEODSummary()', () => {
    it('sends notification with correct parameters', () => {
      notifyEODSummary('/path/to/summary.md');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('with title "End of Day Summary"'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('display notification "Your daily summary has been generated."'),
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('subtitle "Click to open"'),
        { encoding: 'utf-8' }
      );
    });

    it('opens the summary file', () => {
      notifyEODSummary('/path/to/summary.md');

      expect(mockExecSync).toHaveBeenCalledWith(
        'open "/path/to/summary.md"',
        { encoding: 'utf-8' }
      );
    });
  });
});
