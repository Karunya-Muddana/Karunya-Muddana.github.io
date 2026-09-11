/* ============================================================
   Grass 3D — an instanced Three.js meadow above the contact block.

   Each blade is a tapered strip bent along a curve; tens of
   thousands of them go out in one draw call. Wind is three layers
   (a slow sway, rolling gusts from noise, per-blade flutter), all in
   the vertex shader, so there's no per-blade JavaScript per frame.
   The grass parts around the cursor. Distance fades out through an
   ordered-dither stipple, so the field dissolves into the paper like
   pencil shading instead of ending on a hard horizon.

   Three.js only loads once the grass is close to the viewport. If
   WebGL is missing or motion is reduced, the 2D grass (grass.js)
   stays.
   ============================================================ */

const edge = document.querySelector('.grass-edge');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (edge && !reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js')
        .then(start)
        .catch(() => { /* keep the 2D grass */ });
    }
  }, { rootMargin: '700px 0px' });
  io.observe(edge);
}

const VERT = /* glsl */`
  uniform float uTime;
  uniform vec3 uPointer;
  uniform float uPush;
  attribute float aT;
  attribute float aSide;
  attribute vec3 aOffset;
  attribute vec4 aParams;       // height, width, facing angle, seed
  attribute float aTint;
  varying float vT;
  varying float vSide;
  varying float vTint;
  varying float vDist;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    float h = aParams.x, w = aParams.y, ang = aParams.z, seed = aParams.w;
    float t = aT;
    vec2 wp = aOffset.xz;

    // Wind: global sway + rolling gust fronts + per-blade flutter
    float sway = sin(uTime * 0.8 + wp.x * 0.16 + wp.y * 0.1) * 0.22;
    float gust = noise(wp * 0.11 + vec2(uTime * 0.42, uTime * 0.18));
    gust = gust * gust * 1.25;
    float flutter = sin(uTime * 4.6 + seed * 43.0) * 0.06;
    float bend = (seed - 0.5) * 0.7 + sway + gust + flutter;

    // Push away from the cursor
    vec2 toP = wp - uPointer.xz;
    float d = length(toP);
    float push = uPush * (1.0 - smoothstep(0.0, 1.5, d));
    vec2 pushDir = d > 0.001 ? toP / d : vec2(0.0);

    // Bend grows with t², so the base stays planted and the tip travels
    vec2 windDir = normalize(vec2(1.0, 0.3));
    vec2 disp = (windDir * bend + pushDir * push * 1.6) * h * t * t;
    float y = h * t * (1.0 - 0.28 * t * clamp(length(disp) / h, 0.0, 1.0));

    float width = w * (1.0 - t * 0.9);
    vec2 across = vec2(cos(ang), sin(ang));
    vec3 p = aOffset + vec3(across.x * width * aSide + disp.x, y, across.y * width * aSide + disp.y);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vT = t; vSide = aSide; vTint = aTint; vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uBase;
  uniform vec3 uMid;
  uniform vec3 uTip;
  uniform vec3 uPaper;
  uniform float uNear;
  uniform float uFar;
  varying float vT;
  varying float vSide;
  varying float vTint;
  varying float vDist;

  // 4×4 ordered dither, built from 2×2
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    float haze = smoothstep(uNear, uFar, vDist);
    float fade = smoothstep(uFar * 0.75, uFar * 1.1, vDist);
    if (fade > bayer4(gl_FragCoord.xy) * 0.96 + 0.02) discard;

    vec3 col = mix(uBase, uMid, smoothstep(0.0, 0.5, vT));
    col = mix(col, uTip, smoothstep(0.5, 1.0, vT));
    col *= 0.86 + vTint * 0.26;
    col *= 0.92 + 0.08 * vSide;                       // one side catches the light
    col += vec3(0.07, 0.09, 0.02) * smoothstep(0.65, 1.0, vT);   // backlit tips
    col = mix(col, uPaper, haze * 0.88);              // haze toward the paper
    gl_FragColor = vec4(col, 1.0);
  }
`;

const GROUND_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uPaper;
  uniform float uNear;
  uniform float uFar;
  varying float vDist;
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  void main() {
    float haze = smoothstep(uNear, uFar, vDist);
    float fade = smoothstep(uFar * 0.55, uFar * 0.9, vDist);
    if (fade > bayer4(gl_FragCoord.xy) * 0.96 + 0.02) discard;
    gl_FragColor = vec4(mix(uColor, uPaper, haze * 0.88), 1.0);
  }
`;
const GROUND_VERT = /* glsl */`
  varying float vDist;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

