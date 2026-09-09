import styles from "./hero.module.css";

const holders = [120, 360, 600];

function Holder({ x }: { x: number }) {
  return <g transform={`translate(${x} 0)`} data-hero-player="hold">
    <circle cx="0" cy="88" r="25" />
    <path d="M-18 124H18L36 143L42 198H24L18 158V216L23 264H3L0 221L-3 264H-23L-18 216V158L-24 198H-42L-36 143Z" />
  </g>;
}

export function HeroStandoff() {
  return <figure className={styles.scene} data-hero-art="standoff" aria-label="Dot-matrix illustration: one of four players steps away while three hold their position.">
    <svg className={styles.art} viewBox="0 40 960 240" role="img" aria-labelledby="standoff-title" focusable="false">
      <title id="standoff-title">Four equal players. One chooses to sell; three keep holding.</title>
      <defs>
        <pattern id="standoff-field" className={styles.field} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r=".7" fill="currentColor" />
        </pattern>
        <pattern id="standoff-dots" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect x="1.5" y="1.5" width="3" height="3" rx=".4" fill="currentColor" />
        </pattern>
        <pattern id="standoff-dots-compact" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect x="2" y="2" width="4" height="4" rx=".4" fill="currentColor" />
        </pattern>
      </defs>
      <g className={styles.field} fill="url(#standoff-field)">
        <path d="M0 40H960V76H0Z" opacity=".1" />
        <path d="M0 76H960V244H0Z" opacity=".2" />
        <path d="M0 244H960V280H0Z" opacity=".1" />
      </g>
      <g className={styles.formation} fill="url(#standoff-dots)">
        {holders.map(x => <Holder key={x} x={x} />)}
      </g>
      <g transform="translate(94.5 0)">
        <g className={styles.departure} data-hero-player="sell" fill="url(#standoff-dots)">
          <circle cx="752" cy="82" r="25" />
          <path d="M731 117L763 129L779 159L808 153L812 170L769 183L753 160L743 204L780 243L766 261L724 219L700 264H679L711 193L719 155L695 177L683 163Z" />
        </g>
      </g>
    </svg>
    <figcaption className={styles.legend} aria-hidden="true"><span>Hold</span><span>Hold</span><span>Hold</span><span>Sell</span></figcaption>
  </figure>;
}
