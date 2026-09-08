import { BRAND_PATHS, BRAND_VIEW_BOX } from "./geometry.ts";

export function BrandMark({ className = "", label }: { className?: string; label?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={BRAND_VIEW_BOX} width={224} height={264}
    className={`brand-mark ${className}`.trim()} fill="currentColor" focusable="false"
    role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {BRAND_PATHS.map(d => <path key={d} d={d} />)}
  </svg>;
}

export function BrandLogo({ className = "" }: { className?: string }) {
  return <span className={`brand-logo ${className}`.trim()}><BrandMark /><span className="brand-name">flinch</span></span>;
}
