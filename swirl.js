/*
 * Animated swirling background, drawn with a small WebGL shader.
 * Same effect as the quiz app. Change COLOURS (red, green, blue from 0 to 1),
 * PIXEL_SIZE (bigger = chunkier) or SPEED to taste.
 */
(function () {
  const COLOURS = {
    a: [0.78, 0.2, 0.24], // warm red
    b: [0.13, 0.36, 0.66], // deep blue
    c: [0.07, 0.08, 0.13], // near-black ink
  };
  const PIXEL_SIZE = 4;
  const SPEED = 1;

  const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

  const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uA, uB, uC;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float r = length(uv);
  float t = uTime * 0.12;
  float ang = atan(uv.y, uv.x) + 2.2 * r - t;
  vec2 p = vec2(cos(ang), sin(ang)) * r * 3.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    p += 0.55 * vec2(sin(p.y * 1.3 + t * 2.0 + fi), cos(p.x * 1.1 - t * 1.6 + fi * 1.7));
  }
  float bands = sin(p.x + p.y) * 0.5 + 0.5;
  float ink = sin(length(p) * 1.4 - t * 3.0) * 0.5 + 0.5;
  vec3 col = mix(uA, uB, smoothstep(0.25, 0.75, bands));
  col = mix(col, uC, smoothstep(0.5, 0.95, ink) * 0.75);
  col *= 1.0 - 0.45 * smoothstep(0.35, 1.1, r);
  col = floor(col * 12.0 + 0.5) / 12.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

  const canvas = document.getElementById('background');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return; // The CSS gradient on <body> shows instead.

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  const program = gl.createProgram();
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader failed to link');
  } catch (err) {
    console.warn('Background disabled:', err);
    return;
  }
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'uRes');
  const uTime = gl.getUniformLocation(program, 'uTime');
  gl.uniform3fv(gl.getUniformLocation(program, 'uA'), COLOURS.a);
  gl.uniform3fv(gl.getUniformLocation(program, 'uB'), COLOURS.b);
  gl.uniform3fv(gl.getUniformLocation(program, 'uC'), COLOURS.c);

  function draw(seconds) {
    const w = Math.max(1, Math.ceil(window.innerWidth / PIXEL_SIZE));
    const h = Math.max(1, Math.ceil(window.innerHeight / PIXEL_SIZE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, seconds * SPEED);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const start = performance.now();
  let frame = 0;

  function loop(now) {
    draw((now - start) / 1000);
    frame = requestAnimationFrame(loop);
  }

  function startOrStop() {
    cancelAnimationFrame(frame);
    if (reducedMotion.matches || document.hidden) draw(20); // a single still frame
    else frame = requestAnimationFrame(loop);
  }

  startOrStop();
  window.addEventListener('resize', startOrStop);
  document.addEventListener('visibilitychange', startOrStop);
  reducedMotion.addEventListener('change', startOrStop);
})();
