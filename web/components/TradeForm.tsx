"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EXPLORER } from "@/lib/config";
import { coinScalarForKey, coinTypeForKey } from "@/lib/deepbook";
import {
  buildCancelOrder,
  buildCreateBalanceManager,
  buildPlaceOrder,
  type Side,
} from "@/lib/trade";
import { findPool } from "@/lib/pools";
import { useBalanceManager } from "@/hooks/useBalanceManager";
import { useOpenOrders } from "@/hooks/useOpenOrders";
import { useOrderBook } from "@/hooks/useOrderBook";
import { usePoolParams } from "@/hooks/usePoolParams";

/** Keep a little SUI behind for gas when SUI is the coin being deposited. */
const SUI_GAS_RESERVE = 0.05;

function decimalsOf(step: number): number {
  if (!step || step >= 1) return 0;
  return Math.max(0, Math.round(-Math.log10(step)));
}
function roundStep(value: number, step: number): number {
  if (!step) return value;
  return Number((Math.round(value / step) * step).toFixed(decimalsOf(step)));
}

/** `coinTypeForKey` throws on unknown keys; never throw during render. */
function safeType(key: string): string {
  try {
    return coinTypeForKey(key);
  } catch {
    return "0x2::sui::SUI";
  }
}

export function TradeForm({ poolKey }: { poolKey: string }) {
  const pool = findPool(poolKey);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const queryClient = useQueryClient();

  const { data: book } = useOrderBook(poolKey);
  const bmQ = useBalanceManager();
  const paramsQ = usePoolParams(poolKey);
  const ordersQ = useOpenOrders(poolKey, bmQ.data);
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [side, setSide] = useState<Side>("buy");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);

  // The deposit coin funds the order: quote for a buy, base for a sell.
  const isBuy = side === "buy";
  const depositKey = pool ? (isBuy ? pool.quoteSymbol : pool.baseSymbol) : "SUI";

  const balanceQ = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "", coinType: safeType(depositKey) },
    { enabled: !!account?.address && pool?.status === "live" },
  );

  if (!pool) return null;

  const params = paramsQ.data ?? null;
  const hasBm = !!bmQ.data;
  const numPrice = Number(price);
  const numSize = Number(size);
  const validInputs = numPrice > 0 && numSize > 0;
  const needed = isBuy ? numPrice * numSize : numSize;

  const scalar = coinScalarForKey(depositKey);
  const rawBalance = balanceQ.data ? Number(balanceQ.data.totalBalance) / scalar : 0;
  const available =
    depositKey === "SUI" ? Math.max(0, rawBalance - SUI_GAS_RESERVE) : rawBalance;

  type Mode = "connect" | "awaiting" | "loading" | "create" | "place";
  const mode: Mode = (() => {
    if (!account) return "connect";
    if (pool.status !== "live") return "awaiting";
    if (bmQ.isLoading || paramsQ.isLoading) return "loading";
    if (!hasBm) return "create";
    return "place";
  })();

  const placeDisabledReason = (() => {
    if (!validInputs) return "Enter price and size";
    if (params && numSize < params.minSize)
      return `Min size ${params.minSize} ${pool.baseSymbol}`;
    if (needed > available) return `Insufficient ${depositKey}`;
    return null;
  })();

  const buttonLabel = (() => {
    if (isPending) return "Signing…";
    if (mode === "connect") return "Connect wallet";
    if (mode === "awaiting") return "Awaiting pool";
    if (mode === "loading") return "Loading…";
    if (mode === "create") return "Create trading account";
    return placeDisabledReason ?? `Place ${side} order`;
  })();

  const buttonDisabled =
    isPending ||
    mode === "connect" ||
    mode === "awaiting" ||
    mode === "loading" ||
    (mode === "place" && !!placeDisabledReason);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["splyt"] });
    queryClient.invalidateQueries({ queryKey: ["@mysten/dapp-kit"] });
  }

  function run(
    tx: ReturnType<typeof buildCreateBalanceManager>,
    onDone?: () => void,
  ) {
    setError(null);
    setLastDigest(null);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (res) => {
          setLastDigest(res.digest);
          onDone?.();
          refresh();
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  function onSubmit() {
    if (!account || buttonDisabled) return;

    if (mode === "create") {
      run(buildCreateBalanceManager(account.address));
      return;
    }

    if (mode === "place" && bmQ.data && params) {
      const rPrice = roundStep(numPrice, params.tickSize);
      const rSize = Math.max(params.minSize, roundStep(numSize, params.lotSize));
      const depositAmount = isBuy ? rPrice * rSize : rSize;
      run(
        buildPlaceOrder({
          client,
          address: account.address,
          balanceManagerId: bmQ.data,
          poolKey,
          side,
          price: rPrice,
          size: rSize,
          depositCoinKey: depositKey,
          depositAmount,
        }),
        () => setSize(""),
      );
    }
  }

  function onCancel(orderId: string) {
    if (!account || !bmQ.data || isPending) return;
    run(buildCancelOrder(client, account.address, bmQ.data, poolKey, orderId));
  }

  function onSideChange(next: Side) {
    setSide(next);
    if (!price && book?.mid) {
      setPrice(book.mid.toFixed(Math.max(4, decimalsOf(params?.tickSize ?? 0))));
    }
  }

  const total = validInputs ? (numPrice * numSize).toFixed(4) : "—";
  const openOrders = ordersQ.data ?? [];

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
          Limit order · {pool.label}
        </div>
        <div className="mt-0.5 text-[13px] text-text-dim">
          {mode === "create"
            ? "First trade needs a one-time BalanceManager — create it, then place orders."
            : "Maker orders rest on the book; deposit is pulled into your BalanceManager."}
        </div>
      </div>

      <SideToggle side={side} onChange={onSideChange} pool={pool.label} />

      <Field
        id="trade-price"
        label="Price"
        suffix={pool.quoteSymbol}
        value={price}
        onChange={setPrice}
      />
      <Field
        id="trade-size"
        label={`Size${params ? ` (min ${params.minSize})` : ""}`}
        suffix={pool.baseSymbol}
        value={size}
        onChange={setSize}
      />

      <div className="rounded-btn border border-border bg-surface-2/60 px-4 py-3 text-[13px] flex items-center justify-between">
        <span className="text-text-dim">Total</span>
        <span className="font-mono tabular text-text">
          {total} <span className="text-text-dim">{pool.quoteSymbol}</span>
        </span>
      </div>

      <Button onClick={onSubmit} disabled={buttonDisabled} className="w-full h-11">
        {buttonLabel}
      </Button>

      {error && <div className="text-[12px] text-neg break-words">{error}</div>}
      {lastDigest && (
        <div className="text-[12px] text-text-dim">
          Submitted ·{" "}
          <a
            className="text-sui hover:text-sui-deep underline-offset-2 hover:underline font-mono"
            href={EXPLORER.txUrl(lastDigest)}
            target="_blank"
            rel="noreferrer"
          >
            {lastDigest.slice(0, 10)}…
          </a>
        </div>
      )}

      {hasBm && openOrders.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
            Your open orders
          </div>
          {openOrders.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-btn bg-surface-2/60 border border-border px-3 h-10 text-[13px]"
            >
              <span className="font-mono tabular text-text-dim">…{id.slice(-8)}</span>
              <button
                type="button"
                onClick={() => onCancel(id)}
                disabled={isPending}
                className="text-neg hover:underline disabled:opacity-40 text-[12px]"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
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
