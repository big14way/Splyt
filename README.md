<div align="center">

# Splyt

### Fixed, predictable yield for everyone — on Sui.

**Split any yield-bearing asset into a Principal Token (lock a guaranteed return) and a Yield Token (trade the yield). Pendle, brought natively to Sui — with DeepBook order books and a Walrus-verifiable yield history.**

[**🌐 Live App → splyttapp.vercel.app**](https://splyttapp.vercel.app) · [**🎥 Demo Video**](https://youtu.be/G3n9I9uMpu4) · [**🐙 GitHub**](https://github.com/big14way/Splyt)

`Sui Overflow 2026` · Track: **DeFi & Payments** · Network: **Sui Testnet** · Live & verifiable on-chain

</div>

---

## The problem

In DeFi, **principal and yield are welded together** in a single position. Every "APY" you see is a *floating* rate — it can collapse the day after you deposit, and nothing tells you it will. There is **no on-chain way to simply lock a fixed, predictable return.**

> My uncle saved carefully for **three years** in **Nigeria** — toward a home for his family in another country. When he wanted to try crypto, he asked me; I was the one in the family who understood it, and I put his money into something paying **almost 18%**. The rate was *floating*. It quietly fell to almost nothing. He didn't get angry — he just went quiet and asked if his money was still safe. He wasn't greedy. He wanted to **know**.
>
> That certainty didn't exist on-chain. **Splyt is the answer I wish I'd had.**

He is not an edge case. He is the market.

- 🌍 **861M** people now hold crypto; **Nigeria's inflation hit 21.88%** in 2025 and the naira lost **60%+** of its value since 2023. **95%** of surveyed Nigerians would rather hold stablecoins than their own currency, and stablecoins are already **43%** of sub-Saharan Africa's crypto volume. The people who need *certainty* most are the ones least served by floating-rate DeFi.
- 🏦 **Fixed income is the single largest asset class on Earth — ~$140 trillion.** On-chain, it barely exists.
- 📈 Demand is *proven*: **Pendle** (yield tokenization on Ethereum) holds **~$8.7B TVL** and has settled **~$70B** in yield. But it's EVM-only — **Sui has no native yield-tokenization primitive at all.**

## The solution

Splyt takes one deposit of a yield-bearing asset and **splits it into two tradeable Sui coins**:

| Token | What it is | Who it's for |
|---|---|---|
| 🔵 **PT** — Principal Token | Redeems **1:1** for principal at maturity. Buy it below par → you've **locked a fixed yield**. | Savers who want **certainty** (my uncle). |
| 🟢 **YT** — Yield Token | A claim on **all the yield** the deposit earns over the term. | Traders who want **leveraged yield exposure**. |

Certainty for one person and upside for another — **out of the same deposit.** Before maturity you can recombine PT + YT back into the asset anytime; at maturity, PT redeems for principal and YT for its pro-rata share of the real accrued yield.

## Why this matters for Sui

Sui's DeFi TVL hit an all-time high of **~$2.3B (+220% YoY)** in 2025, but it's missing the primitive that made fixed income the biggest market in traditional finance. **Splyt is yield tokenization, built Sui-native** — and it only works *because* of Sui's unique infrastructure:

- It turns PT and YT into **real, liquid markets** on **DeepBook**, Sui's native central-limit order book (**$10B+** traded).
- It makes its yield history **independently verifiable** on **Walrus**, Sui's decentralized storage (which raised **$140M** in 2025).
- It composes cleanly with Sui's object model — PT/YT are plain `Coin`s, so they drop straight into any Sui DeFi protocol.

Splyt doesn't just *use* Sui — it showcases what the Sui stack (Move + DeepBook + Walrus) can do that no other chain can do as cleanly.

## 🔌 Deep technical integrations

These are **load-bearing**, not logos. All three are live on testnet and verifiable on-chain.

### 1. DeepBook v3 — real order books for PT & YT
PT and YT are deliberately standard fungible Sui coins **so they are listable on DeepBook's native CLOB**. We built the **full trade lifecycle** end-to-end and proved it live: create a per-user `BalanceManager`, **deposit + place a limit order in a single PTB**, read the live level-2 book, **cancel**, and **withdraw** back to the wallet. The same `placeLimitOrder` / `cancelOrder` / `getOrderBook` helpers power both the seeding scripts and the web app. *(On testnet the demo trades the whitelisted DEEP/SUI pool, because permissionless PT/USDC pool creation costs a fixed 500 DEEP and testnet DEEP is scarce — the identical code lists PT/YT the moment DEEP is available.)*

### 2. Walrus — a yield history you can't fake
A keeper snapshots the market each interval — implied APY, the accrued-yield index, DeepBook mids — and writes the time series to **Walrus** as content-addressed data. Crucially, the resulting **blob id is committed on-chain** via an admin-gated `market::set_yield_history_blob`, which also emits an event. The frontend reads that id from the `Market` object and fetches the raw series straight from a Walrus aggregator. **The yield curve isn't a number our server made up — anyone can verify it.** *(Verified live: the on-chain `yield_history_blob` matches the aggregator's content exactly.)*

