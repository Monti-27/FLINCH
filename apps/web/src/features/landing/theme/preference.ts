export type LandingTheme = "light" | "dark";

export const THEME_KEY = "flinch:landing-theme";
export const THEME_ROOT = "landing-theme";

export function parseTheme(value: string | null | undefined): LandingTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolveTheme(preference: LandingTheme | null, darkSystem: boolean): LandingTheme {
  return preference ?? (darkSystem ? "dark" : "light");
}

export function readTheme(): LandingTheme | null {
  try { return parseTheme(localStorage.getItem(THEME_KEY)); } catch { return null; }
}

export function saveTheme(theme: LandingTheme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

export const themeBootstrap = `(()=>{let p;try{p=localStorage.getItem("${THEME_KEY}")}catch{}const t=p==="dark"||p==="light"?p:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.getElementById("${THEME_ROOT}").dataset.landingTheme=t})()`;
