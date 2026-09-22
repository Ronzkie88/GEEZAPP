let stage, underlayLayer, wireLayer, electricalLayer, controlLayer, guideLayer;
let planImageNode = null;
let filterReqId = null;
let opacityReqId = null;

let currentComponent = null;
let currentWireType = 'power';
let currentWireRoutingStyle = 'curved';
let selectedWireForEdit = null;
let multiTouchDetected = false;
let isWelcomeActive = true;

let scalePixelsPerMeter = 45;
let isCalibratingScale = false;
let scalePoint1 = null;

const SNAP_THRESHOLD = 8;
const MAX_SNAP_DISTANCE = 160;
const WIRE_HIT_WIDTH = 12;
const COMPONENT_HIT_RADIUS = 16;

const WIRE_TYPES = {
  power: { name: 'Power', stroke: '#2563eb', dash: null },
  switch: { name: 'Switch Leg', stroke: '#d97706', dash: [6, 4] },
  data: { name: 'Data/Comm', stroke: '#0d9488', dash: [2, 4] }
};

const counts = { wire: 0 };
let compIdCounter = 0;
let wireIdCounter = 0;
let wiringStartNode = null;
let wires = [];

const undoStack = [];
const redoStack = [];
const RATES = { cablePerMeterRate: 3.50 };

const CATEGORIES = {
  lighting: { title: 'Lighting & Switching', icon: '💡', desc: 'Downlights, pendants, battens & 1-4G switches' },
  power: { title: 'Power & Outlets', icon: '🔌', desc: 'GPOs, quad points, USBs & weatherproof' },
  data: { title: 'Data & Communications', icon: '🌐', desc: '1-5 port data outlets, racks & WAPs' },
  safety: { title: 'Safety, HVAC & Distribution', icon: '🛡️', desc: 'J-Boxes, DB switchboards, fans & alarms' }
};

const CATALOG = {
  downlight: { name: 'LED Downlight', cat: 'lighting', icon: '💡', rate: 95 },
  batten: { name: 'Batten Holder', cat: 'lighting', icon: '🏮', rate: 65 },
  pendant: { name: 'Pendant Luminaire', cat: 'lighting', icon: '🛋️', rate: 120 },
  ledstrip: { name: 'LED Strip Channel', cat: 'lighting', icon: '➖', rate: 140 },
  switch1g: { name: '1-Gang Switch', cat: 'lighting', icon: '1️⃣', rate: 75 },
  switch2g: { name: '2-Gang Switch', cat: 'lighting', icon: '2️⃣', rate: 90 },
  switch3g: { name: '3-Gang Switch', cat: 'lighting', icon: '3️⃣', rate: 110 },
  switch4g: { name: '4-Gang Switch (Quad)', cat: 'lighting', icon: '4️⃣', rate: 135 },
  dimmer: { name: 'Rotary Dimmer', cat: 'lighting', icon: '🎛️', rate: 115 },
  light2way: { name: '2-Way Switch Mechanism', cat: 'lighting', icon: '🔀', rate: 95 },

  gpoSingle: { name: 'Single GPO', cat: 'power', icon: '◽', rate: 75 },
  gpo: { name: 'Double GPO', cat: 'power', icon: '🔌', rate: 85 },
  gpoQuad: { name: 'Quad GPO (4-Point)', cat: 'power', icon: '🔲', rate: 140 },
  gpoWp: { name: 'Weatherproof GPO (IP56)', cat: 'power', icon: '🌧️', rate: 125 },
  usb: { name: 'USB-A/C Double GPO', cat: 'power', icon: '🔋', rate: 110 },
  isolator: { name: 'A/C Rotary Isolator', cat: 'power', icon: '⚡', rate: 130 },

  data: { name: '1-Port Data Point', cat: 'data', icon: '🌐', rate: 110 },
  data2: { name: '2-Port Data Point', cat: 'data', icon: '🌐²', rate: 135 },
  data3: { name: '3-Port Data Point', cat: 'data', icon: '🌐³', rate: 155 },
  data4: { name: '4-Port Data Point', cat: 'data', icon: '🌐⁴', rate: 180 },
  data5: { name: '5-Port Data Point', cat: 'data', icon: '🌐⁵', rate: 210 },
  datarack: { name: 'Data Rack / Comms Cab', cat: 'data', icon: '🗄️', rate: 250 },
  intercom: { name: 'Access Point (WAP)', cat: 'data', icon: '📡', rate: 140 },
  doorstation: { name: 'Door Station / Intercom', cat: 'data', icon: '🚪', rate: 190 },
  cctv: { name: 'IP Security Camera', cat: 'data', icon: '📷', rate: 160 },

  jbox: { name: 'Junction Box (J-Box)', cat: 'safety', icon: '📦', rate: 35 },
  smoke: { name: 'Photoelectric Smoke Alarm', cat: 'safety', icon: '🚨', rate: 155 },
  fan: { name: 'Ceiling Sweep Fan', cat: 'safety', icon: '🌀', rate: 195 },
  exhaustfan: { name: 'Exhaust Fan (Ductable)', cat: 'safety', icon: '💨', rate: 145 },
  spitfire: { name: 'Emergency Spitfire', cat: 'safety', icon: '🟢', rate: 165 },
  switchboard: { name: 'Main Switchboard (MSB)', cat: 'safety', icon: '⚡📦', rate: 550 },
  subboard: { name: 'Distribution Sub-Board (DB)', cat: 'safety', icon: '🔲⚡', rate: 350 }
};

Object.keys(CATALOG).forEach(k => counts[k] = 0);

window.addEventListener('DOMContentLoaded', () => {
  initStage();
  bindEvents();
  setupPinchAndPan();
  selectPointerTool(false);
  initStudio();
});

function dismissWelcome() {
  if (!isWelcomeActive) return;
  isWelcomeActive = false;
  const pill = document.getElementById('welcomePill');
  if (pill) pill.style.display = 'none';
  const indicator = document.getElementById('modeIndicator');
  if (indicator) indicator.style.display = 'block';
  updateModeIndicatorUI();
}

function startScaleCalibration() {
  toggleTuningDrawer();
  isCalibratingScale = true;
  scalePoint1 = null;
  const banner = document.getElementById('scaleBanner');
  if (banner) {
    banner.style.display = 'block';
    banner.innerText = "📏 Tap first point of known scale reference";
  }
}

function initStage() {
  const container = document.getElementById('container');
  stage = new Konva.Stage({
    container: 'container',
    width: container.clientWidth,
    height: container.clientHeight,
    draggable: false
  });

  underlayLayer = new Konva.Layer();
  guideLayer = new Konva.Layer();
  wireLayer = new Konva.Layer();
  electricalLayer = new Konva.Layer();
  controlLayer = new Konva.Layer();

  stage.add(underlayLayer);
  stage.add(guideLayer);
  stage.add(wireLayer);
  stage.add(electricalLayer);
  stage.add(controlLayer);

  stage.on('click tap', handleStageTap);
}

function bindEvents() {
  window.addEventListener('resize', () => {
    resizeCanvas();
    resizeStudio();
  });
  const uploadInput = document.getElementById('planUpload');
  uploadInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
      e.target.value = '';
    }
  });
}

function toggleBurgerMenu() {
  dismissWelcome();
  const menu = document.getElementById('burgerMenu');
  menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
  closeClearPopover();
}

function checkAlignmentSnap(candidateX, candidateY, skipNodeId = null, currentType = null) {
  const comps = electricalLayer.find('.component');
  let snappedX = candidateX;
  let snappedY = candidateY;
  let lineX = null;
  let lineY = null;
  let bestDistX = Infinity;
  let bestDistY = Infinity;

  comps.forEach(node => {
    if (skipNodeId && node.id() === skipNodeId) return;
    if (currentType && node.getAttr('compType') !== currentType) return;

    const straightLineDist = Math.hypot(node.x() - candidateX, node.y() - candidateY);
    if (straightLineDist > MAX_SNAP_DISTANCE) return;

    const diffX = Math.abs(node.x() - candidateX);
    if (diffX < SNAP_THRESHOLD && straightLineDist < bestDistX) {
      snappedX = node.x();
      lineX = node.x();
      bestDistX = straightLineDist;
    }

    const diffY = Math.abs(node.y() - candidateY);
    if (diffY < SNAP_THRESHOLD && straightLineDist < bestDistY) {
      snappedY = node.y();
      lineY = node.y();
      bestDistY = straightLineDist;
    }
  });

  return { snappedX, snappedY, lineX, lineY };
}

function renderGuideLines(lineX, lineY) {
  guideLayer.destroyChildren();

  if (lineX !== null) {
    guideLayer.add(new Konva.Line({
      points: [lineX, -5000, lineX, 5000],
      stroke: '#06b6d4',
      strokeWidth: 1.5,
      dash: [6, 4],
      listening: false
    }));
  }

  if (lineY !== null) {
    guideLayer.add(new Konva.Line({
      points: [-5000, lineY, 5000, lineY],
      stroke: '#06b6d4',
      strokeWidth: 1.5,
      dash: [6, 4],
      listening: false
    }));
  }

  guideLayer.batchDraw();
}

function clearGuideLines() {
  if (guideLayer.children.length > 0) {
    guideLayer.destroyChildren();
    guideLayer.batchDraw();
  }
}

function renderCategoryView() {
  document.getElementById('libModalTitle').innerText = 'Component Library';
  document.getElementById('btnLibBack').style.display = 'none';
  const body = document.getElementById('libModalBody');
  body.innerHTML = '';

  Object.keys(CATEGORIES).forEach(catKey => {
    const cat = CATEGORIES[catKey];
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.onclick = () => renderItemsView(catKey);

    card.innerHTML = `
      <div class="cat-card-left">
        <div class="cat-icon-lg">${cat.icon}</div>
        <div>
          <div class="cat-title">${cat.title}</div>
          <div class="cat-sub">${cat.desc}</div>
        </div>
      </div>
      <div style="color: #64748b; font-size: 16px; font-weight: bold; margin-left: 8px;">›</div>
    `;
    body.appendChild(card);
  });
}

function renderItemsView(catKey) {
  const cat = CATEGORIES[catKey];
  document.getElementById('libModalTitle').innerText = cat.title;
  document.getElementById('btnLibBack').style.display = 'inline-flex';
  const body = document.getElementById('libModalBody');
  body.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'library-grid';

  Object.keys(CATALOG).forEach(key => {
    const item = CATALOG[key];
    if (item.cat !== catKey) return;

    const card = document.createElement('div');
    card.className = `lib-card ${currentComponent === key ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="lib-icon">${item.icon}</div>
      <div>${item.name}</div>
    `;
    card.onclick = () => selectComponentFromLibrary(key);
    grid.appendChild(card);
  });

  body.appendChild(grid);
}

function openLibraryModal() {
  dismissWelcome();
  closeClearPopover();
  clearWireControlHandle();
  clearGuideLines();
  renderCategoryView();
  document.getElementById('libraryModal').style.display = 'flex';
}

function closeLibraryModal() {
  document.getElementById('libraryModal').style.display = 'none';
}

function selectComponentFromLibrary(type) {
  resetWiringSelection();
  clearWireControlHandle();
  clearGuideLines();
  closeClearPopover();

  currentComponent = type;
  const item = CATALOG[type];
  document.getElementById('activeToolBtn').innerText = item.icon;
  document.getElementById('activeToolBtn').style.background = '#059669';
  document.getElementById('toolWire').classList.remove('selected');
  document.getElementById('toolDel').classList.remove('selected');
  document.getElementById('toolPointer').classList.remove('selected');

  closeLibraryModal();
  updateModeIndicatorUI();
}

function openWireModal() {
  dismissWelcome();
  closeClearPopover();
  resetWiringSelection();
  clearWireControlHandle();
  clearGuideLines();
  document.getElementById('wireModal').style.display = 'flex';
}

function closeWireModal() {
  document.getElementById('wireModal').style.display = 'none';
}

function selectWireWithStyle(type, style) {
  currentWireType = type;
  currentWireRoutingStyle = style;
  currentComponent = 'wire';

  document.getElementById('toolWire').classList.add('selected');
  document.getElementById('toolDel').classList.remove('selected');
  document.getElementById('toolPointer').classList.remove('selected');
  document.getElementById('activeToolBtn').innerText = '🧰';
  document.getElementById('activeToolBtn').style.background = '#d97706';

  closeWireModal();
  updateModeIndicatorUI();
}

function selectQuickTool(tool) {
  dismissWelcome();
  resetWiringSelection();
  clearWireControlHandle();
  clearGuideLines();

  if (tool === 'delete') {
    if (currentComponent === 'delete') {
      const pop = document.getElementById('clearPopover');
      pop.style.display = (pop.style.display === 'flex') ? 'none' : 'flex';
      return;
    } else {
      currentComponent = 'delete';
      document.getElementById('toolDel').classList.add('selected');
      document.getElementById('toolWire').classList.remove('selected');
      document.getElementById('toolPointer').classList.remove('selected');
      document.getElementById('activeToolBtn').innerText = '🧰';
      document.getElementById('activeToolBtn').style.background = '#d97706';
      closeClearPopover();
    }
  }

  updateModeIndicatorUI();
}

