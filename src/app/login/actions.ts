"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNext, withParams } from "@/lib/utils";

const emailSchema = z.email().transform((e) => e.trim().toLowerCase());

export async function sendLoginCode(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    redirect(withParams("/login", { error: "Enter a valid email address.", next }));
  }
  const email = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(withParams("/login", { error: error.message, next }));
  }
  redirect(withParams("/login", { sent: "1", email, next }));
}

export async function verifyLoginCode(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const email = emailSchema.safeParse(formData.get("email"));
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");

  if (!email.success || !/^\d{6,10}$/.test(token)) {
    redirect(withParams("/login", { sent: "1", email: email.data, next, error: "Enter the code from the email." }));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token, type: "email" });
  if (error) {
    redirect(withParams("/login", { sent: "1", email: email.data, next, error: "That code didn't work. Check it or request a new one." }));
  }
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
