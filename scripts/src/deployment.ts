/**
 * `deployment.json` is the single source of truth shared by every off-chain
 * script (DeepBook seeding, the Walrus keeper) and exported to the frontend.
 *
 * It is written incrementally: `sui client publish` fills the package/market
 * ids, `deepbook:pools` adds the pool ids, `deepbook:seed` adds the balance
 * manager id, and the Walrus keeper stamps the latest yield-history blob id.
 *
 * The file is git-ignored (it is environment-specific). `deployment.example.json`
 * documents the shape.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DEPLOYMENT_PATH = join(here, '..', 'deployment.json');

export interface Deployment {
  network: string;
  /** Published Splyt package id. */
  packageId?: string;
  /** Shared Market<U> object id. */
  marketId?: string;
  /** AdminCap object id (yield keeper authority). */
  adminCapId?: string;
  /** Fully qualified underlying coin type, e.g. `0x..::usdc::USDC`. */
  underlyingType?: string;
  /** Fully qualified PT/YT coin types (default to `${packageId}::pt::PT`). */
  ptType?: string;
  ytType?: string;
  ptDecimals?: number;
  ytDecimals?: number;
  /** DeepBook coin key used as the quote asset (testnet default: DBUSDC). */
  quoteCoinKey?: string;
  /** poolKey -> pool object id, e.g. `{ PT_USDC: '0x..', YT_USDC: '0x..' }`. */
  pools?: Record<string, string>;
  /** Seeder BalanceManager object id. */
  balanceManagerId?: string;
  /** Latest Walrus blob id holding the yield-curve history. */
  yieldHistoryBlobId?: string;
}

export function loadDeployment(): Deployment {
  if (!existsSync(DEPLOYMENT_PATH)) {
    return { network: process.env.SUI_NETWORK ?? 'testnet' };
  }
  return JSON.parse(readFileSync(DEPLOYMENT_PATH, 'utf8')) as Deployment;
}

export function saveDeployment(d: Deployment): void {
  writeFileSync(DEPLOYMENT_PATH, JSON.stringify(d, null, 2) + '\n');
}

/** Shallow-merge a patch into deployment.json and persist it. */
export function updateDeployment(patch: Partial<Deployment>): Deployment {
  const merged = { ...loadDeployment(), ...patch };
  saveDeployment(merged);
  return merged;
}

export function setPoolId(poolKey: string, poolId: string): Deployment {
  const d = loadDeployment();
  const pools = { ...(d.pools ?? {}), [poolKey]: poolId };
  return updateDeployment({ pools });
}

export function ptType(d: Deployment): string {
  if (d.ptType) return d.ptType;
  if (!d.packageId) throw new Error('deployment.packageId is not set — publish the Splyt package first.');
  return `${d.packageId}::pt::PT`;
}

export function ytType(d: Deployment): string {
  if (d.ytType) return d.ytType;
  if (!d.packageId) throw new Error('deployment.packageId is not set — publish the Splyt package first.');
  return `${d.packageId}::yt::YT`;
}

export function requirePackage(d: Deployment): string {
  if (!d.packageId) throw new Error('deployment.packageId is not set — publish the Splyt package first.');
  return d.packageId;
}