function selectPointerTool(isUserAction = true) {
  currentComponent = null;
  resetWiringSelection();
  clearWireControlHandle();
  clearGuideLines();
  closeClearPopover();

  document.getElementById('toolPointer').classList.add('selected');
  document.getElementById('toolDel').classList.remove('selected');
  document.getElementById('toolWire').classList.remove('selected');
  document.getElementById('activeToolBtn').innerText = '🧰';
  document.getElementById('activeToolBtn').style.background = '#d97706';

  if (isUserAction) {
    dismissWelcome();
  }

  if (!isWelcomeActive) {
    updateModeIndicatorUI();
  }
}

function closeClearPopover() {
  const pop = document.getElementById('clearPopover');
  if (pop) pop.style.display = 'none';
}

function clearOnlyWires() {
  closeClearPopover();
  if (wires.length === 0) return;
  if (!confirm("Remove all wiring runs from the plan?")) return;

  const deletedSnapshot = [...wires];
  wires.forEach(w => w.lineNode.destroy());
  wires = [];
  wireLayer.batchDraw();
  counts.wire = 0;

  undoStack.push({ action: 'clear_wires', data: deletedSnapshot });
  redoStack.length = 0;
  updateStatus();
}

function clearAllLayout() {
  closeClearPopover();
  const comps = electricalLayer.find('.component');
  if (comps.length === 0 && wires.length === 0) return;
  if (!confirm("Are you sure you want to clear ALL components and wiring? (Background plan will remain)")) return;

  const compSnapshot = comps.map(c => ({ id: c.id(), type: c.getAttr('compType'), x: c.x(), y: c.y() }));
  const wireSnapshot = [...wires];

  wires.forEach(w => w.lineNode.destroy());
  wires = [];
  wireLayer.batchDraw();
  counts.wire = 0;

  comps.forEach(c => c.destroy());
  electricalLayer.batchDraw();
  Object.keys(CATALOG).forEach(k => counts[k] = 0);

  undoStack.push({ action: 'clear_all', components: compSnapshot, wires: wireSnapshot });
  redoStack.length = 0;
  updateStatus();
}

function resetWiringSelection() {
  if (wiringStartNode) {
    try {
      const ring = wiringStartNode.findOne('.highlight-ring');
      if (ring) ring.destroy();
    } catch (e) { }
    wiringStartNode = null;
    electricalLayer.batchDraw();
  }
}

function updateModeIndicatorUI() {
  const indicator = document.getElementById('modeIndicator');
  if (!indicator) return;

  if (stage) stage.container().style.cursor = currentComponent ? 'crosshair' : 'default';

  if (currentComponent === 'wire') {
    const wt = WIRE_TYPES[currentWireType];
    indicator.style.background = 'rgba(49, 46, 129, 0.95)';
    indicator.style.borderColor = wt.stroke;
    indicator.innerHTML = `⚡ Wire: ${wt.name} (${currentWireRoutingStyle === 'curved' ? 'Arc' : '90°'}) <span class="mode-subtext">— Tap start, then end</span>`;
  } else if (currentComponent === 'delete') {
    indicator.style.background = 'rgba(127, 29, 29, 0.95)';
    indicator.style.borderColor = '#ef4444';
    indicator.innerHTML = `🗑️ Delete Tool Active <span class="mode-subtext">— Tap item to remove | Tap trash again for Clear All</span>`;
  } else if (currentComponent && CATALOG[currentComponent]) {
    indicator.style.background = 'rgba(5, 150, 105, 0.95)';
    indicator.style.borderColor = '#10b981';
    indicator.innerHTML = `📍 ${CATALOG[currentComponent].name} <span class="mode-subtext">— Tap plan to place</span>`;
  } else {
    indicator.style.background = 'rgba(15, 23, 42, 0.95)';
    indicator.style.borderColor = '#334155';
    indicator.innerHTML = `👆 Pointer Mode <span class="mode-subtext">— 2 Finger Pan, Drag items to align, pinch to zoom</span>`;
  }
}

function resizeCanvas() {
  if (!stage) return;
  const container = document.getElementById('container');
  stage.width(container.clientWidth);
  stage.height(container.clientHeight);
  stage.batchDraw();
}

function recenterPlan() {
  if (!stage) return;
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
}

function recenterStudioPlan() {
  if (!studioCanvas) return;

  if (studioLines.length === 0) {
    studioScale = 1.0;
    studioPanX = 0;
    studioPanY = 0;
    renderStudio();
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  studioLines.forEach(l => {
    minX = Math.min(minX, l.x1, l.x2);
    maxX = Math.max(maxX, l.x1, l.x2);
    minY = Math.min(minY, l.y1, l.y2);
    maxY = Math.max(maxY, l.y1, l.y2);
  });

  const dpr = window.devicePixelRatio || 1;
  const canvasW = studioCanvas.width / dpr;
  const canvasH = studioCanvas.height / dpr;

  const contentW = (maxX - minX) || 100;
  const contentH = (maxY - minY) || 100;

  const padding = 80;
  const scaleX = (canvasW - padding) / contentW;
  const scaleY = (canvasH - padding) / contentH;

  studioScale = Math.max(0.4, Math.min(Math.min(scaleX, scaleY), 3.0));

  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;

  studioPanX = (canvasW / 2) - (contentCenterX * studioScale);
  studioPanY = (canvasH / 2) - (contentCenterY * studioScale);

  renderStudio();
}

function setupPinchAndPan() {
  let lastCenter = null;
  let lastDist = 0;
  const content = stage.getContent();

  content.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) multiTouchDetected = true;
  }, { passive: true });

  content.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      setTimeout(() => { multiTouchDetected = false; }, 200);
    }
  }, { passive: true });

  content.addEventListener('touchmove', (e) => {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];

    if (touch1 && touch2) {
      e.preventDefault();
      multiTouchDetected = true;
      const p1 = { x: touch1.clientX, y: touch1.clientY };
      const p2 = { x: touch2.clientX, y: touch2.clientY };

      if (!lastCenter) {
        lastCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        lastDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        return;
      }

      const newDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const currentCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const distRatio = newDist / (lastDist || 1);
      const oldScale = stage.scaleX();
      const newScale = Math.max(0.2, Math.min(oldScale * distRatio, 8));

      const mousePointTo = {
        x: (currentCenter.x - stage.x()) / oldScale,
        y: (currentCenter.y - stage.y()) / oldScale,
      };

      stage.scale({ x: newScale, y: newScale });
      const dx = currentCenter.x - lastCenter.x;
      const dy = currentCenter.y - lastCenter.y;

      stage.position({
        x: currentCenter.x - mousePointTo.x * newScale + dx,
        y: currentCenter.y - mousePointTo.y * newScale + dy,
      });

      stage.batchDraw();
      lastDist = newDist;
      lastCenter = currentCenter;
    }
  }, { passive: false });

  content.addEventListener('touchend', () => {
    lastCenter = null;
    lastDist = 0;
  });
}

function toggleInkBoostOptions() {
  const enabled = document.getElementById('chkFilter').checked;
  document.getElementById('inkBoostOptions').style.display = enabled ? 'flex' : 'none';
  updatePlanVisuals();
}

function updatePlanVisuals() {
  if (!underlayLayer) return;
  const enabled = document.getElementById('chkFilter').checked;
  const rawContrast = parseInt(document.getElementById('rngContrast').value, 10);
  const rawBrightness = parseInt(document.getElementById('rngBrightness').value, 10);

  document.getElementById('lblContrast').innerText = rawContrast;
  document.getElementById('lblBrightness').innerText = rawBrightness;

  if (filterReqId) cancelAnimationFrame(filterReqId);
  filterReqId = requestAnimationFrame(() => {
    const canvasEl = underlayLayer.getCanvas()._canvas;
    if (canvasEl) {
      if (!enabled) {
        canvasEl.style.filter = 'none';
      } else {
        const contrastVal = 100 + (rawContrast - 50) * 5;
        const brightnessVal = 100 + (rawBrightness - 50) * 1.5;
        canvasEl.style.filter = `grayscale(100%) contrast(${Math.max(0, contrastVal)}%) brightness(${Math.max(10, brightnessVal)}%)`;
      }
    }
  });
}

function toggleTuningDrawer() {
  const drawer = document.getElementById('tuningDrawer');
  drawer.style.display = drawer.style.display === 'flex' ? 'none' : 'flex';
}

function resetPlanVisuals() {
  document.getElementById('chkFilter').checked = false;
  document.getElementById('inkBoostOptions').style.display = 'none';
  document.getElementById('rngContrast').value = 50;
  document.getElementById('rngBrightness').value = 50;
  document.getElementById('planOpacity').value = 50;
  document.getElementById('lblContrast').innerText = 50;
  document.getElementById('lblBrightness').innerText = 50;
  document.getElementById('lblOpacity').innerText = 50;
  updatePlanVisuals();
  changePlanOpacity(50);
}

function processImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  dismissWelcome();
  const reader = new FileReader();
  reader.onload = (e) => {
    loadPlanImageFromUrl(e.target.result);
  };
  reader.readAsDataURL(file);
}

function loadPlanImageFromUrl(dataUrl) {
  dismissWelcome();
  const img = new Image();
  img.onload = () => {
    deleteUploadedPlan(false);
    const cW = stage.width();
    const cH = stage.height();
    const scale = Math.min((cW * 0.92) / img.width, (cH * 0.92) / img.height);
    const fitW = Math.round(img.width * scale);
    const fitH = Math.round(img.height * scale);

    planImageNode = new Konva.Image({
      x: Math.round((cW - fitW) / 2),
      y: Math.round((cH - fitH) / 2),
      image: img,
      width: fitW,
      height: fitH,
      opacity: 0.5,
      draggable: false,
      name: 'planImage'
    });

    underlayLayer.add(planImageNode);
    underlayLayer.batchDraw();
    resetPlanVisuals();

    document.getElementById('btnToggleTune').style.display = 'inline-flex';
    document.getElementById('btnRecenter').style.display = 'inline-flex';
    document.getElementById('lblScaleDisplay').innerText = `${scalePixelsPerMeter.toFixed(1)} px/m`;
    updatePlanVisuals();
    requestAnimationFrame(resizeCanvas);
  };
  img.src = dataUrl;
}

function changePlanOpacity(val) {
  document.getElementById('lblOpacity').innerText = val;
  if (opacityReqId) cancelAnimationFrame(opacityReqId);
  opacityReqId = requestAnimationFrame(() => {
    if (planImageNode) {
      planImageNode.opacity(val / 100);
      underlayLayer.batchDraw();
    }
  });
}

function deleteUploadedPlan(fullClear = true) {
  if (fullClear) {
    if (!confirm("Are you sure you want to delete the current plan? This action cannot be undone.")) return;
  }
  if (planImageNode) { planImageNode.destroy(); planImageNode = null; }
  const canvasEl = underlayLayer.getCanvas()._canvas;
  if (canvasEl) canvasEl.style.filter = 'none';
  underlayLayer.batchDraw();

  if (fullClear) {
    document.getElementById('btnToggleTune').style.display = 'none';
    document.getElementById('btnRecenter').style.display = 'none';
    document.getElementById('tuningDrawer').style.display = 'none';
    requestAnimationFrame(resizeCanvas);
  }
}

function getDeviceScale() {
  return window.innerWidth < 600 ? 0.75 : 1.0;
}

