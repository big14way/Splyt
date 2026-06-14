/// Principal Token (PT) for Splyt.
///
/// PT is a standard fungible Sui Coin so it can be listed and traded on a
/// DeepBook v3 permissionless pool (for example PT/USDC). One PT redeems for
/// one unit of underlying principal once the market reaches maturity. Buying
/// PT below par is how a user locks in a fixed yield.
module splyt::pt;

use sui::coin;

/// One-time witness. Must match the module name in uppercase.
public struct PT has drop {}

// `coin::create_currency` is the stable, widely-supported way to mint a fungible
// currency. The framework now nudges toward `coin_registry::new_currency_with_otw`,
// but that changes the publish flow and the TreasuryCap handoff the rest of Splyt
// (and the frozen interface) relies on, so we keep this and silence the notice.
#[allow(deprecated_usage)]
fun init(witness: PT, ctx: &mut TxContext) {
    let (treasury, metadata) = coin::create_currency(
        witness,
        9, // decimals: set this to match your underlying coin's decimals
        b"PT",
        b"Splyt Principal Token",
        b"Redeems 1:1 for underlying principal at market maturity",
        option::none(),
        ctx,
    );
    // Metadata is immutable once published.
    transfer::public_freeze_object(metadata);
    // The deployer receives the TreasuryCap and hands it to market::create_market.
    transfer::public_transfer(treasury, ctx.sender());
}
