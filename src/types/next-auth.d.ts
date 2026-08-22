import { DefaultSession } from "next-auth";

export type AppRole = "ADMIN" | "SENIOR_ARCHITECT" | "ARCHITECT" | "CLIENT";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      initials: string;

      /**
       * True when an administrator-created staff account
       * must change its temporary password before continuing.
       */
      mustResetPassword: boolean;

      /**
       * Only set when role === "CLIENT".
       * Staff sessions never have this field.
       */
      clientId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    initials: string;

    /**
     * Forces a newly-created staff member to change
     * their temporary password.
     */
    mustResetPassword?: boolean;

    clientId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    initials: string;

    /**
     * Persist password-reset requirement in the JWT.
     */
    mustResetPassword: boolean;

    clientId?: string;
  }
}