function createSymbol(type, x, y, id) {
  const compId = id || ('comp_' + (++compIdCounter));
  const s = getDeviceScale();

  const group = new Konva.Group({
    x: x,
    y: y,
    scale: { x: s, y: s },
    draggable: true,
    name: 'component',
    id: compId
  });

  group.setAttr('compType', type);
  group.add(new Konva.Circle({ radius: COMPONENT_HIT_RADIUS / s, fill: 'transparent', hitStrokeWidth: 0 }));

  if (type === 'downlight') {
    group.add(new Konva.Circle({ radius: 11, fill: '#fef08a', stroke: '#ca8a04', strokeWidth: 2 }));
    group.add(new Konva.Line({ points: [-6, 0, 6, 0], stroke: '#ca8a04', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [0, -6, 0, 6], stroke: '#ca8a04', strokeWidth: 1.5 }));
  } else if (type === 'batten') {
    group.add(new Konva.Circle({ radius: 12, fill: '#fef9c3', stroke: '#b45309', strokeWidth: 2 }));
    group.add(new Konva.Circle({ radius: 5, fill: '#b45309' }));
    group.add(new Konva.Line({ points: [-8, -8, 8, 8], stroke: '#b45309', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [-8, 8, 8, -8], stroke: '#b45309', strokeWidth: 1.5 }));
  } else if (type === 'pendant') {
    group.add(new Konva.Line({ points: [0, -14, 0, -2], stroke: '#d97706', strokeWidth: 2 }));
    group.add(new Konva.Arc({ innerRadius: 0, outerRadius: 10, angle: 180, rotation: 0, fill: '#fed7aa', stroke: '#ea580c', strokeWidth: 2, y: -2 }));
    group.add(new Konva.Circle({ radius: 3, y: 1, fill: '#f97316' }));
  } else if (type === 'ledstrip') {
    group.add(new Konva.Rect({ x: -16, y: -4, width: 32, height: 8, fill: '#fef08a', stroke: '#eab308', strokeWidth: 2, cornerRadius: 2 }));
    for (let i = -10; i <= 10; i += 5) {
      group.add(new Konva.Circle({ radius: 1.5, x: i, y: 0, fill: '#ca8a04' }));
    }
  } else if (type === 'switch1g') {
    group.add(new Konva.Circle({ radius: 9, fill: '#dbeafe', stroke: '#2563eb', strokeWidth: 2 }));
    group.add(new Konva.Line({ points: [6, -6, 12, -12], stroke: '#2563eb', strokeWidth: 2 }));
  } else if (type === 'switch2g') {
    group.add(new Konva.Rect({ x: -10, y: -10, width: 20, height: 20, fill: '#eff6ff', stroke: '#2563eb', strokeWidth: 2, cornerRadius: 3 }));
    group.add(new Konva.Rect({ x: -7, y: -6, width: 5, height: 12, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1.2, cornerRadius: 1 }));
    group.add(new Konva.Rect({ x: 2, y: -6, width: 5, height: 12, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1.2, cornerRadius: 1 }));
  } else if (type === 'switch3g') {
    group.add(new Konva.Rect({ x: -13, y: -10, width: 26, height: 20, fill: '#eff6ff', stroke: '#2563eb', strokeWidth: 2, cornerRadius: 3 }));
    group.add(new Konva.Rect({ x: -10, y: -6, width: 4, height: 12, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1, cornerRadius: 1 }));
    group.add(new Konva.Rect({ x: -2, y: -6, width: 4, height: 12, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1, cornerRadius: 1 }));
    group.add(new Konva.Rect({ x: 6, y: -6, width: 4, height: 12, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1, cornerRadius: 1 }));
  } else if (type === 'switch4g') {
    group.add(new Konva.Rect({ x: -11, y: -11, width: 22, height: 22, fill: '#eff6ff', stroke: '#2563eb', strokeWidth: 2, cornerRadius: 3 }));
    group.add(new Konva.Rect({ x: -8, y: -8, width: 6, height: 6, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1, cornerRadius: 1 }));
    group.add(new Konva.Rect({ x: 2, y: -8, width: 6, height: 6, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1, cornerRadius: 1 }));
    group.add(new Konva.Rect({ x: -8, y: 2, width: 6, height: 6, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1, cornerRadius: 1 }));
    group.add(new Konva.Rect({ x: 2, y: 2, width: 6, height: 6, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 1, cornerRadius: 1 }));
  } else if (type === 'dimmer') {
    group.add(new Konva.Circle({ radius: 10, fill: '#f1f5f9', stroke: '#475569', strokeWidth: 2 }));
    group.add(new Konva.Circle({ radius: 5, fill: '#cbd5e1', stroke: '#334155', strokeWidth: 1.5 }));
    group.add(new Konva.Arc({ innerRadius: 7, outerRadius: 8, angle: 260, rotation: 140, stroke: '#f59e0b', strokeWidth: 2 }));
  } else if (type === 'light2way') {
    group.add(new Konva.Circle({ radius: 9, fill: '#fef3c7', stroke: '#d97706', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: '2W', x: -6, y: -5, fontSize: 9, fill: '#b45309', fontStyle: 'bold' }));

  } else if (type === 'gpoSingle') {
    group.add(new Konva.Arc({ innerRadius: 0, outerRadius: 11, angle: 180, rotation: 180, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2 }));
    group.add(new Konva.Line({ points: [-3, 3, -1, 0], stroke: '#15803d', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [3, 3, 1, 0], stroke: '#15803d', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [0, -4, 0, -1], stroke: '#15803d', strokeWidth: 1.5 }));
  } else if (type === 'gpo') {
    group.add(new Konva.Rect({ x: -12, y: -8, width: 24, height: 16, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2, cornerRadius: 2 }));
    group.add(new Konva.Line({ points: [-7, -3, -7, 3], stroke: '#15803d', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [7, -3, 7, 3], stroke: '#15803d', strokeWidth: 1.5 }));
  } else if (type === 'gpoQuad') {
    group.add(new Konva.Rect({ x: -16, y: -8, width: 32, height: 16, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2, cornerRadius: 2 }));
    group.add(new Konva.Line({ points: [-11, -3, -11, 3], stroke: '#15803d', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [-4, -3, -4, 3], stroke: '#15803d', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [4, -3, 4, 3], stroke: '#15803d', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [11, -3, 11, 3], stroke: '#15803d', strokeWidth: 1.5 }));
  } else if (type === 'gpoWp') {
    group.add(new Konva.Rect({ x: -12, y: -8, width: 24, height: 16, fill: '#e0f2fe', stroke: '#0284c7', strokeWidth: 2, cornerRadius: 3 }));
    group.add(new Konva.Text({ text: 'WP', x: -8, y: -5, fontSize: 9, fill: '#0369a1', fontStyle: 'bold' }));
  } else if (type === 'usb') {
    group.add(new Konva.Rect({ x: -12, y: -8, width: 24, height: 16, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2, cornerRadius: 2 }));
    group.add(new Konva.Text({ text: 'USB', x: -9, y: -5, fontSize: 8, fill: '#15803d', fontStyle: 'bold' }));
  } else if (type === 'isolator') {
    group.add(new Konva.Rect({ x: -10, y: -10, width: 20, height: 20, fill: '#fef3c7', stroke: '#b45309', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: 'ISO', x: -9, y: -5, fontSize: 8, fill: '#b45309', fontStyle: 'bold' }));

  } else if (type === 'data') {
    group.add(new Konva.RegularPolygon({ sides: 3, radius: 12, fill: '#ccfbf1', stroke: '#0d9488', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: '1', x: -3, y: -3, fontSize: 9, fill: '#0f766e', fontStyle: 'bold' }));
  } else if (type === 'data2') {
    group.add(new Konva.RegularPolygon({ sides: 3, radius: 12, fill: '#ccfbf1', stroke: '#0d9488', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: '2', x: -3, y: -3, fontSize: 9, fill: '#0f766e', fontStyle: 'bold' }));
  } else if (type === 'data3') {
    group.add(new Konva.RegularPolygon({ sides: 3, radius: 12, fill: '#ccfbf1', stroke: '#0d9488', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: '3', x: -3, y: -3, fontSize: 9, fill: '#0f766e', fontStyle: 'bold' }));
  } else if (type === 'data4') {
    group.add(new Konva.RegularPolygon({ sides: 3, radius: 12, fill: '#ccfbf1', stroke: '#0d9488', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: '4', x: -3, y: -3, fontSize: 9, fill: '#0f766e', fontStyle: 'bold' }));
  } else if (type === 'data5') {
    group.add(new Konva.RegularPolygon({ sides: 3, radius: 12, fill: '#ccfbf1', stroke: '#0d9488', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: '5', x: -3, y: -3, fontSize: 9, fill: '#0f766e', fontStyle: 'bold' }));
  } else if (type === 'datarack') {
    group.add(new Konva.Rect({ x: -14, y: -16, width: 28, height: 32, fill: '#0f172a', stroke: '#2dd4bf', strokeWidth: 2, cornerRadius: 3 }));
    group.add(new Konva.Rect({ x: -10, y: -12, width: 20, height: 5, fill: '#134e4a', stroke: '#2dd4bf', strokeWidth: 1 }));
    group.add(new Konva.Rect({ x: -10, y: -4, width: 20, height: 5, fill: '#134e4a', stroke: '#2dd4bf', strokeWidth: 1 }));
    group.add(new Konva.Rect({ x: -10, y: 4, width: 20, height: 5, fill: '#134e4a', stroke: '#2dd4bf', strokeWidth: 1 }));
    group.add(new Konva.Circle({ radius: 1.5, x: -6, y: -9.5, fill: '#f43f5e' }));
    group.add(new Konva.Circle({ radius: 1.5, x: -6, y: -1.5, fill: '#10b981' }));
  } else if (type === 'intercom') {
    group.add(new Konva.Circle({ radius: 12, fill: '#581c87', stroke: '#c084fc', strokeWidth: 2 }));
    group.add(new Konva.Circle({ radius: 4, fill: '#c084fc' }));
    group.add(new Konva.Arc({ innerRadius: 7, outerRadius: 9, angle: 90, rotation: 225, stroke: '#e9d5ff', strokeWidth: 1.5 }));
  } else if (type === 'doorstation') {
    group.add(new Konva.Rect({ x: -8, y: -14, width: 16, height: 28, fill: '#1e293b', stroke: '#94a3b8', strokeWidth: 2, cornerRadius: 2 }));
    group.add(new Konva.Circle({ radius: 3, y: -7, fill: '#38bdf8' }));
    group.add(new Konva.Line({ points: [-5, 0, 5, 0], stroke: '#cbd5e1', strokeWidth: 1 }));
    group.add(new Konva.Line({ points: [-5, 4, 5, 4], stroke: '#cbd5e1', strokeWidth: 1 }));
    group.add(new Konva.Circle({ radius: 2.5, y: 9, fill: '#f59e0b' }));
  } else if (type === 'cctv') {
    group.add(new Konva.Arc({ innerRadius: 0, outerRadius: 12, angle: 180, rotation: 180, fill: '#334155', stroke: '#38bdf8', strokeWidth: 2 }));
    group.add(new Konva.Rect({ x: -8, y: 0, width: 16, height: 6, fill: '#0f172a', stroke: '#38bdf8', strokeWidth: 1, cornerRadius: 2 }));
    group.add(new Konva.Circle({ radius: 3, x: 0, y: 3, fill: '#38bdf8' }));

  } else if (type === 'jbox') {
    group.add(new Konva.Circle({ radius: 11, fill: '#ffedd5', stroke: '#ea580c', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: 'J', x: -4, y: -5, fontSize: 11, fill: '#c2410c', fontStyle: 'bold' }));
  } else if (type === 'smoke') {
    group.add(new Konva.Circle({ radius: 12, fill: '#fce7f3', stroke: '#be185d', strokeWidth: 2 }));
    group.add(new Konva.Circle({ radius: 6, stroke: '#be185d', strokeWidth: 1.5 }));
  } else if (type === 'fan') {
    group.add(new Konva.Circle({ radius: 4, fill: '#0284c7' }));
    group.add(new Konva.Line({ points: [0, -3, 0, -13], stroke: '#0284c7', strokeWidth: 2.5, strokeCap: 'round' }));
    group.add(new Konva.Line({ points: [2.5, 1.5, 11, 7], stroke: '#0284c7', strokeWidth: 2.5, strokeCap: 'round' }));
    group.add(new Konva.Line({ points: [-2.5, 1.5, -11, 7], stroke: '#0284c7', strokeWidth: 2.5, strokeCap: 'round' }));
  } else if (type === 'exhaustfan') {
    group.add(new Konva.Circle({ radius: 12, fill: '#e0f2fe', stroke: '#0369a1', strokeWidth: 2 }));
    group.add(new Konva.Line({ points: [-7, -7, 7, 7], stroke: '#0369a1', strokeWidth: 2 }));
    group.add(new Konva.Line({ points: [-7, 7, 7, -7], stroke: '#0369a1', strokeWidth: 2 }));
  } else if (type === 'spitfire') {
    group.add(new Konva.Circle({ radius: 10, fill: '#dcfce7', stroke: '#15803d', strokeWidth: 2 }));
    group.add(new Konva.Circle({ radius: 3, fill: '#dc2626' }));
  } else if (type === 'switchboard') {
    group.add(new Konva.Rect({ x: -16, y: -12, width: 32, height: 24, fill: '#1e293b', stroke: '#38bdf8', strokeWidth: 2, cornerRadius: 3 }));
    group.add(new Konva.Line({ points: [-10, -6, -10, 6], stroke: '#cbd5e1', strokeWidth: 2 }));
    group.add(new Konva.Line({ points: [-4, -6, -4, 6], stroke: '#cbd5e1', strokeWidth: 2 }));
    group.add(new Konva.Line({ points: [2, -6, 2, 6], stroke: '#cbd5e1', strokeWidth: 2 }));
    group.add(new Konva.Text({ text: 'MSB', x: 6, y: -4, fontSize: 7, fill: '#38bdf8', fontStyle: 'bold' }));
  } else if (type === 'subboard') {
    group.add(new Konva.Rect({ x: -14, y: -10, width: 28, height: 20, fill: '#1e293b', stroke: '#38bdf8', strokeWidth: 2, cornerRadius: 3 }));
    group.add(new Konva.Line({ points: [-7, -5, -7, 5], stroke: '#cbd5e1', strokeWidth: 1.5 }));
    group.add(new Konva.Line({ points: [-2, -5, -2, 5], stroke: '#cbd5e1', strokeWidth: 1.5 }));
    group.add(new Konva.Text({ text: 'DB', x: 4, y: -4, fontSize: 8, fill: '#38bdf8', fontStyle: 'bold' }));
  }

  let compDragStartX = 0;
  let compDragStartY = 0;

  group.on('dragstart', () => {
    compDragStartX = group.x();
    compDragStartY = group.y();
  });

  group.on('dragmove', () => {
    const compType = group.getAttr('compType');
    const snap = checkAlignmentSnap(group.x(), group.y(), group.id(), compType);
    group.position({ x: snap.snappedX, y: snap.snappedY });
    renderGuideLines(snap.lineX, snap.lineY);
    updateConnectedWires();
  });

  group.on('dragend', () => {
    clearGuideLines();
    if (Math.hypot(group.x() - compDragStartX, group.y() - compDragStartY) > 2) {
      undoStack.push({
        action: 'move_component',
        id: group.id(),
        oldX: compDragStartX,
        oldY: compDragStartY,
        newX: group.x(),
        newY: group.y()
      });
      redoStack.length = 0;
      updateStatus();
    }
  });

  group.on('click tap', (e) => {
    e.cancelBubble = true;
    if (currentComponent === 'delete') {
      deleteComponent(group);
    } else if (currentComponent === 'wire') {
      handleWiringClick(group);
    }
  });

  return group;
}

