/**
 * Read Splyt market state via the on-chain view functions using devInspect.
 * Return values come back BCS-encoded; decode here and surface a typed shape.
 */
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { MARKET, PKG, UNDERLYING_TYPE } from "./config";

const ZERO_ADDR =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const U64 = bcs.u64();

const decodeU64 = (bytes: number[]): bigint => BigInt(U64.parse(Uint8Array.from(bytes)));
const decodeBool = (bytes: number[]): boolean => bytes[0] === 1;

async function callView(client: SuiJsonRpcClient, fn: string): Promise<number[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::market::${fn}`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET)],
  });
  const res = await client.devInspectTransactionBlock({
    sender: ZERO_ADDR,
    transactionBlock: tx,
  });
  const bytes = res.results?.[0]?.returnValues?.[0]?.[0];
  if (!bytes) {
    throw new Error(`view ${fn} returned nothing: ${res.error ?? "no result"}`);
  }
  return bytes;
}

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

export async function readMarketState(
  client: SuiJsonRpcClient,
): Promise<MarketState> {
  const [
    maturityMs,
    isMatured,
    principalValue,
    yieldValue,
    ptSupply,
    ytSupply,
    finalYield,
    finalYtSupply,
  ] = await Promise.all([
    callView(client, "maturity_ms").then(decodeU64),
    callView(client, "is_matured").then(decodeBool),
    callView(client, "principal_value").then(decodeU64),
    callView(client, "yield_value").then(decodeU64),
    callView(client, "pt_supply").then(decodeU64),
    callView(client, "yt_supply").then(decodeU64),
    callView(client, "final_yield").then(decodeU64),
    callView(client, "final_yt_supply").then(decodeU64),
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
