import { afterEach, expect, it, vi } from "vitest";
import { createShaderSurface } from "../src/lib/shader/shader-surface.ts";

const { render, release, create } = vi.hoisted(() => {
  const render = vi.fn(() => true);
  const release = vi.fn();
  return { render, release, create: vi.fn(() => ({ render, maximum: 4096, dispose: release })) };
});
vi.mock("../src/lib/shader/waves-renderer.ts", () => ({ createWavesRenderer: create }));

function environment() {
  vi.useFakeTimers();
  const frames = new Map<number, FrameRequestCallback>();
  let next = 1;
  const motion = Object.assign(new EventTarget(), { matches: false });
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const window = Object.assign(new EventTarget(), {
    devicePixelRatio: 2, matchMedia: () => motion, setTimeout, clearTimeout,
  });
  const loseContext = vi.fn();
  const canvas = Object.assign(new EventTarget(), {
    width: 300, height: 150, dataset: {} as Record<string, string>,
    getContext: vi.fn(() => ({ getExtension: () => ({ loseContext }) })),
    getBoundingClientRect: () => ({ width: 1280, height: 550 }),
  });
  let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(next, callback); return next++; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect = disconnect; });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe() {}
    disconnect = disconnect;
  });
  return {
    canvas, frames, motion, document, loseContext, disconnect,
    mount: () => createShaderSurface(canvas as unknown as HTMLCanvasElement),
    show: (visible: boolean) => intersect([{ isIntersecting: visible }]),
    tick(now: number) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(now);
    },
  };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks(); });

it("allocates lazily, caps frame cadence and stops when offscreen", () => {
  const env = environment();
  const surface = env.mount();
  surface.setPaused(false);
  expect(env.canvas.getContext).not.toHaveBeenCalled();
  expect(env.frames.size).toBe(0);
  env.show(true);
  env.tick(0);
  env.tick(10);
  expect(render).toHaveBeenCalledTimes(1);
  env.tick(40);
  expect(render).toHaveBeenCalledTimes(2);
  env.show(false);
  expect(env.frames.size).toBe(0);
  env.show(true);
  env.tick(20_000);
  expect(render.mock.calls.at(-1)).toEqual(render.mock.calls.at(-2));
  surface.dispose();
});

it("freezes on manual and system pause without losing the current frame", () => {
  const env = environment();
  const surface = env.mount();
  surface.setPaused(false);
  env.show(true);
  env.tick(0);
  env.tick(40);
  surface.setPaused(true);
  env.tick(80);
  expect(env.frames.size).toBe(0);
  surface.setPaused(false);
  env.motion.matches = true;
  env.motion.dispatchEvent(new Event("change"));
  env.tick(1000);
  expect(env.frames.size).toBe(0);
  expect(render.mock.calls.at(-1)).toEqual(render.mock.calls.at(-2));
  env.motion.matches = false;
  env.motion.dispatchEvent(new Event("change"));
  env.tick(2000);
  expect(env.frames.size).toBe(1);
  surface.dispose();
});

it("stops in a hidden document and safely removes resources on repeated cleanup", () => {
  const env = environment();
  const surface = env.mount();
  surface.setPaused(false);
  env.show(true);
  env.tick(0);
  env.document.visibilityState = "hidden";
  env.document.dispatchEvent(new Event("visibilitychange"));
  expect(env.frames.size).toBe(0);
  surface.dispose();
  surface.dispose();
  env.document.visibilityState = "visible";
  env.document.dispatchEvent(new Event("visibilitychange"));
  env.motion.dispatchEvent(new Event("change"));
  expect(env.frames.size).toBe(0);
  expect(env.disconnect).toHaveBeenCalledTimes(2);
  expect(release).toHaveBeenCalledTimes(1);
  vi.runAllTimers();
  expect(env.loseContext).toHaveBeenCalledTimes(1);
  expect(env.canvas.width).toBe(1);
});

it("cancels deferred context release when React remounts the same canvas", () => {
  const env = environment();
  const first = env.mount();
  env.show(true);
  env.tick(0);
  first.dispose();
  const second = env.mount();
  vi.runAllTimers();
  expect(env.loseContext).not.toHaveBeenCalled();
  env.show(true);
  env.tick(10);
  expect(env.canvas.dataset.state).toBe("ready");
  second.dispose();
  vi.runAllTimers();
  expect(env.loseContext).toHaveBeenCalledTimes(1);
});

it("stops scheduling when renderer initialization fails", () => {
  const env = environment();
  create.mockImplementationOnce(() => { throw new Error("GPU unavailable"); });
  const surface = env.mount();
  surface.setPaused(false);
  env.show(true);
  env.tick(0);
  expect(env.canvas.dataset.state).toBe("unavailable");
  expect(env.frames.size).toBe(0);
  surface.setPaused(true);
  surface.setPaused(false);
  expect(env.frames.size).toBe(0);
  surface.dispose();
});