function handleWiringClick(node) {
  if (!wiringStartNode) {
    wiringStartNode = node;
    const ring = new Konva.Circle({ radius: 24, stroke: '#6366f1', strokeWidth: 2.5, dash: [4, 4], name: 'highlight-ring' });
    node.add(ring);
    electricalLayer.batchDraw();
  } else {
    if (wiringStartNode.id() !== node.id()) {
      createWire(wiringStartNode.id(), node.id());
    }
    resetWiringSelection();
  }
}

function computePointsForWire(fromX, fromY, toX, toY, routingStyle, customMidX = null, customMidY = null) {
  if (routingStyle === 'orthogonal') {
    const midX = (customMidX !== null) ? customMidX : (fromX + toX) / 2;
    return [fromX, fromY, midX, fromY, midX, toY, toX, toY];
  } else {
    if (customMidX !== null && customMidY !== null) {
      return [fromX, fromY, customMidX, customMidY, toX, toY];
    }
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const offset = Math.min(dist * 0.18, 30);
    return [fromX, fromY, midX + (-dy / dist) * offset, midY + (dx / dist) * offset, toX, toY];
  }
}

function createWire(fromId, toId, wireId = null, recordHistory = true, type = null, routingStyle = null, customMidX = null, customMidY = null) {
  const from = electricalLayer.findOne('#' + fromId);
  const to = electricalLayer.findOne('#' + toId);
  if (!from || !to) return;

  const wType = type || currentWireType;
  const rStyle = routingStyle || currentWireRoutingStyle;
  const style = WIRE_TYPES[wType] || WIRE_TYPES.power;

  const id = wireId || ('wire_' + (++wireIdCounter));
  const pts = computePointsForWire(from.x(), from.y(), to.x(), to.y(), rStyle, customMidX, customMidY);
  const midPoint = (rStyle === 'orthogonal') ? { x: pts[2], y: (pts[1] + pts[5]) / 2 } : { x: pts[2], y: pts[3] };

  const line = new Konva.Line({
    id: id,
    points: pts,
    stroke: style.stroke,
    strokeWidth: 2.5,
    dash: style.dash,
    tension: (rStyle === 'curved') ? 0.5 : 0,
    hitStrokeWidth: WIRE_HIT_WIDTH
  });

  const wireRecord = { id, fromId, toId, type: wType, routingStyle: rStyle, midX: midPoint.x, midY: midPoint.y, lineNode: line };

  line.on('click tap', (e) => {
    e.cancelBubble = true;
    if (currentComponent === 'delete') {
      deleteWire(id);
    } else {
      showWireControlHandle(wireRecord);
    }
  });

  wireLayer.add(line);
  wireLayer.batchDraw();

  wires.push(wireRecord);
  counts.wire++;
  updateStatus();

  if (recordHistory) {
    undoStack.push({ action: 'add_wire', data: { id, fromId, toId, type: wType, routingStyle: rStyle, midX: wireRecord.midX, midY: wireRecord.midY } });
    redoStack.length = 0;
    updateStatus();
  }
}

function showWireControlHandle(w) {
  clearWireControlHandle();
  selectedWireForEdit = w;

  const handle = new Konva.Circle({
    x: w.midX,
    y: w.midY,
    radius: 8,
    fill: '#38bdf8',
    stroke: '#ffffff',
    strokeWidth: 2.5,
    draggable: true,
    name: 'wire-control-handle',
    shadowColor: 'black',
    shadowBlur: 6
  });

  let oldMidX = w.midX;
  let oldMidY = w.midY;

  handle.on('dragmove', () => {
    w.midX = handle.x();
    w.midY = handle.y();
    updateWireGeometry(w);
  });

  handle.on('dragend', () => {
    undoStack.push({ action: 'move_wire_handle', data: { id: w.id, oldMidX, oldMidY, newMidX: w.midX, newMidY: w.midY } });
    redoStack.length = 0;
    updateStatus();
  });

  controlLayer.add(handle);
  controlLayer.batchDraw();
}

function clearWireControlHandle() {
  controlLayer.destroyChildren();
  controlLayer.batchDraw();
  selectedWireForEdit = null;
}

function updateWireGeometry(w) {
  const from = electricalLayer.findOne('#' + w.fromId);
  const to = electricalLayer.findOne('#' + w.toId);
  if (from && to) {
    const pts = computePointsForWire(from.x(), from.y(), to.x(), to.y(), w.routingStyle, w.midX, w.midY);
    w.lineNode.points(pts);
    wireLayer.batchDraw();
  }
}

function updateConnectedWires() {
  wires.forEach(w => {
    const from = electricalLayer.findOne('#' + w.fromId);
    const to = electricalLayer.findOne('#' + w.toId);
    if (from && to) {
      const pts = computePointsForWire(from.x(), from.y(), to.x(), to.y(), w.routingStyle, w.midX, w.midY);
      w.lineNode.points(pts);
    }
  });
  wireLayer.batchDraw();

  if (selectedWireForEdit) {
    const h = controlLayer.findOne('.wire-control-handle');
    if (h) {
      h.position({ x: selectedWireForEdit.midX, y: selectedWireForEdit.midY });
      controlLayer.batchDraw();
    }
  }
}

function deleteWire(wireId, recordHistory = true) {
  clearWireControlHandle();
  const idx = wires.findIndex(w => w.id === wireId);
  if (idx === -1) return;
  const w = wires[idx];
  w.lineNode.destroy();
  wires.splice(idx, 1);
  wireLayer.batchDraw();
  counts.wire--;
  updateStatus();

  if (recordHistory) {
    undoStack.push({ action: 'delete_wire', data: { id: w.id, fromId: w.fromId, toId: w.toId, type: w.type, routingStyle: w.routingStyle, midX: w.midX, midY: w.midY } });
    redoStack.length = 0;
    updateStatus();
  }
}

function deleteComponent(node, recordHistory = true) {
  resetWiringSelection();
  clearWireControlHandle();
  clearGuideLines();
  const compId = node.id();
  const type = node.getAttr('compType');
  const data = { id: compId, type, x: node.x(), y: node.y() };

  const attached = wires.filter(w => w.fromId === compId || w.toId === compId);
  attached.forEach(w => deleteWire(w.id, false));

  node.destroy();
  electricalLayer.batchDraw();
  if (counts[type] !== undefined) counts[type]--;
  updateStatus();

  if (recordHistory) {
    undoStack.push({
      action: 'delete_component',
      data,
      cascadeWires: attached.map(w => ({ id: w.id, fromId: w.fromId, toId: w.toId, type: w.type, routingStyle: w.routingStyle, midX: w.midX, midY: w.midY }))
    });
    redoStack.length = 0;
    updateStatus();
  }
}

function handleStageTap(e) {
  dismissWelcome();
  document.getElementById('burgerMenu').style.display = 'none';
  if (multiTouchDetected) return;

  if (isCalibratingScale) {
    const transform = stage.getAbsoluteTransform().copy().invert();
    const pointer = stage.getPointerPosition();
    const pos = transform.point(pointer);

    if (!scalePoint1) {
      scalePoint1 = pos;
      const banner = document.getElementById('scaleBanner');
      if (banner) banner.innerText = "📏 Tap second point of known scale reference";

      const dot = new Konva.Circle({ x: pos.x, y: pos.y, radius: 5, fill: '#7c3aed', name: 'scale-anchor' });
      guideLayer.add(dot);
      guideLayer.batchDraw();
    } else {
      isCalibratingScale = false;
      const banner = document.getElementById('scaleBanner');
      if (banner) banner.style.display = 'none';
      guideLayer.destroyChildren();
      guideLayer.batchDraw();

      const pixelDist = Math.hypot(pos.x - scalePoint1.x, pos.y - scalePoint1.y);
      const realMetersPrompt = prompt("Enter real-world length between these two points in meters (e.g. 2.5):", "2.5");

      if (realMetersPrompt) {
        const meters = parseFloat(realMetersPrompt);
        if (meters > 0) {
          scalePixelsPerMeter = pixelDist / meters;
          document.getElementById('lblScaleDisplay').innerText = `${scalePixelsPerMeter.toFixed(1)} px/m`;

          studioOpenings.forEach(op => {
            op.length = (op.nominalMeters || 0.9) * scalePixelsPerMeter;
          });

          alert(`Scale calibrated successfully! (${scalePixelsPerMeter.toFixed(1)} pixels/meter)`);
        }
      }
      scalePoint1 = null;
    }
    return;
  }

  if (e.target === stage || e.target.hasName('planImage')) {
    clearWireControlHandle();
    closeClearPopover();
  }

  if (!currentComponent || currentComponent === 'delete' || currentComponent === 'wire') return;
  if (e.target.findAncestor('.component', true)) return;

  const transform = stage.getAbsoluteTransform().copy().invert();
  const pointer = stage.getPointerPosition();
  const pos = transform.point(pointer);

  const symbol = createSymbol(currentComponent, pos.x, pos.y);
  electricalLayer.add(symbol);
  electricalLayer.batchDraw();

  if (counts[currentComponent] !== undefined) counts[currentComponent]++;
  undoStack.push({ action: 'add_component', data: { id: symbol.id(), type: currentComponent, x: pos.x, y: pos.y } });
  redoStack.length = 0;
  updateStatus();
}

function updateStatus() {
  document.getElementById('btnUndo').disabled = undoStack.length === 0;
  document.getElementById('btnRedo').disabled = redoStack.length === 0;
}

function undo() {
  if (undoStack.length === 0) return;
  resetWiringSelection();
  clearWireControlHandle();
  clearGuideLines();
  closeClearPopover();
  const entry = undoStack.pop();

  if (entry.action === 'move_component') {
    const node = electricalLayer.findOne('#' + entry.id);
    if (node) {
      node.position({ x: entry.oldX, y: entry.oldY });
      electricalLayer.batchDraw();
      updateConnectedWires();
    }
  } else if (entry.action === 'add_component') {
    const node = electricalLayer.findOne('#' + entry.data.id);
    if (node) { node.destroy(); if (counts[entry.data.type] !== undefined) counts[entry.data.type]--; electricalLayer.batchDraw(); }
  } else if (entry.action === 'delete_component') {
    const node = createSymbol(entry.data.type, entry.data.x, entry.data.y, entry.data.id);
    electricalLayer.add(node);
    if (counts[entry.data.type] !== undefined) counts[entry.data.type]++;
    electricalLayer.batchDraw();
    if (entry.cascadeWires) entry.cascadeWires.forEach(w => createWire(w.fromId, w.toId, w.id, false, w.type, w.routingStyle, w.midX, w.midY));
  } else if (entry.action === 'add_wire') {
    deleteWire(entry.data.id, false);
  } else if (entry.action === 'delete_wire') {
    createWire(entry.data.fromId, entry.data.toId, entry.data.id, false, entry.data.type, entry.data.routingStyle, entry.data.midX, entry.data.midY);
  } else if (entry.action === 'move_wire_handle') {
    const w = wires.find(item => item.id === entry.data.id);
    if (w) {
      w.midX = entry.data.oldMidX;
      w.midY = entry.data.oldMidY;
      updateWireGeometry(w);
    }
  } else if (entry.action === 'clear_wires') {
    entry.data.forEach(w => createWire(w.fromId, w.toId, w.id, false, w.type, w.routingStyle, w.midX, w.midY));
  } else if (entry.action === 'clear_all') {
    entry.components.forEach(c => {
      const node = createSymbol(c.type, c.x, c.y, c.id);
      electricalLayer.add(node);
      if (counts[c.type] !== undefined) counts[c.type]++;
    });
    electricalLayer.batchDraw();
    entry.wires.forEach(w => createWire(w.fromId, w.toId, w.id, false, w.type, w.routingStyle, w.midX, w.midY));
  }

  redoStack.push(entry);
  updateStatus();
}

