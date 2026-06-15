import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 group"
      aria-label="Splyt home"
    >
      <span
        aria-hidden
        className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-pt to-yt shadow-[0_0_12px_-2px_var(--sui)]"
      />
      <span className="text-[15px] font-semibold tracking-tight">
        Splyt
      </span>
    </Link>
  );
}
