import { z } from 'zod';
import { createToolDefinition } from '@apolitical-assistant/mcp-shared';
import { slackApi, type SlackResponse, type SlackUser } from './api.js';

// ==================== SCHEMAS ====================

export const ListUsersSchema = z.object({
  limit: z.number().optional().default(100).describe('Maximum number of users to return'),
});

export const GetUserSchema = z.object({
  userId: z.string().describe('User ID (e.g., U1234567890)'),
});

// ==================== TOOL DEFINITIONS ====================

export const userTools = [
  createToolDefinition('slack_list_users', 'List users in the workspace', ListUsersSchema),
  createToolDefinition('slack_get_user', 'Get information about a specific user', GetUserSchema),
];

// ==================== HANDLERS ====================

export async function handleListUsers(
  args: z.infer<typeof ListUsersSchema>,
  token: string
): Promise<unknown> {
  interface UsersListResponse extends SlackResponse {
    members: SlackUser[];
  }

  const data = await slackApi<UsersListResponse>('users.list', token, {
    limit: args.limit,
  });

  return data.members
    .filter((u) => !u.is_bot && !u.deleted)
    .map((u) => ({
      id: u.id,
      username: u.name,
      realName: u.real_name,
      title: u.profile.title,
      email: u.profile.email,
      status: u.profile.status_text
        ? `${u.profile.status_emoji || ''} ${u.profile.status_text}`.trim()
        : undefined,
    }));
}

export async function handleGetUser(
  args: z.infer<typeof GetUserSchema>,
  token: string
): Promise<unknown> {
  interface UserInfoResponse extends SlackResponse {
    user: SlackUser;
  }

  const data = await slackApi<UserInfoResponse>('users.info', token, {
    user: args.userId,
  });

  const u = data.user;
  return {
    id: u.id,
    username: u.name,
    realName: u.real_name,
    timezone: u.tz,
    title: u.profile.title,
    email: u.profile.email,
    phone: u.profile.phone,
    status: u.profile.status_text
      ? `${u.profile.status_emoji || ''} ${u.profile.status_text}`.trim()
      : undefined,
    avatar: u.profile.image_192,
  };
}
