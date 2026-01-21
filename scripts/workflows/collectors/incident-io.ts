/**
 * Incident.io Collector
 *
 * Collects incidents and follow-ups from Incident.io via MCP.
 */

import { getCredential } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

/**
 * Incident structure
 */
export interface Incident {
  id: string;
  name: string;
  status: string;
  severity?: {
    id: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  summary?: string;
  permalink?: string;
  lead?: {
    email: string;
    name: string;
  };
}

/**
 * Follow-up action structure
 */
export interface FollowUp {
  id: string;
  title: string;
  description?: string;
  status: 'outstanding' | 'completed';
  incident_id: string;
  assignee?: {
    email: string;
    name: string;
  };
  created_at: string;
  completed_at?: string;
}

export class IncidentIoCollector extends BaseCollector {
  readonly source = 'incident-io' as const;
  readonly name = 'Incident.io';

  private apiBase = 'https://api.incident.io/v2';

  isEnabled(): boolean {
    return !!getCredential('incidentio-api-key');
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const apiKey = getCredential('incidentio-api-key');
    if (!apiKey) {
      this.log('No Incident.io API key available, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Get active incidents
      const activeIncidents = await this.getActiveIncidents(apiKey);
      this.log(`Found ${activeIncidents.length} active incidents`, options);

      // Create TODOs for active incidents where user is lead
      for (const incident of activeIncidents) {
        items.push({
          title: `[${incident.severity?.name ?? 'INC'}] ${incident.name}`,
          description: incident.summary ?? `Active incident: ${incident.name}`,
          sourceId: `incident-${incident.id}`,
          sourceUrl: incident.permalink,
          requestDate: incident.created_at.split('T')[0],
          basePriority: this.getSeverityPriority(incident.severity?.name),
          urgency: 1, // Active incidents are always urgent
          tags: ['incident', incident.severity?.name?.toLowerCase() ?? 'unknown', 'active'],
        });
      }

      // Get outstanding follow-ups
      const followUps = await this.getOutstandingFollowUps(apiKey);
      this.log(`Found ${followUps.length} outstanding follow-ups`, options);

      for (const followUp of followUps) {
        items.push({
          title: `Follow-up: ${followUp.title}`,
          description: followUp.description ?? `Follow-up action from incident`,
          sourceId: `followup-${followUp.id}`,
          requestDate: followUp.created_at.split('T')[0],
          basePriority: 2,
          urgency: 2,
          tags: ['incident', 'follow-up'],
        });
      }
    } catch (error) {
      this.log(`Error collecting from Incident.io: ${error}`, options);
      throw error;
    }

    return items;
  }

  /**
   * Get active incidents
   */
  async getActiveIncidents(apiKey: string): Promise<Incident[]> {
    const url = new URL(`${this.apiBase}/incidents`);
    url.searchParams.set('status_category[one_of]', 'active');
    url.searchParams.set('page_size', '50');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Incident.io API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { incidents?: Incident[] };
    return data.incidents ?? [];
  }

  /**
   * Get outstanding follow-up actions
   */
  async getOutstandingFollowUps(apiKey: string): Promise<FollowUp[]> {
    const url = new URL(`${this.apiBase}/follow_ups`);
    url.searchParams.set('status', 'outstanding');
    url.searchParams.set('page_size', '50');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Follow-ups endpoint might not exist in all plans
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Incident.io API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { follow_ups?: FollowUp[] };
    return data.follow_ups ?? [];
  }

  /**
   * Get a specific incident
   */
  async getIncident(incidentId: string): Promise<Incident | null> {
    const apiKey = getCredential('incidentio-api-key');
    if (!apiKey) return null;

    try {
      const response = await fetch(`${this.apiBase}/incidents/${incidentId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { incident?: Incident };
      return data.incident ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get recently resolved incidents (for summaries)
   */
  async getRecentlyResolvedIncidents(days = 7): Promise<Incident[]> {
    const apiKey = getCredential('incidentio-api-key');
    if (!apiKey) return [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const url = new URL(`${this.apiBase}/incidents`);
    url.searchParams.set('status_category[one_of]', 'closed');
    url.searchParams.set('page_size', '50');

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { incidents?: Incident[] };
      return (data.incidents ?? []).filter((inc) => {
        if (!inc.resolved_at) return false;
        return new Date(inc.resolved_at) >= cutoffDate;
      });
    } catch {
      return [];
    }
  }

  /**
   * Map severity to priority
   */
  private getSeverityPriority(severity?: string): number {
    if (!severity) return 3;

    const sev = severity.toLowerCase();
    if (sev.includes('sev1') || sev.includes('critical') || sev.includes('p0')) return 1;
    if (sev.includes('sev2') || sev.includes('major') || sev.includes('p1')) return 2;
    if (sev.includes('sev3') || sev.includes('minor') || sev.includes('p2')) return 3;
    return 4;
  }
}
