#!/usr/bin/env node

import {
  runMcpServer,
  createBearerClient,
  type HttpClient,
} from '@apolitical-assistant/mcp-shared';
import { createTools, handleToolCall } from './tools.js';

export interface SlackContext {
  client: HttpClient;
  token: string; // Keep token for specialized Slack API calls
}

runMcpServer<SlackContext>({
  config: {
    name: 'slack-mcp',
    version: '1.0.0',
  },
  envRequirements: [
    {
      name: 'SLACK_TOKEN',
      description: 'Slack User OAuth Token (xoxp-...) or Bot Token (xoxb-...)',
      required: true,
    },
  ],
  createTools,
  handleToolCall,
  createContext: (env) => ({
    client: createBearerClient('https://slack.com/api', env.SLACK_TOKEN!),
    token: env.SLACK_TOKEN!,
  }),
});
