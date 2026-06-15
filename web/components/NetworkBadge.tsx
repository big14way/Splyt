"use client";

import { useSuiClientContext } from "@mysten/dapp-kit";

export function NetworkBadge() {
  const ctx = useSuiClientContext();
  const network = ctx.network ?? "testnet";
  return (
    <span
      className="text-[11px] font-medium uppercase tracking-wider px-2 py-1 rounded-md border border-border text-text-dim bg-surface"
      title={`Connected to ${network}`}
    >
      {network}
    </span>
  );
}
