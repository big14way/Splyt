import { Card } from "@/components/Card";

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

      <Card>
        <div className="text-text-dim text-sm">
          Balances and actions wire up in the next step.
        </div>
      </Card>
    </div>
  );
}
