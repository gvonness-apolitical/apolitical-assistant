import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import { SlackClient, type SlackResponse, type SlackUser } from '../client.js';

// ==================== SCHEMAS ====================

export const ListUsersSchema = z.object({
  limit: z.number().optional().default(100).describe('Maximum number of users to return'),
});

export const GetUserSchema = z.object({
  userId: z.string().describe('User ID (e.g., U1234567890)'),
});

// ==================== HANDLERS ====================

export async function handleListUsers(
  args: z.infer<typeof ListUsersSchema>,
  client: SlackClient
): Promise<unknown> {
  interface UsersListResponse extends SlackResponse {
    members: SlackUser[];
  }

  const data = await client.call<UsersListResponse>('users.list', {
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
  client: SlackClient
): Promise<unknown> {
  interface UserInfoResponse extends SlackResponse {
    user: SlackUser;
  }

  const data = await client.call<UserInfoResponse>('users.info', {
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

// ==================== HANDLER BUNDLE ====================

export const userDefs = defineHandlers<SlackClient>()({
  slack_list_users: {
    description: 'List users in the workspace',
    schema: ListUsersSchema,
    handler: handleListUsers,
  },
  slack_get_user: {
    description: 'Get information about a specific user',
    schema: GetUserSchema,
    handler: handleGetUser,
  },
});
