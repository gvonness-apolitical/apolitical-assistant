import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateGoogleToken,
  validateSlackToken,
  validateIncidentioToken,
  validateHumaansToken,
  validateGithubToken,
  validateLinearToken,
} from '../validators.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockJsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
  } as Response;
}

describe('validateGoogleToken', () => {
  it('should return invalid when required credentials are missing', async () => {
    const result = await validateGoogleToken('token', new Map());

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Missing required Google credentials');
  });

  it('should return invalid when token refresh fails', async () => {
    const creds = new Map([
      ['GOOGLE_CLIENT_ID', 'client-id'],
      ['GOOGLE_CLIENT_SECRET', 'client-secret'],
      ['GOOGLE_REFRESH_TOKEN', 'bad-refresh-token'],
    ]);

    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: 'invalid_grant' }, false, 400));

    const result = await validateGoogleToken('bad-refresh-token', creds);

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Token refresh failed');
  });

  it('should return valid with all scopes present', async () => {
    const creds = new Map([
      ['GOOGLE_CLIENT_ID', 'client-id'],
      ['GOOGLE_CLIENT_SECRET', 'client-secret'],
      ['GOOGLE_REFRESH_TOKEN', 'good-token'],
    ]);

    // Token refresh
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ access_token: 'access-token' }));

    // Token info with all scopes
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        scope: [
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/documents.readonly',
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/presentations.readonly',
        ].join(' '),
      })
    );

    const result = await validateGoogleToken('good-token', creds);

    expect(result.valid).toBe(true);
    expect(result.message).toContain('gmail:rw');
    expect(result.message).toContain('calendar:rw');
    expect(result.message).toContain('drive:ro');
  });

  it('should report missing scopes', async () => {
    const creds = new Map([
      ['GOOGLE_CLIENT_ID', 'client-id'],
      ['GOOGLE_CLIENT_SECRET', 'client-secret'],
      ['GOOGLE_REFRESH_TOKEN', 'partial-token'],
    ]);

    mockFetch.mockResolvedValueOnce(mockJsonResponse({ access_token: 'access-token' }));

    // Token info with partial scopes (missing calendar.events)
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        scope:
          'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/presentations.readonly',
      })
    );

    const result = await validateGoogleToken('partial-token', creds);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Missing');
    expect(result.message).toContain('scope');
  });

  it('should handle network errors', async () => {
    const creds = new Map([
      ['GOOGLE_CLIENT_ID', 'client-id'],
      ['GOOGLE_CLIENT_SECRET', 'client-secret'],
      ['GOOGLE_REFRESH_TOKEN', 'token'],
    ]);

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await validateGoogleToken('token', creds);

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Validation error');
  });
});

describe('validateSlackToken', () => {
  it('should return invalid for bad token', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ ok: false, error: 'invalid_auth' }));

    const result = await validateSlackToken('bad-token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('invalid_auth');
  });

  it('should return valid when auth passes and all scopes present', async () => {
    // Auth test
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ ok: true, user: 'testuser', team: 'testteam' })
    );

    // All scope tests return ok (meaning scope is present)
    // There are 12 scope tests in the validator
    for (let i = 0; i < 12; i++) {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    }

    const result = await validateSlackToken('xoxp-valid-token');

    expect(result.valid).toBe(true);
    expect(result.message).toContain('testuser');
    expect(result.message).toContain('testteam');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await validateSlackToken('token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Connection error');
  });
});

describe('validateIncidentioToken', () => {
  it('should return invalid for unauthorized token', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, false, 401));

    const result = await validateIncidentioToken('bad-token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Invalid or unauthorized token');
  });

  it('should return valid with permissions listed', async () => {
    // Incidents read
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ incidents: [] }));
    // Incident types
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ incident_types: [] }));
    // Severities
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ severities: [] }));
    // Follow-ups
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ follow_ups: [] }));

    const result = await validateIncidentioToken('good-token');

    expect(result.valid).toBe(true);
    expect(result.message).toContain('4 permissions');
    expect(result.details).toContain('read:incidents');
    expect(result.details).toContain('read:severities');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await validateIncidentioToken('token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Connection error');
  });
});

describe('validateHumaansToken', () => {
  it('should return valid for good token', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ data: [] }));

    const result = await validateHumaansToken('good-token');

    expect(result.valid).toBe(true);
    expect(result.message).toBe('Valid');
  });

  it('should return invalid for unauthorized token', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, false, 403));

    const result = await validateHumaansToken('bad-token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Invalid or unauthorized token');
  });

  it('should return invalid for other API errors', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, false, 500));

    const result = await validateHumaansToken('token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('API error: 500');
  });
});

describe('validateGithubToken', () => {
  it('should return invalid for 401', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, false, 401));

    const result = await validateGithubToken('bad-token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Invalid token');
  });

  it('should return valid with all required scopes', async () => {
    const response = mockJsonResponse({ login: 'testuser' });
    // Add X-OAuth-Scopes header
    (response.headers as Headers).set('X-OAuth-Scopes', 'repo, read:org, read:user');
    mockFetch.mockResolvedValueOnce(response);

    const result = await validateGithubToken('good-token');

    expect(result.valid).toBe(true);
    expect(result.message).toContain('testuser');
  });

  it('should report missing scopes', async () => {
    const response = mockJsonResponse({ login: 'testuser' });
    (response.headers as Headers).set('X-OAuth-Scopes', 'repo');
    mockFetch.mockResolvedValueOnce(response);

    const result = await validateGithubToken('partial-token');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Missing scopes');
    expect(result.message).toContain('read:org');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await validateGithubToken('token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Connection error');
  });
});

describe('validateLinearToken', () => {
  it('should return invalid for 401', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, false, 401));

    const result = await validateLinearToken('bad-token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Invalid token');
  });

  it('should return valid with viewer info and permissions', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        data: {
          viewer: { id: 'v1', name: 'Test User', email: 'test@example.com', admin: false },
          teams: { nodes: [{ id: 't1', name: 'Engineering' }] },
          issues: { nodes: [{ id: 'i1', title: 'Test Issue' }] },
          projects: { nodes: [{ id: 'p1', name: 'Project' }] },
        },
      })
    );

    const result = await validateLinearToken('good-token');

    expect(result.valid).toBe(true);
    expect(result.message).toContain('Test User');
    expect(result.message).toContain('4 permissions');
    expect(result.details).toContain('read:user');
    expect(result.details).toContain('read:issues');
  });

  it('should handle GraphQL errors', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        errors: [{ message: 'Authentication required' }],
      })
    );

    const result = await validateLinearToken('token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Authentication required');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await validateLinearToken('token');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Connection error');
  });
});
