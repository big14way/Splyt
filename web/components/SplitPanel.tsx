"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  EXPLORER,
  UNDERLYING_DECIMALS,
  UNDERLYING_SYMBOL,
  UNDERLYING_TYPE,
} from "@/lib/config";
import { formatBaseCompact, parseBase } from "@/lib/format";
import { buildSplit } from "@/lib/tx";
import { useMarketState } from "@/hooks/useMarketState";

/** Keep enough SUI behind for gas (0.05 SUI). */
const GAS_RESERVE = 50_000_000n;

export function SplitPanel() {
  const account = useCurrentAccount();
  const market = useMarketState();
  const queryClient = useQueryClient();

  const balanceQ = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "", coinType: UNDERLYING_TYPE },
    { enabled: !!account?.address },
  );

  const [amount, setAmount] = useState("");
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const parsed = parseBase(amount, UNDERLYING_DECIMALS);
  const totalSui = balanceQ.data ? BigInt(balanceQ.data.totalBalance) : 0n;
  const maxAvailable = totalSui > GAS_RESERVE ? totalSui - GAS_RESERVE : 0n;
  const matured = market.data?.isMatured ?? false;

  const disabledReason = (() => {
    if (!account) return "Connect wallet";
    if (matured) return "Market matured";
    if (!parsed) return "Enter an amount";
    if (parsed <= 0n) return "Enter an amount";
    if (parsed > maxAvailable) return `Insufficient ${UNDERLYING_SYMBOL}`;
    return null;
  })();

  function onSplit() {
    if (!parsed || disabledReason) return;
    setError(null);
    setLastDigest(null);
    signAndExecute(
      { transaction: buildSplit(parsed) },
      {
        onSuccess: (res) => {
          setLastDigest(res.digest);
          setAmount("");
          queryClient.invalidateQueries({ queryKey: ["splyt"] });
          queryClient.invalidateQueries({ queryKey: ["@mysten/dapp-kit"] });
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  function onMax() {
    if (maxAvailable <= 0n) return;
    setAmount(formatBaseCompact(maxAvailable, UNDERLYING_DECIMALS, 6).replace(/,/g, ""));
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
            Split
          </div>
          <div className="text-[13px] text-text-dim mt-0.5">
            Deposit {UNDERLYING_SYMBOL}, receive equal PT + YT.
          </div>
        </div>
        <div className="text-right text-[12px] text-text-dim">
          {account ? (
            <>
              <div>Wallet</div>
              <div className="font-mono tabular text-text">
                {balanceQ.data
                  ? formatBaseCompact(totalSui, UNDERLYING_DECIMALS, 4)
                  : "—"}{" "}
                {UNDERLYING_SYMBOL}
              </div>
            </>
          ) : (
            <div>Connect wallet</div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[12px] text-text-dim">
          <label htmlFor="split-amount">Amount</label>
          <button
            type="button"
            onClick={onMax}
            disabled={!account || maxAvailable <= 0n}
            className="text-text-dim hover:text-text disabled:opacity-40"
          >
            Max
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-btn bg-surface-2 border border-border px-3 h-12 focus-within:border-sui">
          <input
            id="split-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent outline-none text-text font-mono tabular text-lg"
          />
          <span className="text-text-dim text-[12px]">{UNDERLYING_SYMBOL}</span>
        </div>
      </div>

      <div className="rounded-btn border border-border bg-surface-2/60 px-4 py-3 text-[13px] flex items-center justify-between">
        <span className="text-text-dim">You receive</span>
        <span className="font-mono tabular text-text">
          {parsed && parsed > 0n
            ? formatBaseCompact(parsed, UNDERLYING_DECIMALS, 4)
            : "0"}{" "}
          <span className="text-pt">PT</span>
          <span className="mx-1 text-text-dim">+</span>
          {parsed && parsed > 0n
            ? formatBaseCompact(parsed, UNDERLYING_DECIMALS, 4)
            : "0"}{" "}
          <span className="text-yt">YT</span>
        </span>
      </div>

      <Button
        onClick={onSplit}
        disabled={!!disabledReason || isPending}
        className="w-full h-11"
      >
        {isPending ? "Signing…" : disabledReason ?? "Split"}
      </Button>

      {error && (
        <div className="text-[12px] text-neg break-words">{error}</div>
      )}
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
    </Card>
  );
}
