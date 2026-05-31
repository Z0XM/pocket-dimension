import { relations } from "drizzle-orm";
import { bigint, boolean, date, index, integer, pgSchema, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import * as auth from "./auth";
import { actionsByUser, id, timestamps } from "./common";

export const chhanSchema = pgSchema("chhanchhan");

export const accountMemberRole = chhanSchema.enum("account_member_role", ["owner", "editor", "viewer"]);
export const transactionType = chhanSchema.enum("transaction_type", ["expense", "income", "transfer"]);
export const budgetPeriod = chhanSchema.enum("budget_period", ["monthly", "weekly", "custom"]);
export const goalStatus = chhanSchema.enum("goal_status", ["active", "paused", "completed", "cancelled"]);

export const financeAccounts = chhanSchema.table(
  "finance_accounts",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    timezone: text("timezone").notNull().default("UTC"),
    isArchived: boolean("is_archived").notNull().default(false),
    balanceMinor: bigint("balance_minor", { mode: "number" }),
    balanceAsOf: date("balance_as_of"),
  },
  (table) => [index("finance_accounts_owner_user_id_idx").on(table.ownerUserId)]
);

export const financeAccountMembers = chhanSchema.table(
  "finance_account_members",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    role: accountMemberRole("role").notNull().default("viewer"),
  },
  (table) => [
    unique("finance_account_members_account_id_user_id_unique").on(table.accountId, table.userId),
    index("finance_account_members_user_id_idx").on(table.userId),
  ]
);

export const financeCategories = chhanSchema.table(
  "finance_categories",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: transactionType("kind").notNull().default("expense"),
    colorHex: text("color_hex"),
    parentCategoryId: uuid("parent_category_id"),
  },
  (table) => [
    unique("finance_categories_account_id_name_unique").on(table.accountId, table.name),
    index("finance_categories_account_id_idx").on(table.accountId),
  ]
);

export const financeTransactions = chhanSchema.table(
  "finance_transactions",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => financeCategories.id, { onDelete: "set null" }),
    occurredOn: date("occurred_on").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    type: transactionType("type").notNull(),
    merchant: text("merchant"),
    notes: text("notes"),
    externalRef: text("external_ref"),
    balanceMinor: bigint("balance_minor", { mode: "number" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("finance_transactions_account_id_occurred_on_idx").on(table.accountId, table.occurredOn),
    index("finance_transactions_account_id_category_id_idx").on(table.accountId, table.categoryId),
    index("finance_transactions_account_id_sort_order_idx").on(table.accountId, table.sortOrder),
  ]
);

export const financeBudgets = chhanSchema.table(
  "finance_budgets",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => financeCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    period: budgetPeriod("period").notNull().default("monthly"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    limitMinor: bigint("limit_minor", { mode: "number" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("finance_budgets_account_id_idx").on(table.accountId)]
);

export const financeGoals = chhanSchema.table(
  "finance_goals",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetMinor: bigint("target_minor", { mode: "number" }).notNull(),
    currentMinor: bigint("current_minor", { mode: "number" }).notNull().default(0),
    targetDate: date("target_date"),
    status: goalStatus("status").notNull().default("active"),
  },
  (table) => [index("finance_goals_account_id_idx").on(table.accountId)]
);

export const financeTags = chhanSchema.table(
  "finance_tags",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colorHex: text("color_hex"),
  },
  (table) => [unique("finance_tags_account_id_name_unique").on(table.accountId, table.name), index("finance_tags_account_id_idx").on(table.accountId)]
);

export const financeTransactionTags = chhanSchema.table(
  "finance_transaction_tags",
  {
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => financeTransactions.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => financeTags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.transactionId, table.tagId] }), index("finance_transaction_tags_tag_id_idx").on(table.tagId)]
);

export const financeGroups = chhanSchema.table(
  "finance_groups",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colorHex: text("color_hex"),
  },
  (table) => [
    unique("finance_groups_account_id_name_unique").on(table.accountId, table.name),
    index("finance_groups_account_id_idx").on(table.accountId),
  ]
);

export const financeTransactionGroups = chhanSchema.table(
  "finance_transaction_groups",
  {
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => financeTransactions.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => financeGroups.id, { onDelete: "cascade" }),
    isHidden: boolean("is_hidden").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.transactionId, table.groupId] }), index("finance_transaction_groups_group_id_idx").on(table.groupId)]
);

export const financeAccountRelations = relations(financeAccounts, ({ one, many }) => ({
  owner: one(auth.user, {
    fields: [financeAccounts.ownerUserId],
    references: [auth.user.id],
  }),
  members: many(financeAccountMembers),
  categories: many(financeCategories),
  transactions: many(financeTransactions),
  budgets: many(financeBudgets),
  goals: many(financeGoals),
  tags: many(financeTags),
  groups: many(financeGroups),
}));

export const financeAccountMemberRelations = relations(financeAccountMembers, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [financeAccountMembers.accountId],
    references: [financeAccounts.id],
  }),
  user: one(auth.user, {
    fields: [financeAccountMembers.userId],
    references: [auth.user.id],
  }),
}));

export const financeCategoryRelations = relations(financeCategories, ({ one, many }) => ({
  account: one(financeAccounts, {
    fields: [financeCategories.accountId],
    references: [financeAccounts.id],
  }),
  parentCategory: one(financeCategories, {
    fields: [financeCategories.parentCategoryId],
    references: [financeCategories.id],
  }),
  transactions: many(financeTransactions),
  budgets: many(financeBudgets),
}));

export const financeTransactionRelations = relations(financeTransactions, ({ one, many }) => ({
  account: one(financeAccounts, {
    fields: [financeTransactions.accountId],
    references: [financeAccounts.id],
  }),
  category: one(financeCategories, {
    fields: [financeTransactions.categoryId],
    references: [financeCategories.id],
  }),
  transactionTags: many(financeTransactionTags),
  transactionGroups: many(financeTransactionGroups),
}));

export const financeTagRelations = relations(financeTags, ({ one, many }) => ({
  account: one(financeAccounts, {
    fields: [financeTags.accountId],
    references: [financeAccounts.id],
  }),
  transactionTags: many(financeTransactionTags),
}));

export const financeTransactionTagRelations = relations(financeTransactionTags, ({ one }) => ({
  transaction: one(financeTransactions, {
    fields: [financeTransactionTags.transactionId],
    references: [financeTransactions.id],
  }),
  tag: one(financeTags, {
    fields: [financeTransactionTags.tagId],
    references: [financeTags.id],
  }),
}));

export const financeGroupRelations = relations(financeGroups, ({ one, many }) => ({
  account: one(financeAccounts, {
    fields: [financeGroups.accountId],
    references: [financeAccounts.id],
  }),
  transactionGroups: many(financeTransactionGroups),
}));

export const financeTransactionGroupRelations = relations(financeTransactionGroups, ({ one }) => ({
  transaction: one(financeTransactions, {
    fields: [financeTransactionGroups.transactionId],
    references: [financeTransactions.id],
  }),
  group: one(financeGroups, {
    fields: [financeTransactionGroups.groupId],
    references: [financeGroups.id],
  }),
}));

export const financeBudgetRelations = relations(financeBudgets, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [financeBudgets.accountId],
    references: [financeAccounts.id],
  }),
  category: one(financeCategories, {
    fields: [financeBudgets.categoryId],
    references: [financeCategories.id],
  }),
}));

export const financeGoalRelations = relations(financeGoals, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [financeGoals.accountId],
    references: [financeAccounts.id],
  }),
}));
