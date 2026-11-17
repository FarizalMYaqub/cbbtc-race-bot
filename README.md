# cbbtc-race-bot
[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/FarizalMYaqub/cbbtc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/FarizalMYaqub/cbbtc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A cbBTC trading bot for make.fun's **"Race a BTC trading bot live for 24 hours"** bounty ($250 in USDC). Simulation only: it trades $1,000 of paper money against replayed on-chain cbBTC/USDC prices from an Orca Whirlpool on Solana. No real money is traded.

## Strategy

cbBTC on this thin pool mostly drifts a few basis points a minute, then a whale trade moves it 100–200 bps inside an hour, up or down. A full-size round trip costs ~26 bps (4 bps fee + 2 bps slippage + ~7 bps price impact each way), so the bot only trades when the last 60 minutes moved a lot, and gets out before the move gives itself back.

- **Entry** (flat only): the 60-minute close-to-close return is at least **+130 bps** (momentum — ride a spike) or at most **−110 bps** (dip — buy the crash). Full cash, one position, long only.
- **Exit** (holding): a trailing stop **0.9%** below the highest close since entry, or a **300-bar (5h)** time stop, whichever comes first. Checked on every bar's close; fills land at the next bar's open.
- **Slippage cap**: every order caps slippage at 100 bps past the close it was decided on.

Everything is a pure function of the bars the harness sends — no clock, no network, no randomness — so two runs on the same data answer byte for byte the same.

## Dev-window result (local grade, kit harness)

| | |
|---|---|
| Net PnL | **+$25.52** on the frozen 24h dev window |
| Trades | 6 (3 round trips) |
| Max drawdown | 1.4% |
| Fees | ~$3.21 |

## Run it

The bot speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on stdin/stdout) via the kit SDK shim vendored at `vendor/makefun-bars.ts`. The grader runs it as `node /bot/main.ts` (Node 22, standard library only).

To grade locally with the competition kit:

```sh
node cli/makefun.mjs grade-local --kit . --bot /path/to/cbbtc-race-bot --driver process
```

## Layout

- `main.ts` — the bot (entrypoint)
- `vendor/makefun-bars.ts` — the kit's SDK shim, byte-for-byte copy
- `.makefun/owner.json` — the claim file for the entry wallet
- `LICENSE` — MIT

<sub>Entered on [make.fun](https://make.fun/?ref=byte&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
