import * as THREE from './libs/three.module.js';
import { OrbitControls } from './libs/OrbitControls.js';

const faceCanvas = document.getElementById('faceCanvas');
const faceCtx = faceCanvas.getContext('2d');
const sourceCanvas = document.getElementById('sourceCanvas');
const sourceCtx = sourceCanvas.getContext('2d');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const btnSample = document.getElementById('btnSample');
const btnClear = document.getElementById('btnClear');
const btnDownload = document.getElementById('btnDownloadTexture');
const btnResetCamera = document.getElementById('btnResetCamera');
const rangeScale = document.getElementById('rangeScale');
const rangeOffset = document.getElementById('rangeOffset');
const rangeTone = document.getElementById('rangeTone');
const scaleValue = document.getElementById('scaleValue');
const offsetValue = document.getElementById('offsetValue');
const toneValue = document.getElementById('toneValue');
const viewerEl = document.getElementById('viewer');

const state = {
  image: null,
  cropScale: parseFloat(rangeScale.value),
  offset: parseFloat(rangeOffset.value),
  tone: parseFloat(rangeTone.value),
  texture: null,
  renderer: null,
  camera: null,
  controls: null,
  scene: null,
  character: null,
  headParts: {
    base: null,
    face: null,
  },
  materials: {},
  palette: {
    skin: new THREE.Color('#f5d5c7'),
    cloth: new THREE.Color('#7bb5ff'),
    accent: new THREE.Color('#68f0c2'),
    shadow: new THREE.Color('#2a3246'),
  },
  limbs: {
    leftArm: null,
    rightArm: null,
    leftLeg: null,
    rightLeg: null,
  },
  clock: new THREE.Clock(),
  focus: { x: 0.5, y: 0.5 }, // normalized focus point inside original image
  previewTransform: null,
};

bootstrap();

function bootstrap() {
  drawPlaceholderTexture('얼굴 이미지를 넣어주세요');
  drawSourcePlaceholder();
  updateTexture();
  init3D();
  bindUI();
  // Load sample after init so controls exist.
  loadSampleFace();
}

function drawPlaceholderTexture(message) {
  faceCtx.save();
  faceCtx.fillStyle = '#dfe6f1';
  faceCtx.fillRect(0, 0, faceCanvas.width, faceCanvas.height);
  faceCtx.fillStyle = '#0f172a';
  faceCtx.font = '700 28px "Space Grotesk", system-ui, sans-serif';
  faceCtx.textAlign = 'center';
  faceCtx.fillText(message, faceCanvas.width / 2, faceCanvas.height / 2 - 6);
  faceCtx.font = '400 16px "Space Grotesk", system-ui, sans-serif';
  faceCtx.fillStyle = '#3c4b63';
  faceCtx.fillText('정사각 크롭이 3D 머리에 들어갑니다', faceCanvas.width / 2, faceCanvas.height / 2 + 18);
  faceCtx.restore();
}

function drawSourcePlaceholder() {
  sourceCtx.save();
  sourceCtx.fillStyle = '#0e1524';
  sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.fillStyle = '#c6defa';
  sourceCtx.font = '600 18px "Space Grotesk", system-ui, sans-serif';
  sourceCtx.textAlign = 'center';
  sourceCtx.fillText('이미지를 올리면', sourceCanvas.width / 2, sourceCanvas.height / 2 - 6);
  sourceCtx.font = '400 15px "Space Grotesk", system-ui, sans-serif';
  sourceCtx.fillStyle = '#7c8ba6';
  sourceCtx.fillText('여기서 얼굴 위치를 클릭해요', sourceCanvas.width / 2, sourceCanvas.height / 2 + 18);
  sourceCtx.restore();
}

