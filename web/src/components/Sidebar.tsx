"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  BarChart3,
  Activity,
  Repeat,
  PieChart,
  Settings,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/",            label: "Dashboard",           icon: LayoutGrid },
  { href: "/market",      label: "Market Overview",     icon: BarChart3 },
  { href: "/signals",     label: "AI Signals",          icon: Activity },
  { href: "/backtesting", label: "Backtesting",         icon: Repeat },
  { href: "/portfolio",   label: "Portfolio Analytics", icon: PieChart },
  { href: "/settings",    label: "Settings",            icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 bg-panel border-r border-line flex flex-col">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-line">
        <div className="size-9 rounded-lg bg-accent/15 flex items-center justify-center ring-1 ring-accent/30">
          <TrendingUp className="size-5 text-accent" />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] tracking-widest text-muted uppercase">AI Trading</div>
          <div className="text-sm font-semibold">Terminal</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-card text-fg ring-1 ring-line"
                  : "text-muted hover:bg-card/60 hover:text-fg",
              )}
            >
              <Icon className={cn("size-4", active ? "text-accent" : "text-muted")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-line text-[11px] text-dim leading-snug">
        <div>v0.1 &middot; paper trading</div>
        <div className="mt-0.5">no real funds</div>
      </div>
    </aside>
  );
}
