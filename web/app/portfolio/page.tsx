import { CombinePanel } from "@/components/CombinePanel";
import { PortfolioBalances } from "@/components/PortfolioBalances";
import { RedeemSection } from "@/components/RedeemSection";

export default function PortfolioPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-text-dim text-[14px] max-w-2xl">
          Your PT and YT balances, with Combine before maturity and Redeem
          after.
        </p>
      </section>

      <section>
        <PortfolioBalances />
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <CombinePanel />
        <div className="space-y-4">
          <RedeemSection />
        </div>
      </section>
    </div>
  );
}
