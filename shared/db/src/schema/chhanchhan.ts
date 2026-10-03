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
    colorHex: text("color_hex"),
    bankImporterId: text("bank_importer_id"),
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

/** Sole free-form classifier. Optional kind helps filter income vs expense tags. */
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
    kind: transactionType("kind"),
  },
  (table) => [unique("finance_tags_account_id_name_unique").on(table.accountId, table.name), index("finance_tags_account_id_idx").on(table.accountId)]
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
    index("finance_transactions_account_id_sort_order_idx").on(table.accountId, table.sortOrder),
  ]
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

/**
 * Space: relationship container for shared money / linked transactions.
 * Quick mode = just membership + M:N allocations. Full mode adds members/items later.
 */
export const financeSpaces = chhanSchema.table(
  "finance_spaces",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colorHex: text("color_hex"),
    notes: text("notes"),
  },
  (table) => [
    unique("finance_spaces_account_id_name_unique").on(table.accountId, table.name),
    index("finance_spaces_account_id_idx").on(table.accountId),
  ]
);

export const financeSpaceTransactions = chhanSchema.table(
  "finance_space_transactions",
  {
    spaceId: uuid("space_id")
      .notNull()
      .references(() => financeSpaces.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => financeTransactions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.spaceId, table.transactionId] }),
    index("finance_space_transactions_transaction_id_idx").on(table.transactionId),
  ]
);

/** M:N amount graph inside a space — any txn portion can allocate against any other. */
export const financeSpaceAllocations = chhanSchema.table(
  "finance_space_allocations",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    spaceId: uuid("space_id")
      .notNull()
      .references(() => financeSpaces.id, { onDelete: "cascade" }),
    leftTransactionId: uuid("left_transaction_id")
      .notNull()
      .references(() => financeTransactions.id, { onDelete: "cascade" }),
    rightTransactionId: uuid("right_transaction_id")
      .notNull()
      .references(() => financeTransactions.id, { onDelete: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  },
  (table) => [
    index("finance_space_allocations_space_id_idx").on(table.spaceId),
    index("finance_space_allocations_left_txn_idx").on(table.leftTransactionId),
    index("finance_space_allocations_right_txn_idx").on(table.rightTransactionId),
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
    tagId: uuid("tag_id").references(() => financeTags.id, { onDelete: "cascade" }),
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

export const financeAccountRelations = relations(financeAccounts, ({ one, many }) => ({
  owner: one(auth.user, {
    fields: [financeAccounts.ownerUserId],
    references: [auth.user.id],
  }),
  members: many(financeAccountMembers),
  transactions: many(financeTransactions),
  budgets: many(financeBudgets),
  goals: many(financeGoals),
  tags: many(financeTags),
  spaces: many(financeSpaces),
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

export const financeTransactionRelations = relations(financeTransactions, ({ one, many }) => ({
  account: one(financeAccounts, {
    fields: [financeTransactions.accountId],
    references: [financeAccounts.id],
  }),
  transactionTags: many(financeTransactionTags),
  spaceTransactions: many(financeSpaceTransactions),
  leftAllocations: many(financeSpaceAllocations, { relationName: "leftAllocations" }),
  rightAllocations: many(financeSpaceAllocations, { relationName: "rightAllocations" }),
}));

export const financeTagRelations = relations(financeTags, ({ one, many }) => ({
  account: one(financeAccounts, {
    fields: [financeTags.accountId],
    references: [financeAccounts.id],
  }),
  transactionTags: many(financeTransactionTags),
  budgets: many(financeBudgets),
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

export const financeSpaceRelations = relations(financeSpaces, ({ one, many }) => ({
  account: one(financeAccounts, {
    fields: [financeSpaces.accountId],
    references: [financeAccounts.id],
  }),
  spaceTransactions: many(financeSpaceTransactions),
  allocations: many(financeSpaceAllocations),
}));

export const financeSpaceTransactionRelations = relations(financeSpaceTransactions, ({ one }) => ({
  space: one(financeSpaces, {
    fields: [financeSpaceTransactions.spaceId],
    references: [financeSpaces.id],
  }),
  transaction: one(financeTransactions, {
    fields: [financeSpaceTransactions.transactionId],
    references: [financeTransactions.id],
  }),
}));

export const financeSpaceAllocationRelations = relations(financeSpaceAllocations, ({ one }) => ({
  space: one(financeSpaces, {
    fields: [financeSpaceAllocations.spaceId],
    references: [financeSpaces.id],
  }),
  leftTransaction: one(financeTransactions, {
    fields: [financeSpaceAllocations.leftTransactionId],
    references: [financeTransactions.id],
    relationName: "leftAllocations",
  }),
  rightTransaction: one(financeTransactions, {
    fields: [financeSpaceAllocations.rightTransactionId],
    references: [financeTransactions.id],
    relationName: "rightAllocations",
  }),
}));

export const financeBudgetRelations = relations(financeBudgets, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [financeBudgets.accountId],
    references: [financeAccounts.id],
  }),
  tag: one(financeTags, {
    fields: [financeBudgets.tagId],
    references: [financeTags.id],
  }),
}));

export const financeGoalRelations = relations(financeGoals, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [financeGoals.accountId],
    references: [financeAccounts.id],
  }),
}));
