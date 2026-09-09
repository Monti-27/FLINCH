export type Flower = { id: number; x: number; y: number; variant: number };
export const MAX_FLOWERS = 48;

export function plantFlower(flowers: readonly Flower[], id: number, x: number, y: number): Flower[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [...flowers];
  const next = { id, x: Math.min(94, Math.max(6, x)), y: Math.min(94, Math.max(22, y)), variant: id % 3 };
  return [...flowers.slice(-(MAX_FLOWERS - 1)), next];
}

export function keyboardPosition(id: number): { x: number; y: number } {
  return { x: 16 + (id * 23 % 68), y: 62 + (id * 11 % 28) };
}
