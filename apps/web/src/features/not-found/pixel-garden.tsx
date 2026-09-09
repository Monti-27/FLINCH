"use client";

import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import { flowerPixels, housePixels, pixelPath } from "./garden-sprites.ts";
import { keyboardPosition, plantFlower } from "./garden-state.ts";
import type { Flower } from "./garden-state.ts";
import styles from "./not-found.module.css";

const HOUSE = pixelPath(housePixels());
const FLOWERS = [0, 1, 2].map(variant => pixelPath(flowerPixels(variant)));

export function PixelGarden() {
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const serial = useRef(0);
  const plant = (event: MouseEvent<HTMLButtonElement>) => {
    const id = serial.current++;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.detail === 0 ? keyboardPosition(id) : {
      x: (event.clientX - bounds.left) / bounds.width * 100,
      y: (event.clientY - bounds.top) / bounds.height * 100,
    };
    setFlowers(current => plantFlower(current, id, position.x, position.y));
  };
  return <>
    <button type="button" className={styles.garden} aria-label="Plant a flower" aria-describedby="garden-instructions" onClick={plant}>
      <span className={styles.house} aria-hidden="true">
        <svg viewBox="0 0 144 160" fill="currentColor" focusable="false">
          <g className={styles.smoke}><path d="M52 0h5v5h-5ZM48 12h4v4h-4ZM54 22h3v3h-3Z" /></g>
          <path d={HOUSE} transform="translate(0 30)" />
        </svg>
      </span>
      {flowers.map(flower => <span key={flower.id} className={styles.flower} data-flower={flower.variant} style={{ left: `${flower.x}%`, top: `${flower.y}%` }} aria-hidden="true">
        <svg viewBox="0 0 66 84" fill="currentColor" focusable="false"><path d={FLOWERS[flower.variant]} /></svg>
        <span className={styles.spark} />
      </span>)}
    </button>
    <div className={styles.message}>
      <h1>This page wandered off.</h1>
      <p id="garden-instructions">Nothing here. Plant a few flowers instead.</p>
      <div className={styles.actions}><button type="button" onClick={() => setFlowers([])} disabled={flowers.length === 0}>Clear garden</button><span aria-hidden="true">/</span><a href="/">Back home</a></div>
      <span className="sr-only" role="status" aria-live="polite">{flowers.length > 0 ? `${flowers.length} ${flowers.length === 1 ? "flower" : "flowers"} planted.` : "The garden is empty."}</span>
      <noscript><p>Flower planting needs JavaScript. You can still head back home.</p></noscript>
    </div>
  </>;
}
