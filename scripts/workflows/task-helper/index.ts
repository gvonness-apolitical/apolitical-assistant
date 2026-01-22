/**
 * Task Helper - Public API
 *
 * Exports the main API for the task helper module.
 */

// Types
export type {
  Todo,
  TodoSource,
  TodoStatus,
  TodoCategory,
  HelperMode,
  OutputType,
  ContextDepth,
  TaskContext,
  HelperResponse,
  GatherOptions,
  GatheringStatus,
  SourceDetails,
  ThreadItem,
  RelatedItem,
  PersonContext,
  ReviewPoint,
  SuggestedTime,
  StructuredOutput,
  ActionResult,
  TaskHelperOptions,
  CachedContext,
} from './types.js';

// Type schemas
export {
  HelperModeSchema,
  OutputTypeSchema,
  ContextDepthSchema,
  TaskContextSchema,
  HelperResponseSchema,
  MCP_WRITE_CAPABLE,
  DEFAULT_MODE_BY_SOURCE,
  DEFAULT_DEPTH_BY_MODE,
  DEFAULT_GATHER_OPTIONS,
} from './types.js';

// Configuration
export {
  loadConfig,
  saveConfig,
  clearConfigCache,
  getPreferredMode,
  getPreferredOutput,
  getCacheTTL,
  getDefaultDepth,
  getPaths,
  type TaskHelperConfig,
} from './config.js';

// TODO Selection
export {
  getSelectableTodos,
  getTodoById,
  groupTodos,
  formatTodoForSelection,
  displayGroupedTodos,
  getFlatTodoList,
  displayTodosJson,
  displayTodoDetails,
  type SelectOptions,
  type GroupedTodos,
} from './select.js';

// Cache
export {
  getCachedContext,
  setCachedContext,
  invalidateCache,
  clearAllCache,
  cleanupExpiredCache,
  getCacheStats,
  formatCacheStats,
} from './cache.js';

// Context gathering
export {
  gatherContext,
  gatherContextBatch,
  mergeGatherOptions,
  summarizeContext,
  formatGatheringProgress,
} from './context/index.js';

// Action modes
export { executeRespondMode, getRespondPrompt, type RespondModeOptions } from './modes/respond.js';
export { executeReviewMode, getReviewPrompt, formatReviewPoints, type ReviewModeOptions, type ReviewFocus } from './modes/review.js';
export { executeSummarizeMode, getSummarizePrompt, formatSummary, type SummarizeModeOptions, type SummaryType } from './modes/summarize.js';
export { executeScheduleMode, getSchedulePrompt, formatSuggestedTimes, formatMeetingAgenda, type ScheduleModeOptions, type ScheduleAction } from './modes/schedule.js';
export { executeCompleteMode, getCompletePrompt, formatCompletionSteps, formatBlockers, assessCompletionReadiness, type CompleteModeOptions } from './modes/complete.js';

// Action execution
export {
  executeAction,
  getAvailableOutputTypes,
  getRecommendedOutputType,
  formatActionResults,
  type ExecuteActionOptions,
} from './actions/index.js';

// MCP write operations
export {
  canWriteToSource,
  getMcpWriteTarget,
  getMcpWriteDescription,
  getMcpFunctionName,
  buildMcpWriteParams,
  getMcpWritePreview,
} from './actions/mcp-write.js';

// Clipboard operations
export {
  isClipboardAvailable,
  writeToClipboard,
  writeToClipboardSync,
  readFromClipboard,
  formatForClipboard,
} from './actions/clipboard.js';

// File operations
export {
  writeToFile,
  writeToFileSync,
  getDefaultOutputPath,
  formatForFile,
  listOutputFiles,
  cleanupOldFiles,
  getOutputStats,
} from './actions/file-output.js';

// Prompt templates
export {
  buildBaseSystemPrompt,
  formatContextForPrompt,
  getDefaultTone,
  getToneInstructions,
  getSignature,
  truncateText,
  extractKeyPoints,
  type PromptTemplate,
  type TemplateOptions,
} from './prompts/templates.js';

/**
 * Helper function to run the task helper for a specific TODO
 */
export async function helpWithTodo(
  todoId: string,
  mode?: HelperMode,
  options: Partial<GatherOptions> = {}
): Promise<HelperResponse> {
  const { getTodoById } = await import('./select.js');
  const { gatherContext, mergeGatherOptions } = await import('./context/index.js');
  const { getPreferredMode, getDefaultDepth } = await import('./config.js');

  // Get the TODO
  const todo = getTodoById(todoId);
  if (!todo) {
    throw new Error(`TODO not found: ${todoId}`);
  }

  // Determine mode
  const effectiveMode = mode ?? getPreferredMode(todo.source ?? 'manual');

  // Merge options with appropriate depth for mode
  const gatherOptions = mergeGatherOptions(
    { ...options, depth: options.depth ?? getDefaultDepth(effectiveMode) },
    options.depth
  );

  // Gather context
  const context = await gatherContext(todo, gatherOptions);

  // Execute the appropriate mode
  switch (effectiveMode) {
    case 'respond': {
      const { executeRespondMode } = await import('./modes/respond.js');
      return executeRespondMode(context);
    }

    case 'review': {
      const { executeReviewMode } = await import('./modes/review.js');
      return executeReviewMode(context);
    }

    case 'summarize': {
      const { executeSummarizeMode } = await import('./modes/summarize.js');
      return executeSummarizeMode(context);
    }

    case 'schedule': {
      const { executeScheduleMode } = await import('./modes/schedule.js');
      return executeScheduleMode(context);
    }

    case 'complete': {
      const { executeCompleteMode } = await import('./modes/complete.js');
      return executeCompleteMode(context);
    }

    default:
      throw new Error(`Unsupported mode: ${effectiveMode}`);
  }
}
