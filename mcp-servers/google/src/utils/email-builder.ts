/**
 * RFC 2822 Email Builder Utility
 *
 * Builds properly formatted email messages for Gmail API.
 */

export interface EmailOptions {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  replyToMessageId?: string;
}

/**
 * Builds an RFC 2822 formatted email message.
 *
 * @param options - Email options including recipients, subject, body, and optional headers
 * @returns The raw RFC 2822 formatted message string
 */
export function buildRfc2822Message(options: EmailOptions): string {
  const messageParts: string[] = [];

  messageParts.push(`To: ${options.to.join(', ')}`);

  if (options.cc && options.cc.length > 0) {
    messageParts.push(`Cc: ${options.cc.join(', ')}`);
  }

  if (options.bcc && options.bcc.length > 0) {
    messageParts.push(`Bcc: ${options.bcc.join(', ')}`);
  }

  messageParts.push(`Subject: ${options.subject}`);

  if (options.replyToMessageId) {
    messageParts.push(`In-Reply-To: ${options.replyToMessageId}`);
    messageParts.push(`References: ${options.replyToMessageId}`);
  }

  messageParts.push('Content-Type: text/plain; charset=utf-8');
  messageParts.push('');
  messageParts.push(options.body);

  return messageParts.join('\r\n');
}

/**
 * Encodes a raw email message for Gmail API.
 *
 * Converts the message to URL-safe base64 encoding as required by Gmail.
 *
 * @param rawMessage - The raw RFC 2822 formatted message
 * @returns URL-safe base64 encoded string
 */
export function encodeForGmail(rawMessage: string): string {
  return Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
