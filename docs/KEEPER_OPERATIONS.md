# Running the keeper

For the prepared public devnet identity, pool, keys and funding workflow, use [DEVNET](DEVNET.md). Configuration may now use `rooms: []` with an explicit `discovery: { pool, validator }`. Discovery is scoped to the selected network's program, admits at most 128 active rooms and reports saturation. Pending file journals are restored before discovery, including terminal rooms needing reconciliation. Discovery failure does not evict known rooms or stop their base recovery.

The keeper is a separate Node process, not a browser task. It uses the existing room worker and durable operation journal. It never holds player wallets, quotes on their behalf, changes a signed minimum, or claims their tokens. A dedicated keeper key pays its own network fees and required account rent. Devnet fees still consume test SOL.

No public FLINCH deployment, funded devnet pool or hosted keeper is configured by this entrypoint. Deployment, public funding and execution remain separately authorized. The local tests below do not make the game publicly playable.

## Requirements

- Use the repository's installed Node 24.14.1 and pinned dependencies. No new package is required.
- Use a dedicated local configuration file and payer key outside the repository, each owned by the current user with mode `600`. Key files must be regular files, not links or shared hard links.
- Use a dedicated journal directory with mode `700`. Keep it across restarts. Do not share it between processes or hosts.
- Pin the actual base genesis and explicit room addresses. Between one and 128 unique rooms and one to four concurrent jobs are supported. This initial service does not discover rooms or hot-reload configuration.
- The base program, pool and room accounts must already exist. This command does not deploy, fund wallets, create pools or initialize rooms.

## Configuration

This template is intentionally not executable until the operator supplies actual paths, room addresses and payer. Unknown fields, unsupported networks, URL credentials and query strings reject before signing. Mainnet is not accepted.

```json
{
  "version": 1,
  "network": "devnet",
  "baseUrl": "https://rpc.magicblock.app/devnet",
  "expectedGenesis": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  "rooms": ["REPLACE_WITH_EXISTING_ROOM_ADDRESS"],
  "journalDirectory": "/absolute/private/flinch-journal",
  "keypairFile": "/absolute/private/keeper-payer.json",
  "payer": "REPLACE_WITH_EXPECTED_KEEPER_PUBLIC_KEY",
  "concurrency": 4,
  "messageVersion": "v0"
}
```

For a verified local stack, use `network: "localnet"`, loopback `baseUrl`, the actual local genesis, an explicit loopback `localErUrl`, and `messageVersion: "legacy"`. The tested stack uses base port 18899 and ER port 17799; these are test configuration, not runtime defaults. Never use a local ER override with devnet. The local resolver checks the SDK-derived delegation record and expected validator; the client separately checks actual ER identity, ownership and revision. Public devnet resolves each delegated account through the hosted router instead.

Local legacy messages preserve the already-tested early-genesis compatibility choice. They still enforce the 1,232-byte packet bound. Public devnet defaults to V0; public execution remains unverified.

## Inspect without signing

```sh
bun run keeper inspect --config /absolute/private/keeper.json
```

Inspection verifies the base network and reads the allowlisted rooms. It resolves delegated Control only when needed. It does not load the payer key, create a journal, acquire a lock, or submit any transaction. The keypair path may be absent if `payer` is also omitted. A configured but unreadable payer key does not prevent inspection.

The output is a confirmed base snapshot and a prospective next action, not permission to bypass pending-operation reconciliation. Inspection does not declare a transaction successful or a room fully operational. An unavailable ER can fail inspection before recovery is due; once recovery is eligible, that decision comes from base alone.

## Execute only after approval and configuration review

```sh
bun run keeper run --config /absolute/private/keeper.json --execute
```

Execution requires both the `run` command and `--execute`. Startup acquires exclusive ownership of the journal directory, verifies genesis, validates every configured room and existing journal, then loads the owner-only key and checks its public identity. It fails closed before submission if any startup check fails. The worker retains its own per-tick validation and onchain instruction guards.

The service starts fully funded rooms, delegates Control, freezes closed cohorts, verifies base return evidence, executes or expires batches, redelegates, cancels expired lobbies and performs hard recovery. It cannot queue player SELL intents or withdraw player tokens. The browser and actual player wallets remain responsible for those actions.

## Status and shutdown

Output is newline-delimited JSON: `ready`, `room`, `room_error`, `fatal` and `stopped`. Repeated unchanged room reports are suppressed. Public signatures and action names are retained. Raw RPC exceptions, URLs, key material and signed transaction bytes are not logged by the runner. Dependency warnings may still appear on stderr.

`submitted` means broadcast returned the expected signature. `confirmed` describes that transaction only. `superseded` means confirmed base state or a disjoint recovery boundary advanced beyond the pending work; it does not claim that the old signature succeeded. Receipts, Ledger and wallet balance deltas remain the evidence for economic results.

Use Ctrl-C or SIGTERM and wait for process exit. The scheduler stops accepting new work, drains the bounded in-flight requests and releases its journal lock. Pending transaction records remain for the next process to reconcile. Do not delete the journal to force a retry.

A second process using the same directory fails with `journal_locked`. An unclean exit deliberately leaves `keeper.lock`; there is no automatic lock stealing. Before manually removing that exact lock file, stop service supervisors and independently verify that no keeper process still owns the directory. PID absence alone is not sufficient when supervisors can restart. Preserve the room journals. This is a single-host operational guard, not a distributed lock or protection from a malicious same-user process. A retained lock is an operator-recovery requirement, not an automatically recovered crash.

Other safe error codes include `invalid_config`, `unsafe_file`, `invalid_keypair`, `wrong_network`, `placement_pending` and `operation_failed`. Correct configuration or investigate the retained public journal rather than weakening transaction checks. Repeated runtime failures back off to four seconds per room; hard recovery continues to use base without ER reads.

## Local proof

For the interactive loopback frontend, explicit local wallet grants and per-room `watch`/`pause`, see [LOCAL_PLAY](LOCAL_PLAY.md). It reuses this keeper and journal contract with a separate temporary payer. Sandbox shutdown destroys the running test world; it is not a persistent hosted keeper deployment.

```sh
bun run test:keeper
bun run test:stack:service
bun run test:stack:service:recovery
bun run test:stack:competing
```

Use the tested Agave 3.1.10 PATH described in TESTING. Run stack commands sequentially because they use the same validator ports. The first uses an independent fee payer, read-only CLI inspection, a rejected duplicate process, an actual process restart with a pending execution, two Raydium swaps and four player claims. The second accepts a session SELL, restarts the keeper with ER HTTP access blocked, waits for the real onchain hard cutoff and verifies base recovery and four unchanged-WSOL claims. Both retain public signatures, transactions, logs and balances and never inject Control.

The competing test starts two independent payer keys, processes and journals. Its test-only loopback proxy releases two distinct signed settlement attempts together for each of two receipts. One succeeds per batch; both workers reconcile without duplicate economic effects. Failed attempts may still pay fees. It retains successful and failed transaction metadata plus four exact claims. See TESTING for the observed race outcome and remaining schedules.

Synthetic local liquidity and ephemeral local test wallets are used. Temporary payer files are created outside the repository and removed after the child processes stop. The tests do not prove public hosted routing, real extension-wallet usability, crash-lock recovery, all competing-worker schedules or ten sequential devnet rounds.