### 3. OpenZeppelin Contracts for Sui — exact, safe math
The pro-rata YT payout in `redeem_yt` uses OpenZeppelin's `u64::mul_div` with **round-down**, so `amount × final_yield ÷ final_yt_supply` is computed in wider precision (no overflow) and the sum of payouts can **never exceed the pool** — the last redeemer never underflows. Covered by Move unit tests.

## 🏗️ Architecture

```
                                ┌──────────────────────────────────────────────┐
                                │            Web App  (Next.js 14)              │
                                │   Split · Trade · Combine · Redeem · Chart    │
                                │   @mysten/dapp-kit · @mysten/sui v2           │
                                └───────┬───────────────┬──────────────┬───────┘
                       split/combine/   │      trade    │   read yield │
                       redeem (PTB)     │   (DeepBook)  │   history    │
                                        ▼               ▼              ▼
        ┌──────────────────────────────────────┐  ┌──────────┐  ┌──────────────┐
        │     Splyt Move package (Sui)          │  │ DeepBook │  │   Walrus     │
        │                                       │  │   v3     │  │  aggregator  │
        │  market.move ── split / combine       │  │  CLOB    │  │ (content-    │
        │      accrue / mature / redeem_pt /yt  │  │ PT·YT·   │  │  addressed)  │
        │      set_yield_history_blob (view)    │  │ DEEP/SUI │  └──────▲───────┘
        │  pt.move / yt.move ── PT & YT coins    │  └────▲─────┘         │ store + read
        │  └─ OpenZeppelin mul_div in redeem_yt  │       │               │
        └───────────────▲───────────────────────┘       │               │
                        │ accrue / commit blob id        │ list/seed/    │
                        │                                │ trade         │
                ┌───────┴─────────────────────────────────┴───────────────┴───────┐
                │     Off-chain scripts (TypeScript, contracts-owner track)        │
                │  deepbook/  ·  walrus keeper  ·  new-demo-market.sh              │
                └─────────────────────────────────────────────────────────────────┘
```

**Three layers, one repo:** Move contracts (the protocol), TypeScript scripts (DeepBook listing + the Walrus keeper), and the Next.js app. Every arrow above is live on testnet.

## ✅ Live & proven on-chain (Sui Testnet)

| | |
|---|---|
| 🌐 **Live app** | https://splyttapp.vercel.app |
| 🎥 **Demo video** | https://youtu.be/G3n9I9uMpu4 |
| 📦 **Package** | `0x78c280c277302119e0cd24f0622ded914103a51af4c96f6265f55a6283c3778c` |
| 🏛️ **Market** (`SUI`) | `0x400184f76d19eb0a726af4079da37f22b0f7f5dd81f6b92a53deffdb74bfced0` |
| 🧪 **Tests** | Move **6/6** · scripts **6/6** · web type-check + prod build ✓ |

Verified working on-chain: `split` / `combine` / `accrue` / settle / redeem and all views; the full DeepBook trade path (deposit → place → cancel → withdraw); and the Walrus yield history with its on-chain blob anchor.

## 🧩 The frozen interface

`PKG` = package id, `MARKET` = shared `Market` object, `CLOCK` = `0x6`, `<U>` = underlying coin type.

