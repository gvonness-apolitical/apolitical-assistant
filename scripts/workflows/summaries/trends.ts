/**
 * Trend Analysis
 *
 * Detect trends and patterns across summaries.
 */

import type { SummaryDocument, SummaryFidelity, TrendAnalysis } from './types.js';
import { loadSummary, listSummaries } from './config.js';
import { getPreviousPeriod } from './periods.js';
import { invokeClaudeWithInput, parseClaudeJson } from '../shared/claude.js';

/**
 * Analyze trends for a summary
 */
export async function analyzeTrends(
  summary: SummaryDocument,
  fidelity: SummaryFidelity,
  period: string
): Promise<TrendAnalysis> {
  // Get previous period for comparison
  const previousPeriod = getPreviousPeriod(fidelity, period);
  const previousSummary = loadSummary(fidelity, previousPeriod);

  // Get all items from current summary
  const allItems = [...summary.engineering, ...summary.management, ...summary.business];

  // Analyze incidents
  const incidents = analyzeIncidents(allItems, previousSummary);

  // Analyze delivery (from dev-analytics items)
  const delivery = analyzeDelivery(allItems, previousSummary);

  // Find recurring themes
  const recurringThemes = await findRecurringThemes(summary, fidelity);

  // Generate recommendations
  const recommendations = await generateRecommendations(incidents, delivery, recurringThemes);

  return {
    incidents,
    delivery,
    recurringThemes,
    recommendations,
  };
}

/**
 * Analyze incident trends
 */
function analyzeIncidents(
  items: SummaryDocument['engineering'],
  previousSummary: SummaryDocument | null
): TrendAnalysis['incidents'] {
  // Find incident-related items
  const incidentItems = items.filter((item) =>
    item.sources.some((s) => s.type === 'incident-io') ||
    item.title.toLowerCase().includes('incident') ||
    item.sources.some((s) => s.title?.toLowerCase().includes('incident'))
  );

  const previousIncidentItems = previousSummary
    ? [
        ...previousSummary.engineering,
        ...previousSummary.management,
        ...previousSummary.business,
      ].filter((item) =>
        item.sources.some((s) => s.type === 'incident-io') ||
        item.title.toLowerCase().includes('incident')
      )
    : [];

  const count = incidentItems.length;
  const countPreviousPeriod = previousIncidentItems.length;

  // Determine trend
  let trend: 'increasing' | 'decreasing' | 'stable';
  if (count > countPreviousPeriod * 1.2) {
    trend = 'increasing';
  } else if (count < countPreviousPeriod * 0.8) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  // Count by severity (inferred from priority)
  const severityDistribution: Record<string, number> = {
    critical: incidentItems.filter((i) => i.priority === 'P0').length,
    high: incidentItems.filter((i) => i.priority === 'P1').length,
    medium: incidentItems.filter((i) => i.priority === 'P2').length,
    low: incidentItems.filter((i) => i.priority === 'P3').length,
  };

  return {
    count,
    countPreviousPeriod,
    trend,
    severityDistribution,
  };
}

/**
 * Analyze delivery trends
 */
function analyzeDelivery(
  items: SummaryDocument['engineering'],
  previousSummary: SummaryDocument | null
): TrendAnalysis['delivery'] {
  // Find dev-analytics items (for future detailed delivery metrics)
  const _deliveryItems = items.filter((item) =>
    item.sources.some((s) => s.type === 'dev-analytics' || s.type === 'github')
  );

  const _previousDeliveryItems = previousSummary
    ? previousSummary.engineering.filter((item) =>
        item.sources.some((s) => s.type === 'dev-analytics' || s.type === 'github')
      )
    : [];

  // Count PRs (rough estimate from GitHub items)
  const prItems = items.filter((item) =>
    item.sources.some((s) => s.type === 'github') ||
    item.title.toLowerCase().includes('pr') ||
    item.title.toLowerCase().includes('pull request')
  );

  const previousPrItems = previousSummary
    ? previousSummary.engineering.filter((item) =>
        item.sources.some((s) => s.type === 'github') ||
        item.title.toLowerCase().includes('pr')
      )
    : [];

  return {
    prsPerPeriod: prItems.length,
    prsPreviousPeriod: previousPrItems.length,
  };
}

/**
 * Find recurring themes across summaries
 */
async function findRecurringThemes(
  currentSummary: SummaryDocument,
  fidelity: SummaryFidelity
): Promise<TrendAnalysis['recurringThemes']> {
  // Get recent summaries
  const recentPeriods = listSummaries(fidelity).slice(0, 5); // Last 5 periods
  const recentSummaries: SummaryDocument[] = [];

  for (const period of recentPeriods) {
    const summary = loadSummary(fidelity, period);
    if (summary && summary.id !== currentSummary.id) {
      recentSummaries.push(summary);
    }
  }

  if (recentSummaries.length === 0) {
    return [];
  }

  // Collect all titles
  const currentTitles = [
    ...currentSummary.engineering,
    ...currentSummary.management,
    ...currentSummary.business,
  ].map((i) => i.title);

  const previousTitles = recentSummaries.flatMap((s) => [
    ...s.engineering,
    ...s.management,
    ...s.business,
  ]).map((i) => i.title);

  // Use Claude to find themes
  const prompt = `
Analyze these summary item titles and find recurring themes or topics.

Current period titles:
${currentTitles.slice(0, 20).join('\n')}

Previous periods titles:
${previousTitles.slice(0, 40).join('\n')}

Find themes that appear multiple times. Respond with JSON:
[
  {
    "theme": "Short theme name",
    "occurrences": number,
    "sources": ["item titles that match"],
    "firstSeen": "approximate when first appeared"
  }
]`;

  const response = await invokeClaudeWithInput(prompt);
  const parsed = parseClaudeJson<TrendAnalysis['recurringThemes']>(response);

  return parsed ?? [];
}

/**
 * Generate recommendations based on trends
 */
async function generateRecommendations(
  incidents: TrendAnalysis['incidents'],
  delivery: TrendAnalysis['delivery'],
  recurringThemes: TrendAnalysis['recurringThemes']
): Promise<string[]> {
  const recommendations: string[] = [];

  // Incident-based recommendations
  if (incidents?.trend === 'increasing') {
    recommendations.push(
      '🚨 Incident frequency is increasing - consider a system stability review'
    );
  }

  if (incidents?.severityDistribution.critical && incidents.severityDistribution.critical > 0) {
    recommendations.push(
      '⚠️ Critical incidents occurred - review incident response and prevention measures'
    );
  }

  // Delivery-based recommendations
  if (delivery && delivery.prsPerPeriod < delivery.prsPreviousPeriod * 0.7) {
    recommendations.push(
      '📉 PR velocity decreased significantly - check for blockers or competing priorities'
    );
  }

  // Theme-based recommendations
  for (const theme of recurringThemes) {
    if (theme.occurrences >= 3) {
      recommendations.push(
        `🔄 Recurring theme: "${theme.theme}" (${theme.occurrences} occurrences) - consider dedicated attention`
      );
    }
  }

  return recommendations;
}
