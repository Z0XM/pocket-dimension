import { db, schema } from "@pocket-dimension/db";
import { desc, eq, inArray, and } from "drizzle-orm";
import { MAX_ANSWERS_PER_SUBMIT, type AnswerDraft } from "$lib/form-utils";
import { dedupeAnswers } from "$lib/server/dedupe";
import type { FormRow } from "$lib/server/forms";
import type { FormWithPreview } from "$lib/types";
import { validatePrimaryAnswer } from "$lib/server/validation";

export { MAX_ANSWERS_PER_SUBMIT, type AnswerDraft };

export type AnswerRow = typeof schema.answers.$inferSelect;

export type AnswerInput = {
  primaryAnswer: string;
  expandDetail?: string | null;
  notes?: string | null;
  respondentName?: string | null;
  isAnonymous: boolean;
};

export async function submitAnswer(formId: string, input: AnswerInput) {
  const [answer] = await submitAnswers(formId, [input]);
  return answer;
}

export async function submitAnswers(formId: string, inputs: AnswerInput[]) {
  if (inputs.length === 0) {
    throw new Error("At least one answer is required.");
  }

  if (inputs.length > MAX_ANSWERS_PER_SUBMIT) {
    throw new Error(`You can submit up to ${MAX_ANSWERS_PER_SUBMIT} answers at a time.`);
  }

  for (const input of inputs) {
    const validation = validatePrimaryAnswer(input.primaryAnswer);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
  }

  return db
    .insert(schema.answers)
    .values(
      inputs.map((input) => ({
        formId,
        primaryAnswer: input.primaryAnswer.trim(),
        expandDetail: input.expandDetail ?? null,
        notes: input.notes ?? null,
        respondentName: input.isAnonymous ? null : (input.respondentName?.trim() ?? null),
        isAnonymous: input.isAnonymous,
      }))
    )
    .returning();
}

export async function listAnswersForForm(formId: string, limit?: number) {
  const query = db.select().from(schema.answers).where(eq(schema.answers.formId, formId)).orderBy(desc(schema.answers.createdAt));

  if (limit) {
    return query.limit(limit);
  }

  return query;
}

export async function countAnswersForForms(formIds: string[]) {
  if (formIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      formId: schema.answers.formId,
    })
    .from(schema.answers)
    .where(inArray(schema.answers.formId, formIds));

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.formId, (counts.get(row.formId) ?? 0) + 1);
  }

  return counts;
}

export async function getHeroAnswersForUser(userId: string) {
  const forms = await db
    .select({
      id: schema.forms.id,
      classification: schema.forms.classification,
    })
    .from(schema.forms)
    .where(and(eq(schema.forms.userId, userId), eq(schema.forms.hiddenFromPublic, false)));

  const positiveFormIds = forms.filter((f) => f.classification === "positive").map((f) => f.id);
  const negativeFormIds = forms.filter((f) => f.classification === "negative").map((f) => f.id);

  const [positiveAnswers, negativeAnswers] = await Promise.all([fetchAnswersForHero(positiveFormIds), fetchAnswersForHero(negativeFormIds)]);

  return {
    positives: dedupeAnswers(positiveAnswers),
    negatives: dedupeAnswers(negativeAnswers),
  };
}

async function fetchAnswersForHero(formIds: string[]) {
  if (formIds.length === 0) return [];

  return db
    .select({
      primaryAnswer: schema.answers.primaryAnswer,
      expandDetail: schema.answers.expandDetail,
    })
    .from(schema.answers)
    .where(inArray(schema.answers.formId, formIds));
}

export async function getFormsWithPreviews(forms: FormRow[], previewLimit = 3): Promise<FormWithPreview[]> {
  const formIds = forms.map((form) => form.id);
  const counts = await countAnswersForForms(formIds);

  return Promise.all(
    forms.map(async (form) => ({
      ...form,
      answerCount: counts.get(form.id) ?? 0,
      previewAnswers: await listAnswersForForm(form.id, previewLimit),
    }))
  );
}

export function parseAnswersInput(formData: FormData): AnswerInput[] {
  const isAnonymous = formData.get("isAnonymous") === "on" || formData.get("isAnonymous") === "true";
  const respondentName = String(formData.get("respondentName") ?? "").trim() || null;

  const answersJson = String(formData.get("answers") ?? "[]");
  let drafts: AnswerDraft[];

  try {
    const parsed = JSON.parse(answersJson);
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid answer data.");
    }
    drafts = parsed;
  } catch {
    throw new Error("Invalid answer data.");
  }

  if (drafts.length === 0) {
    throw new Error("At least one answer is required.");
  }

  if (drafts.length > MAX_ANSWERS_PER_SUBMIT) {
    throw new Error(`You can submit up to ${MAX_ANSWERS_PER_SUBMIT} answers at a time.`);
  }

  return drafts.map((draft) => ({
    primaryAnswer: String(draft.primaryAnswer ?? ""),
    expandDetail: draft.expandDetail ? String(draft.expandDetail).trim() || null : null,
    notes: draft.notes ? String(draft.notes).trim() || null : null,
    respondentName,
    isAnonymous,
  }));
}
