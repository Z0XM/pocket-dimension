import { relations } from "drizzle-orm";
import { boolean, index, pgEnum, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./common";

export const authSchema = pgSchema("auth");

export const userRole = pgEnum("user_role", ["user", "contributor", "admin"]);

export const user = authSchema.table("user", {
  id,
  ...timestamps,
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  role: userRole("role").default("user").notNull(),
});

const userId = uuid("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" });

export const session = authSchema.table(
  "session",
  {
    id,
    userId,
    ...timestamps,
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = authSchema.table(
  "account",
  {
    id,
    userId,
    ...timestamps,
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = authSchema.table(
  "verification",
  {
    id,
    ...timestamps,
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
