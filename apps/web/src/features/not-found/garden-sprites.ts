export type Pixel = readonly [number, number];

export function housePixels(): Pixel[] {
  const pixels: Pixel[] = [];
  for (let y = 0; y < 42; y++) {
    for (let x = 0; x < 48; x++) {
      const roof = y >= 11 && y <= 23 && Math.abs(x - 24) <= y - 11;
      const chimney = x >= 17 && x <= 19 && y >= 9 && y <= 19;
      const body = x >= 15 && x <= 33 && y >= 23 && y <= 40;
      const window = ((x >= 19 && x <= 22) || (x >= 26 && x <= 29)) && ((y >= 27 && y <= 30) || (y >= 34 && y <= 37));
      const fence = ((x >= 1 && x <= 10) || (x >= 39 && x <= 47)) && y >= 31 && y <= 40 && (x % 3 === 0 || y === 34 || y === 37);
      if (roof || chimney || (body && !window) || fence) pixels.push([x, y]);
    }
  }
  return pixels;
}

export function flowerPixels(variant: number): Pixel[] {
  const pixels: Pixel[] = [];
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 22; x++) {
      const dx = x - 10;
      const dy = y - 7;
      const radius = dx * dx + dy * dy;
      const stem = x === 10 && y >= 14 && y <= 27;
      const leaf = (x >= 5 && x <= 8 && y === 20 + (x - 5)) || (x >= 12 && x <= 15 && y === 25 - (x - 12));
      const round = (radius >= 35 && radius <= 53) || (radius >= 3 && radius <= 8);
      const tulip = (y === 4 && x >= 3 && x <= 17) || (y >= 5 && y <= 10 && (x === 3 + Math.floor((y - 5) / 2) || x === 17 - Math.floor((y - 5) / 2))) || (y === 11 && x >= 6 && x <= 14) || (x === 10 && y >= 11 && y <= 14);
      const wild = (Math.abs(dx) === 4 && (y === 3 || y === 4 || y === 10 || y === 11)) || (Math.abs(dx) === 5 && (y === 4 || y === 10)) || (Math.abs(dx) <= 1 && y >= 6 && y <= 8) || (x === 10 && y >= 11 && y <= 14);
      if (stem || leaf || (variant % 3 === 0 ? round : variant % 3 === 1 ? tulip : wild)) pixels.push([x, y]);
    }
  }
  return pixels;
}

export function pixelPath(pixels: readonly Pixel[], step = 3): string {
  return pixels.map(([x, y]) => `M${x * step} ${y * step}h1.6v1.6h-1.6Z`).join("");
}
