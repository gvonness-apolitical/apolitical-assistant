/**
 * Task Helper - Code Review Prompts
 *
 * Prompts for reviewing code changes.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt } from '../templates.js';

/**
 * Build prompt for comprehensive code review
 */
export function buildCodeReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## Code Review Focus Areas
1. **Correctness**: Does the code do what it's supposed to?
2. **Security**: Are there any security vulnerabilities?
3. **Performance**: Are there any performance concerns?
4. **Maintainability**: Is the code readable and maintainable?
5. **Testing**: Is the code adequately tested?
6. **Architecture**: Does it fit well with the existing codebase?

## Review Output Format
Provide feedback in these categories:
- **Critical (Blockers)**: Issues that must be fixed before merge
- **Important (Concerns)**: Issues that should probably be addressed
- **Suggestions**: Nice-to-have improvements
- **Positive**: Good patterns or practices worth noting

For each item, be specific about:
- What the issue is
- Why it matters
- How to fix it (if applicable)`;

  const user = `Please review the code changes in this PR:

${formatContextForPrompt(context)}

${context.sourceDetails.changedFiles ? `Files changed: ${context.sourceDetails.changedFiles}` : ''}
${context.sourceDetails.additions !== undefined ? `Lines added: ${context.sourceDetails.additions}` : ''}
${context.sourceDetails.deletions !== undefined ? `Lines removed: ${context.sourceDetails.deletions}` : ''}

Provide a thorough code review covering correctness, security, performance, and maintainability.`;

  return { system, user };
}

/**
 * Build prompt for security-focused review
 */
export function buildSecurityReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## Security Review Focus Areas
1. **Input Validation**: Are all inputs properly validated and sanitized?
2. **Authentication/Authorization**: Are auth checks in place and correct?
3. **Data Protection**: Is sensitive data handled securely?
4. **Injection Vulnerabilities**: SQL, XSS, Command injection, etc.
5. **Secrets Management**: Are secrets properly managed (not hardcoded)?
6. **Error Handling**: Do errors leak sensitive information?
7. **Dependencies**: Are there known vulnerabilities in dependencies?

## Severity Levels
- **Critical**: Immediate security risk, blocks deployment
- **High**: Significant vulnerability, should fix before merge
- **Medium**: Security concern, should address soon
- **Low**: Minor issue, good to fix but not urgent`;

  const user = `Please perform a security-focused review of these code changes:

${formatContextForPrompt(context)}

Focus specifically on security concerns. Identify any vulnerabilities, insecure patterns, or potential attack vectors.`;

  return { system, user };
}

/**
 * Build prompt for performance review
 */
export function buildPerformanceReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## Performance Review Focus Areas
1. **Algorithm Complexity**: Are there unnecessarily complex operations?
2. **Database Queries**: N+1 queries, missing indexes, inefficient queries
3. **Memory Usage**: Memory leaks, unnecessary allocations
4. **Network Calls**: Unnecessary or unbatched API calls
5. **Caching**: Opportunities for caching, cache invalidation issues
6. **Async Operations**: Proper use of async/await, parallelization opportunities

## Reporting Format
For each concern:
- Describe the performance issue
- Explain the impact (memory, CPU, latency, etc.)
- Suggest an optimization approach`;

  const user = `Please perform a performance-focused review of these code changes:

${formatContextForPrompt(context)}

Focus specifically on performance implications. Identify any potential bottlenecks, inefficiencies, or optimization opportunities.`;

  return { system, user };
}

/**
 * Build prompt for architecture review
 */
export function buildArchitectureReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## Architecture Review Focus Areas
1. **Design Patterns**: Are appropriate patterns used?
2. **Separation of Concerns**: Is the code well-organized?
3. **Dependencies**: Are dependencies appropriate and minimal?
4. **API Design**: Is the API intuitive and consistent?
5. **Extensibility**: Can this be easily extended in the future?
6. **Consistency**: Does this fit with existing architecture?

## Reporting Format
- Overview assessment
- Specific architectural concerns
- Suggestions for improvement
- Trade-offs to consider`;

  const user = `Please perform an architecture review of these code changes:

${formatContextForPrompt(context)}

Focus on how well the changes fit into the overall system architecture. Consider design patterns, separation of concerns, and long-term maintainability.`;

  return { system, user };
}
