import { Card, CardTitle, StatNumber } from "@/components/Card";
import { MARKET, PKG, UNDERLYING_SYMBOL, EXPLORER } from "@/lib/config";

function short(id: string) {
  return id.slice(0, 6) + "…" + id.slice(-4);
}

export default function MarketsPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="text-text-dim text-[14px] max-w-2xl">
          Split a yield-bearing Sui coin into Principal Tokens (PT) and Yield
          Tokens (YT). Trade each on DeepBook, then redeem at maturity.
        </p>
      </section>

      <section>
        <Card className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[12px] uppercase tracking-wider text-text-dim">
                Market
              </div>
              <div className="mt-1 text-lg font-semibold">
                {UNDERLYING_SYMBOL} · Splyt PT/YT
              </div>
              <div className="mt-1 text-[12px] text-text-dim font-mono">
                <a
                  className="hover:text-text"
                  href={EXPLORER.objectUrl(MARKET)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(MARKET)}
                </a>
                <span className="mx-2 opacity-40">·</span>
                <a
                  className="hover:text-text"
                  href={EXPLORER.objectUrl(PKG)}
                  target="_blank"
                  rel="noreferrer"
                >
                  pkg {short(PKG)}
                </a>
              </div>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-1 rounded-md border border-border bg-surface-2 text-pos">
              Active
            </span>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="bg-surface-2">
              <CardTitle>TVL (principal)</CardTitle>
              <StatNumber>—</StatNumber>
              <div className="text-[12px] text-text-dim mt-1">
                {UNDERLYING_SYMBOL}
              </div>
            </Card>
            <Card className="bg-surface-2">
              <CardTitle>Accrued yield</CardTitle>
              <StatNumber>—</StatNumber>
              <div className="text-[12px] text-text-dim mt-1">
                {UNDERLYING_SYMBOL}
              </div>
            </Card>
            <Card className="bg-surface-2">
              <CardTitle>Implied fixed APY</CardTitle>
              <StatNumber>—</StatNumber>
              <div className="text-[12px] text-text-dim mt-1">from PT mid</div>
            </Card>
          </div>

          <div className="text-[12px] text-text-dim">
            Split, Combine, and the yield-curve chart land here next.
          </div>
        </Card>
      </section>
    </div>
  );
}
