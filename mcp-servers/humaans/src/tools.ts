import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const HUMAANS_API_BASE = 'https://app.humaans.io/api';

// Schemas for tool inputs
const ListEmployeesSchema = z.object({
  department: z.string().optional().describe('Filter by department name'),
  status: z.enum(['active', 'inactive', 'all']).optional().default('active').describe('Employment status filter'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
});

const GetEmployeeSchema = z.object({
  employeeId: z.string().describe('The employee ID'),
});

const ListTimeOffSchema = z.object({
  employeeId: z.string().optional().describe('Filter by specific employee'),
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('all').describe('Request status filter'),
  startDate: z.string().optional().describe('Filter time off starting after this date (ISO format)'),
  endDate: z.string().optional().describe('Filter time off ending before this date (ISO format)'),
});

const GetOrgChartSchema = z.object({
  rootEmployeeId: z.string().optional().describe('Start org chart from specific employee (defaults to CEO/top level)'),
});

export function createTools(): Tool[] {
  return [
    {
      name: 'humaans_list_employees',
      description: 'List all employees in the organization with optional filters. Returns employee profiles including name, email, department, job title, and manager.',
      inputSchema: {
        type: 'object',
        properties: {
          department: {
            type: 'string',
            description: 'Filter by department name',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            default: 'active',
            description: 'Employment status filter',
          },
          limit: {
            type: 'number',
            default: 50,
            description: 'Maximum number of results',
          },
        },
      },
    },
    {
      name: 'humaans_get_employee',
      description: 'Get detailed information about a specific employee including their profile, job details, compensation, and time off balance.',
      inputSchema: {
        type: 'object',
        properties: {
          employeeId: {
            type: 'string',
            description: 'The employee ID',
          },
        },
        required: ['employeeId'],
      },
    },
    {
      name: 'humaans_list_time_off',
      description: 'List time off requests and approvals. Can filter by employee, status, and date range. Useful for seeing who is out of office.',
      inputSchema: {
        type: 'object',
        properties: {
          employeeId: {
            type: 'string',
            description: 'Filter by specific employee',
          },
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected', 'all'],
            default: 'all',
            description: 'Request status filter',
          },
          startDate: {
            type: 'string',
            description: 'Filter time off starting after this date (ISO format)',
          },
          endDate: {
            type: 'string',
            description: 'Filter time off ending before this date (ISO format)',
          },
        },
      },
    },
    {
      name: 'humaans_get_org_chart',
      description: 'Get the organization hierarchy/reporting structure. Shows who reports to whom.',
      inputSchema: {
        type: 'object',
        properties: {
          rootEmployeeId: {
            type: 'string',
            description: 'Start org chart from specific employee (defaults to CEO/top level)',
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
  const url = new URL(`${HUMAANS_API_BASE}${endpoint}`);
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
    throw new Error(`Humaans API error: ${response.status} ${response.statusText}`);
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
      case 'humaans_list_employees': {
        const parsed = ListEmployeesSchema.parse(args);
        const params: Record<string, string> = {};
        if (parsed.limit) params['$limit'] = parsed.limit.toString();

        const data = (await apiRequest('/people', token, params)) as {
          data: Array<{
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            jobTitle?: string;
            department?: { name: string };
            status: string;
            managerId?: string;
          }>;
        };

        let employees = data.data;

        // Apply filters
        if (parsed.department) {
          employees = employees.filter(
            (e) => e.department?.name?.toLowerCase() === parsed.department?.toLowerCase()
          );
        }
        if (parsed.status !== 'all') {
          employees = employees.filter((e) => e.status === parsed.status);
        }

        result = employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          email: e.email,
          jobTitle: e.jobTitle,
          department: e.department?.name,
          status: e.status,
          managerId: e.managerId,
        }));
        break;
      }

      case 'humaans_get_employee': {
        const parsed = GetEmployeeSchema.parse(args);
        const data = await apiRequest(`/people/${parsed.employeeId}`, token);
        result = data;
        break;
      }

      case 'humaans_list_time_off': {
        const parsed = ListTimeOffSchema.parse(args);
        const params: Record<string, string> = {};
        if (parsed.employeeId) params['personId'] = parsed.employeeId;

        const data = (await apiRequest('/time-away', token, params)) as {
          data: Array<{
            id: string;
            personId: string;
            startDate: string;
            endDate: string;
            status: string;
            type: string;
            requestedDays: number;
          }>;
        };

        let timeOff = data.data;

        // Apply filters
        if (parsed.status !== 'all') {
          timeOff = timeOff.filter((t) => t.status === parsed.status);
        }
        if (parsed.startDate) {
          timeOff = timeOff.filter((t) => t.startDate >= parsed.startDate!);
        }
        if (parsed.endDate) {
          timeOff = timeOff.filter((t) => t.endDate <= parsed.endDate!);
        }

        result = timeOff;
        break;
      }

      case 'humaans_get_org_chart': {
        const parsed = GetOrgChartSchema.parse(args);

        // Fetch all employees to build org chart
        const data = (await apiRequest('/people', token, { '$limit': '200' })) as {
          data: Array<{
            id: string;
            firstName: string;
            lastName: string;
            jobTitle?: string;
            managerId?: string;
            status: string;
          }>;
        };

        const employees = data.data.filter((e) => e.status === 'active');
        const employeeMap = new Map(employees.map((e) => [e.id, e]));

        // Build tree structure
        interface OrgNode {
          id: string;
          name: string;
          jobTitle?: string;
          reports: OrgNode[];
        }

        function buildTree(managerId: string | null): OrgNode[] {
          return employees
            .filter((e) => (e.managerId || null) === managerId)
            .map((e) => ({
              id: e.id,
              name: `${e.firstName} ${e.lastName}`,
              jobTitle: e.jobTitle,
              reports: buildTree(e.id),
            }));
        }

        if (parsed.rootEmployeeId) {
          const rootEmployee = employeeMap.get(parsed.rootEmployeeId);
          if (rootEmployee) {
            result = {
              id: rootEmployee.id,
              name: `${rootEmployee.firstName} ${rootEmployee.lastName}`,
              jobTitle: rootEmployee.jobTitle,
              reports: buildTree(rootEmployee.id),
            };
          } else {
            result = { error: 'Employee not found' };
          }
        } else {
          // Return from top (employees with no manager)
          result = buildTree(null);
        }
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
