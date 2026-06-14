/**
 * Shared environment: network selection, the Sui JSON-RPC client, and the signer.
 *
 * `@mysten/sui` v2 relocated the concrete client to `@mysten/sui/jsonRpc`
 * (`SuiJsonRpcClient`) and the URL helper to `getJsonRpcFullnodeUrl`. The older
 * `SuiClient` / `getFullnodeUrl` from `@mysten/sui/client` no longer exist, and
 * `@mysten/deepbook-v3` (peer: `@mysten/sui@^2.17`) expects this new client.
 */
import 'dotenv/config';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

export type Network = 'testnet' | 'mainnet' | 'devnet' | 'localnet';

export const NETWORK: Network = (process.env.SUI_NETWORK as Network) ?? 'testnet';

/** Quote coin to list PT/YT against. Testnet default is DeepBook's test USDC. */
export const QUOTE_COIN_KEY = process.env.QUOTE_COIN_KEY ?? 'DBUSDC';

export const suiClient = new SuiJsonRpcClient({
  url: process.env.SUI_RPC_URL ?? getJsonRpcFullnodeUrl(NETWORK),
  network: NETWORK,
});

/** Load the signer from `SUI_PRIVATE_KEY` (a `suiprivkey1...` bech32 string). */
export function loadKeypair(): Ed25519Keypair {
  const pk = process.env.SUI_PRIVATE_KEY;
  if (!pk) {
    throw new Error(
      'SUI_PRIVATE_KEY is not set. Export your key with `sui keytool export` and ' +
        'put the suiprivkey1... value in scripts/.env (see .env.example).',
    );
  }
  return Ed25519Keypair.fromSecretKey(pk.trim());
}

export function loadAddress(): string {
  return loadKeypair().toSuiAddress();
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}
