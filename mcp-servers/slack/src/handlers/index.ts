import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SlackClient } from '../client.js';

// Import handler bundles
import { searchDefs } from './search.js';
import { channelDefs } from './channels.js';
import { messageDefs } from './messages.js';
import { userDefs } from './users.js';
import { dmDefs } from './dms.js';
import { canvasDefs } from './canvases.js';
import { bookmarkDefs } from './bookmarks.js';

// Re-export all schemas for testing
export {
  // Search schemas
  SearchSchema,
} from './search.js';
export {
  // Channel schemas
  ListChannelsSchema,
  ReadChannelSchema,
  GetChannelInfoSchema,
} from './channels.js';
export {
  // Message schemas
  ReadThreadSchema,
  SendMessageSchema,
  AddReactionSchema,
} from './messages.js';
export {
  // User schemas
  ListUsersSchema,
  GetUserSchema,
} from './users.js';
export {
  // DM schemas
  ListDmsSchema,
  ReadDmSchema,
  SendDmSchema,
} from './dms.js';
export {
  // Canvas schemas
  GetCanvasSchema,
  UpdateCanvasSchema,
  CreateCanvasSchema,
  ListCanvasesSchema,
  DeleteCanvasSchema,
} from './canvases.js';
export {
  // Bookmark schemas
  GetBookmarksSchema,
} from './bookmarks.js';

// Re-export handlers for testing
export { handleSearch } from './search.js';
export { handleListChannels, handleReadChannel, handleGetChannelInfo } from './channels.js';
export { handleReadThread, handleSendMessage, handleAddReaction } from './messages.js';
export { handleListUsers, handleGetUser } from './users.js';
export { handleListDms, handleReadDm, handleSendDm } from './dms.js';
export {
  handleGetCanvas,
  handleUpdateCanvas,
  handleCreateCanvas,
  handleListCanvases,
  handleDeleteCanvas,
} from './canvases.js';
export { handleGetBookmarks } from './bookmarks.js';

// Combine all tools from handler bundles
export const allTools: Tool[] = [
  ...searchDefs.tools,
  ...channelDefs.tools,
  ...messageDefs.tools,
  ...userDefs.tools,
  ...dmDefs.tools,
  ...canvasDefs.tools,
  ...bookmarkDefs.tools,
];

// Combine all handler registries from bundles
export const handlerRegistry: Record<
  string,
  (args: Record<string, unknown>, client: SlackClient) => Promise<unknown>
> = {
  ...searchDefs.handlers,
  ...channelDefs.handlers,
  ...messageDefs.handlers,
  ...userDefs.handlers,
  ...dmDefs.handlers,
  ...canvasDefs.handlers,
  ...bookmarkDefs.handlers,
};
