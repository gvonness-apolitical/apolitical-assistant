import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const LATTICE_API_BASE = 'https://api.latticehq.com/v1';

// Schemas for tool inputs
const ListReviewsSchema = z.object({
  status: z.enum(['upcoming', 'in_progress', 'completed', 'all']).optional().default('all').describe('Filter by review status'),
  userId: z.string().optional().describe('Filter by specific user ID'),
  limit: z.number().optional().default(25).describe('Maximum number of results'),
});

const GetGoalsSchema = z.object({
  userId: z.string().optional().describe('Filter goals by user (defaults to current user)'),
  status: z.enum(['active', 'completed', 'all']).optional().default('active').describe('Goal status filter'),
  type: z.enum(['individual', 'team', 'company', 'all']).optional().default('all').describe('Goal type filter'),
});

const ListFeedbackSchema = z.object({
  userId: z.string().optional().describe('Filter by user who gave or received feedback'),
  direction: z.enum(['given', 'received', 'all']).optional().default('all').describe('Filter by feedback direction'),
  since: z.string().optional().describe('Filter feedback after this date (ISO format)'),
  limit: z.number().optional().default(25).describe('Maximum number of results'),
});

const GetOneOnOnesSchema = z.object({
  userId: z.string().optional().describe('Filter 1:1s by participant'),
  managerId: z.string().optional().describe('Filter 1:1s by manager'),
  upcoming: z.boolean().optional().default(false).describe('Only return upcoming 1:1s'),
  limit: z.number().optional().default(10).describe('Maximum number of results'),
});

export function createTools(): Tool[] {
  return [
    {
      name: 'lattice_list_reviews',
      description: 'List performance reviews from Lattice. Can filter by status (upcoming, in_progress, completed) and user. Returns review cycles and individual reviews.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['upcoming', 'in_progress', 'completed', 'all'],
            default: 'all',
            description: 'Filter by review status',
          },
          userId: {
            type: 'string',
            description: 'Filter by specific user ID',
          },
          limit: {
            type: 'number',
            default: 25,
            description: 'Maximum number of results',
          },
        },
      },
    },
    {
      name: 'lattice_get_goals',
      description: 'Get OKRs and goals from Lattice. Shows goal progress, key results, and alignment. Can filter by user, status, and goal type (individual/team/company).',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'Filter goals by user (defaults to current user)',
          },
          status: {
            type: 'string',
            enum: ['active', 'completed', 'all'],
            default: 'active',
            description: 'Goal status filter',
          },
          type: {
            type: 'string',
            enum: ['individual', 'team', 'company', 'all'],
            default: 'all',
            description: 'Goal type filter',
          },
        },
      },
    },
    {
      name: 'lattice_list_feedback',
      description: 'List feedback given and received in Lattice. Useful for preparing for reviews or understanding team dynamics.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'Filter by user who gave or received feedback',
          },
          direction: {
            type: 'string',
            enum: ['given', 'received', 'all'],
            default: 'all',
            description: 'Filter by feedback direction',
          },
          since: {
            type: 'string',
            description: 'Filter feedback after this date (ISO format)',
          },
          limit: {
            type: 'number',
            default: 25,
            description: 'Maximum number of results',
          },
        },
      },
    },
    {
      name: 'lattice_get_one_on_ones',
      description: 'Get 1:1 meeting notes and agendas from Lattice. Shows talking points, action items, and notes from previous meetings.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'Filter 1:1s by participant',
          },
          managerId: {
            type: 'string',
            description: 'Filter 1:1s by manager',
          },
          upcoming: {
            type: 'boolean',
            default: false,
            description: 'Only return upcoming 1:1s',
          },
          limit: {
            type: 'number',
            default: 10,
            description: 'Maximum number of results',
          },
        },
      },
    },
  ];
}

