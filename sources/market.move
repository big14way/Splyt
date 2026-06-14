/// Splyt market: yield tokenization for Sui.
///
/// A market wraps a yield-bearing underlying coin `U` and splits a deposit into
/// equal amounts of Principal Token (PT) and Yield Token (YT). PT and YT are
/// independent fungible coins, each tradeable on its own DeepBook v3 pool. This
/// lets the market price separate into a fixed-yield leg (PT) and a yield-
/// speculation leg (YT), the Pendle model, brought to Sui.
///
/// Settlement model (MVP): European-style. Pre-maturity, PT and YT trade freely
/// and yield accumulates in the market. At maturity the market is settled once,
/// then PT redeems 1:1 for principal and YT redeems for its pro-rata share of
/// the accrued yield. A continuous-claim YT (interest index per account) is the
/// natural follow-up and is left as future work.
///
/// Yield source: abstracted behind `accrue`, which is gated by `AdminCap` and is
/// intended to be driven by an oracle/keeper. In the demo this credits a
/// controlled amount; in production it is wired to a real source such as a
/// Scallop deposit receipt or a Sui LST exchange rate, with no change to the
/// PT/YT mechanics below.
module splyt::market;

use openzeppelin_math::rounding;
use openzeppelin_math::u64 as ozu64;
use splyt::pt::PT;
use splyt::yt::YT;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin, TreasuryCap};

// === Errors ===
const ENotMatured: u64 = 0;
const EAlreadyMatured: u64 = 1;
const EMaturityNotReached: u64 = 2;
const EUnequalLegs: u64 = 3;
const EZeroAmount: u64 = 4;

// === Objects ===

/// Authority to credit yield into a market. Held by the deployer or a keeper.
public struct AdminCap has key, store {
    id: UID,
}

/// A single yield-tokenization market over underlying coin `U`.
public struct Market<phantom U> has key {
    id: UID,
    /// Unix timestamp (ms) at and after which the market can be settled.
    maturity_ms: u64,
    /// Backs PT redemptions 1:1.
    principal: Balance<U>,
    /// Accumulated yield, distributed to YT at maturity.
    yield_pool: Balance<U>,
    pt_cap: TreasuryCap<PT>,
    yt_cap: TreasuryCap<YT>,
    matured: bool,
    /// Snapshot of yield_pool value taken at settlement.
    final_yield: u64,
    /// Snapshot of YT supply taken at settlement.
    final_yt_supply: u64,
}

// === Lifecycle ===

/// Create a market and return the AdminCap. Consumes both TreasuryCaps, so this
/// can run at most once per PT/YT currency, which pins one market per token set.
public fun create<U>(
    pt_cap: TreasuryCap<PT>,
    yt_cap: TreasuryCap<YT>,
    maturity_ms: u64,
    ctx: &mut TxContext,
): AdminCap {
    let market = Market<U> {
        id: object::new(ctx),
        maturity_ms,
        principal: balance::zero<U>(),
        yield_pool: balance::zero<U>(),
        pt_cap,
        yt_cap,
        matured: false,
        final_yield: 0,
        final_yt_supply: 0,
    };
    transfer::share_object(market);
    AdminCap { id: object::new(ctx) }
}

/// Convenience entry: create the market and send the AdminCap to the caller.
entry fun create_market<U>(
    pt_cap: TreasuryCap<PT>,
    yt_cap: TreasuryCap<YT>,
    maturity_ms: u64,
    ctx: &mut TxContext,
) {
    let cap = create<U>(pt_cap, yt_cap, maturity_ms, ctx);
    transfer::public_transfer(cap, ctx.sender());
}

// === Pre-maturity: split / combine ===

/// Deposit `underlying` and mint equal amounts of PT and YT. Composable: the
/// returned coins can be routed straight into a DeepBook order in the same PTB.
public fun split<U>(
    market: &mut Market<U>,
    underlying: Coin<U>,
    clock: &Clock,
    ctx: &mut TxContext,
): (Coin<PT>, Coin<YT>) {
    assert!(!market.matured, EAlreadyMatured);
    assert!(clock.timestamp_ms() < market.maturity_ms, EAlreadyMatured);

    let amount = underlying.value();
    assert!(amount > 0, EZeroAmount);

    market.principal.join(underlying.into_balance());
    let pt = market.pt_cap.mint(amount, ctx);
    let yt = market.yt_cap.mint(amount, ctx);
    (pt, yt)
}

/// Entry wrapper: split and send both legs to the caller.
entry fun split_for_sender<U>(
    market: &mut Market<U>,
    underlying: Coin<U>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let (pt, yt) = split<U>(market, underlying, clock, ctx);
    let sender = ctx.sender();
    transfer::public_transfer(pt, sender);
    transfer::public_transfer(yt, sender);
}

