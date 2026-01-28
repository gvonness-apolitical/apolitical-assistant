# Humaans MCP Server

MCP server for Humaans HR platform API including employee data, time off, and org chart.

## Tools

| Tool | Description |
|------|-------------|
| `humaans_list_employees` | List employees with optional filters (department, status) |
| `humaans_get_employee` | Get detailed employee profile |
| `humaans_list_time_off` | List time off requests and approvals |
| `humaans_get_org_chart` | Get organization hierarchy/reporting structure |

## Features

### Employee Listing
- Filter by department name
- Filter by status (active, inactive, all)
- Returns name, email, job title, department, manager

### Time Off
- Filter by employee
- Filter by status (pending, approved, rejected, all)
- Filter by date range (startDate, endDate)

### Org Chart
- Build tree structure from manager relationships
- Optionally start from specific employee
- Shows reporting hierarchy

## Required Permissions

API token needs read access to:
- People
- Time off requests
- Org structure / reporting

## Setup

1. Go to Humaans (app.humaans.io) > Settings > API Keys
2. Generate new token
3. Run `npm run credentials -- --update HUMAANS_API_TOKEN` from project root

## Development

```bash
npm install
npm run build
npm test
```

## Architecture

```
src/
├── handlers/
│   ├── employees.ts   # All employee/HR handlers
│   └── index.ts       # Handler registry
├── tools.ts           # Tool definitions
└── index.ts           # MCP server entry point
```
