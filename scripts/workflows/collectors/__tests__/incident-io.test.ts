/**
 * Incident.io Collector Tests
 *
 * Tests the IncidentIoCollector class for Incident.io incident and follow-up collection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IncidentIoCollector, type Incident, type FollowUp } from '../incident-io.js';

// Mock dependencies
vi.mock('@apolitical-assistant/shared', async () => {
  const actual = await vi.importActual('@apolitical-assistant/shared');
  return {
    ...actual,
    getCredential: vi.fn(),
    generateFingerprint: vi.fn((title: string) => `fp-${title.slice(0, 10)}`),
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
      setLevel: vi.fn(),
    })),
  };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('../config.js', () => ({
  getCachePath: vi.fn(() => '/tmp/test-cache'),
  loadTodoConfig: vi.fn(() => ({
    archiveAfterDays: 14,
    staleDays: 14,
    deduplication: { enabled: true, fuzzyThreshold: 0.85 },
    notifications: { dayBefore: true, dayOf: true, overdue: true },
  })),
  getCollectionStartDate: vi.fn(() => null),
}));

// Import after mocking
import { getCredential } from '@apolitical-assistant/shared';

const mockGetCredential = vi.mocked(getCredential);

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('IncidentIoCollector', () => {
  let collector: IncidentIoCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new IncidentIoCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('returns true when incidentio-api-key exists', () => {
      mockGetCredential.mockReturnValue('test-api-key');

      expect(collector.isEnabled()).toBe(true);
    });

    it('returns false when incidentio-api-key is missing', () => {
      mockGetCredential.mockReturnValue(null);

      expect(collector.isEnabled()).toBe(false);
    });

    it('returns false when incidentio-api-key is undefined', () => {
      mockGetCredential.mockReturnValue(undefined);

      expect(collector.isEnabled()).toBe(false);
    });
  });

  describe('collect', () => {
    beforeEach(() => {
      mockGetCredential.mockReturnValue('test-api-key');
    });

    it('returns empty result when disabled', async () => {
      mockGetCredential.mockReturnValue(null);

      const result = await collector.collect();

      expect(result.source).toBe('incident-io');
      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('returns empty result when API key is not available during collection', async () => {
      mockGetCredential.mockReturnValueOnce('test-api-key').mockReturnValue(null);

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('creates TODOs for active incidents', async () => {
      const mockIncidents: Incident[] = [
        createIncident({
          id: 'inc-1',
          name: 'Database Outage',
          severity: { id: 'sev-1', name: 'SEV1' },
          summary: 'Production database is down',
          permalink: 'https://app.incident.io/incidents/inc-1',
        }),
        createIncident({
          id: 'inc-2',
          name: 'API Latency',
          severity: { id: 'sev-2', name: 'SEV3' },
        }),
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ incidents: mockIncidents }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ follow_ups: [] }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);

      const todo1 = result.todos[0];
      expect(todo1.title).toBe('[SEV1] Database Outage');
      expect(todo1.description).toBe('Production database is down');
      expect(todo1.sourceId).toBe('incident-inc-1');
      expect(todo1.sourceUrl).toBe('https://app.incident.io/incidents/inc-1');
      expect(todo1.basePriority).toBe(1); // SEV1 = priority 1
      expect(todo1.urgency).toBe(1);
      expect(todo1.tags).toContain('incident');
      expect(todo1.tags).toContain('sev1');
      expect(todo1.tags).toContain('active');

      const todo2 = result.todos[1];
      expect(todo2.title).toBe('[SEV3] API Latency');
      expect(todo2.basePriority).toBe(3); // SEV3 = priority 3
    });

    it('creates TODOs for outstanding follow-ups', async () => {
      const mockFollowUps: FollowUp[] = [
        createFollowUp({
          id: 'fu-1',
          title: 'Update runbook',
          description: 'Add new troubleshooting steps',
          incident_id: 'inc-1',
        }),
        createFollowUp({
          id: 'fu-2',
          title: 'Add monitoring',
          incident_id: 'inc-1',
        }),
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ incidents: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ follow_ups: mockFollowUps }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);

      const todo1 = result.todos[0];
      expect(todo1.title).toBe('Follow-up: Update runbook');
      expect(todo1.description).toBe('Add new troubleshooting steps');
      expect(todo1.sourceId).toBe('followup-fu-1');
      expect(todo1.basePriority).toBe(2);
      expect(todo1.urgency).toBe(2);
      expect(todo1.tags).toContain('follow-up');

      const todo2 = result.todos[1];
      expect(todo2.title).toBe('Follow-up: Add monitoring');
      expect(todo2.description).toBe('Follow-up action from incident');
    });

    it('creates TODOs for both incidents and follow-ups', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            incidents: [createIncident({ name: 'Incident 1' })],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            follow_ups: [createFollowUp({ title: 'Follow-up 1' })],
          }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);
      expect(result.todos[0].title).toContain('Incident 1');
      expect(result.todos[1].title).toContain('Follow-up 1');
    });

    it('handles API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await collector.collect();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Incident.io API error');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await collector.collect();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Network error');
    });

    it('uses default severity label when not provided', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            incidents: [createIncident({ name: 'No Severity', severity: undefined })],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ follow_ups: [] }),
        });

      const result = await collector.collect();

      expect(result.todos[0].title).toBe('[INC] No Severity');
      expect(result.todos[0].tags).toContain('unknown');
    });
  });

  describe('getActiveIncidents', () => {
    it('fetches incidents with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incidents: [] }),
      });

      await collector.getActiveIncidents('test-api-key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/incidents\?/),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get('status_category[one_of]')).toBe('active');
      expect(url.searchParams.get('page_size')).toBe('50');
    });

    it('returns empty array when API returns no incidents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const incidents = await collector.getActiveIncidents('test-api-key');

      expect(incidents).toEqual([]);
    });

    it('returns incidents from API response', async () => {
      const mockIncidents = [
        createIncident({ id: 'inc-1' }),
        createIncident({ id: 'inc-2' }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incidents: mockIncidents }),
      });

      const incidents = await collector.getActiveIncidents('test-api-key');

      expect(incidents).toEqual(mockIncidents);
    });

    it('throws error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(collector.getActiveIncidents('test-api-key')).rejects.toThrow(
        'Incident.io API error: 401 Unauthorized'
      );
    });
  });

  describe('getOutstandingFollowUps', () => {
    it('fetches follow-ups with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ follow_ups: [] }),
      });

      await collector.getOutstandingFollowUps('test-api-key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/follow_ups\?/),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get('status')).toBe('outstanding');
      expect(url.searchParams.get('page_size')).toBe('50');
    });

    it('returns empty array when API returns 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const followUps = await collector.getOutstandingFollowUps('test-api-key');

      expect(followUps).toEqual([]);
    });

    it('returns empty array when API returns no follow_ups', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const followUps = await collector.getOutstandingFollowUps('test-api-key');

      expect(followUps).toEqual([]);
    });

    it('returns follow-ups from API response', async () => {
      const mockFollowUps = [
        createFollowUp({ id: 'fu-1' }),
        createFollowUp({ id: 'fu-2' }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ follow_ups: mockFollowUps }),
      });

      const followUps = await collector.getOutstandingFollowUps('test-api-key');

      expect(followUps).toEqual(mockFollowUps);
    });

    it('throws error on non-404 API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      await expect(collector.getOutstandingFollowUps('test-api-key')).rejects.toThrow(
        'Incident.io API error: 500 Server Error'
      );
    });
  });

  describe('getIncident', () => {
    it('returns null when no API key', async () => {
      mockGetCredential.mockReturnValue(null);

      const incident = await collector.getIncident('inc-1');

      expect(incident).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches specific incident', async () => {
      mockGetCredential.mockReturnValue('test-api-key');
      const mockIncident = createIncident({ id: 'inc-1' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incident: mockIncident }),
      });

      const incident = await collector.getIncident('inc-1');

      expect(incident).toEqual(mockIncident);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/incidents/inc-1'),
        expect.any(Object)
      );
    });

    it('returns null on API error', async () => {
      mockGetCredential.mockReturnValue('test-api-key');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const incident = await collector.getIncident('inc-1');

      expect(incident).toBeNull();
    });

    it('returns null on network error', async () => {
      mockGetCredential.mockReturnValue('test-api-key');
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const incident = await collector.getIncident('inc-1');

      expect(incident).toBeNull();
    });

    it('returns null when API returns no incident', async () => {
      mockGetCredential.mockReturnValue('test-api-key');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const incident = await collector.getIncident('inc-1');

      expect(incident).toBeNull();
    });
  });

  describe('getRecentlyResolvedIncidents', () => {
    it('returns empty array when no API key', async () => {
      mockGetCredential.mockReturnValue(null);

      const incidents = await collector.getRecentlyResolvedIncidents();

      expect(incidents).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches closed incidents', async () => {
      mockGetCredential.mockReturnValue('test-api-key');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incidents: [] }),
      });

      await collector.getRecentlyResolvedIncidents();

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get('status_category[one_of]')).toBe('closed');
    });

    it('filters incidents by resolved date', async () => {
      mockGetCredential.mockReturnValue('test-api-key');

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      const mockIncidents = [
        createIncident({ id: 'recent', resolved_at: recentDate.toISOString() }),
        createIncident({ id: 'old', resolved_at: oldDate.toISOString() }),
        createIncident({ id: 'no-date' }), // No resolved_at
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ incidents: mockIncidents }),
      });

      const incidents = await collector.getRecentlyResolvedIncidents(7);

      expect(incidents).toHaveLength(1);
      expect(incidents[0].id).toBe('recent');
    });

    it('uses custom days parameter', async () => {
      mockGetCredential.mockReturnValue('test-api-key');

      const date14DaysAgo = new Date();
      date14DaysAgo.setDate(date14DaysAgo.getDate() - 10);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          incidents: [createIncident({ id: 'inc-1', resolved_at: date14DaysAgo.toISOString() })],
        }),
      });

      const incidents = await collector.getRecentlyResolvedIncidents(14);

      expect(incidents).toHaveLength(1);
    });

    it('returns empty array on API error', async () => {
      mockGetCredential.mockReturnValue('test-api-key');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const incidents = await collector.getRecentlyResolvedIncidents();

      expect(incidents).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      mockGetCredential.mockReturnValue('test-api-key');
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const incidents = await collector.getRecentlyResolvedIncidents();

      expect(incidents).toEqual([]);
    });
  });

  describe('severity to priority mapping', () => {
    beforeEach(() => {
      mockGetCredential.mockReturnValue('test-api-key');
    });

    it.each([
      ['SEV1', 1],
      ['sev1', 1],
      ['Critical', 1],
      ['P0', 1],
      ['SEV2', 2],
      ['sev2', 2],
      ['Major', 2],
      ['P1', 2],
      ['SEV3', 3],
      ['sev3', 3],
      ['Minor', 3],
      ['P2', 3],
      ['SEV4', 4],
      ['Low', 4],
      ['Unknown', 4],
    ])('maps severity "%s" to priority %i', async (severity, expectedPriority) => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            incidents: [createIncident({ severity: { id: 'sev', name: severity } })],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ follow_ups: [] }),
        });

      const result = await collector.collect();

      expect(result.todos[0].basePriority).toBe(expectedPriority);
    });

    it('defaults to priority 3 when no severity', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            incidents: [createIncident({ severity: undefined })],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ follow_ups: [] }),
        });

      const result = await collector.collect();

      expect(result.todos[0].basePriority).toBe(3);
    });
  });
});

/**
 * Helper to create a test incident
 */
function createIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: `inc-${Math.random().toString(36).slice(2)}`,
    name: 'Test Incident',
    status: 'active',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

/**
 * Helper to create a test follow-up
 */
function createFollowUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    id: `fu-${Math.random().toString(36).slice(2)}`,
    title: 'Test Follow-up',
    status: 'outstanding',
    incident_id: 'inc-1',
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}
