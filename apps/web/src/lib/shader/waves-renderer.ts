import { FRAGMENT_SOURCE, VERTEX_SOURCE } from "./waves-program.ts";
import { COLORS, COLOR_COUNT, TIME_SCALE, UNIFORMS } from "./waves-settings.ts";

export type WavesRenderer = ReturnType<typeof createWavesRenderer>;

export function createWavesRenderer(gl: WebGLRenderingContext) {
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const shader of shaders) gl.deleteShader(shader);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
  };
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Shader allocation failed");
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Shader compilation failed");
    return shader;
  };
  try {
    program = gl.createProgram();
    if (!program) throw new Error("Shader program allocation failed");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SOURCE));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Shader linking failed");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    if (!buffer) throw new Error("Shader buffer allocation failed");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    if (position < 0) throw new Error("Shader position is unavailable");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name: string) => {
      const location = gl.getUniformLocation(program!, name);
      if (location === null) throw new Error("Shader uniform is unavailable");
      return location;
    };
    gl.uniform3fv(uniform("u_colors[0]"), COLORS);
    for (const [name, values] of Object.entries(UNIFORMS)) gl.uniform4f(uniform(name), values[0], values[1], values[2], values[3]);
    const scene = uniform("u_scene");
    const limits = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const maximum = Math.min(limits[0], limits[1], gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
    return {
      maximum,
      render(width: number, height: number, time: number) {
        if (disposed || gl.isContextLost()) return false;
        gl.viewport(0, 0, width, height);
        gl.uniform4f(scene, width, height, time * TIME_SCALE, COLOR_COUNT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return true;
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
