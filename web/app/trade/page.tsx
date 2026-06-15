import { Card } from "@/components/Card";

export default function TradePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trade</h1>
        <p className="text-text-dim text-[14px] max-w-2xl">
          Buy and sell PT and YT on DeepBook v3. Order book, limit orders, and
          your open orders will live here.
        </p>
      </section>

      <Card>
        <div className="text-text-dim text-sm">
          Trade panel arrives last in the build order. DeepBook PT/USDC and
          YT/USDC pools are pending on testnet (DEEP supply).
        </div>
      </Card>
    </div>
  );
}