// sRGB hex straight into a uniform: these shaders write colour as-is.
const rgb = (hex, THREE) => new THREE.Vector3(
  ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

function start(THREE) {
  // Phones: no MSAA and 1x pixels. The blades are thin and stippled, so
  // the difference is hard to see, but the fragment work drops by half+.
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !coarse, alpha: true, powerPreference: 'low-power' });
  } catch (_) { return; }
  if (!renderer.getContext()) return;

  const canvas = renderer.domElement;
  canvas.className = 'grass-3d';
  canvas.setAttribute('aria-hidden', 'true');
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(coarse ? 1 : Math.min(1.5, window.devicePixelRatio || 1));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const CAM = new THREE.Vector3(0, 1.45, 7.2);
  camera.position.copy(CAM);
  camera.lookAt(0, 0.5, -3);

  const FAR_Z = -17, NEAR_Z = 5.4;

  // ---------- Blade geometry: a tapered strip, 5 segments + a tip ----------
  const SEG = 5;
  const base = new THREE.InstancedBufferGeometry();
  const pos = [], aT = [], aSide = [], index = [];
  for (let i = 0; i < SEG; i++) {
    pos.push(0, 0, 0, 0, 0, 0);
    aT.push(i / SEG, i / SEG);
    aSide.push(-1, 1);
  }
  pos.push(0, 0, 0); aT.push(1); aSide.push(0);
  for (let i = 0; i < SEG - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  index.push((SEG - 1) * 2, (SEG - 1) * 2 + 1, SEG * 2);
  base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  base.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  base.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  base.setIndex(index);

  const uniforms = {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector3(0, 0, 999) },
    uPush: { value: 0 },
    uBase: { value: rgb(0x2F4A22, THREE) },
    uMid: { value: rgb(0x6D8A48, THREE) },
    uTip: { value: rgb(0xB9C97F, THREE) },
    uPaper: { value: rgb(0xEEE9DD, THREE) },
    uNear: { value: 5 },
    uFar: { value: 19 }
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.DoubleSide
  });

  let mesh = null;

  // Scatter blades only where the camera can see them: pick a depth
  // (biased toward the front, where each blade covers more screen),
  // then an x inside the frustum's width at that depth.
  function scatter(aspect) {
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
    const n = Math.round((coarse ? 11000 : 42000) * Math.min(1.6, Math.max(0.6, aspect / 4)));
    const geo = base.clone();
    geo.instanceCount = n;
    const off = new Float32Array(n * 3), prm = new Float32Array(n * 4), tint = new Float32Array(n);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const z = NEAR_Z + (FAR_Z - NEAR_Z) * Math.pow(r, 1.7);
      const half = tanH * (CAM.z - z) + 1.2;
      off[i * 3] = (Math.random() * 2 - 1) * half;
      off[i * 3 + 1] = 0;
      off[i * 3 + 2] = z;
      const tall = Math.random() < 0.08;
      prm[i * 4] = tall ? 0.95 + Math.random() * 0.45 : 0.32 + Math.random() * 0.5;   // height
      prm[i * 4 + 1] = 0.028 + Math.random() * 0.022;                                // width
      prm[i * 4 + 2] = Math.random() * Math.PI;                                      // facing
      prm[i * 4 + 3] = Math.random();                                                // seed
      tint[i] = Math.random();
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
    geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(prm, 4));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
    mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // Dark soil under the blades, so gaps don't show bare paper
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 40),
    new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
      uniforms: { uColor: { value: rgb(0x33452A, THREE) }, uPaper: uniforms.uPaper, uNear: uniforms.uNear, uFar: uniforms.uFar }
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -14;
  scene.add(ground);

  // ---------- Size ----------
  let W = 0, H = 0;
  function resize() {
    const w = edge.clientWidth, h = edge.clientHeight;
    if (w === W && h === H) return;
    const rebuild = Math.abs(w - W) > 40 || !mesh;
    W = w; H = h;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (rebuild) scatter(camera.aspect);
  }

  // ---------- Pointer ----------
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const target = new THREE.Vector3(0, 0, 999);
  let over = false;
  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!over) return;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) target.copy(hit);
  }, { passive: true });

  // ---------- Loop (only while on screen) ----------
  let running = false, raf = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    uniforms.uTime.value += dt;
    uniforms.uPointer.value.lerp(target, 1 - Math.exp(-10 * dt));
    uniforms.uPush.value += ((over ? 1 : 0) - uniforms.uPush.value) * (1 - Math.exp(-5 * dt));
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  const startLoop = () => { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stopLoop = () => { running = false; cancelAnimationFrame(raf); };

  edge.appendChild(canvas);
  resize();
  renderer.render(scene, camera);
  edge.classList.add('is-3d');            // hides the 2D fallback

  new ResizeObserver(resize).observe(edge);
  new IntersectionObserver((entries) => {
    entries.forEach((en) => (en.isIntersecting ? startLoop() : stopLoop()));
  }).observe(edge);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stopLoop();
    edge.classList.remove('is-3d');
  });
}
