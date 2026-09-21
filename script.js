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

// Scale calibration state
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
  window.addEventListener('resize', resizeCanvas);
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
    } catch (e) {}
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
      updatePlanVisuals();
      requestAnimationFrame(resizeCanvas);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
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

  group.on('dragmove', () => {
    const compType = group.getAttr('compType');
    const snap = checkAlignmentSnap(group.x(), group.y(), group.id(), compType);
    group.position({ x: snap.snappedX, y: snap.snappedY });
    renderGuideLines(snap.lineX, snap.lineY);
    updateConnectedWires();
  });

  group.on('dragend', () => {
    clearGuideLines();
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
          alert(`Scale calibrated successfully! (${scalePixelsPerMeter.toFixed(1)} pixels/meter)`);
        }
      }
      scalePoint1 = null;
    }
    return;
  }

  if (multiTouchDetected) return;
  
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

  if (entry.action === 'add_component') {
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

  if (entry.action === 'add_component') {
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