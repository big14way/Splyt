"use client";

import { useState } from "react";
import { OrderBook } from "@/components/OrderBook";
import { PoolSelector } from "@/components/PoolSelector";
import { TradeForm } from "@/components/TradeForm";
import { POOLS } from "@/lib/pools";

const DEFAULT_POOL = POOLS.find((p) => p.status === "live")?.key ?? POOLS[0]!.key;

export default function TradePage() {
  const [pool, setPool] = useState<string>(DEFAULT_POOL);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Trade</h1>
        <p className="text-text-dim text-[14px] max-w-2xl">
          PT and YT trade on DeepBook v3, not Splyt. The book is read live
          via{" "}
          <span className="font-mono">DeepBookClient.getLevel2TicksFromMid</span>
          ; once Splyt&apos;s PT/USDC and YT/USDC pools are funded with DEEP
          the same panel works against them.
        </p>
        <PoolSelector selected={pool} onChange={setPool} />
      </section>

      <section className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <OrderBook poolKey={pool} />
        <TradeForm poolKey={pool} />
      </section>
    </div>
  );
}
