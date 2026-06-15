"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import { Logo } from "./Logo";
import { Nav } from "./Nav";
import { NetworkBadge } from "./NetworkBadge";

export function Header() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-bg/70 border-b border-border">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="hidden sm:block">
            <Nav />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NetworkBadge />
          <ConnectButton />
        </div>
      </div>
      <div className="sm:hidden border-t border-border">
        <div className="mx-auto max-w-[1200px] px-4 py-2">
          <Nav />
        </div>
      </div>
    </header>
  );
}
