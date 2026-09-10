import { expect, it, vi } from "vitest";
import { createWavesRenderer } from "../src/lib/shader/waves-renderer.ts";
import { COLORS, drawingSize, PIXEL_BUDGET } from "../src/lib/shader/waves-settings.ts";
import { createHandFlowRenderer } from "../src/lib/shader/hand-flow.ts";

function context(fail?: string) {
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, MAX_VIEWPORT_DIMS: 9, MAX_RENDERBUFFER_SIZE: 10,
    createShader: vi.fn(() => fail === "shader" ? null : {}),
    createProgram: vi.fn(() => fail === "program" ? null : {}),
    createBuffer: vi.fn(() => fail === "buffer" ? null : {}),
    shaderSource: vi.fn(), compileShader: vi.fn(), attachShader: vi.fn(), linkProgram: vi.fn(),
    deleteShader: vi.fn(), deleteBuffer: vi.fn(), deleteProgram: vi.fn(),
    getShaderParameter: vi.fn(() => fail !== "compile"),
    getProgramParameter: vi.fn(() => fail !== "link"),
    getAttribLocation: vi.fn(() => fail === "position" ? -1 : 0),
    getUniformLocation: vi.fn(() => fail === "uniform" ? null : {}),
    getParameter: vi.fn((name: number) => name === 9 ? new Int32Array([4096, 4096]) : 4096),
    useProgram: vi.fn(), bindBuffer: vi.fn(), bufferData: vi.fn(), enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(), uniform3fv: vi.fn(), uniform4f: vi.fn(), uniform3f: vi.fn(), uniform1f: vi.fn(), viewport: vi.fn(), drawArrays: vi.fn(),
    isContextLost: vi.fn(() => false),
  };
  return { calls: gl, gl: gl as unknown as WebGLRenderingContext };
}

it("preserves the supplied four-color Waves recipe", () => {
  expect(COLORS).toHaveLength(24);
  expect(COLORS[0]).toBeCloseTo(3 / 255);
  expect(COLORS[11]).toBe(1);
  expect([...COLORS.slice(12, 15)]).toEqual([...COLORS.slice(9, 12)]);
});

it.each([-1, 1])("renders inward hand waves with direction %s and the supplied theme", direction => {
  const { gl, calls } = context();
  const palette = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.2, 0.3, 0.4], [0.6, 0.7, 0.8]];
  const renderer = createHandFlowRenderer(gl, palette, direction);
  palette.forEach(color => expect(calls.uniform3fv).toHaveBeenCalledWith(expect.anything(), color));
  expect(calls.uniform1f).toHaveBeenCalledWith(expect.anything(), direction);
  expect(renderer.render(400, 228, 10)).toBe(true);
  expect(calls.uniform3f).toHaveBeenCalledWith(expect.anything(), 400, 228, 10);
  calls.isContextLost.mockReturnValue(true);
  expect(renderer.render(400, 228, 11)).toBe(false);
  renderer.dispose();
  renderer.dispose();
  expect(calls.deleteShader).toHaveBeenCalledTimes(2);
  expect(calls.deleteProgram).toHaveBeenCalledTimes(1);
  expect(calls.deleteBuffer).toHaveBeenCalledTimes(1);
  expect(calls.drawArrays).toHaveBeenCalledTimes(1);
});

it.each(["program", "shader", "compile", "link", "buffer", "position", "uniform"])("cleans up failed hand shader %s allocation", failure => {
  const { gl, calls } = context(failure);
  expect(() => createHandFlowRenderer(gl, Array.from({ length: 4 }, () => [0.5, 0.5, 0.5]), 1)).toThrow();
  expect(calls.deleteProgram).toHaveBeenCalledTimes(failure === "program" ? 0 : 1);
  expect(calls.deleteShader).toHaveBeenCalledTimes(calls.createShader.mock.results.filter(result => result.value !== null).length);
  expect(calls.deleteBuffer).toHaveBeenCalledTimes(calls.createBuffer.mock.results.filter(result => result.value !== null).length);
  expect(calls.drawArrays).not.toHaveBeenCalled();
});