```
PKG::market::split_for_sender<U>(MARKET, Coin<U>, CLOCK)
PKG::market::combine<U>(MARKET, Coin<PT>, Coin<YT>, CLOCK) -> Coin<U>
PKG::market::redeem_pt_for_sender<U>(MARKET, Coin<PT>)
PKG::market::redeem_yt_for_sender<U>(MARKET, Coin<YT>)
PKG::market::set_yield_history_blob<U>(MARKET, &AdminCap, blob_id)   // Walrus anchor
views: maturity_ms · is_matured · principal_value · yield_value · pt_supply ·
       yt_supply · final_yield · final_yt_supply · yield_history_blob
```
PT/YT trading is **not** a Splyt call — it goes through the DeepBook SDK against the PT/USDC, YT/USDC (and demo DEEP/SUI) pools.

## 🚀 Run it

```bash
# 1) Move contracts — build + test
sui move build && sui move test                 # 6/6 pass

# 2) Web app
cd web && npm install && npm run dev            # http://localhost:3000

# 3) Off-chain scripts (DeepBook listing + Walrus keeper)
cd scripts && npm install && npm run typecheck && npm test
```

The web app reads its deployment from `NEXT_PUBLIC_*` env vars (set on Vercel), falling back to the live testnet ids — repoint it at a new deployment with **env alone, no code change**. Full off-chain docs: [`scripts/README.md`](scripts/README.md).

### Recording / demoing the redeem lifecycle
The live market matures ~30 days out, so Split / Trade / Combine / the chart work any time. To show **Redeem** without waiting:
```bash
./scripts/new-demo-market.sh 12     # fresh market, matures in 12 min; rewrites web/lib/config.ts
```

## 🗺️ Roadmap

- **Now (this submission):** PT/YT split/combine/redeem, DeepBook trade lifecycle, Walrus-verifiable yield history, full web app — live on testnet.
- **Next:** create PT/USDC + YT/USDC DeepBook pools on mainnet (where DEEP is liquid); a real yield source (a Sui LST exchange rate or a Scallop receipt) behind `accrue` — zero change to the PT/YT logic.
- **Then:** **continuous YT** with a per-account interest index (claim yield anytime, not just at maturity); multiple maturities per asset; an auto-router that quotes the best fixed rate across markets.
- **Vision:** the **fixed-income layer of Sui** — the rails that let anyone, anywhere, turn a floating promise into certainty.

## 📊 By the numbers (sources)

Fixed income ≈ **$140T**, the largest asset class ([MSCI](https://www.msci.com/research-and-insights/blog-post/sizing-up-the-global-market-portfolio), [Mordor](https://finance.yahoo.com/news/global-bond-market-reach-usd-153000646.html)) · Pendle **~$8.7B TVL / ~$70B yield settled** ([WEEX](https://www.weex.com/news/detail/pendle-2025-q3-performance-report-tvl-surpasses-87-billion-trading-volume-up-by-236-232742), [DL News](https://www.dlnews.com/external/pendle-settles-698-billion-in-yield-bridging-the-140t-fixed-income-market-to-crypto/)) · **861M** crypto / **27.7M** DeFi users ([socialcapitalmarkets](https://socialcapitalmarkets.net/crypto-trading/cryptocurrency-statistics/)) · Nigeria inflation **21.88%**, naira **−60%**, **95%** prefer stablecoins ([Cointelegraph](https://cointelegraph.com/news/how-africans-are-using-stablecoins-to-survive-inflation), [Plasma](https://www.plasma.org/learn/nigeria-stablecoins)) · Sui DeFi TVL **~$2.3B (+220% YoY)**, DeepBook **$10B+** traded, Walrus raised **$140M** ([Messari](https://messari.io/report/state-of-sui-q3-2025), [CoinCentral](https://coincentral.com/grayscale-launches-trusts-for-deepbook-and-walrus-tokens-in-sui-ecosystem/)).

---

<div align="center">

**Splyt turns the one thing my uncle wanted — _certainty_ — into something you can actually buy.**

[Live app](https://splyttapp.vercel.app) · [Demo](https://youtu.be/G3n9I9uMpu4) · Built on Sui with DeepBook · Walrus · OpenZeppelin

</div>
