#!/usr/bin/env node

import {
  runMcpServer,
  createBearerClient,
  type HttpClient,
} from '@apolitical-assistant/mcp-shared';
import { createTools, handleToolCall } from './tools.js';

export interface IncidentIoContext {
  client: HttpClient;
}

runMcpServer<IncidentIoContext>({
  config: {
    name: 'incident-io-mcp',
    version: '1.0.0',
  },
  envRequirements: [
    {
      name: 'INCIDENTIO_API_KEY',
      description: 'Incident.io API key',
      required: true,
    },
  ],
  createTools,
  handleToolCall,
  createContext: (env) => ({
    client: createBearerClient('https://api.incident.io/v2', env.INCIDENTIO_API_KEY!),
  }),
});
