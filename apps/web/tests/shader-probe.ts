import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __flinchShaderProbe: { draws: number; time: number; sample: boolean; signature: number; colors: number };
    __flinchLostContext?: WEBGL_lose_context | null;
  }
}

export async function installShaderProbe(page: Page) {
  await page.addInitScript(() => {
    const probe = { draws: 0, time: 0, sample: false, signature: 0, colors: 0 };
    window.__flinchShaderProbe = probe;
    const uniforms = new WeakSet<WebGLUniformLocation>();
    const uniform = WebGLRenderingContext.prototype.getUniformLocation;
    WebGLRenderingContext.prototype.getUniformLocation = function(program, name) {
      const location = uniform.call(this, program, name);
      if (location && name === "u_scene") uniforms.add(location);
      return location;
    };
    const vector = WebGLRenderingContext.prototype.uniform4f;
    WebGLRenderingContext.prototype.uniform4f = function(location, x, y, z, w) {
      if (location && uniforms.has(location)) probe.time = z;
      return vector.call(this, location, x, y, z, w);
    };
    const vector3 = WebGLRenderingContext.prototype.uniform3f;
    WebGLRenderingContext.prototype.uniform3f = function(location, x, y, z) {
      if (location && uniforms.has(location)) probe.time = z;
      return vector3.call(this, location, x, y, z);
    };
    const draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function(mode, first, count) {
      draw.call(this, mode, first, count);
      if (!(this.canvas instanceof HTMLCanvasElement) || !this.canvas.matches(".footer-shader, .footer-hand-current")) return;
      probe.draws++;
      if (!probe.sample) return;
      probe.sample = false;
      const pixels = new Uint8Array(this.drawingBufferWidth * 4);
      this.readPixels(0, Math.floor(this.drawingBufferHeight / 2), this.drawingBufferWidth, 1, this.RGBA, this.UNSIGNED_BYTE, pixels);
      let signature = 2166136261;
      const colors = new Set<number>();
      for (let i = 0; i < pixels.length; i++) signature = Math.imul(signature ^ pixels[i], 16777619);
      for (let i = 0; i < pixels.length; i += 4) colors.add(pixels[i] * 65536 + pixels[i + 1] * 256 + pixels[i + 2]);
      probe.signature = signature >>> 0;
      probe.colors = colors.size;
    };
  });
}
