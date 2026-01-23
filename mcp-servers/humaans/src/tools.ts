import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createJsonResponse,
  createErrorResponse,
  type ToolResponse,
  type HttpClient,
} from '@apolitical-assistant/mcp-shared';
import type { HumaansContext } from './index.js';

// ==================== SCHEMAS ====================

export const ListEmployeesSchema = z.object({
  department: z.string().optional().describe('Filter by department name'),
  status: z
    .enum(['active', 'inactive', 'all'])
    .optional()
    .default('active')
    .describe('Employment status filter'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
});

export const GetEmployeeSchema = z.object({
  employeeId: z.string().describe('The employee ID'),
});

export const ListTimeOffSchema = z.object({
  employeeId: z.string().optional().describe('Filter by specific employee'),
  status: z
    .enum(['pending', 'approved', 'rejected', 'all'])
    .optional()
    .default('all')
    .describe('Request status filter'),
  startDate: z
    .string()
    .optional()
    .describe('Filter time off starting after this date (ISO format)'),
  endDate: z.string().optional().describe('Filter time off ending before this date (ISO format)'),
});

export const GetOrgChartSchema = z.object({
  rootEmployeeId: z
    .string()
    .optional()
    .describe('Start org chart from specific employee (defaults to CEO/top level)'),
});

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return [
    {
      name: 'humaans_list_employees',
      description:
        'List all employees in the organization with optional filters. Returns employee profiles including name, email, department, job title, and manager.',
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
      description:
        'Get detailed information about a specific employee including their profile, job details, compensation, and time off balance.',
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
      description:
        'List time off requests and approvals. Can filter by employee, status, and date range. Useful for seeing who is out of office.',
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

// ==================== API RESPONSE TYPES ====================

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  department?: { name: string };
  status: string;
  managerId?: string;
}

interface TimeOff {
  id: string;
  personId: string;
  startDate: string;
  endDate: string;
  status: string;
  type: string;
  requestedDays: number;
}

// ==================== HANDLERS ====================

async function handleListEmployees(
  args: z.infer<typeof ListEmployeesSchema>,
  client: HttpClient
): Promise<unknown> {
  const params: Record<string, string | number | boolean> = {};
  if (args.limit) params['$limit'] = args.limit;

  const data = await client.get<{ data: Employee[] }>('/people', params);

  let employees = data.data;

  // Apply filters
  if (args.department) {
    employees = employees.filter(
      (e) => e.department?.name?.toLowerCase() === args.department?.toLowerCase()
    );
  }
  if (args.status !== 'all') {
    employees = employees.filter((e) => e.status === args.status);
  }

  return employees.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    email: e.email,
    jobTitle: e.jobTitle,
    department: e.department?.name,
    status: e.status,
    managerId: e.managerId,
  }));
}

async function handleGetEmployee(
  args: z.infer<typeof GetEmployeeSchema>,
  client: HttpClient
): Promise<unknown> {
  return client.get(`/people/${args.employeeId}`);
}

async function handleListTimeOff(
  args: z.infer<typeof ListTimeOffSchema>,
  client: HttpClient
): Promise<unknown> {
  const params: Record<string, string | number | boolean> = {};
  if (args.employeeId) params['personId'] = args.employeeId;

  const data = await client.get<{ data: TimeOff[] }>('/time-away', params);

  let timeOff = data.data;

  // Apply filters
  if (args.status !== 'all') {
    timeOff = timeOff.filter((t) => t.status === args.status);
  }
  if (args.startDate) {
    timeOff = timeOff.filter((t) => t.startDate >= args.startDate!);
  }
  if (args.endDate) {
    timeOff = timeOff.filter((t) => t.endDate <= args.endDate!);
  }

  return timeOff;
}

async function handleGetOrgChart(
  args: z.infer<typeof GetOrgChartSchema>,
  client: HttpClient
): Promise<unknown> {
  // Fetch all employees to build org chart
  const data = await client.get<{ data: Employee[] }>('/people', { $limit: 200 });

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

  if (args.rootEmployeeId) {
    const rootEmployee = employeeMap.get(args.rootEmployeeId);
    if (rootEmployee) {
      return {
        id: rootEmployee.id,
        name: `${rootEmployee.firstName} ${rootEmployee.lastName}`,
        jobTitle: rootEmployee.jobTitle,
        reports: buildTree(rootEmployee.id),
      };
    } else {
      return { error: 'Employee not found' };
    }
  } else {
    // Return from top (employees with no manager)
    return buildTree(null);
  }
}

// ==================== MAIN HANDLER ====================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: HumaansContext
): Promise<ToolResponse> {
  try {
    let result: unknown;

    switch (name) {
      case 'humaans_list_employees': {
        const parsed = ListEmployeesSchema.parse(args);
        result = await handleListEmployees(parsed, context.client);
        break;
      }

      case 'humaans_get_employee': {
        const parsed = GetEmployeeSchema.parse(args);
        result = await handleGetEmployee(parsed, context.client);
        break;
      }

      case 'humaans_list_time_off': {
        const parsed = ListTimeOffSchema.parse(args);
        result = await handleListTimeOff(parsed, context.client);
        break;
      }

      case 'humaans_get_org_chart': {
        const parsed = GetOrgChartSchema.parse(args);
        result = await handleGetOrgChart(parsed, context.client);
        break;
      }

      default:
        return createJsonResponse({ error: `Unknown tool: ${name}` });
    }

    return createJsonResponse(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
