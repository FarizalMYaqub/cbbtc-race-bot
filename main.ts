// cbbtc-race-bot: a cbBTC trading bot for make.fun's "Race a BTC trading bot live
// for 24 hours" (btc-race-24h-20261117-0603). Paper money only, long only.
//
// Strategy — "extreme-move catcher", tuned on the frozen 24h dev window:
// cbBTC on this thin Orca pool mostly drifts a few bps a minute, then a whale
// trade moves it 100-200 bps inside an hour, up or down. A full-size round
// trip costs ~26 bps (4 bps fee + 2 bps slippage + ~7 bps impact each way),
// so the bot only trades when the last 60 minutes moved a lot, and it gets
// out before the move gives itself back.
//
//   - Entry (flat only): the 60-minute close-to-close return is at least
//     +130 bps (momentum: ride a spike) or at most -110 bps (dip: buy the
//     crash, the pool mean-reverts after a whale dump). Full cash, one
//     position, long only.
//   - Exit (holding): a trailing stop 0.9% below the highest close since
//     entry, or a 300-bar (5h) time stop, whichever comes first. Both are
//     checked on every bar's close; the fill lands at the next bar's open.
//   - Orders cap their slippage at 100 bps past the close they were decided
//     on, so a fill into a liquidity gap is refused rather than filled for
//     almost nothing.
//
// Everything is a pure function of the bars the harness sent (the hello, each
// batch and its orders): no clock, no network, no randomness, so two runs on
// the same data answer byte for byte the same. Prices are integers at
// price_scale 5, compared in integer-exact float64 arithmetic.
//
// The bot speaks agent-fun/bars-replay/v1 through the kit's SDK shim, copied
// byte for byte to vendor/makefun-bars.ts.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Lookback for the entry signal, in bars (1-minute bars). */
const RET_BARS = 60;
/** Momentum entry: 60-minute return at or above this, in bps. */
const ENTRY_BPS = 130;
/** Dip entry: 60-minute return at or below this, in bps. */
const DIP_BPS = -110;
/** Trailing stop: sell when the close falls this far below the highest close since entry. */
const TRAIL = 0.009;
/** Time stop: sell after this many bars held, whatever the price. */
const MAX_HOLD_BARS = 300;
/** Slippage cap on every order, in bps past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, oldest first, as plain numbers (price_scale integers). */
const closes: number[] = [];
/** Highest close since the current entry (entry close at entry). */
let peak = 0;
/** Seq of the batch the current entry was decided on. */
let entrySeq = -1;

function retBps(now: number, ref: number): number {
  return ((now - ref) * 10_000) / ref;
}

await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[] }) {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = Number(bar.c);
    closes.push(close);
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      // Exit first: time stop, then the trailing stop off the running peak.
      if (state.seq - entrySeq >= MAX_HOLD_BARS) {
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      if (close > peak) peak = close;
      if (close <= peak * (1 - TRAIL)) {
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      return [];
    }

    // Flat: enter only on an extreme 60-minute move, in either direction.
    if (closes.length <= RET_BARS) return [];
    const ref = closes[closes.length - 1 - RET_BARS]!;
    const r = retBps(close, ref);
    if (r >= ENTRY_BPS || r <= DIP_BPS) {
      const cash = state.cash;
      if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      peak = close;
      entrySeq = state.seq;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
    }
    return [];
  },
});
