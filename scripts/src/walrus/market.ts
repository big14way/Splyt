/**
 * Read Splyt market state via the Move view functions using devInspect (no gas,
 * no signer needed). Return values come back BCS-encoded and are decoded here.
 */
import { bcs } from '@mysten/sui/bcs';
import { Transaction } from '@mysten/sui/transactions';
import { suiClient } from '../env';
import { loadDeployment, requirePackage } from '../deployment';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000000000000000000000000000';
const U64 = bcs.u64();

export interface MarketState {
  maturityMs: bigint;
  isMatured: boolean;
  principalValue: bigint;
  yieldValue: bigint;
  ptSupply: bigint;
  ytSupply: bigint;
  finalYield: bigint;
  finalYtSupply: bigint;
}

async function callView(fn: string): Promise<number[]> {
  const d = loadDeployment();
  const pkg = requirePackage(d);
  if (!d.marketId) throw new Error('deployment.marketId is not set.');
  if (!d.underlyingType) throw new Error('deployment.underlyingType is not set.');

  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::market::${fn}`,
    typeArguments: [d.underlyingType],
    arguments: [tx.object(d.marketId)],
  });

  const res = await suiClient.devInspectTransactionBlock({
    sender: ZERO_ADDR,
    transactionBlock: tx,
  });
  const bytes = res.results?.[0]?.returnValues?.[0]?.[0];
  if (!bytes) throw new Error(`view ${fn} returned nothing: ${res.error ?? 'no result'}`);
  return bytes;
}

const decodeU64 = (bytes: number[]): bigint => BigInt(U64.parse(Uint8Array.from(bytes)));
const decodeBool = (bytes: number[]): boolean => bytes[0] === 1;

export async function readMarketState(): Promise<MarketState> {
  const [maturityMs, isMatured, principalValue, yieldValue, ptSupply, ytSupply, finalYield, finalYtSupply] =
    await Promise.all([
      callView('maturity_ms').then(decodeU64),
      callView('is_matured').then(decodeBool),
      callView('principal_value').then(decodeU64),
      callView('yield_value').then(decodeU64),
      callView('pt_supply').then(decodeU64),
      callView('yt_supply').then(decodeU64),
      callView('final_yield').then(decodeU64),
      callView('final_yt_supply').then(decodeU64),
    ]);

  return {
    maturityMs,
    isMatured,
    principalValue,
    yieldValue,
    ptSupply,
    ytSupply,
    finalYield,
    finalYtSupply,
  };
}
