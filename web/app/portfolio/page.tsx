import { Card } from "@/components/Card";
import { CombinePanel } from "@/components/CombinePanel";
import { PortfolioBalances } from "@/components/PortfolioBalances";

export default function PortfolioPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-text-dim text-[14px] max-w-2xl">
          Your PT and YT balances, plus Combine (pre-maturity) and Redeem
          (post-maturity).
        </p>
      </section>

      <section>
        <PortfolioBalances />
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <CombinePanel />
        <Card className="space-y-2">
          <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
            Redeem
          </div>
          <div className="text-[13px] text-text-dim">
            Burn PT for principal and YT for accrued yield. Enabled once the
            market matures — wires up in the next slice.
          </div>
        </Card>
      </section>
    </div>
  );
}
