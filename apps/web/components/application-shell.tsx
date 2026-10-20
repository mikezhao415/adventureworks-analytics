"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Globe2,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PAGES, preserveQuery } from "../lib/navigation";
const ICONS = [LayoutDashboard, BarChart3, Package, Users, Globe2, BookOpen];
export function ApplicationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    query = useSearchParams().toString();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = nav.current;
    const active = container?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (!container || !active || container.scrollWidth <= container.clientWidth)
      return;
    const bounds = container.getBoundingClientRect(),
      item = active.getBoundingClientRect();
    if (item.left < bounds.left || item.right > bounds.right)
      container.scrollLeft +=
        item.left - bounds.left - (bounds.width - item.width) / 2;
  }, [pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to page content
      </a>
      <aside className="sidebar">
        <Link
          className="brand"
          href={preserveQuery("/", query)}
          prefetch={false}
        >
          <span className="brand-mark">
            <Activity size={26} aria-hidden="true" />
          </span>
          <span>
            AdventureWorks<span className="brand-sub">Analytics</span>
          </span>
        </Link>
        <nav ref={nav} aria-label="Analytics pages">
          {PAGES.map((page, i) => {
            const Icon = ICONS[i];
            return (
              <Link
                key={page.path}
                href={preserveQuery(page.path, query)}
                prefetch={false}
                className={pathname === page.path ? "nav-active" : undefined}
                aria-current={pathname === page.path ? "page" : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span>
                  {page.path === "/products"
                    ? "Products & categories"
                    : page.title}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={23} aria-hidden="true" />
          <strong>Validated sales metrics</strong>
          <p>
            Historical snapshots.
            <br />
            Independent reconciliation.
          </p>
          <Link href={preserveQuery("/definitions", query)} prefetch={false}>
            Data & definitions <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
