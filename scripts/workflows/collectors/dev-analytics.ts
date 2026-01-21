/**
 * Dev Analytics Collector
 *
 * Collects delivery reports from the apolitical-dev-analytics project.
 * Extracts key metrics, trends, and highlights from individual, team, and director reports.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

/**
 * Report types available from dev-analytics
 */
type ReportType = 'individual' | 'team' | 'director';

/**
 * Parsed report structure
 */
interface DevAnalyticsReport {
  type: ReportType;
  date: string;
  title: string;
  content: string;
  path: string;
  metrics?: {
    prsOpened?: number;
    prsMerged?: number;
    reviewsGiven?: number;
    avgCycleTime?: number;
    issuesClosed?: number;
  };
  individual?: string; // For individual reports, the person's name
}

export class DevAnalyticsCollector extends BaseCollector {
  readonly source = 'dev-analytics' as const;
  readonly name = 'Dev Analytics';

  private reportsPath: string;

  constructor() {
    super();
    // Default path - can be overridden in config
    this.reportsPath =
      (this.config.collectors as Record<string, { reportsPath?: string }>)?.devAnalytics
        ?.reportsPath ?? join(PROJECT_ROOT, '../apolitical-dev-analytics/reports');
  }

  isEnabled(): boolean {
    // Check if dev-analytics reports exist
    return existsSync(this.reportsPath);
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    if (!this.isEnabled()) {
      this.log('Dev analytics reports path not found, skipping', options);
      return [];
    }

    try {
      // Collect recent reports
      const reports = this.findRecentReports(options);
      this.log(`Found ${reports.length} recent dev analytics reports`, options);

      // Convert reports to raw TODO items for action items
      for (const report of reports) {
        const actionItems = this.extractActionItems(report);
        items.push(...actionItems);
      }
    } catch (error) {
      this.log(`Error collecting from dev-analytics: ${error}`, options);
      throw error;
    }

    return items;
  }

  /**
   * Find recent reports in the reports directory
   */
  private findRecentReports(options?: CollectOptions): DevAnalyticsReport[] {
    const reports: DevAnalyticsReport[] = [];
    const now = new Date();
    const lookbackDays = 7; // Look back 1 week by default

    // Check for different report types
    const reportDirs = ['individual', 'team', 'director'];

    for (const type of reportDirs) {
      const typePath = join(this.reportsPath, type);

      if (!existsSync(typePath)) {
        continue;
      }

      // List files and find recent ones
      const files = readdirSync(typePath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        // Parse date from filename (e.g., 2025-01-15-report.md or individual-name-2025-01-15.md)
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch) continue;

        const reportDate = new Date(dateMatch[1]);
        const daysDiff = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > lookbackDays) continue;

        const filePath = join(typePath, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          const report = this.parseReport(content, type as ReportType, dateMatch[1], filePath, file);
          if (report) {
            reports.push(report);
          }
        } catch (error) {
          this.log(`Error reading report ${filePath}: ${error}`, options);
        }
      }
    }

    return reports.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Parse a report file
   */
  private parseReport(
    content: string,
    type: ReportType,
    date: string,
    path: string,
    filename: string
  ): DevAnalyticsReport | null {
    // Extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : `${type} report ${date}`;

    // Extract individual name for individual reports
    let individual: string | undefined;
    if (type === 'individual') {
      const nameMatch = filename.match(/^(.+?)-\d{4}-\d{2}-\d{2}/);
      individual = nameMatch ? nameMatch[1].replace(/-/g, ' ') : undefined;
    }

    // Try to extract metrics
    const metrics = this.extractMetrics(content);

    return {
      type,
      date,
      title,
      content,
      path,
      metrics,
      individual,
    };
  }

  /**
   * Extract metrics from report content
   */
  private extractMetrics(content: string): DevAnalyticsReport['metrics'] {
    const metrics: DevAnalyticsReport['metrics'] = {};

    // Look for common metric patterns
    const patterns = {
      prsOpened: /PRs?\s*opened:?\s*(\d+)/i,
      prsMerged: /PRs?\s*merged:?\s*(\d+)/i,
      reviewsGiven: /reviews?\s*(?:given|completed):?\s*(\d+)/i,
      avgCycleTime: /(?:avg|average)\s*cycle\s*time:?\s*([\d.]+)/i,
      issuesClosed: /issues?\s*closed:?\s*(\d+)/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = content.match(pattern);
      if (match) {
        metrics[key as keyof typeof metrics] = parseFloat(match[1]);
      }
    }

    return Object.keys(metrics).length > 0 ? metrics : undefined;
  }

  /**
   * Extract action items from a report
   */
  private extractActionItems(report: DevAnalyticsReport): RawTodoItem[] {
    const items: RawTodoItem[] = [];

    // Look for action items section
    const actionSection = report.content.match(
      /##\s*(?:Action Items|Next Steps|Recommendations)[\s\S]*?(?=##|$)/i
    );

    if (actionSection) {
      // Extract bullet points
      const bullets = actionSection[0].match(/^\s*[-*]\s+(.+)$/gm);

      if (bullets) {
        for (const bullet of bullets) {
          const text = bullet.replace(/^\s*[-*]\s+/, '').trim();

          // Skip if too short
          if (text.length < 10) continue;

          items.push({
            title: `[${report.type}] ${text}`,
            description: `From ${report.type} report: ${report.title}`,
            sourceId: `dev-analytics-${report.date}-${items.length}`,
            sourceUrl: `file://${report.path}`,
            requestDate: report.date,
            basePriority: report.type === 'director' ? 2 : 3,
            urgency: 3,
            tags: ['dev-analytics', report.type, ...(report.individual ? [report.individual] : [])],
          });
        }
      }
    }

    return items;
  }

  /**
   * Get reports for a specific date range (for summaries)
   */
  async getReportsForDateRange(
    startDate: string,
    endDate: string,
    options?: { type?: ReportType; individual?: string }
  ): Promise<DevAnalyticsReport[]> {
    const allReports = this.findRecentReports();

    return allReports.filter((report) => {
      if (report.date < startDate || report.date > endDate) return false;
      if (options?.type && report.type !== options.type) return false;
      if (options?.individual && report.individual !== options.individual) return false;
      return true;
    });
  }

  /**
   * Get the latest director report
   */
  async getLatestDirectorReport(): Promise<DevAnalyticsReport | null> {
    const reports = this.findRecentReports();
    return reports.find((r) => r.type === 'director') ?? null;
  }

  /**
   * Get individual report for a person
   */
  async getIndividualReport(name: string, date?: string): Promise<DevAnalyticsReport | null> {
    const reports = this.findRecentReports();
    const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

    return (
      reports.find(
        (r) =>
          r.type === 'individual' &&
          r.individual?.toLowerCase().replace(/\s+/g, '-') === normalizedName &&
          (!date || r.date === date)
      ) ?? null
    );
  }
}