function bindUI() {
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
    const file = e.dataTransfer.files?.[0];
    if (file) loadImageFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
  });

  btnSample.addEventListener('click', loadSampleFace);
  btnClear.addEventListener('click', () => {
    state.image = null;
    drawPlaceholderTexture('초기화됨');
    drawSourcePlaceholder();
    updateTexture();
  });
  btnDownload.addEventListener('click', () => downloadCanvas(faceCanvas, 'sd-face-texture.png'));
  btnResetCamera.addEventListener('click', resetCamera);

  rangeScale.addEventListener('input', () => {
    state.cropScale = parseFloat(rangeScale.value);
    scaleValue.textContent = `${state.cropScale.toFixed(2)}x`;
    if (state.image) {
      renderSourcePreview();
      processFace();
    }
  });

  rangeOffset.addEventListener('input', () => {
    state.offset = parseFloat(rangeOffset.value);
    offsetValue.textContent = `${state.offset.toFixed(0)}%`;
    if (state.image) {
      renderSourcePreview();
      processFace();
    }
  });

  rangeTone.addEventListener('input', () => {
    state.tone = parseFloat(rangeTone.value);
    toneValue.textContent = `${state.tone > 0 ? '+' : ''}${state.tone.toFixed(0)}`;
    if (state.image) processFace();
  });

  sourceCanvas.addEventListener('click', (e) => {
    if (!state.image || !state.previewTransform) return;
    const rect = sourceCanvas.getBoundingClientRect();
    const scaleX = sourceCanvas.width / rect.width;
    const scaleY = sourceCanvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const { offsetX, offsetY, scale } = state.previewTransform;
    const imgX = (px - offsetX) / scale;
    const imgY = (py - offsetY) / scale;
    const normX = clamp(imgX / state.image.width, 0, 1);
    const normY = clamp(imgY / state.image.height, 0, 1);
    state.focus = { x: normX, y: normY };
    renderSourcePreview();
    processFace();
  });
}

function loadImageFile(file) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => loadImageSrc(reader.result);
  reader.readAsDataURL(file);
}

function loadImageSrc(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    state.image = img;
    state.focus = { x: 0.5, y: 0.5 };
    processFace();
    renderSourcePreview();
  };
  img.onerror = () => {
    console.error('Failed to load image');
    drawPlaceholderTexture('이미지를 불러오지 못했어요');
    drawSourcePlaceholder();
  };
  img.src = src;
}

function loadSampleFace() {
  loadImageSrc('./assets/sample-face.svg');
}

function processFace() {
  if (!state.image) return;
  const { image } = state;
  const w = image.width;
  const h = image.height;
  const base = Math.min(w, h);
  const cropSize = base / state.cropScale;
  const canvasSize = faceCanvas.width;

  const focusX = clamp(state.focus.x * w, cropSize / 2, w - cropSize / 2);
  const focusYOffset = (state.offset / 100) * cropSize * 0.6;
  const focusYRaw = state.focus.y * h + focusYOffset;
  const focusY = clamp(focusYRaw, cropSize / 2, h - cropSize / 2);

  const sx = clamp(focusX - cropSize / 2, 0, Math.max(0, w - cropSize));
  const sy = clamp(focusY - cropSize / 2, 0, Math.max(0, h - cropSize));

  faceCtx.clearRect(0, 0, canvasSize, canvasSize);

  faceCtx.save();
  const brightness = 1 + (state.tone / 100) * 0.25;
  const contrast = 1 + (state.tone / 100) * 0.15;
  const saturation = 1 + (state.tone / 100) * 0.18;
  faceCtx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
  faceCtx.imageSmoothingEnabled = true;
  faceCtx.imageSmoothingQuality = 'high';
  faceCtx.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, canvasSize, canvasSize);
  faceCtx.restore();

  // 소프트 마스크로 얼굴 영역을 전면에만 두고 가장자리는 투명하게 페이드.
  const grad = faceCtx.createRadialGradient(
    canvasSize / 2,
    canvasSize / 2,
    canvasSize * 0.35,
    canvasSize / 2,
    canvasSize / 2,
    canvasSize * 0.52
  );
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  faceCtx.globalCompositeOperation = 'destination-in';
  faceCtx.fillStyle = grad;
  faceCtx.fillRect(0, 0, canvasSize, canvasSize);
  faceCtx.globalCompositeOperation = 'source-over';

  renderSourcePreview({ cropSize, focusX, focusY });
  updateTexture();
  updatePaletteFromFace();
}

function updateTexture() {
  const texture = new THREE.CanvasTexture(faceCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = state.renderer
    ? state.renderer.capabilities.getMaxAnisotropy()
    : 1;
  texture.flipY = true; // 수직 반전을 보정해 얼굴이 거꾸로 보이지 않게
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (state.texture) state.texture.dispose();
  state.texture = texture;
  if (state.headParts.face) {
    state.headParts.face.material.map = texture;
    state.headParts.face.material.needsUpdate = true;
  }
}

function updatePaletteFromFace() {
  if (!state.image || !state.materials.headBase) return;
  const { width, height } = faceCanvas;
  const data = faceCtx.getImageData(0, 0, width, height).data;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  let accentScore = -1;
  let accentColor = new THREE.Color('#7bb5ff');

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 8) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat > accentScore) {
      accentScore = sat;
      accentColor = new THREE.Color(r / 255, g / 255, b / 255);
    }
  }

  if (!count) return;
  const avg = new THREE.Color(sumR / count / 255, sumG / count / 255, sumB / count / 255);
  const skin = avg.clone().lerp(new THREE.Color('#f5d5c7'), 0.4);
  const cloth = accentScore > 12 ? accentColor.clone() : new THREE.Color('#7bb5ff');
  const accent = cloth.clone().offsetHSL(0, 0.05, 0.05);
  const shadow = skin.clone().lerp(new THREE.Color('#2a3246'), 0.6);

  state.palette = { skin, cloth, accent, shadow };
  applyPaletteToMaterials();
}

