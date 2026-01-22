/**
 * Linear TODO Collector
 *
 * Collects TODOs from Linear:
 * - Issues assigned to the user
 * - Issues in active cycles
 */

import { getCredential } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  priority: number; // 0-4, where 1 is urgent
  state: {
    name: string;
    type: string;
  };
  team: {
    name: string;
    key: string;
  };
  labels: {
    nodes: Array<{ name: string }>;
  };
}

interface LinearUser {
  id: string;
  name: string;
  email: string;
}

interface LinearGraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

export class LinearCollector extends BaseCollector {
  readonly source = 'linear' as const;
  readonly name = 'Linear';

  private apiBase = 'https://api.linear.app/graphql';

  isEnabled(): boolean {
    return this.config.collectors.linear.enabled;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const token = await getCredential('linear-api-key');
    if (!token) {
      this.log('No Linear API key found, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Get current user
      const user = await this.getCurrentUser(token);
      this.log(`Collecting for user: ${user.name}`, options);

      // Get assigned issues
      const issues = await this.getAssignedIssues(token, user.id, options);
      items.push(...issues);
    } catch (error) {
      this.log(`Error collecting from Linear: ${error}`, options);
      throw error;
    }

    return items;
  }

  private async getCurrentUser(token: string): Promise<LinearUser> {
    const query = `
      query {
        viewer {
          id
          name
          email
        }
      }
    `;

    const response = await this.executeQuery<{ viewer: LinearUser }>(query, token);
    return response.viewer;
  }

  private async getAssignedIssues(
    token: string,
    userId: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    // Note: Linear doesn't support meaningful historical backfill.
    // We always query current assigned issues regardless of date range.
    // The backfill date parameters are ignored for this collector.

    const query = `
      query($userId: String!) {
        issues(
          filter: {
            assignee: { id: { eq: $userId } }
            state: { type: { nin: ["completed", "canceled"] } }
          }
          first: 50
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            url
            createdAt
            updatedAt
            dueDate
            priority
            state {
              name
              type
            }
            team {
              name
              key
            }
            labels {
              nodes {
                name
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.executeQuery<{
        issues: { nodes: LinearIssue[] };
      }>(query, token, { userId });

      this.log(`Found ${response.issues.nodes.length} assigned issues`, options);

      for (const issue of response.issues.nodes) {
        // Skip backlog items unless they have a due date
        if (issue.state.type === 'backlog' && !issue.dueDate) {
          continue;
        }

        // Convert Linear priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)
        // to our priority (1=highest, 5=lowest)
        const basePriority = this.convertPriority(issue.priority);

        const tags = [
          issue.team.key,
          ...issue.labels.nodes.map((l) => l.name),
        ];

        items.push({
          title: `${issue.identifier}: ${issue.title}`,
          description: issue.description?.slice(0, 200),
          sourceId: issue.id,
          sourceUrl: issue.url,
          requestDate: issue.createdAt,
          dueDate: issue.dueDate,
          basePriority,
          urgency: basePriority,
          tags,
        });
      }
    } catch (error) {
      this.log(`Error fetching assigned issues: ${error}`, options);
    }

    return items;
  }

  private convertPriority(linearPriority: number): number {
    // Linear: 0=none, 1=urgent, 2=high, 3=medium, 4=low
    // Our: 1=highest, 5=lowest
    switch (linearPriority) {
      case 1:
        return 1; // Urgent
      case 2:
        return 2; // High
      case 3:
        return 3; // Medium
      case 4:
        return 4; // Low
      default:
        return 3; // Default to medium
    }
  }

  private async executeQuery<T>(
    query: string,
    token: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(this.apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as LinearGraphQLResponse<T>;

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Linear GraphQL error: ${result.errors.map((e) => e.message).join(', ')}`);
    }

    return result.data;
  }
}
