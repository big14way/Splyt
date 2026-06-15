/**
 * Live testnet deployment ids and shared protocol constants for the frontend.
 * Sourced from the repo README and Published.toml — change only when redeploying.
 */

export const NETWORK = "testnet" as const;

export const PKG =
  "0x78c280c277302119e0cd24f0622ded914103a51af4c96f6265f55a6283c3778c";

export const MARKET =
  "0x400184f76d19eb0a726af4079da37f22b0f7f5dd81f6b92a53deffdb74bfced0";

export const ADMIN_CAP =
  "0x5f621c34130172f80b0e139656e4f4599cb2b3c66b2fe6fbd6b97ba3d630eccb";

export const SEEDER_BALANCE_MANAGER =
  "0x7497d0b34f4804d2abae94618e196ae01d0062d71b17da0ab1b925ebe7f32373";

export const CLOCK = "0x6";

export const UNDERLYING_TYPE = "0x2::sui::SUI";
export const UNDERLYING_SYMBOL = "SUI";
export const UNDERLYING_DECIMALS = 9;

export const PT_TYPE = `${PKG}::pt::PT`;
export const YT_TYPE = `${PKG}::yt::YT`;
export const PT_DECIMALS = 9;
export const YT_DECIMALS = 9;

// DeepBook pool keys (pools may not exist yet on testnet — see README).
export const PT_POOL = "PT_USDC";
export const YT_POOL = "YT_USDC";
export const QUOTE_COIN_KEY = "DBUSDC";

// Walrus testnet endpoints (HTTP). The blob id is read from the Market via the
// `yield_history_blob` view; only the aggregator host is hardcoded here.
export const WALRUS_AGGREGATOR =
  "https://aggregator.walrus-testnet.walrus.space";

export const EXPLORER = {
  txUrl: (digest: string) => `https://suiscan.xyz/testnet/tx/${digest}`,
  objectUrl: (id: string) => `https://suiscan.xyz/testnet/object/${id}`,
};
