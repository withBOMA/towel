import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Job, crew and client management for trade contractors.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5ad1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
