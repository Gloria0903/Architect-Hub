import { DefaultSession } from "next-auth";

export type AppRole = "ADMIN" | "ARCHITECT" | "CLIENT";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      initials: string;
      // Only set when role === "CLIENT" — the Client record this portal
      // login belongs to. Staff sessions never have this.
      clientId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    initials: string;
    clientId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    initials: string;
    clientId?: string;
  }
}
