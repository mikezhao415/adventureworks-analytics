import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { ApplicationShell } from "../components/application-shell";
export const metadata: Metadata = {
  title: "AdventureWorks Analytics",
  description:
    "Historical sales analytics with traceable metrics and validated data.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense
          fallback={<p role="status">Loading AdventureWorks Analytics…</p>}
        >
          <ApplicationShell>{children}</ApplicationShell>
        </Suspense>
      </body>
    </html>
  );
}
