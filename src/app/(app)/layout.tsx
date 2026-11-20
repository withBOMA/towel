import Link from "next/link";
import { OrgSwitcher } from "@/components/org-switcher";
import { canManageOrg, getOrgContext } from "@/lib/auth";
import { APP_NAME } from "@/lib/env";
import { signOut } from "@/app/login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await getOrgContext();

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    ...(canManageOrg(ctx.role) ? [{ href: "/settings/members", label: "Team" }] : []),
    { href: "/account", label: "Account" },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/dashboard" className="shrink-0 font-semibold text-brand-700">
            {APP_NAME}
          </Link>
          <span className="text-slate-300">/</span>
          <OrgSwitcher currentOrgId={ctx.org.id} orgs={ctx.orgs} />
          <form action={signOut} className="ml-auto">
            <button className="text-sm text-slate-500 hover:text-slate-800">Sign out</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
