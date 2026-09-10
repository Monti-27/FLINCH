const offset = Number(process.env.FLINCH_TEST_PORT_OFFSET ?? 0);
if (!Number.isSafeInteger(offset) || offset < 0 || offset > 30000) throw new Error("Invalid isolated test port offset");
export const ports = { base: 18899 + offset, er: 17799 + offset, router: 16699 + offset, faucet: 19900 + offset,
  dynamic: `${20000 + offset}-${20100 + offset}` };
export const loopback = (port: number, protocol = "http") => `${protocol}://127.0.0.1:${port}`;