/// Recombine equal PT and YT back into the underlying before maturity. Any yield
/// already accrued stays in the pool for the remaining YT holders.
public fun combine<U>(
    market: &mut Market<U>,
    pt: Coin<PT>,
    yt: Coin<YT>,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<U> {
    assert!(!market.matured, EAlreadyMatured);
    assert!(clock.timestamp_ms() < market.maturity_ms, EAlreadyMatured);

    let amount = pt.value();
    assert!(amount == yt.value(), EUnequalLegs);
    assert!(amount > 0, EZeroAmount);

    market.pt_cap.burn(pt);
    market.yt_cap.burn(yt);
    coin::from_balance(market.principal.split(amount), ctx)
}

// === Yield + settlement ===

/// Credit yield into the market. Gated by AdminCap; intended for an oracle/keeper
/// that forwards the underlying's real yield. Swap this body for a Scallop or LST
/// read in production without touching split/redeem.
public fun accrue<U>(market: &mut Market<U>, _admin: &AdminCap, yield_in: Coin<U>) {
    assert!(!market.matured, EAlreadyMatured);
    market.yield_pool.join(yield_in.into_balance());
}

/// Settle the market once maturity is reached. Snapshots the total yield and the
/// YT supply so per-YT payouts are fixed and fair regardless of redemption order.
public fun mature<U>(market: &mut Market<U>, clock: &Clock) {
    assert!(!market.matured, EAlreadyMatured);
    assert!(clock.timestamp_ms() >= market.maturity_ms, EMaturityNotReached);

    market.matured = true;
    market.final_yield = market.yield_pool.value();
    market.final_yt_supply = market.yt_cap.total_supply();
}

// === Post-maturity: redeem ===

/// Burn PT for principal, 1:1.
public fun redeem_pt<U>(
    market: &mut Market<U>,
    pt: Coin<PT>,
    ctx: &mut TxContext,
): Coin<U> {
    assert!(market.matured, ENotMatured);
    let amount = pt.value();
    assert!(amount > 0, EZeroAmount);

    market.pt_cap.burn(pt);
    coin::from_balance(market.principal.split(amount), ctx)
}

/// Burn YT for a pro-rata share of the accrued yield:
///   payout = amount * final_yield / final_yt_supply  (rounded down)
///
/// The multiplication is done in wider precision by OpenZeppelin's mul_div, so
/// `amount * final_yield` cannot overflow u64. Rounding down guarantees the sum
/// of all payouts never exceeds the pool, so the last redeemer never underflows.
public fun redeem_yt<U>(
    market: &mut Market<U>,
    yt: Coin<YT>,
    ctx: &mut TxContext,
): Coin<U> {
    assert!(market.matured, ENotMatured);
    let amount = yt.value();
    assert!(amount > 0, EZeroAmount);

    market.yt_cap.burn(yt);
    let payout = ozu64::mul_div(
        amount,
        market.final_yield,
        market.final_yt_supply,
        rounding::down(),
    ).destroy_some();
    coin::from_balance(market.yield_pool.split(payout), ctx)
}

/// Entry wrapper: redeem PT and send proceeds to caller.
entry fun redeem_pt_for_sender<U>(market: &mut Market<U>, pt: Coin<PT>, ctx: &mut TxContext) {
    let out = redeem_pt<U>(market, pt, ctx);
    transfer::public_transfer(out, ctx.sender());
}

/// Entry wrapper: redeem YT and send proceeds to caller.
entry fun redeem_yt_for_sender<U>(market: &mut Market<U>, yt: Coin<YT>, ctx: &mut TxContext) {
    let out = redeem_yt<U>(market, yt, ctx);
    transfer::public_transfer(out, ctx.sender());
}

// === Views (for the indexer / frontend / Walrus snapshot writer) ===

public fun maturity_ms<U>(m: &Market<U>): u64 { m.maturity_ms }

public fun is_matured<U>(m: &Market<U>): bool { m.matured }

public fun principal_value<U>(m: &Market<U>): u64 { m.principal.value() }

public fun yield_value<U>(m: &Market<U>): u64 { m.yield_pool.value() }

public fun pt_supply<U>(m: &Market<U>): u64 { m.pt_cap.total_supply() }

public fun yt_supply<U>(m: &Market<U>): u64 { m.yt_cap.total_supply() }

public fun final_yield<U>(m: &Market<U>): u64 { m.final_yield }

public fun final_yt_supply<U>(m: &Market<U>): u64 { m.final_yt_supply }
