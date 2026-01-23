#!/usr/bin/env node

import {
  runMcpServer,
  createBearerClient,
  type HttpClient,
} from '@apolitical-assistant/mcp-shared';
import { createTools, handleToolCall } from './tools.js';

export interface HumaansContext {
  client: HttpClient;
}

runMcpServer<HumaansContext>({
  config: {
    name: 'humaans-mcp',
    version: '1.0.0',
  },
  envRequirements: [
    {
      name: 'HUMAANS_API_TOKEN',
      description: 'Humaans API token',
      required: true,
    },
  ],
  createTools,
  handleToolCall,
  createContext: (env) => ({
    client: createBearerClient('https://app.humaans.io/api', env.HUMAANS_API_TOKEN!),
  }),
});
