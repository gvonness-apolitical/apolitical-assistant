import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';
import { handleToolCall } from '../tools.js';
import type { IncidentIoContext } from '../index.js';

// Create a mock HttpClient for testing
function createMockClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    withHeaders: vi.fn(),
  } as unknown as HttpClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
}

describe('Incident.io Handlers', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let context: IncidentIoContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    context = { client: mockClient };
  });

  describe('handleToolCall - incidentio_list_incidents', () => {
    it('should return formatted incident list', async () => {
      mockClient.get.mockResolvedValueOnce({
        incidents: [
          {
            id: 'inc-1',
            name: 'API Outage',
            incident_status: { category: 'active', name: 'Investigating' },
            severity: { name: 'sev1' },
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:30:00Z',
            incident_role_assignments: [
              { role: { name: 'Incident Lead' }, assignee: { name: 'John Doe' } },
            ],
          },
          {
            id: 'inc-2',
            name: 'Database Slow',
            incident_status: { category: 'resolved', name: 'Resolved' },
            severity: { name: 'sev2' },
            created_at: '2024-01-14T08:00:00Z',
            updated_at: '2024-01-14T12:00:00Z',
          },
        ],
      });

      const result = await handleToolCall('incidentio_list_incidents', {}, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('API Outage');
      expect(data[0].severity).toBe('sev1');
      expect(data[0].lead).toBe('John Doe');
      expect(data[1].name).toBe('Database Slow');
    });

    it('should filter by active status', async () => {
      mockClient.get.mockResolvedValueOnce({
        incidents: [
          {
            id: 'inc-1',
            name: 'Active Incident',
            incident_status: { category: 'investigating', name: 'Investigating' },
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:30:00Z',
          },
          {
            id: 'inc-2',
            name: 'Resolved Incident',
            incident_status: { category: 'resolved', name: 'Resolved' },
            created_at: '2024-01-14T08:00:00Z',
            updated_at: '2024-01-14T12:00:00Z',
          },
        ],
      });

      const result = await handleToolCall(
        'incidentio_list_incidents',
        { status: 'active' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Active Incident');
    });

    it('should filter by severity', async () => {
      mockClient.get.mockResolvedValueOnce({
        incidents: [
          {
            id: 'inc-1',
            name: 'Critical',
            incident_status: { category: 'active', name: 'Active' },
            severity: { name: 'sev1' },
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:30:00Z',
          },
          {
            id: 'inc-2',
            name: 'Minor',
            incident_status: { category: 'active', name: 'Active' },
            severity: { name: 'sev3' },
            created_at: '2024-01-14T08:00:00Z',
            updated_at: '2024-01-14T12:00:00Z',
          },
        ],
      });

      const result = await handleToolCall(
        'incidentio_list_incidents',
        { severity: 'sev1' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Critical');
    });
  });

  describe('handleToolCall - incidentio_get_incident', () => {
    it('should return incident details', async () => {
      mockClient.get.mockResolvedValueOnce({
        incident: {
          id: 'inc-123',
          name: 'Major Outage',
          incident_status: { category: 'active', name: 'Investigating' },
          severity: { name: 'sev1' },
          summary: 'Services are down',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T11:00:00Z',
        },
      });

      const result = await handleToolCall(
        'incidentio_get_incident',
        { incidentId: 'inc-123' },
        context
      );

      expect(mockClient.get).toHaveBeenCalledWith('/incidents/inc-123');
      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.id).toBe('inc-123');
      expect(data.name).toBe('Major Outage');
    });
  });

  describe('handleToolCall - incidentio_list_followups', () => {
    it('should return followup list', async () => {
      mockClient.get.mockResolvedValueOnce({
        follow_ups: [
          {
            id: 'fu-1',
            title: 'Write postmortem',
            description: 'Document the incident',
            status: { name: 'Outstanding' },
            assignee: { name: 'Jane Doe', email: 'jane@example.com' },
            incident: { id: 'inc-1', name: 'API Outage' },
            created_at: '2024-01-15T12:00:00Z',
          },
          {
            id: 'fu-2',
            title: 'Deploy fix',
            status: { name: 'Completed' },
            incident: { id: 'inc-1', name: 'API Outage' },
            created_at: '2024-01-15T10:00:00Z',
            completed_at: '2024-01-15T11:00:00Z',
          },
        ],
      });

      const result = await handleToolCall('incidentio_list_followups', { status: 'all' }, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(2);
      expect(data[0].title).toBe('Write postmortem');
      expect(data[0].assignee).toBe('Jane Doe');
      expect(data[1].status).toBe('Completed');
    });

    it('should filter by outstanding status', async () => {
      mockClient.get.mockResolvedValueOnce({
        follow_ups: [
          {
            id: 'fu-1',
            title: 'Open task',
            status: { name: 'Outstanding' },
            incident: { id: 'inc-1', name: 'Incident' },
            created_at: '2024-01-15T12:00:00Z',
          },
          {
            id: 'fu-2',
            title: 'Done task',
            status: { name: 'Completed' },
            incident: { id: 'inc-1', name: 'Incident' },
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
      });

      const result = await handleToolCall('incidentio_list_followups', {}, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe('Open task');
    });
  });

  describe('handleToolCall - incidentio_get_postmortem', () => {
    it('should return postmortem details', async () => {
      mockClient.get.mockResolvedValueOnce({
        incident: {
          id: 'inc-123',
          name: 'Past Incident',
          postmortem_document_url: 'https://docs.example.com/postmortem/123',
          summary: 'Root cause was X',
          custom_field_entries: [
            {
              custom_field: { name: 'Timeline' },
              values: [{ value_text: '10:00 - Issue detected' }],
            },
          ],
        },
      });

      const result = await handleToolCall(
        'incidentio_get_postmortem',
        { incidentId: 'inc-123' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.incidentName).toBe('Past Incident');
      expect(data.postmortemUrl).toBe('https://docs.example.com/postmortem/123');
      expect(data.summary).toBe('Root cause was X');
      expect(data.customFields.Timeline).toBe('10:00 - Issue detected');
    });
  });

  describe('handleToolCall - incidentio_create_incident', () => {
    it('should create incident and return result', async () => {
      mockClient.post.mockResolvedValueOnce({
        incident: {
          id: 'inc-new',
          name: 'New Incident',
          incident_status: { name: 'Triage' },
          severity: { name: 'sev2' },
          permalink: 'https://incident.io/incidents/inc-new',
        },
      });

      const result = await handleToolCall(
        'incidentio_create_incident',
        { name: 'New Incident', severity: 'sev2' },
        context
      );

      expect(mockClient.post).toHaveBeenCalledWith(
        '/incidents',
        expect.objectContaining({
          name: 'New Incident',
          severity_id: 'sev2',
        })
      );
      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.success).toBe(true);
      expect(data.incidentId).toBe('inc-new');
      expect(data.permalink).toBe('https://incident.io/incidents/inc-new');
    });
  });

  describe('handleToolCall - incidentio_update_incident', () => {
    it('should update incident and return result', async () => {
      mockClient.patch.mockResolvedValueOnce({
        incident: {
          id: 'inc-123',
          name: 'Updated Name',
          incident_status: { name: 'Investigating' },
          severity: { name: 'sev1' },
        },
      });

      const result = await handleToolCall(
        'incidentio_update_incident',
        { incidentId: 'inc-123', name: 'Updated Name', severity: 'sev1' },
        context
      );

      expect(mockClient.patch).toHaveBeenCalledWith('/incidents/inc-123', {
        incident: { name: 'Updated Name', severity_id: 'sev1' },
      });
      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.success).toBe(true);
      expect(data.name).toBe('Updated Name');
    });
  });

  describe('handleToolCall - incidentio_create_followup', () => {
    it('should create followup and return result', async () => {
      mockClient.post.mockResolvedValueOnce({
        follow_up: {
          id: 'fu-new',
          title: 'New Followup',
          status: { name: 'Outstanding' },
          assignee: { name: 'Alice' },
        },
      });

      const result = await handleToolCall(
        'incidentio_create_followup',
        { incidentId: 'inc-123', title: 'New Followup', assigneeId: 'user-1' },
        context
      );

      expect(mockClient.post).toHaveBeenCalledWith('/follow_ups', {
        incident_id: 'inc-123',
        title: 'New Followup',
        assignee_id: 'user-1',
      });
      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.success).toBe(true);
      expect(data.followUpId).toBe('fu-new');
    });
  });

  describe('handleToolCall - incidentio_list_severities', () => {
    it('should return severity list', async () => {
      mockClient.get.mockResolvedValueOnce({
        severities: [
          { id: 'sev-1', name: 'SEV1', description: 'Critical', rank: 1 },
          { id: 'sev-2', name: 'SEV2', description: 'High', rank: 2 },
          { id: 'sev-3', name: 'SEV3', description: 'Medium', rank: 3 },
        ],
      });

      const result = await handleToolCall('incidentio_list_severities', {}, context);

      expect(mockClient.get).toHaveBeenCalledWith('/severities');
      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(3);
      expect(data[0].name).toBe('SEV1');
      expect(data[1].rank).toBe(2);
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
