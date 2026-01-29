#!/usr/bin/env node

import { runMcpServer } from '@apolitical-assistant/mcp-shared';
import { createTools, handleToolCall } from './tools.js';
import { SlackClient } from './client.js';

export interface SlackContext {
  slackClient: SlackClient;
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
    slackClient: new SlackClient(env.SLACK_TOKEN!),
  }),
});
