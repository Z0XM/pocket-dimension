export const MAX_ANSWERS_PER_SUBMIT = 10;

export type AnswerDraft = {
  primaryAnswer: string;
  expandDetail?: string | null;
  notes?: string | null;
};

export type FormClassification = "positive" | "negative" | "general";

export function classificationLabel(classification: FormClassification): string {
  switch (classification) {
    case "positive":
      return "Positive";
    case "negative":
      return "Negative";
    default:
      return "General";
  }
}

export function getPublicFormUrl(slug: string, origin: string): string {
  return `${origin}/f/${slug}`;
}
