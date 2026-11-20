import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/env";
import { first, safeNext, withParams } from "@/lib/utils";
import { sendLoginCode, verifyLoginCode } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(first(params.next));
  const error = first(params.error);
  const sent = first(params.sent) === "1";
  const email = first(params.email) ?? "";

  if (await getUser()) redirect(next);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-semibold text-brand-700">{APP_NAME}</p>
        <Card>
          {!sent ? (
            <>
              <h1 className="text-xl font-semibold">Sign in</h1>
              <p className="mt-1 text-sm text-slate-600">
                We&apos;ll email you a sign-in link and a code. No password needed.
              </p>
              <form action={sendLoginCode} className="mt-5 space-y-4">
                <input type="hidden" name="next" value={next} />
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={email} />
                </div>
                {error && <Alert>{error}</Alert>}
                <SubmitButton className="w-full" pendingText="Sending…">
                  Email me a sign-in code
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Check your email</h1>
              <p className="mt-1 text-sm text-slate-600">
                We sent a link and a code to <span className="font-medium text-slate-900">{email}</span>. Tap the
                link, or enter the code here.
              </p>
              <form action={verifyLoginCode} className="mt-5 space-y-4">
                <input type="hidden" name="next" value={next} />
                <input type="hidden" name="email" value={email} />
                <div>
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9 ]*"
                    maxLength={12}
                    required
                    className="tracking-widest"
                  />
                </div>
                {error && <Alert>{error}</Alert>}
                <SubmitButton className="w-full" pendingText="Checking…">
                  Sign in
                </SubmitButton>
              </form>
              <Link href={withParams("/login", { next, email })} className="mt-4 block text-center text-sm text-brand-600">
                Use a different email or resend
              </Link>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
