import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AdventureWorks · Sales intelligence",
  description:
    "Historical sales analytics with traceable metrics and validated data.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
