"use client";

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useOrderBook } from "@/hooks/useOrderBook";
import { findPool } from "@/lib/pools";

type Side = "buy" | "sell";

export function TradeForm({ poolKey }: { poolKey: string }) {
  const pool = findPool(poolKey);
  const account = useCurrentAccount();
  const { data: book } = useOrderBook(poolKey);

  const [side, setSide] = useState<Side>("buy");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");

  if (!pool) return null;

  const pending = pool.status === "awaiting";

  function setSideAndDefaultPrice(next: Side) {
    setSide(next);
    if (!price && book?.mid) {
      setPrice(book.mid.toFixed(4));
    }
  }

  const disabledReason = (() => {
    if (!account) return "Connect wallet";
    if (pending) return "Awaiting pool";
    return "Coming next slice";
  })();

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
          Limit order · {pool.label}
        </div>
        <div className="mt-0.5 text-[13px] text-text-dim">
          Pick a side, enter price and size — signing wires up in the next
          slice (needs a BalanceManager + deposit flow).
        </div>
      </div>

      <SideToggle side={side} onChange={setSideAndDefaultPrice} pool={pool.label} />

      <Field
        id="trade-price"
        label="Price"
        suffix={pool.quoteSymbol}
        value={price}
        onChange={setPrice}
      />
      <Field
        id="trade-size"
        label="Size"
        suffix={pool.baseSymbol}
        value={size}
        onChange={setSize}
      />

      <div className="rounded-btn border border-border bg-surface-2/60 px-4 py-3 text-[13px] flex items-center justify-between">
        <span className="text-text-dim">Total</span>
        <span className="font-mono tabular text-text">
          {Number(price) > 0 && Number(size) > 0
            ? (Number(price) * Number(size)).toFixed(4)
            : "—"}{" "}
          <span className="text-text-dim">{pool.quoteSymbol}</span>
        </span>
      </div>

      <Button disabled className="w-full h-11">
        {disabledReason}
      </Button>
    </Card>
  );
}

function SideToggle({
  side,
  onChange,
  pool,
}: {
  side: Side;
  onChange: (next: Side) => void;
  pool: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={`Order side for ${pool}`}
      className="grid grid-cols-2 gap-1 p-1 rounded-btn bg-surface-2 border border-border"
    >
      <button
        type="button"
        role="tab"
        aria-selected={side === "buy"}
        onClick={() => onChange("buy")}
        className={
          "h-9 rounded-md text-[13px] font-medium transition-colors " +
          (side === "buy" ? "bg-surface text-pos" : "text-text-dim hover:text-text")
        }
      >
        Buy
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={side === "sell"}
        onClick={() => onChange("sell")}
        className={
          "h-9 rounded-md text-[13px] font-medium transition-colors " +
          (side === "sell" ? "bg-surface text-neg" : "text-text-dim hover:text-text")
        }
      >
        Sell
      </button>
    </div>
  );
}

function Field({
  id,
  label,
  suffix,
  value,
  onChange,
}: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-[12px] text-text-dim">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-btn bg-surface-2 border border-border px-3 h-12 focus-within:border-sui">
        <input
          id={id}
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent outline-none text-text font-mono tabular text-lg"
        />
        <span className="text-text-dim text-[12px]">{suffix}</span>
      </div>
    </div>
  );
}
