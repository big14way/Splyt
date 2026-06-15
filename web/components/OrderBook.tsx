"use client";

import { useMemo } from "react";
import { Card } from "@/components/Card";
import { useOrderBook, type OrderBookLevel } from "@/hooks/useOrderBook";
import { findPool } from "@/lib/pools";

function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return "—";
  return p.toFixed(p >= 1 ? 4 : 6);
}

function fmtSize(s: number): string {
  return s >= 1 ? s.toFixed(2) : s.toFixed(4);
}

interface LevelRow extends OrderBookLevel {
  cumSize: number;
}

function withCumulative(rows: OrderBookLevel[]): LevelRow[] {
  let cum = 0;
  return rows.map((r) => {
    cum += r.size;
    return { ...r, cumSize: cum };
  });
}

export function OrderBook({ poolKey }: { poolKey: string }) {
  const pool = findPool(poolKey);
  const { data, isLoading, error } = useOrderBook(poolKey);

  const asks = useMemo(() => withCumulative(data?.asks ?? []), [data?.asks]);
  const bids = useMemo(() => withCumulative(data?.bids ?? []), [data?.bids]);
  const maxCum = Math.max(
    asks[asks.length - 1]?.cumSize ?? 0,
    bids[bids.length - 1]?.cumSize ?? 0,
    1,
  );

  if (!pool) {
    return (
      <Card>
        <div className="text-sm text-text-dim">Unknown pool {poolKey}.</div>
      </Card>
    );
  }

  if (pool.status === "awaiting") {
    return (
      <Card className="space-y-3 h-full">
        <div className="flex items-center justify-between">
          <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
            Order book · {pool.label}
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-1 rounded-md border border-border bg-surface-2 text-warn">
            Awaiting pool
          </span>
        </div>
        <div className="text-[13px] text-text-dim">
          {pool.note} Once the pool exists, the book here will render the same
          bids/asks as <span className="font-mono">npm run deepbook:book</span>.
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
            Order book · {pool.label}
          </div>
          <div className="mt-0.5 text-[13px] text-text-dim">
            Mid{" "}
            <span className="font-mono tabular text-text">
              {data?.mid !== undefined && data.mid !== null
                ? fmtPrice(data.mid)
                : "—"}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-1 rounded-md border border-border bg-surface-2 text-pos">
          Live
        </span>
      </div>

      {error ? (
        <div className="text-[13px] text-neg break-words">
          DeepBook read failed: {error.message}
        </div>
      ) : isLoading && !data ? (
        <div className="text-[13px] text-text-dim">Fetching book…</div>
      ) : (
        <div className="text-[12px] font-mono tabular">
          <div className="grid grid-cols-3 text-text-dim pb-1 border-b border-border">
            <div>Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Total</div>
          </div>

          <BookSide
            levels={[...asks].reverse()}
            maxCum={maxCum}
            side="ask"
          />

          <div className="border-y border-border my-1 py-1.5 flex items-center justify-between text-text-dim">
            <span>Mid</span>
            <span className="text-text">
              {data?.mid !== undefined && data.mid !== null
                ? fmtPrice(data.mid)
                : "—"}
            </span>
          </div>

          <BookSide levels={bids} maxCum={maxCum} side="bid" />

          {asks.length === 0 && bids.length === 0 && (
            <div className="text-[13px] text-text-dim pt-3 text-center">
              Empty book.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function BookSide({
  levels,
  maxCum,
  side,
}: {
  levels: LevelRow[];
  maxCum: number;
  side: "bid" | "ask";
}) {
  return (
    <div>
      {levels.map((row, i) => {
        const pct = Math.max(2, Math.min(100, (row.cumSize / maxCum) * 100));
        return (
          <div
            key={`${side}-${i}`}
            className="relative grid grid-cols-3 py-0.5 hover:bg-surface-2/40"
          >
            <div
              aria-hidden
              className="absolute inset-y-0 right-0"
              style={{
                width: `${pct}%`,
                background:
                  side === "ask"
                    ? "linear-gradient(to left, rgba(255,107,107,0.10), transparent)"
                    : "linear-gradient(to left, rgba(46,230,168,0.10), transparent)",
              }}
            />
            <div
              className={
                "relative " + (side === "ask" ? "text-neg" : "text-pos")
              }
            >
              {fmtPrice(row.price)}
            </div>
            <div className="relative text-right text-text">
              {fmtSize(row.size)}
            </div>
            <div className="relative text-right text-text-dim">
              {fmtSize(row.cumSize)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
