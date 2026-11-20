import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cx("mb-1 block text-sm font-medium text-slate-700", className)} {...props} />;
}

const fieldBase =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldBase, "pr-8", className)} {...props} />;
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60",
  link: "text-sm font-medium text-brand-600 hover:text-brand-700",
};

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
    info: "border-brand-100 bg-brand-50 text-brand-700",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg border px-3 py-2.5 text-sm", styles)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