function redo() {
  if (redoStack.length === 0) return;
  resetWiringSelection();
  clearWireControlHandle();
  clearGuideLines();
  closeClearPopover();
  const entry = redoStack.pop();

  if (entry.action === 'move_component') {
    const node = electricalLayer.findOne('#' + entry.id);
    if (node) {
      node.position({ x: entry.newX, y: entry.newY });
      electricalLayer.batchDraw();
      updateConnectedWires();
    }
  } else if (entry.action === 'add_component') {
    const node = createSymbol(entry.data.type, entry.data.x, entry.data.y, entry.data.id);
    electricalLayer.add(node);
    if (counts[entry.data.type] !== undefined) counts[entry.data.type]++;
    electricalLayer.batchDraw();
  } else if (entry.action === 'delete_component') {
    const node = electricalLayer.findOne('#' + entry.data.id);
    if (node) deleteComponent(node, false);
  } else if (entry.action === 'add_wire') {
    createWire(entry.data.fromId, entry.data.toId, entry.data.id, false, entry.data.type, entry.data.routingStyle, entry.data.midX, entry.data.midY);
  } else if (entry.action === 'delete_wire') {
    deleteWire(entry.data.id, false);
  } else if (entry.action === 'move_wire_handle') {
    const w = wires.find(item => item.id === entry.data.id);
    if (w) {
      w.midX = entry.data.newMidX;
      w.midY = entry.data.newMidY;
      updateWireGeometry(w);
    }
  } else if (entry.action === 'clear_wires') {
    wires.forEach(w => w.lineNode.destroy());
    wires = [];
    wireLayer.batchDraw();
    counts.wire = 0;
  } else if (entry.action === 'clear_all') {
    wires.forEach(w => w.lineNode.destroy());
    wires = [];
    wireLayer.batchDraw();
    counts.wire = 0;
    electricalLayer.find('.component').forEach(c => c.destroy());
    electricalLayer.batchDraw();
    Object.keys(CATALOG).forEach(k => counts[k] = 0);
  }

  undoStack.push(entry);
  updateStatus();
}

function openQuoteModal() {
  closeClearPopover();
  const tbody = document.getElementById('takeoffBody');
  tbody.innerHTML = '';
  let subtotal = 0;

  Object.keys(CATALOG).forEach(type => {
    const qty = counts[type] || 0;
    if (qty > 0) {
      const item = CATALOG[type];
      const total = qty * item.rate;
      subtotal += total;
      tbody.innerHTML += `<tr><td>${item.name}</td><td style="text-align:center;">${qty}</td><td style="text-align:right;">$${item.rate}</td><td style="text-align:right;">$${total}</td></tr>`;
    }
  });

  let totalMeters = 0;
  wires.forEach(w => {
    const f = electricalLayer.findOne('#' + w.fromId);
    const t = electricalLayer.findOne('#' + w.toId);
    if (f && t) totalMeters += (Math.hypot(t.x() - f.x(), t.y() - f.y()) / scalePixelsPerMeter) * 1.15;
  });

  if (totalMeters > 0) {
    const m = Math.ceil(totalMeters);
    const cost = m * RATES.cablePerMeterRate;
    subtotal += cost;
    tbody.innerHTML += `<tr><td>TPS Cable (Est. Runs)</td><td style="text-align:center;">${m}m</td><td style="text-align:right;">$${RATES.cablePerMeterRate}</td><td style="text-align:right;">$${cost.toFixed(2)}</td></tr>`;
  }

  const gst = subtotal * 0.10;
  document.getElementById('valSubtotal').innerText = `$${subtotal.toFixed(2)}`;
  document.getElementById('valGst').innerText = `$${gst.toFixed(2)}`;
  document.getElementById('valTotal').innerText = `$${(subtotal + gst).toFixed(2)}`;
  document.getElementById('quoteModal').style.display = 'flex';
}

function closeQuoteModal() {
  document.getElementById('quoteModal').style.display = 'none';
}

/* ==========================================================================
   SPARKY SKETCH STUDIO ENGINE
   ========================================================================== */
let studioCanvas, studioCtx;
let studioTool = 'wall';
let studioGridSnap = true;

let studioLines = [];
let studioOpenings = [];
let studioLabels = [];
let studioUndoStack = [];
let studioRedoStack = [];
let selectedStudioEntity = null;

let studioScale = 1.0;
let studioPanX = 0;
let studioPanY = 0;
let isStudioMultiTouch = false;
let studioInitialPinchDist = 0;
let studioInitialScale = 1.0;
let studioInitialCenter = null;
let studioInitialPan = null;

let isStudioDrawing = false;
let studioStartPoint = null;
let studioCurrentPoint = null;

const STUDIO_GRID_SIZE = 20;
const CORNER_SNAP_DIST = 26;
const T_SNAP_DIST = 16;
const TOUCH_Y_OFFSET = 45;

function initStudio() {
  studioCanvas = document.getElementById('studioCanvas');
  if (!studioCanvas) return;
  studioCtx = studioCanvas.getContext('2d');

  studioCanvas.addEventListener('pointerdown', handleStudioPointerDown);
  studioCanvas.addEventListener('pointermove', handleStudioPointerMove);
  studioCanvas.addEventListener('pointerup', handleStudioPointerUp);
  studioCanvas.addEventListener('pointercancel', handleStudioPointerUp);

  studioCanvas.addEventListener('touchstart', handleStudioTouchStart, { passive: false });
  studioCanvas.addEventListener('touchmove', handleStudioTouchMove, { passive: false });
  studioCanvas.addEventListener('touchend', handleStudioTouchEnd, { passive: false });
}

function openStudioModal() {
  dismissWelcome();
  const modal = document.getElementById('studioModal');
  modal.style.display = 'flex';
  setStudioTool('wall');
  resizeStudio();
}

function closeStudioModal() {
  document.getElementById('studioModal').style.display = 'none';
  hideEditHud();
}

function confirmStudioCancel() {
  if (studioLines.length > 0 || studioOpenings.length > 0 || studioLabels.length > 0) {
    if (!confirm("Are you sure you want to cancel? All unsaved drawing progress will be lost.")) {
      return;
    }
  }
  studioLines = [];
  studioOpenings = [];
  studioLabels = [];
  studioUndoStack = [];
  studioRedoStack = [];
  selectedStudioEntity = null;
  closeStudioModal();
}

function resizeStudio() {
  if (!studioCanvas) return;
  const wrapper = document.getElementById('studioCanvasWrapper');
  if (!wrapper) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = wrapper.getBoundingClientRect();
  studioCanvas.width = rect.width * dpr;
  studioCanvas.height = rect.height * dpr;
  renderStudio();
}

function setStudioTool(tool) {
  studioTool = tool;
  const tools = ['select', 'wall', 'room', 'door', 'slider', 'window', 'label', 'eraser'];
  tools.forEach(t => {
    const el = document.getElementById('btnStudio' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.classList.toggle('selected', tool === t);
  });

  if (tool !== 'select') {
    selectedStudioEntity = null;
    hideEditHud();
  }

  const banner = document.getElementById('studioBanner');
  if (banner) {
    if (tool === 'select') {
      banner.style.display = 'block';
      banner.innerText = '✏️ Tap any wall, door, slider, window or label to edit properties';
    } else if (tool === 'door') {
      banner.style.display = 'block';
      banner.innerText = '🚪 Slide & tap along a wall to place a 900mm swing door';
    } else if (tool === 'slider') {
      banner.style.display = 'block';
      banner.innerText = '🪟 Slide & tap along a wall to place a sliding door';
    } else if (tool === 'window') {
      banner.style.display = 'block';
      banner.innerText = '🪟 Slide & tap along a wall to stamp a 1200mm window';
    } else if (tool === 'label') {
      banner.style.display = 'block';
      banner.innerText = '🏷️ Tap a room center to add a zone name';
    } else if (tool === 'wall') {
      banner.style.display = 'block';
      banner.innerText = '🧱 Draw walls (Toggle Cavity via Edit HUD)';
    } else {
      banner.style.display = 'none';
    }
  }
  renderStudio();
}

function toggleStudioGridSnap() {
  studioGridSnap = !studioGridSnap;
  document.getElementById('btnStudioSnap').classList.toggle('active-toggle', studioGridSnap);
}

function checkOpeningCollision(candidate, ignoreIndex = -1) {
  const cHalf = candidate.length / 2;
  for (let i = 0; i < studioOpenings.length; i++) {
    if (i === ignoreIndex) continue;
    const op = studioOpenings[i];
    if (op.wallRef !== candidate.wall) continue;

    const distBetween = Math.hypot(op.x - candidate.x, op.y - candidate.y);
    const minClearance = (op.length / 2) + cHalf + 8;
    if (distBetween < minClearance) {
      return true;
    }
  }
  return false;
}

function findClosestWallForOpening(worldX, worldY, ignoreOpeningIndex = -1) {
  let closestWall = null;
  let bestDist = 38 / studioScale;
  let bestProj = null;

  for (const l of studioLines) {
    const proj = getPointSegmentProjection(worldX, worldY, l.x1, l.y1, l.x2, l.y2);
    if (proj.dist < bestDist) {
      bestDist = proj.dist;
      closestWall = l;
      bestProj = proj;
    }
  }

  if (closestWall && bestProj) {
    const wLen = Math.hypot(closestWall.x2 - closestWall.x1, closestWall.y2 - closestWall.y1);
    let nominalM = 0.9;
    if (studioTool === 'slider') nominalM = 1.8;
    else if (studioTool === 'window') nominalM = 1.2;

    const opLen = nominalM * scalePixelsPerMeter;
    const halfOp = Math.min(opLen / 2, wLen * 0.45);
    const clampedDist = Math.max(halfOp, Math.min(bestProj.t * wLen, wLen - halfOp));
    const factor = clampedDist / (wLen || 1);

    const clampedX = closestWall.x1 + factor * (closestWall.x2 - closestWall.x1);
    const clampedY = closestWall.y1 + factor * (closestWall.y2 - closestWall.y1);
    const angle = Math.atan2(closestWall.y2 - closestWall.y1, closestWall.x2 - closestWall.x1);

    const candidate = { wall: closestWall, x: clampedX, y: clampedY, angle, length: opLen, nominalMeters: nominalM };
    const hasCollision = checkOpeningCollision(candidate, ignoreOpeningIndex);

    return { ...candidate, hasCollision };
  }
  return null;
}

function getStudioCanvasPoint(e) {
  const rect = studioCanvas.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;

  let x = (rawX - studioPanX) / studioScale;
  let y = (rawY - studioPanY) / studioScale;

  let snapped = false;
  let snappedWall = null;

  if (studioTool === 'door' || studioTool === 'slider' || studioTool === 'window') {
    const openingCandidate = findClosestWallForOpening(x, y);
    if (openingCandidate) {
      return {
        x: openingCandidate.x,
        y: openingCandidate.y,
        snapped: true,
        snappedWall: openingCandidate.wall,
        openingCandidate,
        rawTouchX: rawX,
        rawTouchY: rawY
      };
    }
  }

  for (const l of studioLines) {
    if (Math.hypot(l.x1 - x, l.y1 - y) < CORNER_SNAP_DIST / studioScale) {
      x = l.x1;
      y = l.y1;
      snapped = true;
      snappedWall = l;
      break;
    }
    if (Math.hypot(l.x2 - x, l.y2 - y) < CORNER_SNAP_DIST / studioScale) {
      x = l.x2;
      y = l.y2;
      snapped = true;
      snappedWall = l;
      break;
    }
  }

  if (!snapped) {
    for (const l of studioLines) {
      const proj = getPointSegmentProjection(x, y, l.x1, l.y1, l.x2, l.y2);
      if (proj.dist < T_SNAP_DIST / studioScale && proj.t > 0.05 && proj.t < 0.95) {
        x = proj.x;
        y = proj.y;
        snapped = true;
        snappedWall = l;
        break;
      }
    }
  }

  if (!snapped && studioGridSnap) {
    x = Math.round(x / STUDIO_GRID_SIZE) * STUDIO_GRID_SIZE;
    y = Math.round(y / STUDIO_GRID_SIZE) * STUDIO_GRID_SIZE;
  }

  return { x, y, snapped, snappedWall, rawTouchX: rawX, rawTouchY: rawY };
}

function getPointSegmentProjection(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return { x: x1, y: y1, dist: Math.hypot(px - x1, py - y1), t: 0 };
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return { x: projX, y: projY, dist: Math.hypot(px - projX, py - projY), t };
}

function autoStraightenOrthogonal(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const absAngle = Math.abs(angle);

  if (absAngle < 15 || absAngle > 165) return { x: p2.x, y: p1.y };
  if (Math.abs(absAngle - 90) < 15) return { x: p1.x, y: p2.y };
  return p2;
}

function unifyAllCollinearLines() {
  let changed = false;
  for (let i = 0; i < studioLines.length; i++) {
    for (let j = i + 1; j < studioLines.length; j++) {
      const a = studioLines[i];
      const b = studioLines[j];
      if (a.isCavity !== b.isCavity) continue;

      const aHoriz = Math.abs(a.y1 - a.y2) < 4;
      const bHoriz = Math.abs(b.y1 - b.y2) < 4;
      const aVert = Math.abs(a.x1 - a.x2) < 4;
      const bVert = Math.abs(b.x1 - b.x2) < 4;

      if (aHoriz && bHoriz && Math.abs(a.y1 - b.y1) < 8) {
        const aMinX = Math.min(a.x1, a.x2);
        const aMaxX = Math.max(a.x1, a.x2);
        const bMinX = Math.min(b.x1, b.x2);
        const bMaxX = Math.max(b.x1, b.x2);

        if (Math.max(aMinX, bMinX) <= Math.min(aMaxX, bMaxX) + 12) {
          a.x1 = Math.min(aMinX, bMinX);
          a.x2 = Math.max(aMaxX, bMaxX);
          a.y1 = (a.y1 + b.y1) / 2;
          a.y2 = a.y1;
          studioLines.splice(j, 1);
          changed = true;
          j--;
        }
      } else if (aVert && bVert && Math.abs(a.x1 - b.x1) < 8) {
        const aMinY = Math.min(a.y1, a.y2);
        const aMaxY = Math.max(a.y1, a.y2);
        const bMinY = Math.min(b.y1, b.y2);
        const bMaxY = Math.max(b.y1, b.y2);

        if (Math.max(aMinY, bMinY) <= Math.min(aMaxY, bMaxY) + 12) {
          a.y1 = Math.min(aMinY, bMinY);
          a.y2 = Math.max(aMaxY, bMaxY);
          a.x1 = (a.x1 + b.x1) / 2;
          a.x2 = a.x1;
          studioLines.splice(j, 1);
          changed = true;
          j--;
        }
      }
    }
  }
  return changed;
}

function recordStudioState() {
  studioUndoStack.push({
    lines: JSON.parse(JSON.stringify(studioLines)),
    openings: JSON.parse(JSON.stringify(studioOpenings)),
    labels: JSON.parse(JSON.stringify(studioLabels)),
    scale: scalePixelsPerMeter
  });
  studioRedoStack = [];
  updateStudioStatus();
}

function handleStudioTouchStart(e) {
  if (e.touches.length >= 2) {
    e.preventDefault();
    isStudioMultiTouch = true;
    isStudioDrawing = false;
    studioStartPoint = null;
    studioCurrentPoint = null;

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    studioInitialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    studioInitialScale = studioScale;
    studioInitialCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    studioInitialPan = { x: studioPanX, y: studioPanY };
  }
}

function handleStudioTouchMove(e) {
  if (e.touches.length >= 2 && isStudioMultiTouch) {
    e.preventDefault();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const currentCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };

    const zoomFactor = newDist / (studioInitialPinchDist || 1);
    const newScale = Math.max(0.3, Math.min(studioInitialScale * zoomFactor, 6.0));

    const rect = studioCanvas.getBoundingClientRect();
    const centerCanvasX = studioInitialCenter.x - rect.left;
    const centerCanvasY = studioInitialCenter.y - rect.top;

    studioScale = newScale;
    studioPanX = studioInitialPan.x + (currentCenter.x - studioInitialCenter.x) + (centerCanvasX - studioInitialPan.x) * (1 - newScale / studioInitialScale);
    studioPanY = studioInitialPan.y + (currentCenter.y - studioInitialCenter.y) + (centerCanvasY - studioInitialPan.y) * (1 - newScale / studioInitialScale);

    renderStudio();
  }
}

