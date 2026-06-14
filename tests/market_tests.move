#[test_only]
module splyt::market_tests;

use splyt::market::{Self, Market, AdminCap};
use splyt::pt::PT;
use splyt::yt::YT;
use std::string;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const ADMIN: address = @0xAD;
const USER: address = @0xB0;
const USER_B: address = @0xB1;

const MATURITY_MS: u64 = 1_000;

// Create a SUI-underlying market maturing at MATURITY_MS and hand ADMIN the cap.
fun new_market(s: &mut ts::Scenario) {
    let ctx = ts::ctx(s);
    let pt_cap = coin::create_treasury_cap_for_testing<PT>(ctx);
    let yt_cap = coin::create_treasury_cap_for_testing<YT>(ctx);
    let admin = market::create<SUI>(pt_cap, yt_cap, MATURITY_MS, ctx);
    transfer::public_transfer(admin, ADMIN);
}

// Split `amount` of fresh underlying as the current sender; returns (PT, YT).
fun split_amount(s: &mut ts::Scenario, amount: u64): (coin::Coin<PT>, coin::Coin<YT>) {
    let mut m = ts::take_shared<Market<SUI>>(s);
    let ctx = ts::ctx(s);
    let clk = clock::create_for_testing(ctx); // timestamp 0 < maturity
    let underlying = coin::mint_for_testing<SUI>(amount, ctx);
    let (pt, yt) = market::split<SUI>(&mut m, underlying, &clk, ctx);
    clock::destroy_for_testing(clk);
    ts::return_shared(m);
    (pt, yt)
}

fun accrue_amount(s: &mut ts::Scenario, amount: u64) {
    let mut m = ts::take_shared<Market<SUI>>(s);
    let admin = ts::take_from_address<AdminCap>(s, ADMIN);
    let ctx = ts::ctx(s);
    let yield_in = coin::mint_for_testing<SUI>(amount, ctx);
    market::accrue<SUI>(&mut m, &admin, yield_in);
    ts::return_to_address(ADMIN, admin);
    ts::return_shared(m);
}

fun mature_now(s: &mut ts::Scenario) {
    let mut m = ts::take_shared<Market<SUI>>(s);
    let ctx = ts::ctx(s);
    let mut clk = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clk, MATURITY_MS);
    market::mature<SUI>(&mut m, &clk);
    clock::destroy_for_testing(clk);
    ts::return_shared(m);
}

#[test]
fun test_split_and_combine() {
    let mut scenario = ts::begin(ADMIN);
    let s = &mut scenario;
    new_market(s);

    ts::next_tx(s, USER);
    let (pt, yt) = split_amount(s, 100);
    assert!(coin::value(&pt) == 100, 0);
    assert!(coin::value(&yt) == 100, 1);

    // Combine the equal legs back into the underlying before maturity.
    ts::next_tx(s, USER);
    {
        let mut m = ts::take_shared<Market<SUI>>(s);
        let ctx = ts::ctx(s);
        let clk = clock::create_for_testing(ctx);
        assert!(market::pt_supply(&m) == 100, 2);
        let back = market::combine<SUI>(&mut m, pt, yt, &clk, ctx);
        assert!(coin::value(&back) == 100, 3);
        assert!(market::pt_supply(&m) == 0, 4);
        assert!(market::principal_value(&m) == 0, 5);
        coin::burn_for_testing(back);
        clock::destroy_for_testing(clk);
        ts::return_shared(m);
    };

    ts::end(scenario);
}

#[test]
fun test_full_lifecycle() {
    let mut scenario = ts::begin(ADMIN);
    let s = &mut scenario;
    new_market(s);

    ts::next_tx(s, USER);
    let (pt, yt) = split_amount(s, 100);

    // Admin credits 40 of yield.
    ts::next_tx(s, ADMIN);
    accrue_amount(s, 40);

    ts::next_tx(s, USER);
    {
        let m = ts::take_shared<Market<SUI>>(s);
        assert!(market::yield_value(&m) == 40, 0);
        ts::return_shared(m);
    };

    // Settle at maturity and snapshot the yield + YT supply.
    ts::next_tx(s, USER);
    mature_now(s);

    ts::next_tx(s, USER);
    {
        let mut m = ts::take_shared<Market<SUI>>(s);
        assert!(market::is_matured(&m), 1);
        assert!(market::final_yield(&m) == 40, 2);
        assert!(market::final_yt_supply(&m) == 100, 3);
        let ctx = ts::ctx(s);

        let principal = market::redeem_pt<SUI>(&mut m, pt, ctx);
        assert!(coin::value(&principal) == 100, 4); // PT redeems 1:1

        let yield_out = market::redeem_yt<SUI>(&mut m, yt, ctx);
        assert!(coin::value(&yield_out) == 40, 5); // sole YT holder takes all yield

        coin::burn_for_testing(principal);
        coin::burn_for_testing(yield_out);
        ts::return_shared(m);
    };

    ts::end(scenario);
}

