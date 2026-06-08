import type { AnswerRow } from "$lib/server/answers";
import type { FormRow } from "$lib/server/forms";

export type { AnswerRow };

export type FormWithPreview = FormRow & {
  answerCount: number;
  previewAnswers: AnswerRow[];
};

export type DedupedAnswer = {
  text: string;
  count: number;
  expandDetails: string[];
};
