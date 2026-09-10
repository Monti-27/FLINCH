import type { ShaderController, SweepHandle } from "glimm";
import type { LandingTheme } from "./preference.ts";

export function startThemeSweep(canvas: HTMLCanvasElement, theme: LandingTheme, apply: () => void, finish: () => void) {
  let controller: ShaderController | null = null;
  let sweep: SweepHandle | null = null;
  let disposed = false;
  let applied = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const commit = () => {
    if (disposed || applied) return;
    applied = true;
    apply();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(watchdog);
    sweep?.cancel();
    controller?.destroy();
    canvas.hidden = true;
    motion.removeEventListener("change", interrupt);
    document.removeEventListener("visibilitychange", interrupt);
    canvas.removeEventListener("webglcontextlost", lost);
    finish();
  };
  const complete = () => { commit(); dispose(); };
  const interrupt = () => { if (motion.matches || document.hidden) complete(); };
  const lost = (event: Event) => { event.preventDefault(); complete(); };
  motion.addEventListener("change", interrupt);
  document.addEventListener("visibilitychange", interrupt);
  canvas.addEventListener("webglcontextlost", lost);
  if (motion.matches || document.hidden) {
    complete();
    return dispose;
  }
  watchdog = setTimeout(complete, 1800);
  void import("glimm").then(({ createShader, playSweep }) => {
    if (disposed) return;
    canvas.hidden = false;
    controller = createShader({ canvas });
    if (!controller) { complete(); return; }
    sweep = playSweep(controller, {
      palette: "prism", direction: theme === "dark" ? "rtl" : "ltr",
      sweepMs: 650, outroMs: 180, midpoint: 0.5, easing: "easeInOutCubic",
      brightness: theme === "dark" ? 0.85 : 1, bandTight: 10, peakAlpha: 1,
      onMidpoint: commit, onComplete: dispose,
    });
  }).catch(complete);
  return dispose;
}
