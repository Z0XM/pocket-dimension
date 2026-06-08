import { boolean, index, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import * as auth from "./auth";
import { id, timestamps } from "./common";

export const meViaYouSchema = pgSchema("meviayou");

export const formClassification = meViaYouSchema.enum("form_classification", ["positive", "negative", "general"]);
export const formStatus = meViaYouSchema.enum("form_status", ["active", "closed"]);

export const forms = meViaYouSchema.table(
  "forms",
  {
    id,
    ...timestamps,
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    classification: formClassification("classification").notNull(),
    status: formStatus("status").default("active").notNull(),
    publicSlug: text("public_slug").notNull(),
    closesAt: timestamp("closes_at"),
    hiddenFromPublic: boolean("hidden_from_public").default(false).notNull(),
  },
  (table) => [unique("forms_public_slug_unique").on(table.publicSlug), index("forms_user_id_idx").on(table.userId)]
);

export const answers = meViaYouSchema.table(
  "answers",
  {
    id,
    createdAt: timestamps.createdAt,
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    primaryAnswer: text("primary_answer").notNull(),
    expandDetail: text("expand_detail"),
    notes: text("notes"),
    respondentName: text("respondent_name"),
    isAnonymous: boolean("is_anonymous").default(false).notNull(),
  },
  (table) => [index("answers_form_id_idx").on(table.formId)]
);
