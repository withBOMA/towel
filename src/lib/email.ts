import "server-only";
import { env } from "@/lib/env";

type Email = { to: string; subject: string; text: string; html: string };

/**
 * Sends a transactional email through Resend when RESEND_API_KEY and EMAIL_FROM
 * are set. Returns false (and sends nothing) otherwise, so the app works with
 * zero paid services: admins can copy invite links instead.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
  });

  if (!res.ok) {
    console.error("Resend error", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
