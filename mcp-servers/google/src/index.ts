#!/usr/bin/env node

import { runMcpServer } from '@apolitical-assistant/mcp-shared';
import { createTools, handleToolCall } from './tools.js';
import { GoogleAuth } from './auth.js';

export interface GoogleContext {
  auth: GoogleAuth;
}

runMcpServer<GoogleContext>({
  config: {
    name: 'google-mcp',
    version: '1.0.0',
  },
  envRequirements: [
    {
      name: 'GOOGLE_CLIENT_ID',
      description: 'Google OAuth Client ID',
      required: true,
    },
    {
      name: 'GOOGLE_CLIENT_SECRET',
      description: 'Google OAuth Client Secret',
      required: true,
    },
    {
      name: 'GOOGLE_REFRESH_TOKEN',
      description: 'Google OAuth Refresh Token (run npm run auth to obtain)',
      required: true,
    },
  ],
  createTools,
  handleToolCall,
  createContext: (env) => ({
    auth: new GoogleAuth(
      env.GOOGLE_CLIENT_ID!,
      env.GOOGLE_CLIENT_SECRET!,
      env.GOOGLE_REFRESH_TOKEN!
    ),
  }),
});
