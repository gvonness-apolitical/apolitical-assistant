import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';

// ==================== ZOD SCHEMAS ====================

export const FormsCreateSchema = z.object({
  title: z.string().describe('The title of the form (shown to respondents)'),
  documentTitle: z
    .string()
    .optional()
    .describe('The title of the underlying document (shown in Google Drive). Defaults to title.'),
});

const ChoiceQuestionSchema = z.object({
  type: z.enum(['RADIO', 'CHECKBOX', 'DROP_DOWN']).describe('The type of choice question'),
  options: z
    .array(z.object({ value: z.string() }))
    .describe('The available choices'),
  shuffle: z.boolean().optional().describe('Whether to shuffle the option order'),
});

const TextQuestionSchema = z.object({
  paragraph: z
    .boolean()
    .optional()
    .describe('If true, allows multi-line (paragraph) responses. Default is single-line.'),
});

const ScaleQuestionSchema = z.object({
  low: z.number().describe('The lowest value of the scale'),
  high: z.number().describe('The highest value of the scale'),
  lowLabel: z.string().optional().describe('Label for the lowest value'),
  highLabel: z.string().optional().describe('Label for the highest value'),
});

const QuestionItemSchema = z.object({
  question: z.object({
    required: z.boolean().optional().describe('Whether the question is required'),
    choiceQuestion: ChoiceQuestionSchema.optional(),
    textQuestion: TextQuestionSchema.optional(),
    scaleQuestion: ScaleQuestionSchema.optional(),
  }),
});

const CreateItemRequestSchema = z.object({
  item: z.object({
    title: z.string().describe('The title/question text'),
    description: z.string().optional().describe('Help text shown below the question'),
    questionItem: QuestionItemSchema.optional(),
  }),
  location: z.object({
    index: z.number().describe('Position in the form (0-based)'),
  }),
});

export const FormsUpdateSchema = z.object({
  formId: z.string().describe('The form ID to update'),
  requests: z
    .array(z.object({ createItem: CreateItemRequestSchema }))
    .describe('Array of batch update requests (createItem operations)'),
});

export const FormsGetSchema = z.object({
  formId: z.string().describe('The form ID to retrieve'),
});

export const FormsListResponsesSchema = z.object({
  formId: z.string().describe('The form ID to get responses for'),
  pageSize: z
    .number()
    .optional()
    .describe('Maximum number of responses to return (default 50)'),
  pageToken: z
    .string()
    .optional()
    .describe('Token for fetching the next page of responses'),
});

// ==================== HANDLER FUNCTIONS ====================

export async function handleFormsCreate(
  args: z.infer<typeof FormsCreateSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const response = await auth.fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      info: {
        title: args.title,
        documentTitle: args.documentTitle ?? args.title,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Forms API error creating form: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    formId: string;
    responderUri: string;
    info: { title: string; documentTitle: string };
  };

  return {
    formId: data.formId,
    responderUri: data.responderUri,
    editUri: `https://docs.google.com/forms/d/${data.formId}/edit`,
  };
}

export async function handleFormsUpdate(
  args: z.infer<typeof FormsUpdateSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://forms.googleapis.com/v1/forms/${args.formId}:batchUpdate`;
  const response = await auth.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: args.requests }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Forms API error updating form: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function handleFormsGet(
  args: z.infer<typeof FormsGetSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://forms.googleapis.com/v1/forms/${args.formId}`;
  const response = await auth.fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Forms API error getting form: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function handleFormsListResponses(
  args: z.infer<typeof FormsListResponsesSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const params = new URLSearchParams();
  params.set('pageSize', String(args.pageSize ?? 50));
  if (args.pageToken) params.set('pageToken', args.pageToken);

  const url = `https://forms.googleapis.com/v1/forms/${args.formId}/responses?${params.toString()}`;
  const response = await auth.fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Forms API error listing responses: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// ==================== HANDLER BUNDLE ====================

export const formsDefs = defineHandlers<GoogleAuth>()({
  forms_create: {
    description:
      'Create a new Google Form. Returns the form ID and URLs. Add questions via forms_update.',
    schema: FormsCreateSchema,
    handler: handleFormsCreate,
  },
  forms_update: {
    description:
      'Add or modify items in a Google Form using batch update requests. Supports creating questions (choice, text, scale) at specific positions.',
    schema: FormsUpdateSchema,
    handler: handleFormsUpdate,
  },
  forms_get: {
    description: 'Get a Google Form including its metadata and all items/questions.',
    schema: FormsGetSchema,
    handler: handleFormsGet,
  },
  forms_list_responses: {
    description:
      'List responses submitted to a Google Form. Supports pagination for forms with many responses.',
    schema: FormsListResponsesSchema,
    handler: handleFormsListResponses,
  },
});
