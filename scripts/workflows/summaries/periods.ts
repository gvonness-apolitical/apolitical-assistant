/**
 * Period Calculations
 *
 * Utilities for working with summary periods (dates, weeks, months, etc.)
 */

import type { SummaryFidelity } from './types.js';

/**
 * Parse a period string to get start and end dates
 */
export function parsePeriod(
  fidelity: SummaryFidelity,
  period: string
): { startDate: string; endDate: string } {
  switch (fidelity) {
    case 'daily':
      // Period format: YYYY-MM-DD
      return {
        startDate: period,
        endDate: period,
      };

    case 'weekly': {
      // Period format: YYYY-Www (e.g., 2025-W03)
      const weekMatch = period.match(/^(\d{4})-W(\d{2})$/);
      if (!weekMatch) {
        throw new Error(`Invalid weekly period format: ${period}`);
      }
      const [, yearStr, weekStr] = weekMatch;
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekStr, 10);

      // Calculate start of week (Monday)
      const jan1 = new Date(year, 0, 1);
      const daysToFirstMonday = (8 - jan1.getDay()) % 7 || 7;
      const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return {
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
      };
    }

    case 'monthly': {
      // Period format: YYYY-MM
      const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
      if (!monthMatch) {
        throw new Error(`Invalid monthly period format: ${period}`);
      }
      const [, yearStr, monthStr] = monthMatch;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of month

      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    }

    case 'quarterly': {
      // Period format: YYYY-Qn (e.g., 2025-Q1)
      const quarterMatch = period.match(/^(\d{4})-Q([1-4])$/);
      if (!quarterMatch) {
        throw new Error(`Invalid quarterly period format: ${period}`);
      }
      const [, yearStr, quarterStr] = quarterMatch;
      const year = parseInt(yearStr, 10);
      const quarter = parseInt(quarterStr, 10);

      const startMonth = (quarter - 1) * 3;
      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, startMonth + 3, 0);

      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    }

    case 'h1-h2': {
      // Period format: YYYY-H1 or YYYY-H2
      const halfMatch = period.match(/^(\d{4})-H([12])$/);
      if (!halfMatch) {
        throw new Error(`Invalid half-year period format: ${period}`);
      }
      const [, yearStr, halfStr] = halfMatch;
      const year = parseInt(yearStr, 10);
      const half = parseInt(halfStr, 10);

      if (half === 1) {
        return {
          startDate: `${year}-01-01`,
          endDate: `${year}-06-30`,
        };
      } else {
        return {
          startDate: `${year}-07-01`,
          endDate: `${year}-12-31`,
        };
      }
    }

    case 'yearly': {
      // Period format: YYYY
      const yearMatch = period.match(/^(\d{4})$/);
      if (!yearMatch) {
        throw new Error(`Invalid yearly period format: ${period}`);
      }
      const year = parseInt(yearMatch[1], 10);

      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }

    default:
      throw new Error(`Unknown fidelity: ${fidelity}`);
  }
}

/**
 * Get the period string for a date at a given fidelity
 */
export function getPeriodForDate(date: string, fidelity: SummaryFidelity): string {
  const d = new Date(date);

  switch (fidelity) {
    case 'daily':
      return date;

    case 'weekly': {
      // Get ISO week number
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
      }
      const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      const year = d.getFullYear();
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    }

    case 'monthly':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    case 'quarterly': {
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      return `${d.getFullYear()}-Q${quarter}`;
    }

    case 'h1-h2': {
      const half = d.getMonth() < 6 ? 1 : 2;
      return `${d.getFullYear()}-H${half}`;
    }

    case 'yearly':
      return String(d.getFullYear());

    default:
      throw new Error(`Unknown fidelity: ${fidelity}`);
  }
}

/**
 * Get the current period for a fidelity
 */
export function getCurrentPeriod(fidelity: SummaryFidelity): string {
  return getPeriodForDate(new Date().toISOString().split('T')[0], fidelity);
}

/**
 * Get the previous period
 */
export function getPreviousPeriod(fidelity: SummaryFidelity, period: string): string {
  const { startDate } = parsePeriod(fidelity, period);
  const d = new Date(startDate);

  switch (fidelity) {
    case 'daily':
      d.setDate(d.getDate() - 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() - 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() - 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() - 3);
      break;
    case 'h1-h2':
      d.setMonth(d.getMonth() - 6);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() - 1);
      break;
  }

  return getPeriodForDate(d.toISOString().split('T')[0], fidelity);
}

/**
 * Get the next period
 */
export function getNextPeriod(fidelity: SummaryFidelity, period: string): string {
  const { endDate } = parsePeriod(fidelity, period);
  const d = new Date(endDate);
  d.setDate(d.getDate() + 1);
  return getPeriodForDate(d.toISOString().split('T')[0], fidelity);
}

/**
 * Get the source fidelity for a higher-level summary
 * (e.g., weekly summaries are built from daily summaries)
 */
export function getSourceFidelity(fidelity: SummaryFidelity): SummaryFidelity | null {
  switch (fidelity) {
    case 'daily':
      return null; // Daily summaries are built from raw data
    case 'weekly':
      return 'daily';
    case 'monthly':
      return 'weekly';
    case 'quarterly':
      return 'monthly';
    case 'h1-h2':
      return 'quarterly';
    case 'yearly':
      return 'h1-h2';
    default:
      return null;
  }
}

/**
 * Get all source periods needed to build a summary
 */
export function getSourcePeriods(fidelity: SummaryFidelity, period: string): string[] {
  const sourceFidelity = getSourceFidelity(fidelity);
  if (!sourceFidelity) {
    return [];
  }

  const { startDate, endDate } = parsePeriod(fidelity, period);
  const periods: string[] = [];

  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    periods.push(getPeriodForDate(currentDate.toISOString().split('T')[0], sourceFidelity));

    // Move to next period
    switch (sourceFidelity) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      case 'h1-h2':
        currentDate.setMonth(currentDate.getMonth() + 6);
        break;
    }
  }

  // Remove duplicates
  return [...new Set(periods)];
}

/**
 * Format a period for display
 */
export function formatPeriod(fidelity: SummaryFidelity, period: string): string {
  const { startDate, endDate } = parsePeriod(fidelity, period);

  switch (fidelity) {
    case 'daily':
      return new Date(startDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    case 'weekly':
      return `Week of ${new Date(startDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${new Date(endDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;

    case 'monthly':
      return new Date(startDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      });

    case 'quarterly':
      return `Q${period.slice(-1)} ${period.slice(0, 4)}`;

    case 'h1-h2':
      return `${period.slice(-2) === 'H1' ? 'First Half' : 'Second Half'} ${period.slice(0, 4)}`;

    case 'yearly':
      return period;

    default:
      return period;
  }
}
