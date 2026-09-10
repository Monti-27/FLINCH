import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Keypair, PublicKey } from "@solana/web3.js";
import { legacyRoomDestination, readRoomLink, roomAddress, roomLink } from "../src/lib/room-link.ts";
import { createRoomInviteStore } from "../src/stores/room-invite-store.ts";
import { RoomInvite } from "../src/components/shell/room-invite.tsx";

const address = Keypair.generate().publicKey.toBase58();
const origin = "http://127.0.0.1:3400";
afterEach(() => vi.useRealTimers());

it("shares only the app origin and canonical public room address", () => {
  expect(roomLink(`${origin}/path?token=private&room=old#secret`, address)).toBe(`${origin}/play?room=${address}`);
  expect(roomLink(`https://user:password@example.test/path`, address)).toBe(`https://example.test/play?room=${address}`);
  for (const value of ["", "invalid", PublicKey.default.toBase58(), address + " ", "a".repeat(2049)]) expect(() => roomAddress(value)).toThrow();
  expect(() => roomLink("file:///private", address)).toThrow();
});

it("opens addresses and same-site links without navigating to an untrusted destination", () => {
  expect(readRoomLink(` ${address} `, origin)).toBe(address);
  expect(readRoomLink(`${origin}/?room=${address}&extra=discarded#discarded`, origin)).toBe(address);
  expect(readRoomLink(`${origin}/play?room=${address}`, origin)).toBe(address);
  for (const link of [`https://other.test/?room=${address}`, `${origin}/path?room=${address}`, `${origin}/?room=${address}&room=${address}`,
    `http://name:password@127.0.0.1:3400/?room=${address}`, "javascript:alert(1)", `${origin}/?room=invalid`, "a".repeat(2049)]) {
    expect(() => readRoomLink(link, origin)).toThrow();
  }
});

it("shows copied only after clipboard success and keeps state isolated by room", async () => {
  const first = createRoomInviteStore(address);
  const second = createRoomInviteStore(address);
  let complete!: () => void;
  const write = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
  const copy = first.getState().copy(origin, write);
  expect(first.getState().status).toBe("copying");
  await first.getState().copy(origin, write);
  expect(write).toHaveBeenCalledTimes(1);
  complete(); await copy;
  expect(first.getState()).toMatchObject({ status: "copied", link: `${origin}/play?room=${address}` });
  expect(second.getState().status).toBe("idle");
});

it("provides a manual link on denial or timeout and ignores late clipboard completion", async () => {
  vi.useFakeTimers();
  const store = createRoomInviteStore(address);
  await store.getState().copy(origin, async () => { throw new Error("Denied"); });
  expect(store.getState().status).toBe("manual");
  let complete!: () => void;
  const pending = store.getState().copy(origin, () => new Promise(resolve => { complete = resolve; }));
  await vi.advanceTimersByTimeAsync(5000); await pending;
  expect(store.getState().status).toBe("manual");
  complete(); await Promise.resolve();
  expect(store.getState().status).toBe("manual");
});

it("reset invalidates a pending copy rather than restoring old-room feedback", async () => {
  const store = createRoomInviteStore(address);
  let complete!: () => void;
  const pending = store.getState().copy(origin, () => new Promise(resolve => { complete = resolve; }));
  store.getState().reset(); complete(); await pending;
  expect(store.getState()).toMatchObject({ status: "idle", link: "" });
});

it("renders a native named invite control with no fabricated link or invalid-address action", () => {
  const html = renderToStaticMarkup(<RoomInvite address={address} />);
  expect(html).toContain('aria-label="Copy invite link"');
  expect(html).toContain('type="button"');
  expect(html).toContain('role="status"');
  expect(html).not.toContain("?room=");
  expect(renderToStaticMarkup(<RoomInvite address="invalid" />)).toBe("");
});

it("redirects only a single valid legacy room parameter to the fixed arena path", () => {
  expect(legacyRoomDestination(address)).toBe(`/play?room=${address}`);
  for (const value of [undefined, [address, address], "", "invalid", "https://other.test", PublicKey.default.toBase58()]) {
    expect(legacyRoomDestination(value)).toBeUndefined();
  }
});
