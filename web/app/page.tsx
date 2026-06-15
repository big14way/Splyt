import { Card } from "@/components/Card";
import { MarketStats } from "@/components/MarketStats";
import { SplitPanel } from "@/components/SplitPanel";
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
          </div>

          <MarketStats />
        </Card>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <SplitPanel />
        <Card className="space-y-2">
          <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
            Yield curve
          </div>
          <div className="text-[13px] text-text-dim">
            Verifiable history from Walrus lands here next — the keeper is
            already snapshotting, we just need to plug the chart in.
          </div>
        </Card>
      </section>
    </div>
  );
}
