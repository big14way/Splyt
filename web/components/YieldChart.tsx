"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/Card";
import { useYieldHistory, type YieldPoint } from "@/hooks/useYieldHistory";

const SUI_BLUE = "#4da2ff";

function fmtPct(x: number, dp = 2): string {
  return `${(x * 100).toFixed(dp)}%`;
}

function fmtTime(t: number, includeDate = false): string {
  const d = new Date(t * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (!includeDate) return `${hh}:${mm}`;
  const mon = d.toLocaleString(undefined, { month: "short" });
  return `${mon} ${d.getDate()} ${hh}:${mm}`;
}

interface ChartRow {
  t: number;
  apy: number;
  ptMid: number | null;
  ytMid: number | null;
}

function toRows(series: YieldPoint[]): ChartRow[] {
  return series.map((p) => ({
    t: p.t,
    apy: p.impliedApy,
    ptMid: p.ptMid,
    ytMid: p.ytMid,
  }));
}

interface TooltipPayloadEntry {
  payload: ChartRow;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-border bg-bg/90 backdrop-blur px-3 py-2 text-[12px] shadow-md">
      <div className="text-text-dim mb-1">{fmtTime(row.t, true)}</div>
      <div className="flex items-center justify-between gap-4 font-mono tabular">
        <span className="text-text-dim">Implied APY</span>
        <span className="text-text">{fmtPct(row.apy, 3)}</span>
      </div>
      {row.ptMid !== null && (
        <div className="flex items-center justify-between gap-4 font-mono tabular">
          <span className="text-pt">PT mid</span>
          <span className="text-text">{row.ptMid.toFixed(4)}</span>
        </div>
      )}
      {row.ytMid !== null && (
        <div className="flex items-center justify-between gap-4 font-mono tabular">
          <span className="text-yt">YT mid</span>
          <span className="text-text">{row.ytMid.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}

export function YieldChart() {
  const { data, isLoading, error } = useYieldHistory();

  const rows = useMemo<ChartRow[]>(
    () => (data ? toRows(data.series) : []),
    [data],
  );
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const blobShort = data ? `${data.blobId.slice(0, 8)}…${data.blobId.slice(-6)}` : null;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
            Yield curve
          </div>
          <div className="mt-1 text-lg font-semibold font-mono tabular">
            {latest ? fmtPct(latest.apy, 2) : "—"}
          </div>
          <div className="text-[12px] text-text-dim">
            {latest ? `Implied APY · last update ${fmtTime(latest.t, true)}` : "Implied APY · awaiting first snapshot"}
          </div>
        </div>
        {data ? (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-md border border-border bg-surface-2 hover:border-sui transition-colors"
            title="Open the raw blob on the Walrus aggregator"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-pos shadow-[0_0_6px_var(--pos)]"
            />
            <span className="text-text-dim group-hover:text-text">
              Stored on Walrus
            </span>
            <span className="font-mono text-text-dim">{blobShort}</span>
          </a>
        ) : null}
      </div>

      <div className="h-56 -mx-2">
        {error ? (
          <div className="h-full flex items-center justify-center text-[13px] text-neg px-4 text-center">
            Walrus read failed: {error.message}
          </div>
        ) : isLoading ? (
          <div className="h-full flex items-center justify-center text-[13px] text-text-dim">
            Fetching yield history…
          </div>
        ) : rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[13px] text-text-dim px-4 text-center">
            No snapshots yet. The keeper writes one each interval and commits
            the blob id on-chain.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="apy-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SUI_BLUE} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SUI_BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                stroke="var(--text-dim)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => fmtTime(v)}
                minTickGap={48}
              />
              <YAxis
                stroke="var(--text-dim)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v: number) => fmtPct(v, 1)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area
                type="monotone"
                dataKey="apy"
                stroke={SUI_BLUE}
                strokeWidth={2}
                fill="url(#apy-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="text-[11px] text-text-dim">
        Series is fetched from the Walrus aggregator using the blob id
        committed on-chain via{" "}
        <span className="font-mono">market::set_yield_history_blob</span> —
        the badge links to the raw, content-addressed data.
      </div>
    </Card>
  );
}
