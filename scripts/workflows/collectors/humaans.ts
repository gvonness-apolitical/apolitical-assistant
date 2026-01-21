/**
 * Humaans TODO Collector
 *
 * Collects TODOs from Humaans HR platform:
 * - Pending time-off approvals
 * - Outstanding HR actions
 */

import { getCredential } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

interface TimeOffRequest {
  id: string;
  personId: string;
  person?: {
    firstName: string;
    lastName: string;
  };
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

interface HumaansListResponse<T> {
  data: T[];
  total: number;
}

export class HumaansCollector extends BaseCollector {
  readonly source = 'humaans' as const;
  readonly name = 'Humaans';

  private apiBase = 'https://app.humaans.io/api';

  isEnabled(): boolean {
    return this.config.collectors.humaans.enabled;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const token = await getCredential('humaans-api-token');
    if (!token) {
      this.log('No Humaans API token found, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Get pending time-off requests that need approval
      const pendingApprovals = await this.getPendingTimeOffApprovals(token, options);
      items.push(...pendingApprovals);
    } catch (error) {
      this.log(`Error collecting from Humaans: ${error}`, options);
      throw error;
    }

    return items;
  }

  private async getPendingTimeOffApprovals(
    token: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      const response = await this.fetchHumaansApi<HumaansListResponse<TimeOffRequest>>(
        '/time-away?status=pending',
        token
      );

      this.log(`Found ${response.data.length} pending time-off requests`, options);

      for (const request of response.data) {
        const personName = request.person
          ? `${request.person.firstName} ${request.person.lastName}`
          : 'Unknown';

        const title = `Approve time off: ${personName} (${request.type})`;
        const description = `${request.startDate} to ${request.endDate}`;

        items.push({
          title,
          description,
          sourceId: `humaans-timeoff-${request.id}`,
          sourceUrl: `https://app.humaans.io/time-away/${request.id}`,
          requestDate: request.createdAt,
          basePriority: 2, // HR approvals are high priority
          urgency: 2,
          tags: ['humaans', 'time-off', 'approval'],
        });
      }
    } catch (error) {
      this.log(`Error fetching pending time-off requests: ${error}`, options);
    }

    return items;
  }

  private async fetchHumaansApi<T>(endpoint: string, token: string): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Humaans API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}
