import { z } from "zod";

const sortableColumns = ["occurredOn", "amountMinor", "merchant", "type", "createdAt"] as const;

export const paginationQuerySchema = z.object({
  pageIndex: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const multiTagIdsSchema = z.preprocess(
  (value) => {
    if (value == null || value === "") return undefined;
    if (Array.isArray(value)) return value;
    return String(value)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  },
  z.array(z.union([z.string().uuid(), z.literal("untagged")])).optional()
);

export const transactionsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  tagIds: multiTagIdsSchema,
  type: z.enum(["expense", "income", "transfer"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  spaceId: z.string().uuid().optional(),
  sortBy: z.enum(sortableColumns).default("occurredOn"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const createAccountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  currencyCode: z.string().trim().length(3).default("INR"),
  timezone: z.string().trim().min(2).max(120).default("Asia/Kolkata"),
  colorHex: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{6})$/)
    .optional(),
  bankImporterId: z.enum(["kotak", "icici", "hdfc", "generic"]).optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  currencyCode: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  timezone: z.string().trim().min(2).max(120).optional(),
  colorHex: z
    .union([
      z
        .string()
        .trim()
        .regex(/^#([0-9A-Fa-f]{6})$/),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  bankImporterId: z.union([z.enum(["kotak", "icici", "hdfc", "generic"]), z.literal(""), z.null()]).optional(),
});

export const switchAccountSchema = z.object({
  accountId: z.string().uuid(),
});

export const updateAccountCurrencySchema = z.object({
  currencyCode: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
});

export const updateAccountOpeningBalanceSchema = z.object({
  balanceAsOf: z.string().date(),
  amount: z.string().trim().min(1),
});

export const clearAccountOpeningBalanceSchema = z.object({
  clear: z.literal("1"),
});

const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((value) => value.replace(/^#+/, ""));

export const createTagSchema = z.object({
  name: tagNameSchema,
  kind: z.enum(["expense", "income", "transfer"]).nullish(),
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

const spaceNameSchema = z.string().trim().min(1).max(80);

export const createSpaceSchema = z.object({
  name: spaceNameSchema,
  colorHex: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{6})$/)
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateSpaceSchema = createSpaceSchema.extend({
  id: z.string().uuid(),
});

export const deleteSpaceSchema = z.object({
  id: z.string().uuid(),
});

export const attachTransactionSpaceSchema = z.object({
  spaceId: z.string().uuid(),
});

export const createSpaceAllocationSchema = z.object({
  leftTransactionId: z.string().uuid(),
  rightTransactionId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
});

export const updateSpaceAllocationSchema = z.object({
  amountMinor: z.number().int().positive(),
});

export const transactionUpsertSchema = z.object({
  occurredOn: z.string().date(),
  amountMinor: z.number().int(),
  type: z.enum(["expense", "income", "transfer"]),
  merchant: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  externalRef: z.string().trim().max(120).optional(),
  sortOrder: z.number().int().optional(),
});

export const budgetUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagId: z.string().uuid().optional(),
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
  tagNames: z.array(z.string().trim()).optional(),
  externalRef: z.string().trim().optional(),
  balanceMinor: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
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
