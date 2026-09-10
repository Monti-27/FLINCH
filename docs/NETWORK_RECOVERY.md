# Room network recovery

## Cause and scope

The reported live screen showed `Room unavailable` and `Signal timed out`. The client limits individual network requests to five seconds. The screenshot alone does not identify which request timed out or prove a Railway outage.

A deterministic reproduction found that `FlinchClient` retained its constructor's rejected network-verification promise. Once that initial genesis request failed, later room polls reused the rejection instead of checking the network again. This could leave the client stuck until it was recreated.

## Fix

Network verification now shares one in-flight request, retains success, and releases a failed transport request so a later caller can retry. A wrong genesis or other client validation error remains blocked for that client. Account reads still wait for successful verification; no fallback endpoint is introduced.

Room timeouts now say: “The network took too long to respond. Retrying automatically.” Existing confirmed balances and their observation times remain visible, stale ER control is discarded, and cancelled reads are not published. The existing polling interval and five-second request deadline are unchanged.

This change does not retry signed transactions, change signing or settlement, or modify round timing. Concurrent timer edits in the workspace are separate work and were preserved.

## Local verification on 2026-09-11

- Client tests: 48 passed, including six new network-verification regressions.
- Frontend tests: 474 passed, including initial timeout recovery, stale-control removal, and cancellation coverage.
- Keeper tests: 36 passed; two PostgreSQL-dependent tests skipped without a test database.
- Test harness: 29 passed.
- Local program tests: 23 passed, including authorization, replay, Raydium execution, and claims.
- Domain tests: 35 passed; formatting and Clippy passed.
- Root and frontend type checks passed.
- Production webpack build passed in `/tmp/flinch-timeout-WOChVK` without replacing the workspace's build output.
- Source-size/comment checks, selected secret/generated-artifact scans, and whitespace checks passed.

The isolated browser test exercised the real five-second abort signal at 375, 768, and 1280 pixels. Each page recovered after its first genesis timeout with one document navigation and exactly two genesis attempts. Desktop also recovered after a later room-read timeout while retaining the same action surface. No wallet was connected, external RPC requests were blocked, and no transaction was submitted.

Browser evidence: `artifacts/runs/network-recovery-1789090720685/result.json`, with timeout and recovered screenshots alongside it. Accounts came from the local program fixture, not the live Devnet room. The market feed was deliberately unavailable rather than replaced with fabricated prices.

To repeat the browser test, serve an isolated localnet production build configured with base RPC `http://127.0.0.1:18991`, local ER `http://127.0.0.1:18992`, genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, and transactions disabled. Then run:

```sh
FLINCH_UI_URL=http://127.0.0.1:3491/play FLINCH_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node apps/web/tests/network-recovery-browser.ts
```

## Deployment boundary

This fix has not been deployed. No hosted keeper was restarted and no live room or wallet was changed. The complete local validator/ER cycle, live Devnet router/session/oracle/swap/recovery/withdrawal cycle, and ten-round Devnet soak were not rerun for this patch. These local results do not constitute a new end-to-end deployment certification.
