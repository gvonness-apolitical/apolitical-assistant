import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  SearchSchema,
  ListChannelsSchema,
  ReadChannelSchema,
  ReadThreadSchema,
  ListDmsSchema,
  ReadDmSchema,
  ListUsersSchema,
  GetUserSchema,
  GetChannelInfoSchema,
  SendMessageSchema,
  SendDmSchema,
  AddReactionSchema,
} from '../tools.js';

describe('Slack Schemas', () => {
  describe('SearchSchema', () => {
    it('should validate with required query', () => {
      const result = SearchSchema.parse({ query: 'from:@user in:#general' });
      expect(result.query).toBe('from:@user in:#general');
      expect(result.count).toBe(20);
      expect(result.sort).toBe('score');
    });

    it('should accept custom count', () => {
      const result = SearchSchema.parse({ query: 'test', count: 50 });
      expect(result.count).toBe(50);
    });

    it('should accept timestamp sort', () => {
      const result = SearchSchema.parse({ query: 'test', sort: 'timestamp' });
      expect(result.sort).toBe('timestamp');
    });

    it('should reject missing query', () => {
      expect(() => SearchSchema.parse({})).toThrow(ZodError);
    });

    it('should reject invalid sort', () => {
      expect(() => SearchSchema.parse({ query: 'test', sort: 'invalid' })).toThrow(ZodError);
    });
  });

  describe('ListChannelsSchema', () => {
    it('should validate with defaults', () => {
      const result = ListChannelsSchema.parse({});
      expect(result.types).toBe('public_channel,private_channel');
      expect(result.limit).toBe(100);
    });

    it('should accept custom types', () => {
      const result = ListChannelsSchema.parse({ types: 'im,mpim' });
      expect(result.types).toBe('im,mpim');
    });

    it('should accept custom limit', () => {
      const result = ListChannelsSchema.parse({ limit: 50 });
      expect(result.limit).toBe(50);
    });
  });

  describe('ReadChannelSchema', () => {
    it('should validate with channel ID', () => {
      const result = ReadChannelSchema.parse({ channel: 'C1234567890' });
      expect(result.channel).toBe('C1234567890');
      expect(result.limit).toBe(20);
    });

    it('should accept channel name', () => {
      const result = ReadChannelSchema.parse({ channel: '#general' });
      expect(result.channel).toBe('#general');
    });

    it('should accept custom limit', () => {
      const result = ReadChannelSchema.parse({ channel: 'C123', limit: 50 });
      expect(result.limit).toBe(50);
    });

    it('should reject missing channel', () => {
      expect(() => ReadChannelSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('ReadThreadSchema', () => {
    it('should validate with required fields', () => {
      const result = ReadThreadSchema.parse({
        channel: 'C1234567890',
        threadTs: '1234567890.123456',
      });
      expect(result.channel).toBe('C1234567890');
      expect(result.threadTs).toBe('1234567890.123456');
      expect(result.limit).toBe(50);
    });

    it('should accept custom limit', () => {
      const result = ReadThreadSchema.parse({
        channel: 'C123',
        threadTs: '123.456',
        limit: 100,
      });
      expect(result.limit).toBe(100);
    });

    it('should reject missing channel', () => {
      expect(() => ReadThreadSchema.parse({ threadTs: '123.456' })).toThrow(ZodError);
    });

    it('should reject missing threadTs', () => {
      expect(() => ReadThreadSchema.parse({ channel: 'C123' })).toThrow(ZodError);
    });
  });

  describe('ListDmsSchema', () => {
    it('should validate with defaults', () => {
      const result = ListDmsSchema.parse({});
      expect(result.limit).toBe(50);
    });

    it('should accept custom limit', () => {
      const result = ListDmsSchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });
  });

  describe('ReadDmSchema', () => {
    it('should validate with required userId', () => {
      const result = ReadDmSchema.parse({ userId: 'U1234567890' });
      expect(result.userId).toBe('U1234567890');
      expect(result.limit).toBe(20);
    });

    it('should accept custom limit', () => {
      const result = ReadDmSchema.parse({ userId: 'U123', limit: 50 });
      expect(result.limit).toBe(50);
    });

    it('should reject missing userId', () => {
      expect(() => ReadDmSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('ListUsersSchema', () => {
    it('should validate with defaults', () => {
      const result = ListUsersSchema.parse({});
      expect(result.limit).toBe(100);
    });

    it('should accept custom limit', () => {
      const result = ListUsersSchema.parse({ limit: 200 });
      expect(result.limit).toBe(200);
    });
  });

  describe('GetUserSchema', () => {
    it('should validate with required userId', () => {
      const result = GetUserSchema.parse({ userId: 'U1234567890' });
      expect(result.userId).toBe('U1234567890');
    });

    it('should reject missing userId', () => {
      expect(() => GetUserSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('GetChannelInfoSchema', () => {
    it('should validate with required channel', () => {
      const result = GetChannelInfoSchema.parse({ channel: 'C1234567890' });
      expect(result.channel).toBe('C1234567890');
    });

    it('should reject missing channel', () => {
      expect(() => GetChannelInfoSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('SendMessageSchema', () => {
    it('should validate with required fields', () => {
      const result = SendMessageSchema.parse({
        channel: 'C1234567890',
        text: 'Hello, world!',
      });
      expect(result.channel).toBe('C1234567890');
      expect(result.text).toBe('Hello, world!');
      expect(result.unfurlLinks).toBe(true);
    });

    it('should accept threadTs for replies', () => {
      const result = SendMessageSchema.parse({
        channel: 'C123',
        text: 'Reply',
        threadTs: '1234567890.123456',
      });
      expect(result.threadTs).toBe('1234567890.123456');
    });

    it('should accept unfurlLinks option', () => {
      const result = SendMessageSchema.parse({
        channel: 'C123',
        text: 'No unfurl',
        unfurlLinks: false,
      });
      expect(result.unfurlLinks).toBe(false);
    });

    it('should reject missing channel', () => {
      expect(() => SendMessageSchema.parse({ text: 'Hello' })).toThrow(ZodError);
    });

    it('should reject missing text', () => {
      expect(() => SendMessageSchema.parse({ channel: 'C123' })).toThrow(ZodError);
    });
  });

  describe('SendDmSchema', () => {
    it('should validate with required fields', () => {
      const result = SendDmSchema.parse({
        userId: 'U1234567890',
        text: 'Hello!',
      });
      expect(result.userId).toBe('U1234567890');
      expect(result.text).toBe('Hello!');
    });

    it('should reject missing userId', () => {
      expect(() => SendDmSchema.parse({ text: 'Hello' })).toThrow(ZodError);
    });

    it('should reject missing text', () => {
      expect(() => SendDmSchema.parse({ userId: 'U123' })).toThrow(ZodError);
    });
  });

  describe('AddReactionSchema', () => {
    it('should validate with required fields', () => {
      const result = AddReactionSchema.parse({
        channel: 'C1234567890',
        timestamp: '1234567890.123456',
        emoji: 'thumbsup',
      });
      expect(result.channel).toBe('C1234567890');
      expect(result.timestamp).toBe('1234567890.123456');
      expect(result.emoji).toBe('thumbsup');
    });

    it('should reject missing channel', () => {
      expect(() => AddReactionSchema.parse({ timestamp: '123.456', emoji: 'thumbsup' })).toThrow(
        ZodError
      );
    });

    it('should reject missing timestamp', () => {
      expect(() => AddReactionSchema.parse({ channel: 'C123', emoji: 'thumbsup' })).toThrow(
        ZodError
      );
    });

    it('should reject missing emoji', () => {
      expect(() => AddReactionSchema.parse({ channel: 'C123', timestamp: '123.456' })).toThrow(
        ZodError
      );
    });
  });
});
