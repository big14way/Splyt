"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/trade", label: "Trade" },
  { href: "/portfolio", label: "Portfolio" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-[14px]">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={
              "px-3 py-1.5 rounded-btn transition-colors " +
              (active
                ? "text-text bg-surface-2"
                : "text-text-dim hover:text-text hover:bg-surface")
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
