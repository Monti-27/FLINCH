export function fundingBudget(size: number, rents: { program: bigint; data: bigint; buffer: bigint }) {
  if (!Number.isSafeInteger(size) || size < 1 || Object.values(rents).some(value => value < 0n)) throw new Error("Invalid deployment budget");
  const fees = BigInt(Math.ceil(size / 900) + 20) * 10_000n;
  const keeper = 300_000_000n;
  const players = 600_000_000n;
  const contingency = 500_000_000n;
  const total = rents.program + rents.data + rents.buffer + fees + keeper + players + contingency;
  return { programRent: rents.program, permanentDataRent: rents.data, temporaryBufferRent: rents.buffer,
    estimatedDeploymentFees: fees, keeperReserve: keeper, fourPlayerReserve: players, contingency,
    total, requested: ((total + 999_999_999n) / 1_000_000_000n) * 1_000_000_000n };
}