#[test]
fun test_pro_rata_yield() {
    let mut scenario = ts::begin(ADMIN);
    let s = &mut scenario;
    new_market(s);

    // USER splits 100, USER_B splits 300 -> total YT supply 400.
    ts::next_tx(s, USER);
    let (pt_a, yt_a) = split_amount(s, 100);
    ts::next_tx(s, USER_B);
    let (pt_b, yt_b) = split_amount(s, 300);

    // Accrue 40 of yield, then settle.
    ts::next_tx(s, ADMIN);
    accrue_amount(s, 40);
    ts::next_tx(s, USER);
    mature_now(s);

    ts::next_tx(s, USER);
    {
        let mut m = ts::take_shared<Market<SUI>>(s);
        assert!(market::final_yt_supply(&m) == 400, 0);
        let ctx = ts::ctx(s);

        // 100/400 * 40 = 10, 300/400 * 40 = 30.
        let y_a = market::redeem_yt<SUI>(&mut m, yt_a, ctx);
        let y_b = market::redeem_yt<SUI>(&mut m, yt_b, ctx);
        assert!(coin::value(&y_a) == 10, 1);
        assert!(coin::value(&y_b) == 30, 2);

        let p_a = market::redeem_pt<SUI>(&mut m, pt_a, ctx);
        let p_b = market::redeem_pt<SUI>(&mut m, pt_b, ctx);
        assert!(coin::value(&p_a) == 100, 3);
        assert!(coin::value(&p_b) == 300, 4);

        coin::burn_for_testing(y_a);
        coin::burn_for_testing(y_b);
        coin::burn_for_testing(p_a);
        coin::burn_for_testing(p_b);
        ts::return_shared(m);
    };

    ts::end(scenario);
}

#[test]
fun test_set_yield_history_blob() {
    let mut scenario = ts::begin(ADMIN);
    let s = &mut scenario;
    new_market(s);

    ts::next_tx(s, ADMIN);
    {
        let mut m = ts::take_shared<Market<SUI>>(s);
        let admin = ts::take_from_address<AdminCap>(s, ADMIN);
        assert!(market::yield_history_blob(&m) == string::utf8(b""), 0);

        market::set_yield_history_blob<SUI>(&mut m, &admin, b"blob-abc-123");
        assert!(market::yield_history_blob(&m) == string::utf8(b"blob-abc-123"), 1);

        ts::return_to_address(ADMIN, admin);
        ts::return_shared(m);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = market::EAlreadyMatured)]
fun test_split_at_maturity_aborts() {
    let mut scenario = ts::begin(ADMIN);
    let s = &mut scenario;
    new_market(s);

    ts::next_tx(s, USER);
    {
        let mut m = ts::take_shared<Market<SUI>>(s);
        let ctx = ts::ctx(s);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, MATURITY_MS); // not < maturity
        let underlying = coin::mint_for_testing<SUI>(100, ctx);
        let (pt, yt) = market::split<SUI>(&mut m, underlying, &clk, ctx);
        // Unreachable: split aborts above. Consume for the type checker.
        coin::burn_for_testing(pt);
        coin::burn_for_testing(yt);
        clock::destroy_for_testing(clk);
        ts::return_shared(m);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = market::ENotMatured)]
fun test_redeem_pt_before_maturity_aborts() {
    let mut scenario = ts::begin(ADMIN);
    let s = &mut scenario;
    new_market(s);

    ts::next_tx(s, USER);
    let (pt, yt) = split_amount(s, 100);

    ts::next_tx(s, USER);
    {
        let mut m = ts::take_shared<Market<SUI>>(s);
        let ctx = ts::ctx(s);
        let principal = market::redeem_pt<SUI>(&mut m, pt, ctx); // aborts: not matured
        coin::burn_for_testing(principal);
        coin::burn_for_testing(yt);
        ts::return_shared(m);
    };

    ts::end(scenario);
}
