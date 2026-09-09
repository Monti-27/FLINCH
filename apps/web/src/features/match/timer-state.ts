export const ROUND_DURATION_MS = 90_000;
export const DIAL_TICKS = 72;
export const DIAL_INNER_RADIUS = 29;
export const DIAL_REST_LENGTH = 11;
export const DIAL_ACTIVE_LENGTH = 14;

export function boundedTime(milliseconds: bigint) {
  return Number(milliseconds < 0n ? 0n : milliseconds > BigInt(ROUND_DURATION_MS) ? BigInt(ROUND_DURATION_MS) : milliseconds);
}

export function estimatedTime(startedAt: bigint, chainNow: bigint, observedAt: number, wallTime: number) {
  const elapsed = BigInt(Math.max(0, Math.trunc(wallTime - observedAt)));
  return boundedTime((startedAt - chainNow) * 1000n + BigInt(ROUND_DURATION_MS) - elapsed);
}

export function tickFill(progress: number, index: number) {
  return Math.max(0, Math.min(1, progress * DIAL_TICKS - index));
}

export function tickLength(progress: number, index: number) {
  const fill = tickFill(progress, index);
  const distance = progress * DIAL_TICKS - index - .5;
  const taper = Math.min(1, progress * 12, (1 - progress) * 12);
  const ripple = Math.sin(distance * 1.15) * Math.exp(-distance * distance / 16) * 2.5 * taper;
  return DIAL_REST_LENGTH + (DIAL_ACTIVE_LENGTH - DIAL_REST_LENGTH) * fill + ripple;
}

export function dialColor(progress: number) {
  if (progress <= .18) return "var(--dial-amber)";
  if (progress < .3) return `color-mix(in srgb, var(--dial-green) ${(progress - .18) / .12 * 100}%, var(--dial-amber))`;
  if (progress <= .72) return "var(--dial-green)";
  if (progress < .84) return `color-mix(in srgb, var(--dial-blue) ${(progress - .72) / .12 * 100}%, var(--dial-green))`;
  return "var(--dial-blue)";
}
