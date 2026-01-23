import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  ListIncidentsSchema,
  GetIncidentSchema,
  ListFollowupsSchema,
  GetPostmortemSchema,
  CreateIncidentSchema,
  UpdateIncidentSchema,
  CreateFollowupSchema,
} from '../tools.js';

describe('Incident.io Schemas', () => {
  describe('ListIncidentsSchema', () => {
    it('should validate with defaults', () => {
      const result = ListIncidentsSchema.parse({});
      expect(result.status).toBe('all');
      expect(result.limit).toBe(25);
    });

    it('should accept status filter', () => {
      const result = ListIncidentsSchema.parse({ status: 'active' });
      expect(result.status).toBe('active');
    });

    it('should accept resolved status', () => {
      const result = ListIncidentsSchema.parse({ status: 'resolved' });
      expect(result.status).toBe('resolved');
    });

    it('should accept severity filter', () => {
      const result = ListIncidentsSchema.parse({ severity: 'sev1' });
      expect(result.severity).toBe('sev1');
    });

    it('should accept custom limit', () => {
      const result = ListIncidentsSchema.parse({ limit: 50 });
      expect(result.limit).toBe(50);
    });

    it('should reject invalid status', () => {
      expect(() => ListIncidentsSchema.parse({ status: 'invalid' })).toThrow(ZodError);
    });
  });

  describe('GetIncidentSchema', () => {
    it('should validate with required incidentId', () => {
      const result = GetIncidentSchema.parse({ incidentId: 'inc-123' });
      expect(result.incidentId).toBe('inc-123');
    });

    it('should reject missing incidentId', () => {
      expect(() => GetIncidentSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('ListFollowupsSchema', () => {
    it('should validate with defaults', () => {
      const result = ListFollowupsSchema.parse({});
      expect(result.status).toBe('outstanding');
    });

    it('should accept incidentId filter', () => {
      const result = ListFollowupsSchema.parse({ incidentId: 'inc-456' });
      expect(result.incidentId).toBe('inc-456');
    });

    it('should accept completed status', () => {
      const result = ListFollowupsSchema.parse({ status: 'completed' });
      expect(result.status).toBe('completed');
    });

    it('should accept all status', () => {
      const result = ListFollowupsSchema.parse({ status: 'all' });
      expect(result.status).toBe('all');
    });

    it('should accept assigneeId filter', () => {
      const result = ListFollowupsSchema.parse({ assigneeId: 'user-123' });
      expect(result.assigneeId).toBe('user-123');
    });
  });

  describe('GetPostmortemSchema', () => {
    it('should validate with required incidentId', () => {
      const result = GetPostmortemSchema.parse({ incidentId: 'inc-789' });
      expect(result.incidentId).toBe('inc-789');
    });

    it('should reject missing incidentId', () => {
      expect(() => GetPostmortemSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('CreateIncidentSchema', () => {
    it('should validate with required name', () => {
      const result = CreateIncidentSchema.parse({ name: 'API Outage' });
      expect(result.name).toBe('API Outage');
      expect(result.mode).toBe('standard');
    });

    it('should accept optional fields', () => {
      const result = CreateIncidentSchema.parse({
        name: 'Database Issue',
        summary: 'Production DB is slow',
        severity: 'sev2',
        incidentTypeId: 'type-1',
        mode: 'retrospective',
      });
      expect(result.summary).toBe('Production DB is slow');
      expect(result.severity).toBe('sev2');
      expect(result.incidentTypeId).toBe('type-1');
      expect(result.mode).toBe('retrospective');
    });

    it('should accept test mode', () => {
      const result = CreateIncidentSchema.parse({ name: 'Test Incident', mode: 'test' });
      expect(result.mode).toBe('test');
    });

    it('should reject missing name', () => {
      expect(() => CreateIncidentSchema.parse({})).toThrow(ZodError);
    });

    it('should reject invalid mode', () => {
      expect(() => CreateIncidentSchema.parse({ name: 'Test', mode: 'invalid' })).toThrow(ZodError);
    });
  });

  describe('UpdateIncidentSchema', () => {
    it('should validate with required incidentId', () => {
      const result = UpdateIncidentSchema.parse({ incidentId: 'inc-update' });
      expect(result.incidentId).toBe('inc-update');
    });

    it('should accept optional update fields', () => {
      const result = UpdateIncidentSchema.parse({
        incidentId: 'inc-123',
        name: 'Updated Name',
        summary: 'Updated summary',
        severity: 'sev1',
      });
      expect(result.name).toBe('Updated Name');
      expect(result.summary).toBe('Updated summary');
      expect(result.severity).toBe('sev1');
    });

    it('should reject missing incidentId', () => {
      expect(() => UpdateIncidentSchema.parse({ name: 'Test' })).toThrow(ZodError);
    });
  });

  describe('CreateFollowupSchema', () => {
    it('should validate with required fields', () => {
      const result = CreateFollowupSchema.parse({
        incidentId: 'inc-123',
        title: 'Implement fix',
      });
      expect(result.incidentId).toBe('inc-123');
      expect(result.title).toBe('Implement fix');
    });

    it('should accept optional fields', () => {
      const result = CreateFollowupSchema.parse({
        incidentId: 'inc-456',
        title: 'Write postmortem',
        description: 'Document the incident',
        assigneeId: 'user-789',
      });
      expect(result.description).toBe('Document the incident');
      expect(result.assigneeId).toBe('user-789');
    });

    it('should reject missing incidentId', () => {
      expect(() => CreateFollowupSchema.parse({ title: 'Test' })).toThrow(ZodError);
    });

    it('should reject missing title', () => {
      expect(() => CreateFollowupSchema.parse({ incidentId: 'inc-123' })).toThrow(ZodError);
    });
  });
});
