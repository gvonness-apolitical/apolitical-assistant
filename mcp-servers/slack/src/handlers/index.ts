import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Import tools, schemas, and handlers from each module
import { searchTools, SearchSchema, handleSearch } from './search.js';

import {
  channelTools,
  ListChannelsSchema,
  ReadChannelSchema,
  GetChannelInfoSchema,
  handleListChannels,
  handleReadChannel,
  handleGetChannelInfo,
} from './channels.js';

import {
  messageTools,
  ReadThreadSchema,
  SendMessageSchema,
  AddReactionSchema,
  handleReadThread,
  handleSendMessage,
  handleAddReaction,
} from './messages.js';

import {
  userTools,
  ListUsersSchema,
  GetUserSchema,
  handleListUsers,
  handleGetUser,
} from './users.js';

import {
  dmTools,
  ListDmsSchema,
  ReadDmSchema,
  SendDmSchema,
  handleListDms,
  handleReadDm,
  handleSendDm,
} from './dms.js';

import {
  canvasTools,
  GetCanvasSchema,
  UpdateCanvasSchema,
  CreateCanvasSchema,
  ListCanvasesSchema,
  handleGetCanvas,
  handleUpdateCanvas,
  handleCreateCanvas,
  handleListCanvases,
} from './canvases.js';

import { bookmarkTools, GetBookmarksSchema, handleGetBookmarks } from './bookmarks.js';

// Re-export all schemas for testing
export {
  // Search schemas
  SearchSchema,
  // Channel schemas
  ListChannelsSchema,
  ReadChannelSchema,
  GetChannelInfoSchema,
  // Message schemas
  ReadThreadSchema,
  SendMessageSchema,
  AddReactionSchema,
  // User schemas
  ListUsersSchema,
  GetUserSchema,
  // DM schemas
  ListDmsSchema,
  ReadDmSchema,
  SendDmSchema,
  // Canvas schemas
  GetCanvasSchema,
  UpdateCanvasSchema,
  CreateCanvasSchema,
  ListCanvasesSchema,
  // Bookmark schemas
  GetBookmarksSchema,
};

// Re-export handlers for testing
export {
  handleSearch,
  handleListChannels,
  handleReadChannel,
  handleGetChannelInfo,
  handleReadThread,
  handleSendMessage,
  handleAddReaction,
  handleListUsers,
  handleGetUser,
  handleListDms,
  handleReadDm,
  handleSendDm,
  handleGetCanvas,
  handleUpdateCanvas,
  handleCreateCanvas,
  handleListCanvases,
  handleGetBookmarks,
};

// Combine all tools into a single array
export const allTools: Tool[] = [
  ...searchTools,
  ...channelTools,
  ...messageTools,
  ...userTools,
  ...dmTools,
  ...canvasTools,
  ...bookmarkTools,
];

// Handler type definition
type Handler = (args: Record<string, unknown>, token: string) => Promise<unknown>;

// Handler registry maps tool names to their handler functions
export const handlerRegistry: Record<string, Handler> = {
  // Search handlers
  slack_search: (args, token) => handleSearch(SearchSchema.parse(args), token),

  // Channel handlers
  slack_list_channels: (args, token) => handleListChannels(ListChannelsSchema.parse(args), token),
  slack_read_channel: (args, token) => handleReadChannel(ReadChannelSchema.parse(args), token),
  slack_get_channel_info: (args, token) =>
    handleGetChannelInfo(GetChannelInfoSchema.parse(args), token),

  // Message handlers
  slack_read_thread: (args, token) => handleReadThread(ReadThreadSchema.parse(args), token),
  slack_send_message: (args, token) => handleSendMessage(SendMessageSchema.parse(args), token),
  slack_add_reaction: (args, token) => handleAddReaction(AddReactionSchema.parse(args), token),

  // User handlers
  slack_list_users: (args, token) => handleListUsers(ListUsersSchema.parse(args), token),
  slack_get_user: (args, token) => handleGetUser(GetUserSchema.parse(args), token),

  // DM handlers
  slack_list_dms: (args, token) => handleListDms(ListDmsSchema.parse(args), token),
  slack_read_dm: (args, token) => handleReadDm(ReadDmSchema.parse(args), token),
  slack_send_dm: (args, token) => handleSendDm(SendDmSchema.parse(args), token),

  // Canvas handlers
  slack_get_canvas: (args, token) => handleGetCanvas(GetCanvasSchema.parse(args), token),
  slack_update_canvas: (args, token) => handleUpdateCanvas(UpdateCanvasSchema.parse(args), token),
  slack_create_canvas: (args, token) => handleCreateCanvas(CreateCanvasSchema.parse(args), token),
  slack_list_canvases: (args, token) => handleListCanvases(ListCanvasesSchema.parse(args), token),

  // Bookmark handlers
  slack_get_bookmarks: (args, token) => handleGetBookmarks(GetBookmarksSchema.parse(args), token),
};
