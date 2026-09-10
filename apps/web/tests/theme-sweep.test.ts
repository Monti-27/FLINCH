import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ShaderController, SweepOptions } from "glimm";
import { startThemeSweep } from "../src/features/landing/theme/sweep.ts";

const glimm = vi.hoisted(() => ({ createShader: vi.fn(), playSweep: vi.fn() }));
vi.mock("glimm", () => glimm);

let motion: EventTarget & { matches: boolean };
let documentState: EventTarget & { hidden: boolean };
let canvas: HTMLCanvasElement;
let options: SweepOptions;
let destroy: ReturnType<typeof vi.fn>;
let cancel: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  motion = Object.assign(new EventTarget(), { matches: false });
  documentState = Object.assign(new EventTarget(), { hidden: false });
  canvas = Object.assign(new EventTarget(), { hidden: true }) as unknown as HTMLCanvasElement;
  vi.stubGlobal("matchMedia", () => motion);
  vi.stubGlobal("document", documentState);
  destroy = vi.fn();
  cancel = vi.fn();
  glimm.createShader.mockReturnValue({ destroy } as unknown as ShaderController);
  glimm.playSweep.mockImplementation((_, value) => { options = value; return { cancel }; });
});

afterEach(() => vi.unstubAllGlobals());

it.each(["dark", "light"] as const)("commits %s exactly at the Glimm midpoint and releases its renderer", async theme => {
  const apply = vi.fn(), finish = vi.fn();
  const stop = startThemeSweep(canvas, theme, apply, finish);
  await vi.dynamicImportSettled();
  expect(apply).not.toHaveBeenCalled();
  expect(canvas.hidden).toBe(false);
  expect(options.direction).toBe(theme === "dark" ? "rtl" : "ltr");
  options.onMidpoint?.();
  options.onMidpoint?.();
  expect(apply).toHaveBeenCalledTimes(1);
  options.onComplete?.();
  stop();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(canvas.hidden).toBe(true);
});

it.each(["motion", "hidden"])("skips allocation for %s", reason => {
  motion.matches = reason === "motion";
  documentState.hidden = reason === "hidden";
  const apply = vi.fn(), finish = vi.fn();
  startThemeSweep(canvas, "dark", apply, finish);
  expect(apply).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(glimm.createShader).not.toHaveBeenCalled();
});

it.each(["motion", "hidden", "context"])("finishes safely after live %s interruption", async reason => {
  const apply = vi.fn(), finish = vi.fn();
  startThemeSweep(canvas, "dark", apply, finish);
  await vi.dynamicImportSettled();
  if (reason === "motion") { motion.matches = true; motion.dispatchEvent(new Event("change")); }
  if (reason === "hidden") { documentState.hidden = true; documentState.dispatchEvent(new Event("visibilitychange")); }
  if (reason === "context") canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  options.onMidpoint?.();
  expect(apply).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledTimes(1);
});

it("switches even when WebGL allocation fails", async () => {
  glimm.createShader.mockReturnValue(null);
  const apply = vi.fn(), finish = vi.fn();
  startThemeSweep(canvas, "dark", apply, finish);
  await vi.dynamicImportSettled();
  expect(apply).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(glimm.playSweep).not.toHaveBeenCalled();
});

it("does not apply a stale change after unmount during lazy loading", async () => {
  const apply = vi.fn(), finish = vi.fn();
  const stop = startThemeSweep(canvas, "dark", apply, finish);
  stop();
  await vi.dynamicImportSettled();
  expect(apply).not.toHaveBeenCalled();
  expect(glimm.createShader).not.toHaveBeenCalled();
});