function applyPaletteToMaterials() {
  const m = state.materials;
  if (!m.headBase) return;
  m.headBase.color.copy(state.palette.skin);
  m.body?.color.copy(state.palette.cloth);
  m.limb?.color.copy(state.palette.cloth.clone().lerp(state.palette.skin, 0.25));
  m.accent?.color.copy(state.palette.accent);
}

function init3D() {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewerEl.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(
    45,
    viewerEl.clientWidth / viewerEl.clientHeight,
    0.1,
    50
  );
  camera.position.set(1.8, 1.7, 2.8);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.minDistance = 1.2;
  controls.maxDistance = 4.2;
  controls.maxPolarAngle = Math.PI * 0.49;

  const hemi = new THREE.HemisphereLight(0xd7e7ff, 0x0b121d, 0.6);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(4, 6, 3);
  dirLight.castShadow = true;
  dirLight.shadow.bias = -0.0008;
  dirLight.shadow.mapSize.set(2048, 2048);
  scene.add(dirLight);

  const fillLight = new THREE.SpotLight(0x68f0c2, 0.6, 0, Math.PI / 4, 0.4, 1);
  fillLight.position.set(-2.5, 2.5, 1.5);
  fillLight.castShadow = false;
  scene.add(fillLight);

  const groundGeo = new THREE.CircleGeometry(4, 48);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0d1726,
    roughness: 0.9,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const character = buildCharacter();
  scene.add(character);

  state.renderer = renderer;
  state.camera = camera;
  state.controls = controls;
  state.scene = scene;
  state.character = character;

  window.addEventListener('resize', handleResize);
  animate();
}

function buildCharacter() {
  const group = new THREE.Group();

  const { palette } = state;

  state.materials = {
    body: new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: 0.32, metalness: 0.08 }),
    accent: new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.32, metalness: 0.18 }),
    limb: new THREE.MeshStandardMaterial({ color: palette.cloth.clone().lerp(palette.skin, 0.25), roughness: 0.45, metalness: 0.05 }),
    headBase: new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.58, metalness: 0 }),
    headFace: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: state.texture,
      roughness: 0.55,
      metalness: 0,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
  };

  // 둥글고 통통한 도로롱 스타일 몸통
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 48, 48), state.materials.body);
  body.position.y = 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 머리: 베이스 + 앞쪽 반구만 텍스처
  const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.6, 64, 64), state.materials.headBase);
  headBase.position.y = 1.3;
  headBase.castShadow = true;
  group.add(headBase);

  // 얼굴 패치: 앞쪽 반구를 얇게 겹쳐서 부드럽게 매핑
  const facePatchGeo = new THREE.SphereGeometry(
    0.605,
    64,
    64,
    -Math.PI / 2,
    Math.PI,
    Math.PI * 0.22,
    Math.PI * 0.58
  );
  const headFace = new THREE.Mesh(facePatchGeo, state.materials.headFace);
  headFace.position.copy(headBase.position);
  headFace.castShadow = false;
  headFace.receiveShadow = false;
  headFace.rotation.y = Math.PI / 2; // 얼굴을 정면(카메라) 방향으로 90도 회전
  headFace.renderOrder = 2;
  group.add(headFace);

  // 목 부분 심리스 컬러링
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.05, 12, 48), state.materials.accent);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.98;
  collar.castShadow = true;
  group.add(collar);

  // 팔, 다리, 신발
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.12, 8, 16);
  const leftArm = new THREE.Mesh(armGeo, state.materials.limb);
  leftArm.position.set(-0.55, 0.92, 0.1);
  leftArm.rotation.z = Math.PI / 2.1;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.55;
  rightArm.rotation.z = -Math.PI / 2.1;
  group.add(rightArm);

  const legGeo = new THREE.CapsuleGeometry(0.12, 0.12, 8, 12);
  const leftLeg = new THREE.Mesh(legGeo, state.materials.limb);
  leftLeg.position.set(-0.18, 0.16, 0.06);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.18;
  group.add(rightLeg);

  const shoeGeo = new THREE.SphereGeometry(0.16, 24, 24, -Math.PI / 2, Math.PI, 0, Math.PI);
  const shoeL = new THREE.Mesh(shoeGeo, state.materials.accent);
  shoeL.position.set(-0.18, 0.02, 0.16);
  shoeL.scale.set(1, 0.6, 1.2);
  shoeL.rotation.y = Math.PI / 2; // 발 방향 90도 CCW
  shoeL.castShadow = true;
  group.add(shoeL);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.18;
  group.add(shoeR);

  state.headParts.base = headBase;
  state.headParts.face = headFace;
  state.limbs.leftArm = leftArm;
  state.limbs.rightArm = rightArm;
  state.limbs.leftLeg = leftLeg;
  state.limbs.rightLeg = rightLeg;

  return group;
}

