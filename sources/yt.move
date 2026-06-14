/// Yield Token (YT) for Splyt.
///
/// YT is a standard fungible Sui Coin so it can be listed and traded on a
/// DeepBook v3 permissionless pool (for example YT/USDC). YT represents a claim
/// on the yield accrued by the market over its term. At maturity, YT redeems for
/// its pro-rata share of the accumulated yield pool.
module splyt::yt;

use sui::coin;

/// One-time witness. Must match the module name in uppercase.
public struct YT has drop {}

// See the note in pt.move: `create_currency` is kept deliberately over the newer
// coin_registry flow to preserve the TreasuryCap handoff used by market::create.
#[allow(deprecated_usage)]
fun init(witness: YT, ctx: &mut TxContext) {
    let (treasury, metadata) = coin::create_currency(
        witness,
        9, // decimals: keep equal to PT and to the underlying
        b"YT",
        b"Splyt Yield Token",
        b"Redeems for a pro-rata share of accrued yield at market maturity",
        option::none(),
        ctx,
    );
    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury, ctx.sender());
}
