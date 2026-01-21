/**
 * Calendar Collector
 *
 * Collects calendar events from Google Calendar via MCP.
 * Identifies meetings, meeting types, and prep requirements.
 */

import { getCredential } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

/**
 * Calendar event structure
 */
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    self?: boolean;
    organizer?: boolean;
  }>;
  organizer?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
  htmlLink?: string;
  recurringEventId?: string;
  conferenceData?: {
    conferenceId?: string;
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
}

/**
 * Meeting type classification
 */
export type MeetingType = 'one-on-one' | 'team-meeting' | 'leadership' | 'external' | 'focus' | 'other';

export class CalendarCollector extends BaseCollector {
  readonly source = 'calendar' as const;
  readonly name = 'Calendar';

  private apiBase = 'https://www.googleapis.com/calendar/v3';

  isEnabled(): boolean {
    // Calendar is enabled by default if credentials exist
    return !!getCredential('google-refresh-token');
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      this.log('No Google access token available, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Get today's events
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const events = await this.getEvents(accessToken, today.toISOString(), tomorrow.toISOString());
      this.log(`Found ${events.length} calendar events for today`, options);

      // Convert events to TODO items for meetings that need prep
      for (const event of events) {
        const meetingType = this.classifyMeeting(event);

        // Create prep TODO for meetings I'm leading or 1:1s
        if (this.needsPrep(event, meetingType)) {
          items.push({
            title: `Prep: ${event.summary}`,
            description: this.generatePrepDescription(event, meetingType),
            sourceId: `calendar-${event.id}`,
            sourceUrl: event.htmlLink,
            requestDate: new Date().toISOString().split('T')[0],
            dueDate: event.start.dateTime?.split('T')[0] ?? event.start.date,
            basePriority: meetingType === 'one-on-one' ? 2 : 3,
            urgency: 2, // Same day
            tags: ['calendar', 'meeting-prep', meetingType],
          });
        }
      }
    } catch (error) {
      this.log(`Error collecting from Calendar: ${error}`, options);
      throw error;
    }

    return items;
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string | null> {
    const refreshToken = getCredential('google-refresh-token');
    const clientId = getCredential('google-oauth-client-id');
    const clientSecret = getCredential('google-oauth-client-secret');

    if (!refreshToken || !clientId || !clientSecret) {
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { access_token: string };
      return data.access_token;
    } catch {
      return null;
    }
  }

  /**
   * Get events for a date range
   */
  async getEvents(accessToken: string, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
    const url = new URL(`${this.apiBase}/calendars/primary/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '100');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { items?: CalendarEvent[] };
    return data.items ?? [];
  }

  /**
   * Classify the type of meeting
   */
  classifyMeeting(event: CalendarEvent): MeetingType {
    const title = event.summary?.toLowerCase() ?? '';
    const attendeeCount = event.attendees?.filter((a) => !a.self).length ?? 0;

    // Focus time / blocked time
    if (
      title.includes('focus') ||
      title.includes('blocked') ||
      title.includes('do not book') ||
      attendeeCount === 0
    ) {
      return 'focus';
    }

    // 1:1
    if (
      attendeeCount === 1 ||
      title.includes('1:1') ||
      title.includes('1-1') ||
      title.includes('one on one') ||
      title.includes('1on1')
    ) {
      return 'one-on-one';
    }

    // Team meetings
    const teamKeywords = ['standup', 'retro', 'retrospective', 'sprint', 'planning', 'sync', 'team'];
    if (teamKeywords.some((k) => title.includes(k))) {
      return 'team-meeting';
    }

    // Leadership
    const leadershipKeywords = ['leadership', 'exec', 'director', 'all-hands', 'town hall', 'staff'];
    if (leadershipKeywords.some((k) => title.includes(k))) {
      return 'leadership';
    }

    // External
    const externalKeywords = ['external', 'vendor', 'partner', 'client', 'interview', 'candidate'];
    if (externalKeywords.some((k) => title.includes(k))) {
      return 'external';
    }

    // Check if external based on attendee domains
    const myEmail = event.attendees?.find((a) => a.self)?.email;
    if (myEmail) {
      const myDomain = myEmail.split('@')[1];
      const hasExternalAttendees = event.attendees?.some((a) => {
        if (a.self) return false;
        const domain = a.email.split('@')[1];
        return domain !== myDomain;
      });
      if (hasExternalAttendees) {
        return 'external';
      }
    }

    return 'other';
  }

  /**
   * Check if a meeting needs prep
   */
  private needsPrep(event: CalendarEvent, meetingType: MeetingType): boolean {
    // Skip focus time
    if (meetingType === 'focus') return false;

    // 1:1s always need prep
    if (meetingType === 'one-on-one') return true;

    // Meetings I'm leading need prep
    if (event.organizer?.self) return true;

    // Leadership meetings need prep
    if (meetingType === 'leadership') return true;

    // External meetings need prep
    if (meetingType === 'external') return true;

    return false;
  }

  /**
   * Generate prep description based on meeting type
   */
  private generatePrepDescription(event: CalendarEvent, meetingType: MeetingType): string {
    const parts: string[] = [];

    // Event details
    const startTime = event.start.dateTime
      ? new Date(event.start.dateTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : event.start.date;

    parts.push(`Time: ${startTime}`);

    // Attendees
    const attendees = event.attendees
      ?.filter((a) => !a.self)
      .map((a) => a.displayName || a.email)
      .slice(0, 5);

    if (attendees && attendees.length > 0) {
      parts.push(`Attendees: ${attendees.join(', ')}`);
    }

    // Meeting link
    const meetingLink = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
    if (meetingLink) {
      parts.push(`Meeting link: ${meetingLink}`);
    }

    // Type-specific prep notes
    switch (meetingType) {
      case 'one-on-one':
        parts.push('', 'Prep needed:', '- Review recent activity', '- Check previous 1:1 notes', '- Prepare talking points');
        break;
      case 'leadership':
        parts.push('', 'Prep needed:', '- Review team updates', '- Prepare status report', '- Note any blockers or escalations');
        break;
      case 'external':
        parts.push('', 'Prep needed:', '- Review attendee background', '- Prepare agenda', '- Note key discussion points');
        break;
    }

    return parts.join('\n');
  }

  /**
   * Get events for a specific date (for meeting prep)
   */
  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return [];
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    return this.getEvents(accessToken, startDate.toISOString(), endDate.toISOString());
  }

  /**
   * Get upcoming events (for briefing)
   */
  async getUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return [];
    }

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.getEvents(accessToken, now.toISOString(), endDate.toISOString());
  }
}
