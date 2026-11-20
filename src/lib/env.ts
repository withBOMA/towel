import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Towelapp"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

// Next.js inlines NEXT_PUBLIC_* only when referenced literally, so list them.
export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || undefined,
  RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
  EMAIL_FROM: process.env.EMAIL_FROM || undefined,
});

export const APP_NAME = env.NEXT_PUBLIC_APP_NAME;
