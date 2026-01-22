/**
 * Task Helper - Document Review Prompts
 *
 * Prompts for reviewing documents, proposals, and written content.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt } from '../templates.js';

/**
 * Build prompt for document review
 */
export function buildDocumentReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## Document Review Focus Areas
1. **Clarity**: Is the document clear and easy to understand?
2. **Completeness**: Does it cover all necessary topics?
3. **Accuracy**: Is the information correct and up-to-date?
4. **Structure**: Is it well-organized and logical?
5. **Audience**: Is it appropriate for the intended readers?
6. **Actionability**: Are next steps and decisions clear?

## Feedback Categories
- **Praise**: What's working well
- **Questions**: Areas needing clarification
- **Suggestions**: Improvements to consider
- **Concerns**: Issues that should be addressed`;

  const user = `Please review this document:

${formatContextForPrompt(context)}

Provide constructive feedback on clarity, completeness, accuracy, and overall effectiveness.`;

  return { system, user };
}

/**
 * Build prompt for technical specification review
 */
export function buildTechSpecReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## Technical Specification Review Focus Areas
1. **Requirements Coverage**: Are all requirements addressed?
2. **Technical Accuracy**: Is the technical approach sound?
3. **Completeness**: Are edge cases and error handling covered?
4. **Feasibility**: Can this be implemented as described?
5. **Security**: Are security considerations addressed?
6. **Scalability**: Will this work at scale?
7. **Testability**: Can the implementation be tested?

## Feedback Structure
- Executive summary (1-2 sentences)
- Technical concerns (if any)
- Missing considerations
- Suggestions for improvement
- Questions for the author`;

  const user = `Please review this technical specification:

${formatContextForPrompt(context)}

Provide technical feedback on completeness, accuracy, feasibility, and any concerns about the proposed approach.`;

  return { system, user };
}

/**
 * Build prompt for proposal review
 */
export function buildProposalReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## Proposal Review Focus Areas
1. **Problem Statement**: Is the problem clearly defined?
2. **Solution**: Does the proposed solution address the problem?
3. **Alternatives**: Were alternatives considered?
4. **Impact**: What are the expected benefits and risks?
5. **Resources**: Are resource requirements realistic?
6. **Timeline**: Is the proposed timeline feasible?
7. **Success Metrics**: How will success be measured?

## Feedback Structure
- Overall assessment
- Strengths of the proposal
- Areas of concern
- Questions to address
- Recommendation (approve/revise/reject)`;

  const user = `Please review this proposal:

${formatContextForPrompt(context)}

Evaluate the proposal's clarity, feasibility, and completeness. Provide a recommendation and any concerns that should be addressed.`;

  return { system, user };
}

/**
 * Build prompt for RFC (Request for Comments) review
 */
export function buildRFCReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## RFC Review Focus Areas
1. **Motivation**: Is the motivation compelling?
2. **Design**: Is the proposed design sound?
3. **Drawbacks**: Are drawbacks acknowledged?
4. **Alternatives**: Were alternatives considered?
5. **Compatibility**: What are the compatibility implications?
6. **Implementation**: Is the implementation approach clear?

## Feedback Format
- Summary of the RFC
- Technical analysis
- Concerns and questions
- Suggestions for improvement
- Disposition (accept/revise/reject) with rationale`;

  const user = `Please review this RFC:

${formatContextForPrompt(context)}

Provide thorough feedback on the proposed changes, including technical analysis, concerns, and a recommendation.`;

  return { system, user };
}
