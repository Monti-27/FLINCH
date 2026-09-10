# Local four-player play

The sandbox runs the real FLINCH program, local Solana/MagicBlock runtimes, Raydium swaps, a separate keeper and the current frontend. Its mint and liquidity fixtures are synthetic. Nothing here deploys publicly, requests faucet funds, or represents real-money play.

## Start

Use the installed Node 24.14.1, Bun 1.3.14, Agave 3.1.10 and pinned MagicBlock validator 0.14.10. The built `target/deploy/flinch_v2.so`, generated V2 IDL and hash-checked `target/raydium-devnet.so` must exist. See [TESTING](TESTING.md) for build prerequisites. No dependency upgrade is required.

```sh
PATH='/Users/montisaini/.local/share/solana/install/releases/3.1.10/solana-release/bin:'"$PATH" bun run local --execute-local
```

On another machine, use that machine's verified Agave installation path. `bun run local --help` is read-only; omitting `--execute-local` refuses startup. Wait for the `ready` event before opening [local gameplay](http://127.0.0.1:3400/play). The root URL is now the landing page.

| Service | Loopback endpoint |
| --- | --- |
| Interactive frontend | `http://127.0.0.1:3400/play` |
| Solana base RPC | `http://127.0.0.1:18899` |
| Local ER RPC | `http://127.0.0.1:17799` |
| Stack public entry | `http://127.0.0.1:16699` |

The stack also uses the next port for each websocket, port 19900 and dynamic ports 20000–20100. Existing listeners are not killed. Port 3000 is a separate read-only design preview, not this enabled game. Do not expose these services or forward them to the public internet. The reference chart may still contact Coinbase; it never prices game proceeds.

## Wallet limitation

Player keys are never requested by the launcher. Use four distinct wallets that can sign transactions for this custom local chain, and configure their base RPC to the endpoint above. Do not import a production wallet or paste a seed/private key into the terminal or app.

Ordinary extension-wallet compatibility is not yet proven. Phantom's [Testnet Mode documentation](https://docs.phantom.com/developer-powertools/testnet-mode), inspected 2026-09-09, lists Solana Devnet and Testnet; that does not establish custom local RPC support. Switching Phantom to Devnet does not make local balances visible. Do not bypass wallet security warnings. The automated test below uses test-only Wallet Standard adapters, not a claim of Phantom or other extension support.

The 2026-09-11 signing patch addresses Phantom's documented automatic fee insertion and legacy account-order reconstruction: compute limits and a zero priority fee are fixed before preview, and the compiled message must remain identical after signing. Reload the arena after updating the client. If a wallet still changes the message, the error reports categories such as compute budget or blockhash, and the application does not submit it. Do not disable this guard, switch to the wallet's public-network broadcaster, or retry an uncertain submission automatically. Actual Phantom approval on this custom chain remains a separate verification step. `AccountNotFound` during an initial preview can instead mean the connected wallet has no account in this fresh genesis; balances from another network do not apply.

## Run a round

The launcher reads one command per line. Addresses are public keys only.

1. Connect each compatible local wallet in a separate browser profile/context. Enter `fund WALLET` for each public wallet address. Each receives exactly one synthetic local SOL from the test genesis host, with a maximum of 16 wallets. Repeating the command reconciles the original transfer; it never grants another SOL. This is a direct local transfer, not a faucet call.
2. Create a room in the frontend. Copy its room address and enter `watch ROOM` in the launcher. The keeper validates that the room belongs to this sandbox's pool and validator. Up to four rooms can be watched concurrently. Repeating `watch` reuses the existing process.
3. Use **Invite players** in the room toolbar. The link opens the same room and is also accepted by the lobby's room-entry field. Copying or opening an invite never signs a transaction or reserves a seat. Loopback links work only on this machine; remote multiplayer requires separately authorized public infrastructure.
4. Each wallet explicitly joins and approves its equal stake. The keeper starts the round automatically after all four deposits confirm. HOLD is passive; SELL first displays the executable quote, then explicitly queues the intent. Only a confirmed base swap produces USDC credit.
5. Sellers claim their actual USDC. The final holder, or multiple holders after timeout/recovery, claims their WSOL. Claims remain wallet-authorized. Check the receipt and wallet delta, not just the notification.

Other commands: `status` shows watched-room process state and latest keeper event; `pause ROOM` drains that room's keeper; `watch ROOM` resumes with the same journal; `help` lists commands; `quit` stops the sandbox. Pausing does not stop the onchain clock. A late resume may recover unsold WSOL rather than execute an expired intent.

## Shutdown and recovery limits

Use `quit`, Ctrl-C or SIGTERM and wait for the `stopped` event and process exit. Shutdown drains all room keepers before stopping the stack and deleting temporary owner-only keeper keys outside the repository. It attempts remaining cleanup even if a service fails to stop. If keeper exit is unconfirmed, keys are retained and `shutdown_failed` is reported; inspect the remaining processes before another launch.

An unexpected web or stack supervisor exit produces `service_stopped`, shuts down the remaining sandbox, and exits with status 1. There is no automatic restart. An observation timeout is not treated as proof that a process died. Individual keeper status is available through `status`; an unclean keeper exit can leave its journal lock and needs the operator checks in [KEEPER_OPERATIONS](KEEPER_OPERATIONS.md).

Each launch creates a new genesis and test world. Sandbox restart/resume is **not implemented**. Old room links and balances do not carry into the new world. Keeper pause/resume inside one running sandbox is distinct from restarting the whole sandbox. Evidence and ledger files remain under the printed `artifacts/runs/mb-stack-*` directory; they are not an implemented restoration path.

## Automated verification

```sh
PATH='/Users/montisaini/.local/share/solana/install/releases/3.1.10/solana-release/bin:'"$PATH" \
FLINCH_BROWSER_EXECUTABLE='/Users/montisaini/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' \
bun run test:browser:local
```

Run `bun run test:local:failure` with the same Agave PATH for the actual web-process termination and cleanup check. Run stack scenarios sequentially, never simultaneously on their shared ports. Retained test results, signatures, balances and limits are recorded in [TESTING](TESTING.md).

The browser test uses four separate adapters to sign genuine local transactions: four UI deposits, three distinct Raydium sales, and four UI claims. It checks final vaults, exact entitlements, duplicate funding/watch behavior, keeper pause/resume, invite clipboard success/denial, keyboard and reduced motion. This does not satisfy ordinary-wallet, hosted routing, ten devnet rounds or production-readiness gates.