function handleStudioTouchEnd(e) {
  if (e.touches.length === 0) {
    setTimeout(() => { isStudioMultiTouch = false; }, 150);
  }
}

function handleStudioPointerDown(e) {
  if (isStudioMultiTouch) return;
  if (e.button && e.button !== 0) return;
  e.preventDefault();
  const pt = getStudioCanvasPoint(e);

  isStudioDrawing = true;
  studioStartPoint = pt;
  studioCurrentPoint = pt;

  // Only allow dragging an opening if the pointer down is actually on the selected door/window
  if (studioTool === 'select' && selectedStudioEntity && selectedStudioEntity.type === 'opening') {
    const op = studioOpenings[selectedStudioEntity.index];
    if (Math.hypot(pt.x - op.x, pt.y - op.y) < 30 / studioScale) {
      selectedStudioEntity.isDragging = true;
    }
  }

  renderStudio();
}

function handleStudioPointerMove(e) {
  if (!isStudioDrawing || isStudioMultiTouch) return;
  e.preventDefault();
  let pt = getStudioCanvasPoint(e);

  if (studioTool === 'wall') {
    pt = autoStraightenOrthogonal(studioStartPoint, pt);
  } else if (studioTool === 'select' && selectedStudioEntity && selectedStudioEntity.isDragging) {
    const op = studioOpenings[selectedStudioEntity.index];
    const candidate = findClosestWallForOpening(pt.x, pt.y, selectedStudioEntity.index);
    if (candidate && !candidate.hasCollision) {
      op.x = candidate.x;
      op.y = candidate.y;
      op.angle = candidate.angle;
      op.wallRef = candidate.wall;
    }
  }

  studioCurrentPoint = pt;
  renderStudio();
}

function handleStudioPointerUp(e) {
  if (!isStudioDrawing || isStudioMultiTouch) {
    isStudioDrawing = false;
    studioStartPoint = null;
    studioCurrentPoint = null;
    renderStudio();
    return;
  }
  e.preventDefault();
  isStudioDrawing = false;

  const p1 = studioStartPoint;
  let p2 = studioCurrentPoint;
  const isTap = p1 && p2 && Math.hypot(p2.x - p1.x, p2.y - p1.y) < 12 / studioScale;

  if (selectedStudioEntity && selectedStudioEntity.isDragging) {
    selectedStudioEntity.isDragging = false;
    recordStudioState();
    renderStudio();
    return;
  }

  if (isTap) {
    if (studioTool === 'select') {
      selectEntityAt(p2.x, p2.y);
    } else if (studioTool === 'eraser') {
      eraseStudioEntityAt(p2.x, p2.y);
    } else if (studioTool === 'label') {
      createRoomLabelAt(p2.x, p2.y);
    } else if (studioTool === 'door' || studioTool === 'slider' || studioTool === 'window') {
      stampOpeningAt(p2);
    }
  } else if (p1 && p2 && Math.hypot(p2.x - p1.x, p2.y - p1.y) > 8 / studioScale) {
    if (studioTool === 'wall') {
      recordStudioState();
      p2 = autoStraightenOrthogonal(p1, p2);
      studioLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, isCavity: false });
      unifyAllCollinearLines();
    } else if (studioTool === 'room') {
      recordStudioState();
      studioLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p1.y, isCavity: false });
      studioLines.push({ x1: p2.x, y1: p1.y, x2: p2.x, y2: p2.y, isCavity: false });
      studioLines.push({ x1: p2.x, y1: p2.y, x2: p1.x, y2: p2.y, isCavity: false });
      studioLines.push({ x1: p1.x, y1: p2.y, x2: p1.x, y2: p1.y, isCavity: false });
      unifyAllCollinearLines();
    } else if (studioTool === 'door' || studioTool === 'slider' || studioTool === 'window') {
      stampOpeningAt(p2);
    }
  }

  studioStartPoint = null;
  studioCurrentPoint = null;
  renderStudio();
}

function selectEntityAt(x, y) {
  // 1. Check Openings (Doors, Sliders, Windows) first with an accurate touch radius
  const hitOpening = studioOpenings.findIndex(o => Math.hypot(o.x - x, o.y - y) < 30 / studioScale);
  if (hitOpening !== -1) {
    selectedStudioEntity = { type: 'opening', index: hitOpening, data: studioOpenings[hitOpening] };
    showEditHud();
    renderStudio();
    return;
  }

  // 2. Check Room Labels
  const hitLabel = studioLabels.findIndex(b => Math.hypot(b.x - x, b.y - y) < 28 / studioScale);
  if (hitLabel !== -1) {
    selectedStudioEntity = { type: 'label', index: hitLabel, data: studioLabels[hitLabel] };
    showEditHud();
    renderStudio();
    return;
  }

  // 3. Check Walls & Witness badges
  const hitWall = studioLines.findIndex(l => {
    const proj = getPointSegmentProjection(x, y, l.x1, l.y1, l.x2, l.y2);
    if (proj.dist < 20 / studioScale) return true;

    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const dist = Math.hypot(dx, dy) || 1;
    const normX = -dy / dist;
    const normY = dx / dist;
    const badgeX = (l.x1 + l.x2) / 2 + normX * 22;
    const badgeY = (l.y1 + l.y2) / 2 + normY * 22;
    return Math.hypot(x - badgeX, y - badgeY) < 24 / studioScale;
  });

  if (hitWall !== -1) {
    selectedStudioEntity = { type: 'wall', index: hitWall, data: studioLines[hitWall] };
    showEditHud();
    renderStudio();
    return;
  }

  // 4. Tapping empty canvas space clears selection and hides HUD immediately
  selectedStudioEntity = null;
  hideEditHud();
  renderStudio();
}

function hideEditHud() {
  const hud = document.getElementById('studioEditHud');
  if (hud) {
    hud.style.display = 'none';
  }
}

function showEditHud() {
  const hud = document.getElementById('studioEditHud');
  const title = document.getElementById('studioEditTitle');
  const actions = document.getElementById('studioEditActions');
  if (!hud || !selectedStudioEntity) return;

  hud.style.display = 'flex';
  actions.innerHTML = '';

  let actionButtons = '';

  if (selectedStudioEntity.type === 'opening') {
    const op = studioOpenings[selectedStudioEntity.index];
    if (op.type === 'door') {
      title.innerText = '🚪 Door:';
      actionButtons = `
        <button class="btn-hud" onclick="toggleDoorSwing()">🔄 Swing</button>
        <button class="btn-hud" onclick="toggleDoorHinge()">🔀 Hinge</button>
        <button class="btn-hud" onclick="deleteSelectedStudioEntity()" style="color:#f87171;">🗑️ Delete</button>
      `;
    } else if (op.type === 'slider') {
      title.innerText = '🪟 Slider:';
      actionButtons = `
        <button class="btn-hud" onclick="toggleDoorSwing()">🔄 Track</button>
        <button class="btn-hud" onclick="toggleDoorHinge()">🔀 Panel</button>
        <button class="btn-hud" onclick="deleteSelectedStudioEntity()" style="color:#f87171;">🗑️ Delete</button>
      `;
    } else if (op.type === 'window') {
      title.innerText = '🪟 Window:';
      actionButtons = `
        <button class="btn-hud" onclick="cycleWindowWidth()">📏 Width</button>
        <button class="btn-hud" onclick="deleteSelectedStudioEntity()" style="color:#f87171;">🗑️ Delete</button>
      `;
    }
  } else if (selectedStudioEntity.type === 'label') {
    title.innerText = '🏷️ Label:';
    actionButtons = `
      <button class="btn-hud" onclick="renameSelectedLabel()">✏️ Rename</button>
      <button class="btn-hud" onclick="deleteSelectedStudioEntity()" style="color:#f87171;">🗑️ Delete</button>
    `;
  } else if (selectedStudioEntity.type === 'wall') {
    const w = studioLines[selectedStudioEntity.index];
    title.innerText = w.isCavity ? '🧱🧱 Cavity Wall:' : '🧱 Wall:';
    actionButtons = `
      <button class="btn-hud" onclick="calibrateSelectedWall()">📏 Length</button>
      <button class="btn-hud" onclick="toggleWallCavity()">🧱 Toggle Cavity</button>
      <button class="btn-hud" onclick="deleteSelectedStudioEntity()" style="color:#f87171;">🗑️ Delete</button>
    `;
  }

  actions.innerHTML = actionButtons + `<button class="btn-hud" onclick="dismissEditHud()" style="background: #0284c7; color: white; border-color: #38bdf8;">✓ Done</button>`;
}

function dismissEditHud() {
  selectedStudioEntity = null;
  hideEditHud();
  renderStudio();
}

function hideEditHud() {
  const hud = document.getElementById('studioEditHud');
  if (hud) hud.style.display = 'none';
}

function toggleDoorSwing() {
  if (!selectedStudioEntity || selectedStudioEntity.type !== 'opening') return;
  recordStudioState();
  const op = studioOpenings[selectedStudioEntity.index];
  op.flipV = !op.flipV;
  renderStudio();
}

function toggleDoorHinge() {
  if (!selectedStudioEntity || selectedStudioEntity.type !== 'opening') return;
  recordStudioState();
  const op = studioOpenings[selectedStudioEntity.index];
  op.flipH = !op.flipH;
  renderStudio();
}

function cycleWindowWidth() {
  if (!selectedStudioEntity || selectedStudioEntity.type !== 'opening') return;
  recordStudioState();
  const op = studioOpenings[selectedStudioEntity.index];
  const widths = [0.9, 1.2, 1.8];
  const currentM = op.length / scalePixelsPerMeter;
  let nextIdx = (widths.findIndex(w => Math.abs(w - currentM) < 0.1) + 1) % widths.length;
  op.nominalMeters = widths[nextIdx];
  op.length = op.nominalMeters * scalePixelsPerMeter;
  renderStudio();
}

function renameSelectedLabel() {
  if (!selectedStudioEntity || selectedStudioEntity.type !== 'label') return;
  const b = studioLabels[selectedStudioEntity.index];
  const name = prompt("Rename room label:", b.text);
  if (name && name.trim()) {
    recordStudioState();
    b.text = name.trim().toUpperCase();
    renderStudio();
  }
}

