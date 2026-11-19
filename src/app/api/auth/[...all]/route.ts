import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Sign-up, sign-in, sign-out, email verification, password reset and 2FA.
export const { GET, POST } = toNextJsHandler(auth);
