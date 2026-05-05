"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/":            "Live Market Dashboard",
  "/market":      "Market Overview",
  "/signals":     "AI Signals",
  "/backtesting": "Backtesting",
  "/portfolio":   "Portfolio Analytics",
  "/settings":    "Settings",
};

export function TopBar() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "AI Trading Terminal";

  return (
    <header className="h-14 px-6 border-b border-line flex items-center justify-between bg-page">
      <h1 className="text-base font-medium tracking-tight">{title}</h1>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <span className="text-muted">Market Status:</span>
          <span className="inline-flex items-center gap-1.5 text-up">
            <span className="size-2 rounded-full bg-up animate-pulse" />
            OPEN
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-muted">Balance:</span>
          <span className="font-mono tabular-nums">$125,400.50</span>
          <span className="text-dim text-xs">(Paper)</span>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-card transition-colors"
        >
          <div className="size-7 rounded-full bg-elevated ring-1 ring-line flex items-center justify-center text-xs font-medium">
            RP
          </div>
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      </div>
    </header>
  );
}
