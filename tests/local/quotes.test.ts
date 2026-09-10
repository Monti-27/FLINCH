import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { readQuotePool } from "../../packages/client/src/quotes/read.ts";
import { quoteExactInput } from "../../packages/client/src/quotes/curve.ts";
import { executeIx, fundAndStart, injectReturnedControlFixture, roomFixture } from "./support/room.ts";
import { BN, RAYDIUM_ID, setTime, success } from "./support/runtime.ts";
import { balance } from "./support/tokens.ts";
import { patchPool, poolConnection } from "./support/quote.ts";

test("quotes match actual Raydium CPI for both orientations and every creator fee mode", async () => {
  for (const reversed of [false, true]) for (const enabled of [false, true]) for (const mode of [0, 1, 2]) {
    const room = await roomFixture();
    patchPool(room, room.pool.pool, "PoolState", raw => {
      if (reversed) for (const [a, b] of [["token_0_vault", "token_1_vault"], ["token_0_mint", "token_1_mint"], ["mint_0_decimals", "mint_1_decimals"]]) [raw[a], raw[b]] = [raw[b], raw[a]];
      raw.creator_fee_on = mode;
      raw.enable_creator_fee = enabled;
      for (const prefix of ["protocol", "fund", "creator"]) for (const index of [0, 1]) raw[`${prefix}_fees_token_${index}`] = new BN(12345 + index);
    });
    patchPool(room, room.pool.ammConfig, "AmmConfig", raw => { raw.creator_fee_rate = new BN(1000); });
    await fundAndStart(room);
    const pool = await readQuotePool(poolConnection(room), room.pool.pool, 50);
    assert.equal(pool.inputReserve, 100_000_000_000n - 3n * BigInt(reversed ? 12346 : 12345));
    assert.equal(pool.creatorFeeOnInput, mode === 0 || mode === (reversed ? 2 : 1));
    assert.equal(pool.creatorFeeRate, enabled ? 1000n : 0n);
    const quoted = quoteExactInput(pool, 997_500n);
    await injectReturnedControlFixture(room, 1, [quoted.output, 0n, 0n, 0n]);
    setTime(room.svm, 1002n);
    const before = balance(room.svm, room.pool.poolUsdcVault);
    success(room.svm, [await executeIx(room)], [room.players[0]]);
    assert.equal(balance(room.svm, room.usdcVault), quoted.output, `orientation=${reversed} enabled=${enabled} mode=${mode}`);
    assert.equal(before - balance(room.svm, room.pool.poolUsdcVault), quoted.output);
  }
});

test("pool reads reject unsafe venue state and preserve coherent read requirements", async () => {
  const mutations = [
    (room: Awaited<ReturnType<typeof roomFixture>>) => patchPool(room, room.pool.pool, "PoolState", raw => { raw.status = 4; }),
    (room: Awaited<ReturnType<typeof roomFixture>>) => patchPool(room, room.pool.pool, "PoolState", raw => { raw.open_time = new BN(1001); }),
    (room: Awaited<ReturnType<typeof roomFixture>>) => patchPool(room, room.pool.pool, "PoolState", raw => { raw.token_0_program = TOKEN_2022_PROGRAM_ID; }),
    (room: Awaited<ReturnType<typeof roomFixture>>) => patchPool(room, room.pool.pool, "PoolState", raw => { raw.auth_bump = 0; }),
    (room: Awaited<ReturnType<typeof roomFixture>>) => patchPool(room, room.pool.pool, "PoolState", raw => { raw.fund_fees_token_0 = new BN("100000000001"); }),
    (room: Awaited<ReturnType<typeof roomFixture>>) => patchPool(room, room.pool.observation, "ObservationState", raw => { raw.pool_id = Keypair.generate().publicKey; }),
  ];
  for (const mutate of mutations) {
    const room = await roomFixture();
    mutate(room);
    await assert.rejects(readQuotePool(poolConnection(room), room.pool.pool));
  }
  for (const target of ["pool", "ammConfig", "poolWsolVault", "poolUsdcVault", "observation", "mint", "program", "clock"] as const) {
    const room = await roomFixture();
    const address = target === "mint" ? NATIVE_MINT : target === "program" ? RAYDIUM_ID : target === "clock" ? SYSVAR_CLOCK_PUBKEY : room.pool[target];
    const account = room.svm.getAccount(address)!;
    room.svm.setAccount(address, { ...account, owner: Keypair.generate().publicKey, executable: false });
    await assert.rejects(readQuotePool(poolConnection(room), room.pool.pool), target);
  }
  const room = await roomFixture();
  const connection = poolConnection(room);
  const read = connection.getMultipleAccountsInfoAndContext.bind(connection);
  connection.getMultipleAccountsInfoAndContext = async (keys, options) => {
    assert.deepEqual(options, { commitment: "confirmed", minContextSlot: 50 });
    patchPool(room, room.pool.pool, "PoolState", raw => { raw.amm_config = Keypair.generate().publicKey; });
    return read(keys, options);
  };
  await assert.rejects(readQuotePool(connection, room.pool.pool, 50), /changed/);
});
