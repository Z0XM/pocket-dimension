import { db } from "@pocket-dimension/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

export const auth = betterAuth({
  user: {
    additionalFields: {
      role: {
        type: ["user", "contributor", "admin"],
        required: true,
        defaultValue: "user",
        input: false,
        returned: true,
        nullable: false,
        fieldName: "role",
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      usernameValidator: (username) => {
        return /^[a-zA-Z0-9]+$/.test(username);
      },
      usernameNormalization: (username) => {
        return username.toLowerCase();
      },
    }),
  ],
});