async function apiRequest(
  endpoint: string,
  token: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const url = new URL(`${LATTICE_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Lattice API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  token: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    let result: unknown;

    switch (name) {
      case 'lattice_list_reviews': {
        const parsed = ListReviewsSchema.parse(args);
        const params: Record<string, string> = {};

        if (parsed.limit) params['per_page'] = parsed.limit.toString();
        if (parsed.userId) params['user_id'] = parsed.userId;

        const data = (await apiRequest('/reviews', token, params)) as {
          data: Array<{
            id: string;
            name: string;
            status: string;
            start_date: string;
            end_date: string;
            reviewee?: { name: string; email: string };
            reviewer?: { name: string; email: string };
          }>;
        };

        let reviews = data.data;

        // Apply status filter
        if (parsed.status !== 'all') {
          reviews = reviews.filter((r) => {
            const now = new Date();
            const startDate = new Date(r.start_date);
            const endDate = new Date(r.end_date);

            switch (parsed.status) {
              case 'upcoming':
                return startDate > now;
              case 'in_progress':
                return startDate <= now && endDate >= now;
              case 'completed':
                return endDate < now;
              default:
                return true;
            }
          });
        }

        result = reviews.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          startDate: r.start_date,
          endDate: r.end_date,
          reviewee: r.reviewee?.name,
          reviewer: r.reviewer?.name,
        }));
        break;
      }

      case 'lattice_get_goals': {
        const parsed = GetGoalsSchema.parse(args);
        const params: Record<string, string> = {};

        if (parsed.userId) params['user_id'] = parsed.userId;

        const data = (await apiRequest('/goals', token, params)) as {
          data: Array<{
            id: string;
            title: string;
            description?: string;
            status: string;
            progress: number;
            goal_type: string;
            due_date?: string;
            owner?: { name: string };
            key_results?: Array<{
              title: string;
              progress: number;
              target_value?: number;
              current_value?: number;
            }>;
          }>;
        };

        let goals = data.data;

        // Apply filters
        if (parsed.status !== 'all') {
          goals = goals.filter((g) => {
            if (parsed.status === 'active') {
              return g.status.toLowerCase() !== 'completed';
            }
            return g.status.toLowerCase() === 'completed';
          });
        }

        if (parsed.type !== 'all') {
          goals = goals.filter(
            (g) => g.goal_type.toLowerCase() === parsed.type
          );
        }

        result = goals.map((g) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          status: g.status,
          progress: `${Math.round(g.progress * 100)}%`,
          type: g.goal_type,
          dueDate: g.due_date,
          owner: g.owner?.name,
          keyResults: g.key_results?.map((kr) => ({
            title: kr.title,
            progress: `${Math.round(kr.progress * 100)}%`,
            current: kr.current_value,
            target: kr.target_value,
          })),
        }));
        break;
      }

      case 'lattice_list_feedback': {
        const parsed = ListFeedbackSchema.parse(args);
        const params: Record<string, string> = {};

        if (parsed.limit) params['per_page'] = parsed.limit.toString();
        if (parsed.userId) params['user_id'] = parsed.userId;
        if (parsed.since) params['since'] = parsed.since;

        const data = (await apiRequest('/feedback', token, params)) as {
          data: Array<{
            id: string;
            content: string;
            created_at: string;
            giver?: { name: string; email: string };
            receiver?: { name: string; email: string };
            visibility: string;
          }>;
        };

        let feedback = data.data;

        // Apply direction filter
        if (parsed.direction !== 'all' && parsed.userId) {
          feedback = feedback.filter((f) => {
            if (parsed.direction === 'given') {
              return f.giver?.email === parsed.userId;
            }
            return f.receiver?.email === parsed.userId;
          });
        }

        result = feedback.map((f) => ({
          id: f.id,
          content: f.content,
          createdAt: f.created_at,
          from: f.giver?.name,
          to: f.receiver?.name,
          visibility: f.visibility,
        }));
        break;
      }

      case 'lattice_get_one_on_ones': {
        const parsed = GetOneOnOnesSchema.parse(args);
        const params: Record<string, string> = {};

        if (parsed.limit) params['per_page'] = parsed.limit.toString();
        if (parsed.userId) params['user_id'] = parsed.userId;
        if (parsed.managerId) params['manager_id'] = parsed.managerId;

        const data = (await apiRequest('/one_on_ones', token, params)) as {
          data: Array<{
            id: string;
            scheduled_at: string;
            status: string;
            participant?: { name: string };
            manager?: { name: string };
            talking_points?: Array<{
              content: string;
              completed: boolean;
              author?: { name: string };
            }>;
            action_items?: Array<{
              content: string;
              completed: boolean;
              assignee?: { name: string };
            }>;
            notes?: string;
          }>;
        };

        let oneOnOnes = data.data;

        // Filter for upcoming if requested
        if (parsed.upcoming) {
          const now = new Date();
          oneOnOnes = oneOnOnes.filter(
            (o) => new Date(o.scheduled_at) > now
          );
        }

        result = oneOnOnes.map((o) => ({
          id: o.id,
          scheduledAt: o.scheduled_at,
          status: o.status,
          participant: o.participant?.name,
          manager: o.manager?.name,
          talkingPoints: o.talking_points?.map((tp) => ({
            content: tp.content,
            completed: tp.completed,
            author: tp.author?.name,
          })),
          actionItems: o.action_items?.map((ai) => ({
            content: ai.content,
            completed: ai.completed,
            assignee: ai.assignee?.name,
          })),
          notes: o.notes,
        }));
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