function toggleWallCavity() {
  if (!selectedStudioEntity || selectedStudioEntity.type !== 'wall') return;
  recordStudioState();
  const w = studioLines[selectedStudioEntity.index];
  w.isCavity = !w.isCavity;
  showEditHud();
  renderStudio();
}

function calibrateSelectedWall() {
  if (!selectedStudioEntity || selectedStudioEntity.type !== 'wall') return;
  const w = studioLines[selectedStudioEntity.index];
  calibrateWallAt((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2);
}

function deleteSelectedStudioEntity() {
  if (!selectedStudioEntity) return;
  recordStudioState();
  if (selectedStudioEntity.type === 'opening') {
    studioOpenings.splice(selectedStudioEntity.index, 1);
  } else if (selectedStudioEntity.type === 'label') {
    studioLabels.splice(selectedStudioEntity.index, 1);
  } else if (selectedStudioEntity.type === 'wall') {
    studioLines.splice(selectedStudioEntity.index, 1);
  }
  selectedStudioEntity = null;
  hideEditHud();
  renderStudio();
}

function stampOpeningAt(pt) {
  const candidate = pt.openingCandidate || findClosestWallForOpening(pt.x, pt.y);
  if (!candidate) {
    const banner = document.getElementById('studioBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.innerText = '⚠️ Please tap directly on a wall line';
      setTimeout(() => {
        if (studioTool === 'door') banner.innerText = '🚪 Slide & tap along a wall to place a 900mm swing door';
        else if (studioTool === 'slider') banner.innerText = '🪟 Slide & tap along a wall to place a sliding door';
        else if (studioTool === 'window') banner.innerText = '🪟 Slide & tap along a wall to stamp a 1200mm window';
      }, 1500);
    }
    return;
  }

  if (candidate.hasCollision) {
    const banner = document.getElementById('studioBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.innerText = '⚠️ Space blocked by an existing door or window';
      setTimeout(() => {
        if (studioTool === 'door') banner.innerText = '🚪 Slide & tap along a wall to place a 900mm swing door';
        else if (studioTool === 'slider') banner.innerText = '🪟 Slide & tap along a wall to place a sliding door';
        else if (studioTool === 'window') banner.innerText = '🪟 Slide & tap along a wall to stamp a 1200mm window';
      }, 1500);
    }
    return;
  }

  recordStudioState();
  const newOpening = {
    type: studioTool,
    x: candidate.x,
    y: candidate.y,
    angle: candidate.angle,
    length: candidate.length,
    nominalMeters: candidate.nominalMeters,
    flipH: false,
    flipV: false,
    wallRef: candidate.wall
  };
  studioOpenings.push(newOpening);

  selectedStudioEntity = { type: 'opening', index: studioOpenings.length - 1, data: newOpening };
  showEditHud();
  renderStudio();
}

function createRoomLabelAt(x, y) {
  const commonNames = ['Living', 'Kitchen', 'Master Bed', 'Bed 2', 'Bed 3', 'Ensuite', 'Bathroom', 'Garage', 'Hallway', 'Patio', 'Alfresco'];
  const name = prompt(`Enter room label (or choose: ${commonNames.slice(0, 5).join(', ')}):`, "Living");
  if (name && name.trim()) {
    recordStudioState();
    studioLabels.push({ text: name.trim().toUpperCase(), x, y });
    renderStudio();
  }
}

function calibrateWallAt(x, y) {
  const hitIndex = studioLines.findIndex(l => {
    const proj = getPointSegmentProjection(x, y, l.x1, l.y1, l.x2, l.y2);
    if (proj.dist < 26 / studioScale) return true;

    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const dist = Math.hypot(dx, dy) || 1;
    const normX = -dy / dist;
    const normY = dx / dist;
    const tagX = (l.x1 + l.x2) / 2 + normX * (22 / studioScale);
    const tagY = (l.y1 + l.y2) / 2 + normY * (22 / studioScale);
    return Math.hypot(x - tagX, y - tagY) < 28 / studioScale;
  });

  if (hitIndex === -1) return;
  const wall = studioLines[hitIndex];
  const pxLen = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  const currentEst = (pxLen / scalePixelsPerMeter).toFixed(2);

  const realM = prompt(`Enter true physical length for this wall in meters:`, currentEst);
  if (realM) {
    const meters = parseFloat(realM);
    if (meters > 0) {
      recordStudioState();
      scalePixelsPerMeter = pxLen / meters;
      document.getElementById('lblScaleDisplay').innerText = `${scalePixelsPerMeter.toFixed(1)} px/m`;

      studioOpenings.forEach(op => {
        op.length = (op.nominalMeters || 0.9) * scalePixelsPerMeter;
      });

      renderStudio();
    }
  }
}

function eraseStudioEntityAt(x, y) {
  const hitWall = studioLines.findIndex(l => getPointSegmentProjection(x, y, l.x1, l.y1, l.x2, l.y2).dist < 18 / studioScale);
  if (hitWall !== -1) {
    recordStudioState();
    studioLines.splice(hitWall, 1);
    renderStudio();
    return;
  }
  const hitOpening = studioOpenings.findIndex(o => Math.hypot(o.x - x, o.y - y) < 22 / studioScale);
  if (hitOpening !== -1) {
    recordStudioState();
    studioOpenings.splice(hitOpening, 1);
    renderStudio();
    return;
  }
  const hitLabel = studioLabels.findIndex(b => Math.hypot(b.x - x, b.y - y) < 24 / studioScale);
  if (hitLabel !== -1) {
    recordStudioState();
    studioLabels.splice(hitLabel, 1);
    renderStudio();
    return;
  }
}

function studioUndo() {
  if (studioUndoStack.length === 0) return;
  studioRedoStack.push({
    lines: JSON.parse(JSON.stringify(studioLines)),
    openings: JSON.parse(JSON.stringify(studioOpenings)),
    labels: JSON.parse(JSON.stringify(studioLabels)),
    scale: scalePixelsPerMeter
  });
  const prev = studioUndoStack.pop();
  studioLines = prev.lines;
  studioOpenings = prev.openings;
  studioLabels = prev.labels;
  scalePixelsPerMeter = prev.scale;
  selectedStudioEntity = null;
  hideEditHud();
  updateStudioStatus();
  renderStudio();
}

function studioRedo() {
  if (studioRedoStack.length === 0) return;
  studioUndoStack.push({
    lines: JSON.parse(JSON.stringify(studioLines)),
    openings: JSON.parse(JSON.stringify(studioOpenings)),
    labels: JSON.parse(JSON.stringify(studioLabels)),
    scale: scalePixelsPerMeter
  });
  const next = studioRedoStack.pop();
  studioLines = next.lines;
  studioOpenings = next.openings;
  studioLabels = next.labels;
  scalePixelsPerMeter = next.scale;
  selectedStudioEntity = null;
  hideEditHud();
  updateStudioStatus();
  renderStudio();
}

function studioClear() {
  if (studioLines.length === 0 && studioOpenings.length === 0 && studioLabels.length === 0) return;
  if (!confirm("Clear all sketched walls, openings, and labels?")) return;
  recordStudioState();
  studioLines = [];
  studioOpenings = [];
  studioLabels = [];
  selectedStudioEntity = null;
  hideEditHud();
  renderStudio();
}

function updateStudioStatus() {
  const btnU = document.getElementById('btnStudioUndo');
  if (btnU) btnU.disabled = studioUndoStack.length === 0;
  const btnR = document.getElementById('btnStudioRedo');
  if (btnR) btnR.disabled = studioRedoStack.length === 0;
}

function renderStudio() {
  if (!studioCtx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = studioCanvas.width / dpr;
  const h = studioCanvas.height / dpr;

  studioCtx.setTransform(1, 0, 0, 1, 0, 0);
  studioCtx.clearRect(0, 0, studioCanvas.width, studioCanvas.height);
  studioCtx.setTransform(dpr * studioScale, 0, 0, dpr * studioScale, dpr * studioPanX, dpr * studioPanY);

  studioLines.forEach((l, idx) => {
    const isSel = (selectedStudioEntity && selectedStudioEntity.type === 'wall' && selectedStudioEntity.index === idx);
    studioCtx.save();

    if (l.isCavity) {
      studioCtx.strokeStyle = isSel ? '#0284c7' : '#0f172a';
      studioCtx.lineWidth = 11;
      studioCtx.lineCap = 'round';
      studioCtx.lineJoin = 'round';
      studioCtx.beginPath();
      studioCtx.moveTo(l.x1, l.y1);
      studioCtx.lineTo(l.x2, l.y2);
      studioCtx.stroke();

      studioCtx.strokeStyle = '#ffffff';
      studioCtx.lineWidth = 5;
      studioCtx.lineCap = 'square';
      studioCtx.beginPath();
      studioCtx.moveTo(l.x1, l.y1);
      studioCtx.lineTo(l.x2, l.y2);
      studioCtx.stroke();
    } else {
      studioCtx.strokeStyle = isSel ? '#0284c7' : '#0f172a';
      studioCtx.lineWidth = isSel ? 6 : 5;
      studioCtx.lineCap = 'round';
      studioCtx.lineJoin = 'round';

      studioCtx.beginPath();
      studioCtx.moveTo(l.x1, l.y1);
      studioCtx.lineTo(l.x2, l.y2);
      studioCtx.stroke();
    }
    studioCtx.restore();
  });

  studioOpenings.forEach((op, idx) => {
    const isSel = (selectedStudioEntity && selectedStudioEntity.type === 'opening' && selectedStudioEntity.index === idx);
    studioCtx.save();
    studioCtx.translate(op.x, op.y);
    studioCtx.rotate(op.angle);

    const sH = op.flipH ? -1 : 1;
    const sV = op.flipV ? -1 : 1;
    studioCtx.scale(sH, sV);

    if (op.type === 'door') {
      studioCtx.fillStyle = '#ffffff';
      studioCtx.fillRect(-op.length / 2, -7, op.length, 14);

      if (isSel) {
        studioCtx.strokeStyle = '#0284c7';
        studioCtx.lineWidth = 1.5;
        studioCtx.strokeRect(-op.length / 2 - 2, -op.length - 2, op.length + 4, op.length + 10);
      }

      studioCtx.strokeStyle = '#b45309';
      studioCtx.lineWidth = 2.5;
      studioCtx.beginPath();
      studioCtx.moveTo(-op.length / 2, 0);
      studioCtx.lineTo(-op.length / 2, -op.length);
      studioCtx.stroke();

      studioCtx.beginPath();
      studioCtx.setLineDash([3, 3]);
      studioCtx.arc(-op.length / 2, 0, op.length, -Math.PI / 2, 0, false);
      studioCtx.stroke();
    } else if (op.type === 'slider') {
      studioCtx.fillStyle = '#ffffff';
      studioCtx.fillRect(-op.length / 2, -8, op.length, 16);

      if (isSel) {
        studioCtx.strokeStyle = '#0284c7';
        studioCtx.lineWidth = 1.5;
        studioCtx.strokeRect(-op.length / 2 - 2, -10, op.length + 4, 20);
      }

      studioCtx.strokeStyle = '#0d9488';
      studioCtx.lineWidth = 2.5;
      studioCtx.strokeRect(-op.length / 2, -6, op.length / 2 + 4, 4);
      studioCtx.strokeRect(-2, 2, op.length / 2 + 2, 4);
    } else if (op.type === 'window') {
      studioCtx.fillStyle = '#ffffff';
      studioCtx.fillRect(-op.length / 2, -6, op.length, 12);

      if (isSel) {
        studioCtx.strokeStyle = '#0284c7';
        studioCtx.lineWidth = 1.5;
        studioCtx.strokeRect(-op.length / 2 - 2, -8, op.length + 4, 16);
      }

      studioCtx.strokeStyle = '#0284c7';
      studioCtx.lineWidth = 2;
      studioCtx.strokeRect(-op.length / 2, -4, op.length, 8);
      studioCtx.beginPath();
      studioCtx.moveTo(-op.length / 2, 0);
      studioCtx.lineTo(op.length / 2, 0);
      studioCtx.stroke();
    }
    studioCtx.restore();
  });

  if (isStudioDrawing && studioCurrentPoint && (studioTool === 'door' || studioTool === 'slider' || studioTool === 'window')) {
    const candidate = studioCurrentPoint.openingCandidate || findClosestWallForOpening(studioCurrentPoint.x, studioCurrentPoint.y);
    if (candidate) {
      studioCtx.save();
      studioCtx.translate(candidate.x, candidate.y);
      studioCtx.rotate(candidate.angle);

      const previewColor = candidate.hasCollision ? '#ef4444' : '#0284c7';

      if (studioTool === 'door') {
        studioCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        studioCtx.fillRect(-candidate.length / 2, -6, candidate.length, 12);
        studioCtx.strokeStyle = candidate.hasCollision ? '#ef4444' : '#d97706';
        studioCtx.lineWidth = 2;
        studioCtx.beginPath();
        studioCtx.moveTo(-candidate.length / 2, 0);
        studioCtx.lineTo(-candidate.length / 2, -candidate.length);
        studioCtx.stroke();
        studioCtx.beginPath();
        studioCtx.setLineDash([3, 3]);
        studioCtx.arc(-candidate.length / 2, 0, candidate.length, -Math.PI / 2, 0, false);
        studioCtx.stroke();
      } else if (studioTool === 'slider') {
        studioCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        studioCtx.fillRect(-candidate.length / 2, -8, candidate.length, 16);
        studioCtx.strokeStyle = candidate.hasCollision ? '#ef4444' : '#0d9488';
        studioCtx.lineWidth = 2;
        studioCtx.strokeRect(-candidate.length / 2, -5, candidate.length / 2 + 4, 4);
        studioCtx.strokeRect(-2, 2, candidate.length / 2 + 2, 4);
      } else {
        studioCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        studioCtx.fillRect(-candidate.length / 2, -5, candidate.length, 10);
        studioCtx.strokeStyle = previewColor;
        studioCtx.lineWidth = 2;
        studioCtx.strokeRect(-candidate.length / 2, -4, candidate.length, 8);
      }
      studioCtx.restore();
    }
  }

  studioLabels.forEach((b, idx) => {
    const isSel = (selectedStudioEntity && selectedStudioEntity.type === 'label' && selectedStudioEntity.index === idx);
    studioCtx.save();
    studioCtx.font = 'bold 13px -apple-system, sans-serif';
    studioCtx.textAlign = 'center';
    studioCtx.textBaseline = 'middle';
    const textW = studioCtx.measureText(b.text).width;

    studioCtx.fillStyle = isSel ? '#e0f2fe' : 'rgba(241, 245, 249, 0.9)';
    studioCtx.strokeStyle = isSel ? '#0284c7' : '#cbd5e1';
    studioCtx.lineWidth = isSel ? 1.5 : 1;
    studioCtx.fillRect(b.x - textW / 2 - 8, b.y - 10, textW + 16, 20);
    studioCtx.strokeRect(b.x - textW / 2 - 8, b.y - 10, textW + 16, 20);

    studioCtx.fillStyle = '#1e293b';
    studioCtx.fillText(b.text, b.x, b.y);
    studioCtx.restore();
  });

  studioLines.forEach(l => {
    const midX = (l.x1 + l.x2) / 2;
    const midY = (l.y1 + l.y2) / 2;
    const lenPx = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    const meters = (lenPx / scalePixelsPerMeter).toFixed(1) + 'm';

    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const dist = Math.hypot(dx, dy) || 1;
    const normX = -dy / dist;
    const normY = dx / dist;

    const offsetDist = 22;
    const badgeX = midX + normX * offsetDist;
    const badgeY = midY + normY * offsetDist;

    studioCtx.save();

    studioCtx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
    studioCtx.lineWidth = 1;
    studioCtx.setLineDash([2, 2]);
    studioCtx.beginPath();
    studioCtx.moveTo(midX, midY);
    studioCtx.lineTo(badgeX, badgeY);
    studioCtx.stroke();
    studioCtx.setLineDash([]);

    studioCtx.fillStyle = '#64748b';
    studioCtx.beginPath();
    studioCtx.arc(midX, midY, 2, 0, Math.PI * 2);
    studioCtx.fill();

    studioCtx.font = '600 10.5px -apple-system, sans-serif';
    studioCtx.textAlign = 'center';
    studioCtx.textBaseline = 'middle';
    const tagW = studioCtx.measureText(meters).width + 10;

    studioCtx.fillStyle = '#ffffff';
    studioCtx.strokeStyle = '#cbd5e1';
    studioCtx.lineWidth = 1.2;
    studioCtx.beginPath();
    studioCtx.roundRect(badgeX - tagW / 2, badgeY - 8, tagW, 16, 4);
    studioCtx.fill();
    studioCtx.stroke();

    studioCtx.fillStyle = '#475569';
    studioCtx.fillText(meters, badgeX, badgeY);
    studioCtx.restore();
  });

  if (isStudioDrawing && studioStartPoint && studioCurrentPoint) {
    studioCtx.save();
    studioCtx.strokeStyle = '#2563eb';
    studioCtx.lineWidth = 3.5;
    studioCtx.setLineDash([6, 4]);

    if (studioTool === 'wall') {
      studioCtx.beginPath();
      studioCtx.moveTo(studioStartPoint.x, studioStartPoint.y);
      studioCtx.lineTo(studioCurrentPoint.x, studioCurrentPoint.y);
      studioCtx.stroke();
    } else if (studioTool === 'room') {
      const rx = Math.min(studioStartPoint.x, studioCurrentPoint.x);
      const ry = Math.min(studioStartPoint.y, studioCurrentPoint.y);
      const rw = Math.abs(studioCurrentPoint.x - studioStartPoint.x);
      const rh = Math.abs(studioCurrentPoint.y - studioStartPoint.y);
      studioCtx.strokeRect(rx, ry, rw, rh);
    }
    studioCtx.restore();
  }

  const isRealTouchFinger = (studioCurrentPoint && studioCurrentPoint.rawTouchX !== undefined);
  const isDrafting = (studioTool === 'wall' || studioTool === 'room');
  if (isStudioDrawing && studioCurrentPoint && isDrafting && isRealTouchFinger) {
    studioCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const screenX = studioCurrentPoint.x * studioScale + studioPanX;
    const screenY = studioCurrentPoint.y * studioScale + studioPanY;

    studioCtx.save();
    studioCtx.strokeStyle = 'rgba(14, 165, 233, 0.45)';
    studioCtx.lineWidth = 1;
    studioCtx.setLineDash([4, 4]);

    studioCtx.beginPath();
    studioCtx.moveTo(0, screenY);
    studioCtx.lineTo(w, screenY);
    studioCtx.stroke();

    studioCtx.beginPath();
    studioCtx.moveTo(screenX, 0);
    studioCtx.lineTo(screenX, h);
    studioCtx.stroke();

    studioCtx.strokeStyle = '#0284c7';
    studioCtx.lineWidth = 1.5;
    studioCtx.setLineDash([]);
    studioCtx.beginPath();
    studioCtx.arc(screenX, screenY, 12, 0, Math.PI * 2);
    studioCtx.stroke();

    studioCtx.fillStyle = '#0284c7';
    studioCtx.beginPath();
    studioCtx.arc(screenX, screenY, 3.5, 0, Math.PI * 2);
    studioCtx.fill();

    if (studioCurrentPoint.rawTouchX !== undefined && studioCurrentPoint.rawTouchY !== undefined) {
      studioCtx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      studioCtx.lineWidth = 1;
      studioCtx.setLineDash([2, 2]);
      studioCtx.beginPath();
      studioCtx.moveTo(screenX, screenY + 12);
      studioCtx.lineTo(studioCurrentPoint.rawTouchX, studioCurrentPoint.rawTouchY);
      studioCtx.stroke();
    }
    studioCtx.restore();
  }
}

function finishAndApplyPlan() {
  if (studioLines.length === 0) {
    alert("Please sketch at least one room or wall before applying.");
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  studioLines.forEach(l => {
    minX = Math.min(minX, l.x1, l.x2);
    maxX = Math.max(maxX, l.x1, l.x2);
    minY = Math.min(minY, l.y1, l.y2);
    maxY = Math.max(maxY, l.y1, l.y2);
  });

  const pad = 40;
  const cropW = Math.max(300, (maxX - minX) + pad * 2);
  const cropH = Math.max(300, (maxY - minY) + pad * 2);

  const offscreen = document.createElement('canvas');
  offscreen.width = cropW;
  offscreen.height = cropH;
  const oCtx = offscreen.getContext('2d');

  oCtx.fillStyle = '#ffffff';
  oCtx.fillRect(0, 0, cropW, cropH);
  oCtx.translate(-minX + pad, -minY + pad);

  studioLines.forEach(l => {
    oCtx.save();
    if (l.isCavity) {
      oCtx.strokeStyle = '#0f172a';
      oCtx.lineWidth = 10;
      oCtx.lineCap = 'round';
      oCtx.lineJoin = 'round';
      oCtx.beginPath();
      oCtx.moveTo(l.x1, l.y1);
      oCtx.lineTo(l.x2, l.y2);
      oCtx.stroke();

      oCtx.strokeStyle = '#ffffff';
      oCtx.lineWidth = 5;
      oCtx.lineCap = 'square';
      oCtx.beginPath();
      oCtx.moveTo(l.x1, l.y1);
      oCtx.lineTo(l.x2, l.y2);
      oCtx.stroke();
    } else {
      oCtx.strokeStyle = '#0f172a';
      oCtx.lineWidth = 4.5;
      oCtx.lineCap = 'round';
      oCtx.lineJoin = 'round';
      oCtx.beginPath();
      oCtx.moveTo(l.x1, l.y1);
      oCtx.lineTo(l.x2, l.y2);
      oCtx.stroke();
    }
    oCtx.restore();
  });

  studioOpenings.forEach(op => {
    oCtx.save();
    oCtx.translate(op.x, op.y);
    oCtx.rotate(op.angle);
    const sH = op.flipH ? -1 : 1;
    const sV = op.flipV ? -1 : 1;
    oCtx.scale(sH, sV);

    if (op.type === 'door') {
      oCtx.fillStyle = '#ffffff';
      oCtx.fillRect(-op.length / 2, -6, op.length, 12);
      oCtx.strokeStyle = '#b45309';
      oCtx.lineWidth = 2.2;
      oCtx.beginPath();
      oCtx.moveTo(-op.length / 2, 0);
      oCtx.lineTo(-op.length / 2, -op.length);
      oCtx.stroke();
      oCtx.beginPath();
      oCtx.setLineDash([3, 3]);
      oCtx.arc(-op.length / 2, 0, op.length, -Math.PI / 2, 0, false);
      oCtx.stroke();
    } else if (op.type === 'slider') {
      oCtx.fillStyle = '#ffffff';
      oCtx.fillRect(-op.length / 2, -7, op.length, 14);
      oCtx.strokeStyle = '#0d9488';
      oCtx.lineWidth = 2.2;
      oCtx.strokeRect(-op.length / 2, -5, op.length / 2 + 3, 3.5);
      oCtx.strokeRect(-2, 1.5, op.length / 2 + 2, 3.5);
    } else {
      oCtx.fillStyle = '#ffffff';
      oCtx.fillRect(-op.length / 2, -5, op.length, 10);
      oCtx.strokeStyle = '#0284c7';
      oCtx.lineWidth = 2;
      oCtx.strokeRect(-op.length / 2, -4, op.length, 8);
      oCtx.beginPath();
      oCtx.moveTo(-op.length / 2, 0);
      oCtx.lineTo(op.length / 2, 0);
      oCtx.stroke();
    }
    oCtx.restore();
  });

  studioLabels.forEach(b => {
    oCtx.save();
    oCtx.font = 'bold 13px -apple-system, sans-serif';
    oCtx.textAlign = 'center';
    oCtx.textBaseline = 'middle';
    const textW = oCtx.measureText(b.text).width;
    oCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    oCtx.strokeStyle = '#cbd5e1';
    oCtx.lineWidth = 1;
    oCtx.fillRect(b.x - textW / 2 - 8, b.y - 10, textW + 16, 20);
    oCtx.strokeRect(b.x - textW / 2 - 8, b.y - 10, textW + 16, 20);
    oCtx.fillStyle = '#334155';
    oCtx.fillText(b.text, b.x, b.y);
    oCtx.restore();
  });

  studioLines.forEach(l => {
    const midX = (l.x1 + l.x2) / 2;
    const midY = (l.y1 + l.y2) / 2;
    const lenPx = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    const meters = (lenPx / scalePixelsPerMeter).toFixed(1) + 'm';

    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const dist = Math.hypot(dx, dy) || 1;
    const normX = -dy / dist;
    const normY = dx / dist;

    const offsetDist = 18;
    const badgeX = midX + normX * offsetDist;
    const badgeY = midY + normY * offsetDist;

    oCtx.save();
    oCtx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
    oCtx.lineWidth = 0.8;
    oCtx.setLineDash([2, 2]);
    oCtx.beginPath();
    oCtx.moveTo(midX, midY);
    oCtx.lineTo(badgeX, badgeY);
    oCtx.stroke();
    oCtx.setLineDash([]);

    oCtx.font = '600 10px -apple-system, sans-serif';
    oCtx.textAlign = 'center';
    oCtx.textBaseline = 'middle';
    const tagW = oCtx.measureText(meters).width + 8;
    oCtx.fillStyle = '#ffffff';
    oCtx.strokeStyle = '#cbd5e1';
    oCtx.lineWidth = 1;
    oCtx.beginPath();
    oCtx.roundRect(badgeX - tagW / 2, badgeY - 7, tagW, 14, 3);
    oCtx.fill();
    oCtx.stroke();
    oCtx.fillStyle = '#64748b';
    oCtx.fillText(meters, badgeX, badgeY);
    oCtx.restore();
  });

  const exportUrl = offscreen.toDataURL('image/png');
  loadPlanImageFromUrl(exportUrl);
  closeStudioModal();
}