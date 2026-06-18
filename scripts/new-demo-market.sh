#!/usr/bin/env bash
#
# Spin up a fresh Splyt market with a SHORT maturity so you can record the full
# lifecycle on camera — split → trade → combine → (wait for maturity) → settle →
# redeem PT → redeem YT — without waiting 30 days.
#
# It publishes a new package, creates a market maturing in N minutes, mints PT/YT,
# seeds a rising yield curve on Walrus, then patches BOTH scripts/deployment.json
# and web/lib/config.ts so the running app points at the new market.
#
# Usage:   ./scripts/new-demo-market.sh [MINUTES]      (default 12)
# Prereq:  the deployer wallet needs ~1.5 testnet SUI (faucet.sui.io) and the
#          sui CLI active env = testnet.
#
set -euo pipefail
MIN="${1:-12}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ Publishing a fresh package (bundling OpenZeppelin math)…"
rm -f Published.toml
sui client publish --gas-budget 500000000 --with-unpublished-dependencies --json > /tmp/splyt_pub.json
export PKG PT_CAP YT_CAP
PKG=$(node -e 'const j=require("/tmp/splyt_pub.json");process.stdout.write((j.objectChanges||[]).find(c=>c.type==="published").packageId)')
PT_CAP=$(node -e 'const j=require("/tmp/splyt_pub.json");process.stdout.write((j.objectChanges||[]).find(c=>c.type==="created"&&c.objectType.includes("TreasuryCap")&&c.objectType.includes("::pt::PT")).objectId)')
YT_CAP=$(node -e 'const j=require("/tmp/splyt_pub.json");process.stdout.write((j.objectChanges||[]).find(c=>c.type==="created"&&c.objectType.includes("TreasuryCap")&&c.objectType.includes("::yt::YT")).objectId)')
echo "  PKG=$PKG"

MATURITY=$(( ($(date +%s) + MIN * 60) * 1000 ))
echo "▶ Creating market (matures in ${MIN}m)…"
sui client call --package "$PKG" --module market --function create_market \
  --type-args 0x2::sui::SUI --args "$PT_CAP" "$YT_CAP" "$MATURITY" \
  --gas-budget 50000000 --json > /tmp/splyt_mkt.json
export MARKET ADMIN
MARKET=$(node -e 'const j=require("/tmp/splyt_mkt.json");process.stdout.write((j.objectChanges||[]).find(c=>c.type==="created"&&c.objectType.includes("market::Market")).objectId)')
ADMIN=$(node -e 'const j=require("/tmp/splyt_mkt.json");process.stdout.write((j.objectChanges||[]).find(c=>c.type==="created"&&c.objectType.includes("market::AdminCap")).objectId)')
echo "  MARKET=$MARKET"

echo "▶ Writing scripts/deployment.json…"
node -e '
const fs=require("fs");const p="scripts/deployment.json";
const d=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};
Object.assign(d,{network:"testnet",packageId:process.env.PKG,marketId:process.env.MARKET,
  adminCapId:process.env.ADMIN,underlyingType:"0x2::sui::SUI",
  ptType:process.env.PKG+"::pt::PT",ytType:process.env.PKG+"::yt::YT",
  ptDecimals:9,ytDecimals:9,quoteCoinKey:"DBUSDC"});
delete d.balanceManagerId;delete d.yieldHistoryBlobId;
fs.writeFileSync(p,JSON.stringify(d,null,2)+"\n");'

echo "▶ Minting PT/YT + seeding a rising yield curve on Walrus…"
( cd scripts && npm run --silent deepbook:mint )
( cd scripts && npm run --silent walrus:snapshot )
for _ in 1 2 3; do
  ( cd scripts && npm run --silent accrue )
  ( cd scripts && npm run --silent walrus:snapshot )
done

echo "▶ Patching web/lib/config.ts…"
node -e '
const fs=require("fs");const p="web/lib/config.ts";let s=fs.readFileSync(p,"utf8");
const set=(n,v)=>{s=s.replace(new RegExp("(export const "+n+"\\s*=\\s*)\"[^\"]*\""),`$1"${v}"`);};
set("PKG",process.env.PKG);set("MARKET",process.env.MARKET);set("ADMIN_CAP",process.env.ADMIN);
fs.writeFileSync(p,s);'

echo ""
echo "✓ Demo market ready — matures in ${MIN} minutes."
echo "  PKG=$PKG"
echo "  MARKET=$MARKET"
echo "  Restart the web dev server (cd web && npm run dev) and record."
echo "  After recording, 'git checkout web/lib/config.ts' to restore the stable market."
