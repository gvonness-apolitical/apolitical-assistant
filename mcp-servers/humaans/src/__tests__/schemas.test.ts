import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  ListEmployeesSchema,
  GetEmployeeSchema,
  ListTimeOffSchema,
  GetOrgChartSchema,
} from '../tools.js';

describe('Humaans Schemas', () => {
  describe('ListEmployeesSchema', () => {
    it('should validate with defaults', () => {
      const result = ListEmployeesSchema.parse({});
      expect(result.status).toBe('active');
      expect(result.limit).toBe(50);
    });

    it('should accept department filter', () => {
      const result = ListEmployeesSchema.parse({ department: 'Engineering' });
      expect(result.department).toBe('Engineering');
    });

    it('should accept status filter', () => {
      const result = ListEmployeesSchema.parse({ status: 'inactive' });
      expect(result.status).toBe('inactive');
    });

    it('should accept all status', () => {
      const result = ListEmployeesSchema.parse({ status: 'all' });
      expect(result.status).toBe('all');
    });

    it('should accept custom limit', () => {
      const result = ListEmployeesSchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it('should reject invalid status', () => {
      expect(() => ListEmployeesSchema.parse({ status: 'invalid' })).toThrow(ZodError);
    });
  });

  describe('GetEmployeeSchema', () => {
    it('should validate with required employeeId', () => {
      const result = GetEmployeeSchema.parse({ employeeId: 'emp-123' });
      expect(result.employeeId).toBe('emp-123');
    });

    it('should reject missing employeeId', () => {
      expect(() => GetEmployeeSchema.parse({})).toThrow(ZodError);
    });

    it('should reject non-string employeeId', () => {
      expect(() => GetEmployeeSchema.parse({ employeeId: 123 })).toThrow(ZodError);
    });
  });

  describe('ListTimeOffSchema', () => {
    it('should validate with defaults', () => {
      const result = ListTimeOffSchema.parse({});
      expect(result.status).toBe('all');
    });

    it('should accept employeeId filter', () => {
      const result = ListTimeOffSchema.parse({ employeeId: 'emp-456' });
      expect(result.employeeId).toBe('emp-456');
    });

    it('should accept status filter', () => {
      const result = ListTimeOffSchema.parse({ status: 'pending' });
      expect(result.status).toBe('pending');
    });

    it('should accept approved status', () => {
      const result = ListTimeOffSchema.parse({ status: 'approved' });
      expect(result.status).toBe('approved');
    });

    it('should accept rejected status', () => {
      const result = ListTimeOffSchema.parse({ status: 'rejected' });
      expect(result.status).toBe('rejected');
    });

    it('should accept date range filters', () => {
      const result = ListTimeOffSchema.parse({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });
      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-01-31');
    });

    it('should reject invalid status', () => {
      expect(() => ListTimeOffSchema.parse({ status: 'invalid' })).toThrow(ZodError);
    });
  });

  describe('GetOrgChartSchema', () => {
    it('should validate with empty object', () => {
      const result = GetOrgChartSchema.parse({});
      expect(result.rootEmployeeId).toBeUndefined();
    });

    it('should accept rootEmployeeId', () => {
      const result = GetOrgChartSchema.parse({ rootEmployeeId: 'emp-ceo' });
      expect(result.rootEmployeeId).toBe('emp-ceo');
    });
  });
});
