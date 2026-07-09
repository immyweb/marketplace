import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db/prisma";
import { sendWelcomeEmail } from "@/features/account/welcome.email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: ["http://localhost:3000"],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail(user.email, user.name);
        },
      },
    },
  },
});
