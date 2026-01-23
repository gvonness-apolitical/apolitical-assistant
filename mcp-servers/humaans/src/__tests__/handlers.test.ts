import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';
import { handleToolCall } from '../tools.js';
import type { HumaansContext } from '../index.js';

// Create a mock HttpClient for testing
function createMockClient(): HttpClient & { get: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    withHeaders: vi.fn(),
  } as unknown as HttpClient & { get: ReturnType<typeof vi.fn> };
}

describe('Humaans Handlers', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let context: HumaansContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    context = { client: mockClient };
  });

  describe('handleToolCall - humaans_list_employees', () => {
    it('should return formatted employee list', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'emp-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            jobTitle: 'Engineer',
            department: { name: 'Engineering' },
            status: 'active',
            managerId: 'emp-0',
          },
          {
            id: 'emp-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            jobTitle: 'Designer',
            department: { name: 'Design' },
            status: 'active',
            managerId: 'emp-0',
          },
        ],
      });

      const result = await handleToolCall('humaans_list_employees', {}, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('John Doe');
      expect(data[0].email).toBe('john@example.com');
      expect(data[1].name).toBe('Jane Smith');
    });

    it('should filter by department', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'emp-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            department: { name: 'Engineering' },
            status: 'active',
          },
          {
            id: 'emp-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            department: { name: 'Design' },
            status: 'active',
          },
        ],
      });

      const result = await handleToolCall(
        'humaans_list_employees',
        { department: 'Engineering' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1);
      expect(data[0].department).toBe('Engineering');
    });

    it('should filter by status', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'emp-1',
            firstName: 'Active',
            lastName: 'User',
            email: 'active@example.com',
            status: 'active',
          },
          {
            id: 'emp-2',
            firstName: 'Inactive',
            lastName: 'User',
            email: 'inactive@example.com',
            status: 'inactive',
          },
        ],
      });

      const result = await handleToolCall(
        'humaans_list_employees',
        { status: 'inactive' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Inactive User');
    });
  });

  describe('handleToolCall - humaans_get_employee', () => {
    it('should return employee details', async () => {
      const employeeData = {
        id: 'emp-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        jobTitle: 'Senior Engineer',
        department: { name: 'Engineering' },
        status: 'active',
      };

      mockClient.get.mockResolvedValueOnce(employeeData);

      const result = await handleToolCall(
        'humaans_get_employee',
        { employeeId: 'emp-123' },
        context
      );

      expect(mockClient.get).toHaveBeenCalledWith('/people/emp-123');
      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.id).toBe('emp-123');
      expect(data.firstName).toBe('John');
    });
  });

  describe('handleToolCall - humaans_list_time_off', () => {
    it('should return time off list', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'to-1',
            personId: 'emp-1',
            startDate: '2024-01-15',
            endDate: '2024-01-20',
            status: 'approved',
            type: 'vacation',
            requestedDays: 5,
          },
          {
            id: 'to-2',
            personId: 'emp-2',
            startDate: '2024-02-01',
            endDate: '2024-02-03',
            status: 'pending',
            type: 'sick',
            requestedDays: 2,
          },
        ],
      });

      const result = await handleToolCall('humaans_list_time_off', {}, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe('to-1');
      expect(data[0].status).toBe('approved');
    });

    it('should filter by status', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'to-1',
            personId: 'emp-1',
            startDate: '2024-01-15',
            endDate: '2024-01-20',
            status: 'approved',
            type: 'vacation',
            requestedDays: 5,
          },
          {
            id: 'to-2',
            personId: 'emp-2',
            startDate: '2024-02-01',
            endDate: '2024-02-03',
            status: 'pending',
            type: 'sick',
            requestedDays: 2,
          },
        ],
      });

      const result = await handleToolCall('humaans_list_time_off', { status: 'approved' }, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('approved');
    });

    it('should filter by date range', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'to-1',
            personId: 'emp-1',
            startDate: '2024-01-15',
            endDate: '2024-01-20',
            status: 'approved',
            type: 'vacation',
            requestedDays: 5,
          },
          {
            id: 'to-2',
            personId: 'emp-2',
            startDate: '2024-02-01',
            endDate: '2024-02-28',
            status: 'pending',
            type: 'sick',
            requestedDays: 2,
          },
        ],
      });

      const result = await handleToolCall(
        'humaans_list_time_off',
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('to-1');
    });
  });

  describe('handleToolCall - humaans_get_org_chart', () => {
    it('should build org chart from all employees', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'ceo',
            firstName: 'Chief',
            lastName: 'Executive',
            jobTitle: 'CEO',
            status: 'active',
            managerId: null,
          },
          {
            id: 'emp-1',
            firstName: 'John',
            lastName: 'Doe',
            jobTitle: 'VP Engineering',
            status: 'active',
            managerId: 'ceo',
          },
          {
            id: 'emp-2',
            firstName: 'Jane',
            lastName: 'Smith',
            jobTitle: 'Engineer',
            status: 'active',
            managerId: 'emp-1',
          },
        ],
      });

      const result = await handleToolCall('humaans_get_org_chart', {}, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1); // One root (CEO)
      expect(data[0].name).toBe('Chief Executive');
      expect(data[0].reports).toHaveLength(1); // VP reports to CEO
      expect(data[0].reports[0].name).toBe('John Doe');
      expect(data[0].reports[0].reports).toHaveLength(1); // Engineer reports to VP
    });

    it('should start from specific employee', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'ceo',
            firstName: 'Chief',
            lastName: 'Executive',
            jobTitle: 'CEO',
            status: 'active',
            managerId: null,
          },
          {
            id: 'emp-1',
            firstName: 'John',
            lastName: 'Doe',
            jobTitle: 'VP Engineering',
            status: 'active',
            managerId: 'ceo',
          },
          {
            id: 'emp-2',
            firstName: 'Jane',
            lastName: 'Smith',
            jobTitle: 'Engineer',
            status: 'active',
            managerId: 'emp-1',
          },
        ],
      });

      const result = await handleToolCall(
        'humaans_get_org_chart',
        { rootEmployeeId: 'emp-1' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.name).toBe('John Doe');
      expect(data.reports).toHaveLength(1);
      expect(data.reports[0].name).toBe('Jane Smith');
    });

    it('should return error for non-existent employee', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: 'emp-1',
            firstName: 'John',
            lastName: 'Doe',
            status: 'active',
          },
        ],
      });

      const result = await handleToolCall(
        'humaans_get_org_chart',
        { rootEmployeeId: 'non-existent' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.error).toBe('Employee not found');
    });
  });

  describe('handleToolCall - unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await handleToolCall('unknown_tool', {}, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.error).toBe('Unknown tool: unknown_tool');
    });
  });
});
