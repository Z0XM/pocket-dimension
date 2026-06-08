import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, lte } from "drizzle-orm";

export type FormClassification = (typeof schema.formClassification.enumValues)[number];
export type FormStatus = (typeof schema.formStatus.enumValues)[number];

export type FormRow = typeof schema.forms.$inferSelect;

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_LENGTH = 10;

function generatePublicSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SLUG_LENGTH));
  return Array.from(bytes, (byte) => SLUG_CHARS[byte % SLUG_CHARS.length]).join("");
}

export async function expireFormIfNeeded(form: FormRow): Promise<FormRow> {
  if (form.status !== "active" || !form.closesAt) {
    return form;
  }

  const now = new Date();
  if (form.closesAt > now) {
    return form;
  }

  const [updated] = await db
    .update(schema.forms)
    .set({ status: "closed" })
    .where(and(eq(schema.forms.id, form.id), eq(schema.forms.status, "active")))
    .returning();

  return updated ?? { ...form, status: "closed" };
}

export async function createForm(input: { userId: string; question: string; classification: FormClassification; closesAt?: Date | null }) {
  const question = input.question.trim();
  if (!question) {
    throw new Error("Question is required.");
  }

  let publicSlug = generatePublicSlug();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [form] = await db
        .insert(schema.forms)
        .values({
          userId: input.userId,
          question,
          classification: input.classification,
          status: "active",
          publicSlug,
          closesAt: input.closesAt ?? null,
        })
        .returning();

      return form;
    } catch {
      publicSlug = generatePublicSlug();
    }
  }

  throw new Error("Could not create form. Please try again.");
}

export async function closeForm(formId: string, userId: string) {
  const [form] = await db
    .update(schema.forms)
    .set({ status: "closed" })
    .where(and(eq(schema.forms.id, formId), eq(schema.forms.userId, userId), eq(schema.forms.status, "active")))
    .returning();

  return form ?? null;
}

export async function getFormBySlug(slug: string) {
  const [form] = await db.select().from(schema.forms).where(eq(schema.forms.publicSlug, slug)).limit(1);
  if (!form) return null;
  return expireFormIfNeeded(form);
}

export async function getFormByIdForUser(formId: string, userId: string) {
  const [form] = await db
    .select()
    .from(schema.forms)
    .where(and(eq(schema.forms.id, formId), eq(schema.forms.userId, userId)))
    .limit(1);

  if (!form) return null;
  return expireFormIfNeeded(form);
}

export async function listFormsForUser(userId: string, options?: { publicOnly?: boolean }) {
  const conditions = [eq(schema.forms.userId, userId)];
  if (options?.publicOnly) {
    conditions.push(eq(schema.forms.hiddenFromPublic, false));
  }

  const forms = await db
    .select()
    .from(schema.forms)
    .where(and(...conditions))
    .orderBy(desc(schema.forms.createdAt));

  return Promise.all(forms.map((form) => expireFormIfNeeded(form)));
}

export async function setFormHiddenFromPublic(formId: string, userId: string, hiddenFromPublic: boolean) {
  const [form] = await db
    .update(schema.forms)
    .set({ hiddenFromPublic })
    .where(and(eq(schema.forms.id, formId), eq(schema.forms.userId, userId)))
    .returning();

  return form ?? null;
}

export async function expireDueFormsForUser(userId: string) {
  const now = new Date();
  await db
    .update(schema.forms)
    .set({ status: "closed" })
    .where(and(eq(schema.forms.userId, userId), eq(schema.forms.status, "active"), lte(schema.forms.closesAt, now)));
}

export function isFormAcceptingResponses(form: FormRow): boolean {
  return form.status === "active";
}

export function getPublicFormUrl(slug: string, origin: string): string {
  return `${origin}/f/${slug}`;
}
