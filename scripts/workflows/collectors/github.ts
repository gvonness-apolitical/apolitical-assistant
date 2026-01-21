/**
 * GitHub TODO Collector
 *
 * Collects TODOs from GitHub:
 * - Pull requests awaiting review
 * - Issues assigned to the user
 */

import { getCredential } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: { login: string };
  repository_url: string;
  draft: boolean;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  repository_url: string;
}

interface GitHubUser {
  login: string;
}

export class GitHubCollector extends BaseCollector {
  readonly source = 'github' as const;
  readonly name = 'GitHub';

  private apiBase = 'https://api.github.com';

  isEnabled(): boolean {
    return this.config.collectors.github.enabled;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const token = await getCredential('github-token');
    if (!token) {
      this.log('No GitHub token found, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Get current user
      const user = await this.fetchGitHubApi<GitHubUser>('/user', token);
      this.log(`Collecting for user: ${user.login}`, options);

      // Get PRs awaiting review
      if (this.config.collectors.github.reviewRequestsOnly) {
        const prs = await this.getReviewRequests(token, user.login, options);
        items.push(...prs);
      }

      // Get assigned issues (optional, controlled by config)
      const issues = await this.getAssignedIssues(token, user.login, options);
      items.push(...issues);
    } catch (error) {
      this.log(`Error collecting from GitHub: ${error}`, options);
      throw error;
    }

    return items;
  }

  private async getReviewRequests(
    token: string,
    username: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      // Search for PRs where user is requested as reviewer
      const searchQuery = `is:pr is:open review-requested:${username}`;
      const response = await this.fetchGitHubApi<{ items: GitHubPullRequest[] }>(
        `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=50`,
        token
      );

      this.log(`Found ${response.items.length} PRs awaiting review`, options);

      for (const pr of response.items) {
        // Skip draft PRs
        if (pr.draft) continue;

        // Extract repo name from repository_url
        const repoName = pr.repository_url.split('/').slice(-2).join('/');

        items.push({
          title: `Review PR #${pr.number}: ${pr.title}`,
          description: `Repository: ${repoName}\nAuthor: ${pr.user.login}`,
          sourceId: `pr-${pr.id}`,
          sourceUrl: pr.html_url,
          requestDate: pr.created_at,
          basePriority: 2, // PR reviews are generally high priority
          urgency: 2,
          tags: ['review', 'pr', repoName],
        });
      }
    } catch (error) {
      this.log(`Error fetching review requests: ${error}`, options);
    }

    return items;
  }

  private async getAssignedIssues(
    token: string,
    username: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      // Search for issues assigned to user
      const searchQuery = `is:issue is:open assignee:${username}`;
      const response = await this.fetchGitHubApi<{ items: GitHubIssue[] }>(
        `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=50`,
        token
      );

      this.log(`Found ${response.items.length} assigned issues`, options);

      for (const issue of response.items) {
        // Extract repo name from repository_url
        const repoName = issue.repository_url.split('/').slice(-2).join('/');

        items.push({
          title: `Issue #${issue.number}: ${issue.title}`,
          description: `Repository: ${repoName}`,
          sourceId: `issue-${issue.id}`,
          sourceUrl: issue.html_url,
          requestDate: issue.created_at,
          basePriority: 3,
          urgency: 3,
          tags: ['issue', repoName],
        });
      }
    } catch (error) {
      this.log(`Error fetching assigned issues: ${error}`, options);
    }

    return items;
  }

  private async fetchGitHubApi<T>(endpoint: string, token: string): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiBase}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'apolitical-assistant',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}
