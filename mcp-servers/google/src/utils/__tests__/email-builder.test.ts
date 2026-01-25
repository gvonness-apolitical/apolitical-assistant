import { describe, it, expect } from 'vitest';
import { buildRfc2822Message, encodeForGmail } from '../email-builder.js';

describe('email-builder', () => {
  describe('buildRfc2822Message', () => {
    it('should build a basic email message', () => {
      const message = buildRfc2822Message({
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Hello, World!',
      });

      expect(message).toContain('To: recipient@example.com');
      expect(message).toContain('Subject: Test Subject');
      expect(message).toContain('Content-Type: text/plain; charset=utf-8');
      expect(message).toContain('Hello, World!');
    });

    it('should handle multiple recipients', () => {
      const message = buildRfc2822Message({
        to: ['alice@example.com', 'bob@example.com'],
        subject: 'Test',
        body: 'Body',
      });

      expect(message).toContain('To: alice@example.com, bob@example.com');
    });

    it('should include CC recipients', () => {
      const message = buildRfc2822Message({
        to: ['recipient@example.com'],
        cc: ['cc1@example.com', 'cc2@example.com'],
        subject: 'Test',
        body: 'Body',
      });

      expect(message).toContain('Cc: cc1@example.com, cc2@example.com');
    });

    it('should include BCC recipients', () => {
      const message = buildRfc2822Message({
        to: ['recipient@example.com'],
        bcc: ['secret@example.com'],
        subject: 'Test',
        body: 'Body',
      });

      expect(message).toContain('Bcc: secret@example.com');
    });

    it('should not include empty CC or BCC', () => {
      const message = buildRfc2822Message({
        to: ['recipient@example.com'],
        cc: [],
        bcc: [],
        subject: 'Test',
        body: 'Body',
      });

      expect(message).not.toContain('Cc:');
      expect(message).not.toContain('Bcc:');
    });

    it('should include reply-to headers when replyToMessageId is provided', () => {
      const message = buildRfc2822Message({
        to: ['recipient@example.com'],
        subject: 'Re: Original',
        body: 'Reply content',
        replyToMessageId: '<original-message-id@example.com>',
      });

      expect(message).toContain('In-Reply-To: <original-message-id@example.com>');
      expect(message).toContain('References: <original-message-id@example.com>');
    });

    it('should use CRLF line endings', () => {
      const message = buildRfc2822Message({
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Body',
      });

      expect(message).toContain('\r\n');
    });
  });

  describe('encodeForGmail', () => {
    it('should encode a message to URL-safe base64', () => {
      const rawMessage = 'To: test@example.com\r\nSubject: Test\r\n\r\nHello';
      const encoded = encodeForGmail(rawMessage);

      // Should not contain characters that are not URL-safe
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('should be decodable back to original', () => {
      const rawMessage = 'To: test@example.com\r\nSubject: Test\r\n\r\nHello, World!';
      const encoded = encodeForGmail(rawMessage);

      // Convert URL-safe base64 back to standard base64 for decoding
      const standardBase64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(standardBase64, 'base64').toString('utf-8');

      expect(decoded).toBe(rawMessage);
    });

    it('should handle unicode characters', () => {
      const rawMessage = 'To: test@example.com\r\nSubject: Test\r\n\r\nHello, \u4e16\u754c!';
      const encoded = encodeForGmail(rawMessage);

      // Should produce valid base64
      expect(() => {
        const standardBase64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        Buffer.from(standardBase64, 'base64').toString('utf-8');
      }).not.toThrow();
    });
  });
});
