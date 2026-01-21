/**
 * Markdown Output Generation
 *
 * Generate markdown output for summaries.
 */

import type { SummaryDocument, SummaryItem, TrendAnalysis } from './types.js';
import { formatPeriod } from './periods.js';

/**
 * Generate markdown for a summary document
 */
export function generateMarkdown(document: SummaryDocument): string {
  const lines: string[] = [];

  // Header
  const formattedPeriod = formatPeriod(document.fidelity, document.period);
  lines.push(`# ${document.fidelity.charAt(0).toUpperCase() + document.fidelity.slice(1)} Summary: ${formattedPeriod}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(document.generatedAt).toLocaleString()}*`);
  lines.push('');

  // Overview stats
  lines.push('## Overview');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Items | ${document.stats.totalItems} |`);
  lines.push(`| Engineering | ${document.stats.byCategory.engineering ?? 0} |`);
  lines.push(`| Management | ${document.stats.byCategory.management ?? 0} |`);
  lines.push(`| Business | ${document.stats.byCategory.business ?? 0} |`);
  lines.push(`| P0/P1 (High Priority) | ${(document.stats.byPriority.P0 ?? 0) + (document.stats.byPriority.P1 ?? 0)} |`);
  lines.push(`| Action Items | ${document.stats.actionItems} |`);
  lines.push(`| Completed | ${document.stats.completedActionItems} |`);
  lines.push('');

  // Trends (if available)
  if (document.trends) {
    lines.push(...generateTrendsSection(document.trends));
  }

  // High Priority Items
  const highPriority = [
    ...document.engineering,
    ...document.management,
    ...document.business,
  ].filter((i) => i.priority === 'P0' || i.priority === 'P1');

  if (highPriority.length > 0) {
    lines.push('## 🔥 High Priority Items');
    lines.push('');
    for (const item of highPriority) {
      lines.push(formatItem(item));
    }
    lines.push('');
  }

  // Engineering Section
  if (document.engineering.length > 0) {
    lines.push('## Engineering');
    lines.push('');
    for (const item of document.engineering) {
      lines.push(formatItem(item));
    }
    lines.push('');
  }

  // Management Section
  if (document.management.length > 0) {
    lines.push('## Management');
    lines.push('');
    for (const item of document.management) {
      lines.push(formatItem(item));
    }
    lines.push('');
  }

  // Business Section
  if (document.business.length > 0) {
    lines.push('## Business');
    lines.push('');
    for (const item of document.business) {
      lines.push(formatItem(item));
    }
    lines.push('');
  }

  // TODO Progress
  lines.push('## TODO Progress');
  lines.push('');
  lines.push(`- Created: ${document.todoProgress.created}`);
  lines.push(`- Completed: ${document.todoProgress.completed}`);
  lines.push(`- Pending: ${document.todoProgress.pending}`);
  lines.push('');

  // Sources breakdown
  lines.push('## Sources');
  lines.push('');
  for (const [source, count] of Object.entries(document.stats.bySource)) {
    lines.push(`- ${source}: ${count}`);
  }
  lines.push('');

  // Metadata
  lines.push('---');
  lines.push('');
  lines.push('*Metadata*');
  lines.push(`- ID: ${document.id}`);
  lines.push(`- Period: ${document.period} (${document.startDate} to ${document.endDate})`);
  if (document.sourceSummaries && document.sourceSummaries.length > 0) {
    lines.push(`- Source Summaries: ${document.sourceSummaries.length}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format a single summary item
 */
function formatItem(item: SummaryItem): string {
  const priorityEmoji = {
    P0: '🔴',
    P1: '🟠',
    P2: '🟡',
    P3: '🟢',
  };

  const statusEmoji = item.todoStatus === 'completed' ? '✅' : item.todoId ? '📋' : '';

  let line = `- ${priorityEmoji[item.priority]} **[${item.priority}]** ${item.title}`;

  if (statusEmoji) {
    line += ` ${statusEmoji}`;
  }

  // Add source links
  const links = item.sources
    .filter((s) => s.url)
    .map((s) => `[${s.type}](${s.url})`)
    .join(', ');

  if (links) {
    line += ` (${links})`;
  }

  // Add description if present
  if (item.description) {
    line += `\n  - ${item.description}`;
  }

  return line;
}

/**
 * Generate trends section
 */
function generateTrendsSection(trends: TrendAnalysis): string[] {
  const lines: string[] = [];

  lines.push('## Trends');
  lines.push('');

  // Incident trends
  if (trends.incidents) {
    const { count, countPreviousPeriod, trend, severityDistribution } = trends.incidents;
    const trendEmoji = trend === 'increasing' ? '📈' : trend === 'decreasing' ? '📉' : '➡️';

    lines.push('### Incidents');
    lines.push('');
    lines.push(`- This period: ${count} ${trendEmoji}`);
    lines.push(`- Previous period: ${countPreviousPeriod}`);
    lines.push(`- Trend: ${trend}`);

    if (Object.values(severityDistribution).some((v) => v > 0)) {
      lines.push('- Severity breakdown:');
      for (const [severity, cnt] of Object.entries(severityDistribution)) {
        if (cnt > 0) {
          lines.push(`  - ${severity}: ${cnt}`);
        }
      }
    }
    lines.push('');
  }

  // Delivery trends
  if (trends.delivery) {
    const { prsPerPeriod, prsPreviousPeriod } = trends.delivery;
    const change = prsPerPeriod - prsPreviousPeriod;
    const changeEmoji = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';

    lines.push('### Delivery');
    lines.push('');
    lines.push(`- PRs this period: ${prsPerPeriod} ${changeEmoji}`);
    lines.push(`- PRs previous period: ${prsPreviousPeriod}`);
    if (trends.delivery.avgCycleTime) {
      lines.push(`- Avg cycle time: ${trends.delivery.avgCycleTime.toFixed(1)} days`);
    }
    lines.push('');
  }

  // Recurring themes
  if (trends.recurringThemes && trends.recurringThemes.length > 0) {
    lines.push('### Recurring Themes');
    lines.push('');
    for (const theme of trends.recurringThemes) {
      lines.push(`- **${theme.theme}**: ${theme.occurrences} occurrences`);
      if (theme.sources.length > 0) {
        lines.push(`  - Examples: ${theme.sources.slice(0, 3).join(', ')}`);
      }
    }
    lines.push('');
  }

  // Recommendations
  if (trends.recommendations && trends.recommendations.length > 0) {
    lines.push('### Recommendations');
    lines.push('');
    for (const rec of trends.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  return lines;
}
