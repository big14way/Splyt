import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-btn px-4 h-10 text-sm font-medium transition-colors " +
  "disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sui";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-sui text-[#0a0f1e] hover:bg-sui-deep",
  secondary:
    "bg-transparent border border-border text-text hover:bg-surface-2",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
