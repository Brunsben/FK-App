import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "member";
      consentGiven: boolean;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "member";
    consentGiven: boolean;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "member";
    consentGiven: boolean;
    mustChangePassword: boolean;
  }
}
