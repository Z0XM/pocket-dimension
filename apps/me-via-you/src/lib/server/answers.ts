import { db, schema } from "@pocket-dimension/db";
import { desc, eq, inArray, and } from "drizzle-orm";
import { dedupeAnswers } from "$lib/server/dedupe";
import type { FormRow } from "$lib/server/forms";
import type { FormWithPreview } from "$lib/types";
import { validatePrimaryAnswer } from "$lib/server/validation";

export type AnswerRow = typeof schema.answers.$inferSelect;

export type AnswerInput = {
  primaryAnswer: string;
  expandDetail?: string | null;
  notes?: string | null;
  respondentName?: string | null;
  isAnonymous: boolean;
};

export async function submitAnswer(formId: string, input: AnswerInput) {
  const validation = validatePrimaryAnswer(input.primaryAnswer);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const [answer] = await db
    .insert(schema.answers)
    .values({
      formId,
      primaryAnswer: input.primaryAnswer.trim(),
      expandDetail: input.expandDetail ?? null,
      notes: input.notes ?? null,
      respondentName: input.isAnonymous ? null : (input.respondentName?.trim() ?? null),
      isAnonymous: input.isAnonymous,
    })
    .returning();

  return answer;
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

export function parseAnswerInput(formData: FormData): AnswerInput {
  const isAnonymous = formData.get("isAnonymous") === "on" || formData.get("isAnonymous") === "true";
  const primaryAnswer = String(formData.get("primaryAnswer") ?? "");
  const expandDetail = String(formData.get("expandDetail") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const respondentName = String(formData.get("respondentName") ?? "").trim() || null;

  return {
    primaryAnswer,
    expandDetail,
    notes,
    respondentName,
    isAnonymous,
  };
}
