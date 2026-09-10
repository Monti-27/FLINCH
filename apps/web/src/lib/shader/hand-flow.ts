const VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec3 u_scene;
uniform float u_direction;
uniform vec3 u_ink;
uniform vec3 u_coral;
uniform vec3 u_violet;
uniform vec3 u_ice;

void main() {
  vec2 uv = gl_FragCoord.xy / u_scene.xy;
  float x = u_direction > 0.0 ? uv.x : 1.0 - uv.x;
  float time = u_scene.z;
  float bend = sin(uv.y * 5.4 + sin(x * 3.8 - time * 0.24)) * 0.24;
  bend += sin(uv.y * 10.0 - x * 2.4 + time * 0.36) * 0.07;
  float phase = (x + bend) * 7.8 - time * 0.85;
  float warm = 0.5 + 0.5 * sin(phase);
  float cool = 0.5 + 0.5 * sin(phase + 2.0944);
  float violet = 0.5 + 0.5 * sin(phase + 4.1888);
  vec3 color = (u_coral * warm * warm + u_ice * cool * cool + u_violet * violet * violet)
    / (warm * warm + cool * cool + violet * violet);
  float ribbon = smoothstep(0.6, 1.0, 0.5 + 0.5 * sin(phase * 1.7 + uv.y * 3.0));
  gl_FragColor = vec4(mix(color, u_ink, ribbon * 0.3), 1.0);
}
`;

export function handFlowPalette(element: Element) {
  const style = getComputedStyle(element);
  return ["silver", "coral", "violet", "ice"].map(name => {
    const color = style.getPropertyValue(`--hand-${name}`).trim();
    if (!/^#[a-f\d]{6}$/i.test(color)) throw new Error("Invalid hand palette");
    return [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);
  });
}

export function createHandFlowRenderer(gl: WebGLRenderingContext, palette: number[][] | (() => number[][]), direction: number) {
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    shaders.forEach(shader => gl.deleteShader(shader));
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
  };
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Hand shader allocation failed");
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Hand shader compilation failed");
    return shader;
  };
  try {
    program = gl.createProgram();
    if (!program) throw new Error("Hand program allocation failed");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Hand shader linking failed");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    if (!buffer) throw new Error("Hand buffer allocation failed");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    if (position < 0) throw new Error("Hand position is unavailable");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name: string) => {
      const location = gl.getUniformLocation(program!, name);
      if (location === null) throw new Error("Hand uniform is unavailable");
      return location;
    };
    const colors = ["ink", "coral", "violet", "ice"].map(name => uniform(`u_${name}`));
    let previousPalette: number[][] | null = null;
    const updatePalette = () => {
      const current = typeof palette === "function" ? palette() : palette;
      if (current === previousPalette) return;
      colors.forEach((color, index) => gl.uniform3fv(color, current[index]));
      previousPalette = current;
    };
    updatePalette();
    gl.uniform1f(uniform("u_direction"), direction);
    const scene = uniform("u_scene");
    const limits = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    return {
      maximum: Math.min(limits[0], limits[1], gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number),
      render(width: number, height: number, time: number) {
        if (disposed || gl.isContextLost()) return false;
        updatePalette();
        gl.viewport(0, 0, width, height);
        gl.uniform3f(scene, width, height, time);
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
