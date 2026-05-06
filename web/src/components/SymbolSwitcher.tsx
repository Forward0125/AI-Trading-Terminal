"use client";

import { SYMBOLS, type ProductId } from "@/lib/market";
import { cn } from "@/lib/cn";

interface Props {
  value:    ProductId;
  onChange: (id: ProductId) => void;
}

export function SymbolSwitcher({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-line bg-elevated p-0.5">
      {SYMBOLS.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded transition-colors",
              active
                ? "bg-card text-fg shadow-sm"
                : "text-muted hover:text-fg",
            )}
          >
            {s.base}
          </button>
        );
      })}
    </div>
  );
}
