"use client";

import { POOLS, type PoolDescriptor } from "@/lib/pools";

export function PoolSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Trading pair"
      className="inline-flex items-center gap-1 p-1 rounded-btn bg-surface-2 border border-border"
    >
      {POOLS.map((p) => (
        <PoolTab
          key={p.key}
          pool={p}
          active={p.key === selected}
          onClick={() => onChange(p.key)}
        />
      ))}
    </div>
  );
}

function PoolTab({
  pool,
  active,
  onClick,
}: {
  pool: PoolDescriptor;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 px-3 h-9 rounded-md text-[13px] transition-colors " +
        (active
          ? "bg-surface text-text"
          : "text-text-dim hover:text-text hover:bg-surface")
      }
    >
      <span
        aria-hidden
        className={
          "h-1.5 w-1.5 rounded-full " +
          (pool.status === "live"
            ? "bg-pos shadow-[0_0_6px_var(--pos)]"
            : "bg-warn shadow-[0_0_6px_var(--warn)]")
        }
      />
      <span className="font-medium" style={{ color: active ? pool.accent : undefined }}>
        {pool.baseSymbol}
      </span>
      <span className="text-text-dim">/</span>
      <span>{pool.quoteSymbol}</span>
    </button>
  );
}
