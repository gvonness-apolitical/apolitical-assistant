/**
 * TODOs Module
 *
 * Public API for the TODOs module.
 */

// Types
export * from './types.js';

// Configuration
export {
  loadTodoConfig,
  saveTodoConfig,
  clearConfigCache,
  ensureDirectories,
  getPaths,
  DB_PATH,
  TODOS_DIR,
  CONFIG_PATH,
  ARCHIVE_DIR,
  CACHE_DIR,
} from './config.js';

// Collection
export {
  collectFromAllSources,
  processTodos,
  collectTodos,
  getCollectionStatusSummary,
} from './collect.js';

// Creation
export {
  createTodoFromSummary,
  createTodosFromSummary,
  createManualTodo,
  linkTodoToSummary,
  getTodosForSummary,
  getTodosForSummaryPeriod,
  getSummaryTodoProgress,
} from './create.js';

// Display
export {
  computeTodoFields,
  groupTodosByStatus,
  listTodos,
  getTodo,
  findTodoByPartialId,
  formatTextOutput,
  formatJsonOutput,
  getTodoStats,
} from './display.js';

// Completion
export {
  completeTodo,
  reopenTodo,
  completeTodos,
  reopenTodos,
  startTodo,
  type CompletionResult,
} from './complete.js';

// Archive
export {
  getTodosForArchive,
  archiveTodos,
  listArchivedTodos,
  getArchiveMonths,
  searchArchivedTodos,
  type ArchiveResult,
} from './archive.js';

// Snooze
export {
  snoozeTodoUntil,
  snoozeTodoForDays,
  snoozeTodoUntilTomorrow,
  snoozeTodoUntilNextWeek,
  snoozeTodoUntilNextMonth,
  unsnoozeTodo,
  getSnoozedTodos,
  getTodosWithSnoozeExpiringSoon,
  autoUnsnooze,
  type SnoozeResult,
} from './snooze.js';

// Notifications
export {
  checkAndNotify,
  getUpcomingDeadlines,
  getOverdueTodos,
  getStaleTodos,
  type NotificationResult,
} from './notify.js';
