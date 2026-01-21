/**
 * Email Triage Module
 *
 * Public API for email classification and triage.
 */

// Types
export type {
  Email,
  EmailCategory,
  ConfidenceLevel,
  ClassificationMethod,
  ClassificationResult,
  TriagedEmail,
  ClassificationRule,
  RuleConditions,
  TriageSession,
  ClassificationFeedback,
  EmailTriageConfig,
  ActionResult,
  BatchActionRequest,
} from './types.js';

export {
  EmailCategorySchema,
  ConfidenceLevelSchema,
  ClassificationMethodSchema,
  EmailSchema,
  ClassificationResultSchema,
  TriagedEmailSchema,
  ClassificationRuleSchema,
  RuleConditionsSchema,
  TriageSessionSchema,
  ClassificationFeedbackSchema,
  EmailTriageConfigSchema,
  ActionResultSchema,
  BatchActionRequestSchema,
} from './types.js';

// Config
export {
  loadEmailTriageConfig,
  saveEmailTriageConfig,
  clearConfigCache,
  getConfigPath,
  getFeedbackLogPath,
  loadClassificationRules,
  clearRulesCache,
  addCustomRule,
  removeCustomRule,
  getRuleById,
  toggleRule,
  ensureDirectories,
} from './config.js';

// Rules engine
export {
  classifyWithRules,
  getMatchingRules,
  testRule,
  explainClassification,
  suggestRule,
  validateRuleConditions,
} from './rules.js';

// Classification
export {
  classifyEmail,
  classifyEmails,
  buildClassificationPrompt,
  parseLLMResponse,
  getClassificationStats,
} from './classify.js';

// Triage session
export {
  createTriageSession,
  getHighConfidenceEmails,
  getEmailsNeedingReview,
  updateEmailClassification,
  markEmailProcessed,
  markEmailSkipped,
  completeSession,
  getSessionSummary,
  getActionRecommendations,
  formatSessionForDisplay,
} from './triage.js';

// Actions
export {
  deleteEmail,
  archiveEmail,
  labelEmail,
  starEmail,
  markAsRead,
  markAsUnread,
  createTodoFromEmail,
  delegateEmail,
  executeBatchAction,
  deleteHighConfidenceEmails,
  archiveHighConfidenceEmails,
  createTodosForRespondEmails,
  getActionSummary,
} from './actions.js';

// Learning
export {
  recordFeedback,
  loadFeedback,
  analyzeFeedback,
  applySuggestedRule,
  getFeedbackStats,
  formatFeedbackAnalysis,
  clearFeedback,
} from './learn.js';