it("refreshes a changed hand palette without resetting motion or allocating another renderer", () => {
  const { gl, calls } = context();
  let palette = Array.from({ length: 4 }, () => [0.1, 0.2, 0.3]);
  const renderer = createHandFlowRenderer(gl, () => palette, 1);
  renderer.render(400, 228, 10);
  expect(calls.uniform3fv).toHaveBeenCalledTimes(4);
  palette = Array.from({ length: 4 }, () => [0.7, 0.8, 0.9]);
  renderer.render(400, 228, 11);
  expect(calls.uniform3fv).toHaveBeenCalledTimes(8);
  expect(calls.uniform3fv).toHaveBeenLastCalledWith(expect.anything(), palette[3]);
  expect(calls.uniform3f).toHaveBeenLastCalledWith(expect.anything(), 400, 228, 11);
  expect(calls.createProgram).toHaveBeenCalledTimes(1);
  renderer.dispose();
});

it.each([[375, 620, 3], [768, 540, 2], [1280, 550, 2], [1920, 720, 2], [3840, 2160, 4], [0, 0, 0], [NaN, Infinity, NaN]])(
  "bounds the drawing buffer for %s × %s at DPR %s", (width, height, dpr) => {
    const size = drawingSize(width, height, dpr);
    expect(size.width * size.height).toBeLessThanOrEqual(PIXEL_BUDGET);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
    expect(size.width).toBeLessThanOrEqual(4096);
    expect(size.height).toBeLessThanOrEqual(4096);
  },
);

it("honors device limits and preserves the aspect ratio", () => {
  expect(drawingSize(2000, 1000, 2, 1024)).toEqual({ width: 1024, height: 512 });
});

it("compiles, binds the supplied uniforms and renders the triangle", () => {
  const { gl, calls } = context();
  const renderer = createWavesRenderer(gl);
  expect(renderer.render(800, 400, 10)).toBe(true);
  expect(calls.viewport).toHaveBeenCalledWith(0, 0, 800, 400);
  expect(calls.uniform4f).toHaveBeenLastCalledWith(expect.anything(), 800, 400, -7.27, 4);
  expect(calls.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 3);
  renderer.dispose();
  renderer.dispose();
  expect(calls.deleteShader).toHaveBeenCalledTimes(2);
  expect(calls.deleteBuffer).toHaveBeenCalledTimes(1);
  expect(calls.deleteProgram).toHaveBeenCalledTimes(1);
  expect(renderer.render(800, 400, 20)).toBe(false);
  expect(calls.drawArrays).toHaveBeenCalledTimes(1);
});

it.each(["program", "shader", "compile", "link", "buffer", "position", "uniform"])("rolls back allocations after %s failure", failure => {
  const { gl, calls } = context(failure);
  expect(() => createWavesRenderer(gl)).toThrow();
  expect(calls.deleteProgram).toHaveBeenCalledTimes(failure === "program" ? 0 : 1);
  const allocated = calls.createShader.mock.results.filter(result => result.value !== null).length;
  expect(calls.deleteShader).toHaveBeenCalledTimes(allocated);
  const buffers = calls.createBuffer.mock.results.filter(result => result.value !== null).length;
  expect(calls.deleteBuffer).toHaveBeenCalledTimes(buffers);
  expect(calls.drawArrays).not.toHaveBeenCalled();
});

it("never draws while the context is lost", () => {
  const { gl, calls } = context();
  const renderer = createWavesRenderer(gl);
  calls.isContextLost.mockReturnValue(true);
  expect(renderer.render(800, 400, 1)).toBe(false);
  expect(calls.drawArrays).not.toHaveBeenCalled();
  renderer.dispose();
});
