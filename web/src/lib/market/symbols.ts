import type { ProductId } from "./types";

export interface SymbolInfo {
  id:         ProductId;
  display:    string;
  base:       string;
  quote:      string;
  precision:  number;  // decimal places for price formatting
  kind:       "crypto" | "stock";
}

/** Whitelist used by the UI symbol switcher. Crypto pairs are pulled
 *  live from Coinbase; stocks come via the Yahoo proxy added in step 12. */
export const SYMBOLS: readonly SymbolInfo[] = [
  { id: "BTC-USD", display: "BTC/USD", base: "BTC", quote: "USD", precision: 2, kind: "crypto" },
  { id: "ETH-USD", display: "ETH/USD", base: "ETH", quote: "USD", precision: 2, kind: "crypto" },
  { id: "SOL-USD", display: "SOL/USD", base: "SOL", quote: "USD", precision: 2, kind: "crypto" },
  { id: "DOGE-USD", display: "DOGE/USD", base: "DOGE", quote: "USD", precision: 5, kind: "crypto" },
  { id: "AVAX-USD", display: "AVAX/USD", base: "AVAX", quote: "USD", precision: 3, kind: "crypto" },
] as const;

const BY_ID = new Map<ProductId, SymbolInfo>(SYMBOLS.map((s) => [s.id, s]));

export function getSymbol(id: ProductId): SymbolInfo | undefined {
  return BY_ID.get(id);
}

export function isSupported(id: string): id is ProductId {
  return BY_ID.has(id);
}

export function formatPrice(p: number, sym: SymbolInfo | ProductId | undefined): string {
  const info = typeof sym === "string" ? BY_ID.get(sym) : sym;
  const places = info?.precision ?? 2;
  return p.toLocaleString(undefined, {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}
