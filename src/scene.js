import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { isSandbox, profile } from './data.js';

async function inflateArray(value) {
  if (typeof value !== 'string') return value;
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

export async function createScene(host, points, onSelect, onProgress) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f0f3f5');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  host.prepend(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 3;
  controls.maxDistance = 32;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0.2, 1, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b9eac, 2.8));
  const sun = new THREE.DirectionalLight(0xfff6e8, 3.2);
  sun.position.set(2, 8, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffffff, 2);
  rim.position.set(-5, 3, -3);
  scene.add(rim);

  const readJSON = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`模型资源读取失败: ${url} (${response.status})`);
    return response.json();
  };
  const source = await readJSON(`${profile.source}/scene.json`);
  const geometryLists = await Promise.all(Array.from({ length: profile.geometryCount }, (_, i) => readJSON(`${profile.source}/${profile.geometryDir}/geometries_${i}.json`)));
  const geometries = geometryLists.flat();
  await Promise.all(geometries.map(async (g) => {
    if (!g.data) return;
    for (const a of Object.values(g.data.attributes ?? {})) a.array = await inflateArray(a.array);
    if (g.data.index) g.data.index.array = await inflateArray(g.data.index.array);
  }));
  onProgress('正在装配水槽与设备');
  const modelNode = isSandbox ? source.scene.object.children[0] : source.scene.object.children.find(n => n.name === '模型');
  const materialIds = new Set();
  const clean = (n) => {
    if (Array.isArray(n.material)) n.material.forEach(m => materialIds.add(m));
    else if (n.material) materialIds.add(n.material);
    delete n.userData;
    n.children?.forEach(clean);
  };
  clean(modelNode);
  const model = new THREE.ObjectLoader().parse({
    metadata: { version: 4.6, type: 'Object' }, geometries,
    materials: [...materialIds].map(uuid => ({ uuid, type: 'MeshStandardMaterial', color: 0xa0b2bd })),
    object: modelNode,
  });
  const waterMeshes = [];
  const walls = [];
  model.traverse(o => {
    if (!o.isMesh) return;
    if (/^liuti/i.test(o.name)) {
      o.material = new THREE.MeshPhysicalMaterial({ color: 0x2aaac5, roughness: 0.22, metalness: 0.12, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      waterMeshes.push(o);
    } else if (o.name.startsWith('QU_') || /^(Upper_|Lower_|Middle_)/.test(o.name)) {
      o.material = new THREE.MeshPhysicalMaterial({ color: 0x9bb4c0, roughness: 0.28, metalness: 0.05, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide });
      walls.push(o);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), new THREE.LineBasicMaterial({ color: 0x6f939f, transparent: true, opacity: 0.35 }));
      o.add(edges);
    } else if (/^JianCe/.test(o.name) || /^LiuLiangJi/.test(o.name)) {
      o.material = new THREE.MeshStandardMaterial({ color: 0x16859d, roughness: 0.32, metalness: 0.4 });
    } else if (o.name.includes('DangBan')) {
      const color = o.name.endsWith('LG') ? 0xb68a48 : o.name.endsWith('ZJ') ? 0x597581 : 0x476374;
      o.material = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
    } else {
      o.material = new THREE.MeshStandardMaterial({ color: /^Beng/.test(o.name) ? 0x456c9a : /KuangJia|框架/.test(o.name) ? 0x99a7ac : 0xaab7bc, roughness: 0.4, metalness: 0.4 });
    }
  });
  scene.add(model);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const grid = new THREE.GridHelper(30, 60, 0xcbd7dc, 0xe0e7eb);
  grid.position.y = bounds.min.y - 0.08;
  scene.add(grid);
  const base = new THREE.Mesh(new THREE.BoxGeometry(size.x + 0.5, 0.09, size.z + 0.5), new THREE.MeshStandardMaterial({ color: 0xe2e8ec, roughness: 0.9 }));
  base.position.set(center.x, bounds.min.y - 0.05, center.z);
  scene.add(base);

  const markers = new Map();
  const overlay = document.createElement('div');
  overlay.className = 'marker-layer';
  host.append(overlay);
  const sensorMat = new THREE.MeshStandardMaterial({ color: 0x166d88, roughness: 0.35, metalness: 0.45 });
  points.forEach(p => {
    const object = model.getObjectByName(p.mesh);
    if (!object) throw new Error(`模型中未找到 ${p.mesh}`);
    const box = new THREE.Box3().setFromObject(object);
    const anchor = box.getCenter(new THREE.Vector3());
    anchor.y = box.max.y + (p.kind === 'level' ? 0.18 : 0.09);
    if (p.kind === 'level' && !isSandbox) {
      const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 16), sensorMat);
      sensor.position.copy(anchor);
      scene.add(sensor);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.23, 8), sensorMat);
      stem.position.copy(anchor).add(new THREE.Vector3(0, -0.14, 0));
      scene.add(stem);
    }
    const button = document.createElement('button');
    button.className = `point-marker ${p.kind}`;
    button.type = 'button';
    button.setAttribute('aria-label', `查看 ${p.id} ${p.name}`);
    button.title = `${p.id} ${p.name}`;
    button.innerHTML = `<span class="marker-dot"></span><span class="marker-copy"><small>${p.id} · ${p.short}</small><strong>${p.value.toFixed(p.digits)} <em>${p.unit}</em></strong></span>`;
    button.onclick = () => onSelect(p.id);
    overlay.append(button);
    markers.set(p.id, { p, object, anchor, button });
  });
  const selection = new THREE.BoxHelper(markers.get('LT-03').object, 0x0786a3);
  selection.material.transparent = true;
  selection.material.opacity = 0.7;
  scene.add(selection);

  const flow = new THREE.Group();
  const flowPaths = [];
  waterMeshes.filter(m => isSandbox ? /^LiuTi_(3|4|5|8)$/.test(m.name) : /^liuti_(2|4|5|7|8|10)$/.test(m.name)).forEach((m, i) => {
    const box = new THREE.Box3().setFromObject(m);
    const y = box.max.y + 0.025;
    const z = (box.min.z + box.max.z) / 2;
    const start = box.min.x + 0.12;
    const end = box.max.x - 0.12;
    const direction = [1, -1, -1, 1, 1, -1][i];
    for (let j = 0; j < 5; j++) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 3), new THREE.MeshBasicMaterial({ color: 0xc6f9ff }));
      arrow.rotation.z = -Math.PI / 2 * direction;
      flow.add(arrow);
      flowPaths.push({ arrow, start, end, y, z, direction, phase: j / 5 });
    }
  });
  scene.add(flow);
  let selected = 'LT-03';
  let layer = 'level';
  let showTags = true;
  let moving = true;
  let width = 1;
  let height = 1;
  let tween = null;
  const target = new THREE.Vector3(center.x, isSandbox ? center.y * 0.9 : 1.05, center.z);
  function home(mode = 'perspective') {
    const aspect = width / height;
    const direction = mode === 'top' ? new THREE.Vector3(0, 1, 0.001) : mode === 'front' ? new THREE.Vector3(0, 0.13, 1) : new THREE.Vector3(isSandbox ? 0.72 : 0.44, 0.53, 1);
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let distance = 0;
    // Fit every bounding-box corner into the usable area around the scene controls.
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const relative = new THREE.Vector3(x, y, z).sub(target);
          distance = Math.max(distance, relative.dot(direction) + Math.max(
            Math.abs(relative.dot(right)) / (tangent * aspect * 0.84),
            Math.abs(relative.dot(up)) / (tangent * 0.74),
          ));
        }
      }
    }
    tween = { position: target.clone().add(direction.multiplyScalar(distance)), target: target.clone() };
  }
  const resize = () => {
    const nextWidth = host.clientWidth;
    const nextHeight = host.clientHeight;
    // A hidden tab reports zero dimensions, which would poison camera matrices.
    if (nextWidth < 1 || nextHeight < 1) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    home();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  camera.position.copy(tween.position);
  controls.target.copy(target);
  tween = null;
  controls.addEventListener('start', () => { tween = null; });
  const raycaster = new THREE.Raycaster();
  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', e => { pointerStart = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pointerStart || Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = raycaster.intersectObject(model, true)[0];
    if (hit) {
      const found = [...markers.values()].find(m => { let o = hit.object; while (o) { if (o === m.object) return true; o = o.parent; } return false; });
      if (found) onSelect(found.p.id);
    }
  });
  let animationTime = 0;
  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (moving) animationTime += dt;
    if (tween) {
      camera.position.lerp(tween.position, 0.09);
      controls.target.lerp(tween.target, 0.09);
      if (camera.position.distanceTo(tween.position) < 0.005) tween = null;
    }
    controls.update();
    flowPaths.forEach(f => {
      const t = (animationTime * 0.12 + f.phase) % 1;
      f.arrow.position.set(f.start + (f.end - f.start) * (f.direction > 0 ? t : 1 - t), f.y, f.z);
    });
    const occupied = [];
    [...markers.values()].sort((a, b) => Number(b.p.id === selected) - Number(a.p.id === selected)).forEach(m => {
      const allowed = showTags && (m.p.kind === layer || (layer === 'equipment' && ['gate', 'pump'].includes(m.p.kind)) || m.p.id === selected);
      const v = m.anchor.clone().project(camera);
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      const labelRight = y < 300 ? width - 60 : width - 10;
      const labelX = Math.max(71, Math.min(x, labelRight - 65));
      const rect = { x: labelX - 65, y: y - 74, w: 130, h: 60 };
      const blocked = occupied.some(r => rect.x < r.x + r.w + 8 && rect.x + rect.w + 8 > r.x && rect.y < r.y + r.h + 6 && rect.y + rect.h + 6 > r.y);
      const visible = allowed && v.z < 1 && v.z > -1 && x > 12 && x < width - 12 && y > 95 && y < height - 90;
      const fullLabel = visible && rect.x >= 6 && rect.x + rect.w <= labelRight && rect.y > (width < 600 ? 100 : 62) && !blocked;
      m.button.hidden = !visible;
      const copy = m.button.querySelector('.marker-copy');
      copy.hidden = !fullLabel;
      copy.style.left = `${labelX - x - 59}px`;
      copy.style.setProperty('--leader-x', `${x - labelX + 58}px`);
      if (visible) {
        if (fullLabel) occupied.push(rect);
        m.button.style.transform = `translate(${x}px, ${y}px)`;
      }
    });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
  return {
    select(id) { selected = id; selection.setFromObject(markers.get(id).object); markers.forEach((m, key) => m.button.classList.toggle('selected', key === id)); },
    focus(id) {
      const m = markers.get(id);
      tween = { target: m.anchor.clone(), position: m.anchor.clone().add(new THREE.Vector3(2, 2.5, 3.8)) };
    },
    update() { markers.forEach(m => { m.button.querySelector('strong').innerHTML = `${m.p.value.toFixed(m.p.digits)} <em>${m.p.unit}</em>`; m.button.classList.toggle('alarm', m.p.quality === 'alarm'); m.button.classList.toggle('offline', m.p.quality === 'offline'); }); },
    home, setLayer(value) { layer = value; },
    setTags(value) { showTags = value; },
    setFlow(value) { flow.visible = value; },
    setMoving(value) { moving = value; },
    rotate(value) { controls.autoRotate = value; controls.autoRotateSpeed = 0.6; },
    zoom(factor) { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); },
    setTransparent(value) { walls.forEach(m => { m.material.opacity = value ? 0.14 : 0.26; }); },
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    diagnostics() {
      const corners = [];
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new THREE.Vector3(x, y, z).project(camera);
        corners.push({ x: projected.x, y: projected.y });
      }
      return { model: profile.name, meshes: [...model.children].length, geometries: geometries.length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width, height, inFrame: corners.every(p => Math.abs(p.x) < 1 && Math.abs(p.y) < 1) };
    },
  };
}
