import { z } from "zod";

const sortableColumns = ["occurredOn", "amountMinor", "merchant", "type", "createdAt"] as const;

export const paginationQuerySchema = z.object({
  pageIndex: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const multiCategoryIdsSchema = z.preprocess(
  (value) => {
    if (value == null || value === "") return undefined;
    if (Array.isArray(value)) return value;
    return String(value)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  },
  z.array(z.union([z.string().uuid(), z.literal("uncategorized")])).optional()
);

const multiTagIdsSchema = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  if (Array.isArray(value)) return value;
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}, z.array(z.string().uuid()).optional());

export const transactionsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  categoryIds: multiCategoryIdsSchema,
  tagIds: multiTagIdsSchema,
  type: z.enum(["expense", "income", "transfer"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  groupId: z.string().uuid().optional(),
  linkTransactionId: z.string().uuid().optional(),
  sortBy: z.enum(sortableColumns).default("occurredOn"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const createAccountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  currencyCode: z.string().trim().length(3).default("USD"),
  timezone: z.string().trim().min(2).max(120).default("UTC"),
});

export const updateAccountCurrencySchema = z.object({
  currencyCode: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["expense", "income", "transfer"]).default("expense"),
  colorHex: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{6})$/)
    .optional(),
});

export const updateCategorySchema = createCategorySchema.extend({
  id: z.string().uuid(),
});

export const deleteCategorySchema = z.object({
  id: z.string().uuid(),
});

const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((value) => value.replace(/^#+/, ""));

export const createTagSchema = z.object({
  name: tagNameSchema,
  colorHex: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{6})$/)
    .optional(),
});

export const updateTagSchema = createTagSchema.extend({
  id: z.string().uuid(),
});

export const deleteTagSchema = z.object({
  id: z.string().uuid(),
});

export const attachTransactionTagSchema = z.object({
  tagId: z.string().uuid(),
});

export const attachTransactionGroupSchema = z.object({
  groupId: z.string().uuid(),
});

export const attachRefundLinkSchema = z.object({
  expenseTransactionId: z.string().uuid(),
});

const groupNameSchema = z.string().trim().min(1).max(80);

export const setGroupHiddenSchema = z.object({
  hidden: z.boolean(),
});

export const createGroupSchema = z.object({
  name: groupNameSchema,
});

export const updateGroupSchema = createGroupSchema.extend({
  id: z.string().uuid(),
});

export const deleteGroupSchema = z.object({
  id: z.string().uuid(),
});

export const transactionUpsertSchema = z.object({
  occurredOn: z.string().date(),
  amountMinor: z.number().int(),
  type: z.enum(["expense", "income", "transfer"]),
  merchant: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  externalRef: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().nullish(),
  sortOrder: z.number().int().optional(),
});

export const budgetUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: z.string().uuid().optional(),
  period: z.enum(["monthly", "weekly", "custom"]).default("monthly"),
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
  limitMinor: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

export const goalUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetMinor: z.number().int().positive(),
  currentMinor: z.number().int().min(0).default(0),
  targetDate: z.string().date().optional(),
  status: z.enum(["active", "paused", "completed", "cancelled"]).default("active"),
});

export const csvImportRowSchema = z.object({
  occurredOn: z.string().date(),
  amountMinor: z.number().int().positive(),
  type: z.enum(["expense", "income", "transfer"]),
  merchant: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  categoryName: z.string().trim().optional(),
  externalRef: z.string().trim().optional(),
  balanceMinor: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
});

export const smartCategorizePreviewSchema = z.object({
  merchant: z.string().trim().min(1).max(120),
  newCategoryId: z.string().uuid().nullish(),
  sourceTransactionId: z.string().uuid(),
  type: z.enum(["expense", "income", "transfer"]),
});

export const smartCategorizeApplySchema = z.object({
  sourceTransactionId: z.string().uuid(),
  newCategoryId: z.string().uuid().nullish(),
  type: z.enum(["expense", "income", "transfer"]),
  migrations: z.array(
    z.object({
      merchant: z.string().trim().min(1).max(120),
      fromCategoryId: z.string().uuid().nullish(),
      enabled: z.boolean(),
    })
  ),
});

export const smartTagPreviewSchema = z.object({
  merchant: z.string().trim().min(1).max(120),
  newTagId: z.string().uuid(),
  sourceTransactionId: z.string().uuid(),
  type: z.enum(["expense", "income", "transfer"]),
});

export const smartTagApplySchema = z.object({
  sourceTransactionId: z.string().uuid(),
  newTagId: z.string().uuid(),
  type: z.enum(["expense", "income", "transfer"]),
  mode: z.enum(["replace", "append"]),
  migrations: z.array(
    z.object({
      merchant: z.string().trim().min(1).max(120),
      fromTagIds: z.array(z.string().uuid()).nullable(),
      enabled: z.boolean(),
    })
  ),
});
