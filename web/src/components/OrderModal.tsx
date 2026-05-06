"use client";

/**
 * Buy/Sell order modal. Market orders only — limit would need a
 * price-watching engine we're not building. The displayed price
 * updates live via useTicker; the order fills at whatever the
 * latest tick shows when the user hits Confirm.
 */

import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useTicker } from "@/hooks/useTicker";
import { usePaperAccount } from "@/hooks/usePaperAccount";
import {
  type OrderSide,
  formatUSD,
  placeOrder,
} from "@/lib/paper";
import { formatPrice, getSymbol, type ProductId } from "@/lib/market";
import { cn } from "@/lib/cn";

interface Props {
  open:       boolean;
  side:       OrderSide;
  productId:  ProductId;
  onClose:    () => void;
}

export function OrderModal({ open, side, productId, onClose }: Props) {
  const ticker  = useTicker(productId);
  const account = usePaperAccount();
  const sym     = getSymbol(productId);

  const [qtyInput, setQtyInput] = useState<string>("");
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQtyInput("");
    setError(null);
    setSuccess(null);
    // Tiny delay to let the modal mount; otherwise focus loses to the click.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, productId, side]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const qty       = Number.parseFloat(qtyInput) || 0;
  const price     = ticker?.last ?? 0;
  const notional  = qty * price;
  const heldQty   = account.positions.find((p) => p.symbol === productId)?.qty ?? 0;
  const isBuy     = side === "buy";

  const reasons: string[] = [];
  if (qty <= 0)                                reasons.push("enter a positive quantity");
  if (price <= 0)                              reasons.push("waiting for live price");
  if (isBuy  && notional > account.cash)       reasons.push("insufficient cash");
  if (!isBuy && qty > heldQty)                 reasons.push(`only ${heldQty.toFixed(6)} held`);
  const canSubmit = reasons.length === 0;

  function submit() {
    setError(null);
    const result = placeOrder({ symbol: productId, side, qty, price });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(
      `${side.toUpperCase()} ${qty} ${sym?.base ?? productId} ` +
      `@ ${formatPrice(price, sym)} — ${formatUSD(notional)}`,
    );
    setTimeout(onClose, 900);
  }

  const tone = isBuy
    ? { btn: "bg-up text-page hover:bg-up/85", icon: ArrowUpRight, label: "Buy" }
    : { btn: "bg-down text-page hover:bg-down/85", icon: ArrowDownRight, label: "Sell" };
  const Icon = tone.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg bg-card border border-line shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Icon className={cn("size-4", isBuy ? "text-up" : "text-down")} />
            <h2 className="text-sm font-medium">{tone.label} {sym?.display ?? productId}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="p-4 space-y-4 text-sm">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">Last price</span>
            <span className="font-mono tabular-nums text-fg">
              {price > 0 ? formatPrice(price, sym) : "…"}
            </span>
          </div>

          <label className="block">
            <span className="text-xs text-muted">Quantity ({sym?.base ?? "units"})</span>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              placeholder="0.0000"
              className="mt-1 w-full bg-page border border-line rounded px-2 py-1.5 font-mono tabular-nums text-fg focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          <div className="rounded border border-line/60 bg-elevated/40 px-3 py-2 text-xs space-y-1">
            <Row label="Notional" value={qty > 0 ? formatUSD(notional) : "—"} />
            {isBuy
              ? <Row label="Cash available" value={formatUSD(account.cash)} />
              : <Row label="Held"          value={`${heldQty.toFixed(6)} ${sym?.base ?? ""}`} />}
            {isBuy
              ? <Row
                  label="Cash after"
                  value={qty > 0 ? formatUSD(account.cash - notional) : "—"}
                  tone={account.cash - notional < 0 ? "down" : undefined}
                />
              : <Row label="Held after" value={qty > 0 ? `${(heldQty - qty).toFixed(6)}` : "—"} />}
          </div>

          {error   && <p className="text-xs text-down">{error}</p>}
          {success && <p className="text-xs text-up">{success}</p>}
          {!success && reasons.length > 0 && (
            <p className="text-[11px] text-dim">{reasons.join(" · ")}</p>
          )}
        </div>

        <footer className="px-4 pb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded text-sm border border-line text-muted hover:text-fg hover:bg-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || !!success}
            className={cn(
              "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
              tone.btn,
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-current",
            )}
          >
            Confirm {tone.label}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "down" }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn("font-mono tabular-nums", tone === "down" ? "text-down" : "text-fg")}>
        {value}
      </span>
    </div>
  );
}