function animate() {
  requestAnimationFrame(animate);
  if (!state.renderer || !state.scene || !state.camera) return;
  const t = state.clock.getElapsedTime();

  if (state.character) {
    state.character.position.y = Math.sin(t * 2) * 0.02;
  }

  if (state.headParts.face && state.headParts.base) {
    const baseY = 1.3 + Math.sin(t * 2.2) * 0.03;
    state.headParts.base.position.y = baseY;
    state.headParts.face.position.y = baseY;
    state.headParts.face.rotation.y = Math.PI / 2 + Math.sin(t * 0.8) * 0.08;
  }

  const { leftArm, rightArm, leftLeg, rightLeg } = state.limbs;
  if (leftArm && rightArm) {
    leftArm.rotation.z = Math.PI / 2.6 + Math.sin(t * 2.4) * 0.25;
    rightArm.rotation.z = -Math.PI / 2.6 - Math.sin(t * 2.4) * 0.25;
  }
  if (leftLeg && rightLeg) {
    leftLeg.rotation.x = Math.sin(t * 2) * 0.12;
    rightLeg.rotation.x = -Math.sin(t * 2) * 0.12;
  }

  state.controls?.update();
  state.renderer.render(state.scene, state.camera);
}

function handleResize() {
  if (!state.renderer || !state.camera) return;
  const { clientWidth, clientHeight } = viewerEl;
  state.renderer.setSize(clientWidth, clientHeight);
  state.camera.aspect = clientWidth / clientHeight;
  state.camera.updateProjectionMatrix();
}

function resetCamera() {
  if (!state.camera || !state.controls) return;
  state.camera.position.set(1.8, 1.7, 2.8);
  state.controls.target.set(0, 0.9, 0);
  state.controls.update();
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderSourcePreview(overrides = {}) {
  sourceCtx.save();
  sourceCtx.fillStyle = '#0e1524';
  sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  if (!state.image) {
    sourceCtx.restore();
    drawSourcePlaceholder();
    state.previewTransform = null;
    return;
  }

  const img = state.image;
  const scale = Math.min(sourceCanvas.width / img.width, sourceCanvas.height / img.height) * 0.9;
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const offsetX = (sourceCanvas.width - drawW) / 2;
  const offsetY = (sourceCanvas.height - drawH) / 2;

  sourceCtx.imageSmoothingEnabled = true;
  sourceCtx.imageSmoothingQuality = 'high';
  sourceCtx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawW, drawH);

  const base = Math.min(img.width, img.height);
  const cropSize = overrides.cropSize || base / state.cropScale;
  const focusX = overrides.focusX || state.focus.x * img.width;
  const focusY = overrides.focusY || state.focus.y * img.height;
  const overlaySize = cropSize * scale;
  const overlayX = offsetX + (focusX - cropSize / 2) * scale;
  const overlayY = offsetY + (focusY - cropSize / 2) * scale;

  sourceCtx.strokeStyle = 'rgba(104,240,194,0.9)';
  sourceCtx.lineWidth = 2;
  sourceCtx.fillStyle = 'rgba(104,240,194,0.12)';
  sourceCtx.fillRect(overlayX, overlayY, overlaySize, overlaySize);
  sourceCtx.strokeRect(overlayX, overlayY, overlaySize, overlaySize);

  sourceCtx.beginPath();
  sourceCtx.moveTo(overlayX + overlaySize / 2, overlayY);
  sourceCtx.lineTo(overlayX + overlaySize / 2, overlayY + overlaySize);
  sourceCtx.moveTo(overlayX, overlayY + overlaySize / 2);
  sourceCtx.lineTo(overlayX + overlaySize, overlayY + overlaySize / 2);
  sourceCtx.stroke();
  sourceCtx.restore();

  state.previewTransform = { offsetX, offsetY, scale };
}
