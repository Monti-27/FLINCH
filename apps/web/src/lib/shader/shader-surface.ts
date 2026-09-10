import { createWavesRenderer } from "./waves-renderer.ts";
import type { WavesRenderer } from "./waves-renderer.ts";
import { drawingSize, FRAME_INTERVAL } from "./waves-settings.ts";

const pendingReleases = new WeakMap<HTMLCanvasElement, number>();

export function createShaderSurface(canvas: HTMLCanvasElement, options: {
  createRenderer?: (gl: WebGLRenderingContext) => WavesRenderer;
  frameInterval?: number;
  pixelRatio?: number;
} = {}) {
  window.clearTimeout(pendingReleases.get(canvas));
  pendingReleases.delete(canvas);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let renderer: WavesRenderer | null = null;
  let gl: WebGLRenderingContext | null = null;
  let raf = 0;
  let time = 0;
  let lastFrame: number | null = null;
  let inView = false;
  let paused = true;
  let disposed = false;
  let unavailable = false;
  let dirty = true;
  let bounds = canvas.getBoundingClientRect();
  canvas.dataset.state = "loading";

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = null;
  }

  function request() {
    if (!disposed && !unavailable && inView && document.visibilityState === "visible" && raf === 0) raf = requestAnimationFrame(render);
  }

  function render(now: number) {
    raf = 0;
    if (disposed || unavailable || !inView || document.visibilityState !== "visible") return;
    const animated = !paused && !motion.matches;
    if (!dirty && lastFrame !== null && now - lastFrame < (options.frameInterval ?? FRAME_INTERVAL)) {
      request();
      return;
    }
    try {
      if (!renderer) {
        gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
        if (!gl) throw new Error("WebGL is unavailable");
        renderer = (options.createRenderer ?? createWavesRenderer)(gl);
      }
      const size = drawingSize(bounds.width, bounds.height, options.pixelRatio ?? window.devicePixelRatio, renderer.maximum);
      if (canvas.width !== size.width) canvas.width = size.width;
      if (canvas.height !== size.height) canvas.height = size.height;
      if (animated && lastFrame !== null) time += Math.min((now - lastFrame) / 1000, 0.1);
      if (renderer.render(size.width, size.height, time)) canvas.dataset.state = "ready";
      dirty = false;
      lastFrame = animated ? now : null;
      if (animated) request();
    } catch {
      unavailable = true;
      renderer?.dispose();
      renderer = null;
      canvas.dataset.state = "unavailable";
      stop();
    }
  }

  function resize() {
    bounds = canvas.getBoundingClientRect();
    dirty = true;
    request();
  }

  function synchronize() {
    stop();
    dirty = true;
    request();
  }

  function lost(event: Event) {
    event.preventDefault();
    stop();
    renderer?.dispose();
    renderer = null;
    unavailable = true;
    canvas.dataset.state = "context-lost";
  }

  function restored() {
    unavailable = false;
    synchronize();
  }

  const sizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting === true;
    synchronize();
  });
  sizeObserver.observe(canvas);
  intersectionObserver.observe(canvas);
  motion.addEventListener("change", synchronize);
  document.addEventListener("visibilitychange", synchronize);
  window.addEventListener("resize", resize);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);

  return {
    invalidate() { dirty = true; request(); },
    setPaused(value: boolean) {
      if (paused === value) return;
      paused = value;
      synchronize();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      sizeObserver.disconnect();
      intersectionObserver.disconnect();
      motion.removeEventListener("change", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      renderer?.dispose();
      const release = window.setTimeout(() => {
        if (pendingReleases.get(canvas) !== release) return;
        pendingReleases.delete(canvas);
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.width = 1;
        canvas.height = 1;
      }, 0);
      pendingReleases.set(canvas, release);
    },
  };
}
