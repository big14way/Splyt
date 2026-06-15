import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-card border border-border bg-surface p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset] " +
        className
      }
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
      {children}
    </div>
  );
}

export function StatNumber({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono tabular text-2xl mt-2 text-text">{children}</div>
  );
}
