# MCP Shared Utilities

Shared utilities and abstractions for building MCP servers.

## Exports

### Response Utilities

```typescript
import { createJsonResponse, createErrorResponse, createTextResponse } from '@apolitical-assistant/mcp-shared';

// Create JSON response for tool result
const response = createJsonResponse({ data: 'value' });

// Create error response from Error or string
const error = createErrorResponse(new Error('Something went wrong'));

// Create plain text response
const text = createTextResponse('Hello world');
```

### HTTP Client

```typescript
import { HttpClient, createBearerClient } from '@apolitical-assistant/mcp-shared';

// Create client with bearer token auth
const client = createBearerClient('https://api.example.com', 'your-token');

// Make requests
const data = await client.get<ResponseType>('/endpoint', { param: 'value' });
const result = await client.post<ResponseType>('/endpoint', { body: 'data' });
```

### Server Factory

```typescript
import { createMcpServer, runMcpServer, validateEnv } from '@apolitical-assistant/mcp-shared';

// Validate required environment variables
const env = validateEnv([
  { name: 'API_TOKEN', required: true }
]);

// Create MCP server with tools
const server = createMcpServer({
  name: 'my-server',
  version: '1.0.0',
  tools: myTools,
  handleToolCall: async (name, args, context) => { ... }
});

// Run the server
await runMcpServer(server);
```

### Types

```typescript
import type {
  ToolResponse,
  HttpClientOptions,
  McpServerConfig,
  ToolDefinition,
  ToolHandler,
} from '@apolitical-assistant/mcp-shared';
```

## Features

- **Response formatting**: Consistent JSON/error/text responses for MCP tools
- **HTTP client**: Generic HTTP client with Bearer auth, error handling
- **Server factory**: Simplified MCP server creation with tool registration
- **Environment validation**: Check for required env vars with helpful errors

## Development

```bash
npm install
npm run build
npm test
```

## Architecture

```
src/
├── response.ts       # Response formatting utilities
├── http-client.ts    # HTTP client with auth
├── server-factory.ts # MCP server creation
├── types.ts          # TypeScript types
└── index.ts          # Public exports
```
