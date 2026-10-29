import { createIcons, Waves, Box, Radio, Activity, Search, ChevronRight, PanelTop, Fan, Gauge, Focus, RotateCcw, Rotate3d, Plus, Minus, Camera, Maximize, Download, Pause, Play, CircleHelp, X, AlertTriangle, Check, Layers, LocateFixed, ArrowUpRight, CircleDot, SlidersHorizontal, Menu } from 'lucide';
import { Simulation, kindNames, kindIcons, profile, isSandbox } from './data.js';
import { createScene } from './scene.js';
import './style.css';

const icons = { Waves, Box, Radio, Activity, Search, ChevronRight, PanelTop, Fan, Gauge, Focus, RotateCcw, Rotate3d, Plus, Minus, Camera, Maximize, Download, Pause, Play, CircleHelp, X, AlertTriangle, Check, Layers, LocateFixed, ArrowUpRight, CircleDot, SlidersHorizontal, Menu };
const icon = name => `<i data-lucide="${name}"></i>`;
const paintIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.7 } });
const sim = new Simulation();
const pointCount = sim.points.length;
const sensorCount = sim.points.filter(p => ['level', 'flow'].includes(p.kind)).length;
const pointName = id => sim.points.find(p => p.id === id).name;
document.title = `${profile.name} · 三维感知`;
let selectedId = 'LT-03';
let deviceTab = 'sensor';
let view = 'monitor';
let scene;
let rotating = false;
const events = [{ time: Date.now(), title: '模拟数据源已启动', detail: `${pointCount} 个测点 · 1 秒更新`, type: 'good' }];
const $ = s => document.querySelector(s);
const selected = () => sim.points.find(p => p.id === selectedId);
const time = timestamp => new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false });

$('#app').innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">${icon('waves')}</span><div><h1>${profile.name}<span>三维感知</span></h1><small>水槽渠系实验平台</small></div></div>
    <nav aria-label="主视图"><button class="nav-tab active" data-view="monitor">${icon('box')}三维监测</button><button class="nav-tab" data-view="data">${icon('activity')}测点数据</button></nav>
    <div class="top-status"><span class="demo-badge"><span></span>模拟数据</span><time id="clock"></time><button class="icon-button" id="about" title="数据与模型说明" aria-label="数据与模型说明">${icon('circle-help')}</button></div>
  </header>
  <div class="commandbar">
    <div class="breadcrumb">实验场景 ${icon('chevron-right')}<select id="model-select" aria-label="实验场景"><option value="sandbox" ${isSandbox ? 'selected' : ''}>水槽沙盘</option><option value="ring" ${isSandbox ? '' : 'selected'}>环形水槽</option></select><span class="revision">${profile.revision}</span></div>
    <div class="command-actions"><label class="scenario-select">模拟工况<select id="scenario" aria-label="模拟工况"><option value="steady">稳定运行</option><option value="disturbance">来流扰动</option><option value="alarm">高水位告警</option><option value="offline">通信中断</option></select></label><button class="plain-button" id="pause">${icon('pause')}<span>暂停</span></button><button class="plain-button" id="export">${icon('download')}<span>导出数据</span></button></div>
  </div>
  <div class="app-layout">
    <aside class="device-sidebar">
      <div class="section-heading"><h2>设备与测点</h2><span class="count">${pointCount}</span></div>
      <label class="search-field">${icon('search')}<input id="search" placeholder="搜索名称或编号" aria-label="搜索设备与测点" /></label>
      <div class="segmented device-tabs"><button class="active" data-device="sensor">传感器 <span>${sensorCount}</span></button><button data-device="equipment">设备 <span>${pointCount - sensorCount}</span></button></div>
      <div class="list-heading"><span id="list-title">感知测点</span><small>当前值</small></div>
      <div id="device-list"></div>
      <div class="sidebar-bottom"><span class="status-dot"></span><div><strong id="source-state">模拟数据源正常</strong><small>采样周期 1 s · 点位为示意</small></div>${icon('radio')}</div>
    </aside>
    <main class="workspace">
      <section class="overview" aria-label="运行概况">
        <div class="overview-title"><span class="status-dot" id="overall-dot"></span><strong id="overall-state">模拟运行中</strong><small id="overall-count">${pointCount} / ${pointCount} 测点有数据</small></div>
        <div class="overview-metric"><span>${pointName('LT-03')}</span><div><strong id="kpi-level">0.101</strong><small>m</small></div></div>
        <div class="overview-metric"><span>${pointName('FT-01')}</span><div><strong id="kpi-flow">12.60</strong><small>L/s</small></div></div>
        <div class="overview-metric"><span>G2 闸门开度</span><div><strong id="kpi-gate">0.135</strong><small>m</small></div></div>
        <div class="overview-metric"><span>${pointName('P-01')}频率</span><div><strong id="kpi-pump">37.5</strong><small>Hz</small></div></div>
      </section>
      <div class="monitor-view" id="monitor-view">
        <div class="center-column">
          <section class="scene-wrap" id="scene-wrap" aria-label="水槽三维场景">
            <div id="scene-host"><div class="loading" id="loading"><span class="loading-ring"></span><strong>正在读取${profile.name}模型</strong><small>加载原始几何数据</small></div></div>
            <div class="scene-heading"><div><span class="scene-title">${profile.name}</span><span class="scene-tag">数字模型</span></div><small>${profile.description}</small></div>
            <div class="camera-modes segmented"><button class="active" data-camera="perspective">透视</button><button data-camera="top">俯视</button><button data-camera="front">正视</button></div>
            <div class="scene-tools">
              <button class="icon-button" id="reset-camera" title="复位视角" aria-label="复位视角">${icon('rotate-ccw')}</button>
              <button class="icon-button" id="rotate" title="自动环绕" aria-label="自动环绕" aria-pressed="false">${icon('rotate-3d')}</button>
              <span class="tool-divider"></span>
              <button class="icon-button" id="zoom-in" title="放大" aria-label="放大">${icon('plus')}</button>
              <button class="icon-button" id="zoom-out" title="缩小" aria-label="缩小">${icon('minus')}</button>
              <span class="tool-divider"></span>
              <button class="icon-button" id="snapshot" title="保存三维截图" aria-label="保存三维截图">${icon('camera')}</button>
              <button class="icon-button" id="fullscreen" title="全屏场景" aria-label="全屏场景">${icon('maximize')}</button>
            </div>
            <div class="scene-bottom"><div class="layer-switch segmented"><button class="active" data-layer="level">${icon('waves')}水位</button><button data-layer="flow">${icon('gauge')}流量</button><button data-layer="equipment">${icon('panel-top')}设备</button></div><div class="scene-legend"><span><b class="legend-dot water"></b>感知</span><span><b class="legend-dot equipment"></b>设备</span><span><b class="legend-dot warning"></b>告警</span></div></div>
            <div class="scene-options"><label><input type="checkbox" id="show-tags" checked>数据标签</label><label><input type="checkbox" id="show-flow" checked>水流</label><label><input type="checkbox" id="transparent">透视结构</label></div>
          </section>
          <section class="trend-section">
            <div class="trend-header"><div><h2>感知趋势 <span id="trend-point">LT-03</span></h2><small id="trend-description">渠道 3 水位 / m</small></div><div class="trend-controls"><label id="target-label"><input id="show-target" type="checkbox" checked>参考水位</label><select id="time-range" aria-label="趋势时间范围"><option value="120">近 2 分钟</option><option value="300">近 5 分钟</option><option value="600">近 10 分钟</option></select></div></div>
            <div class="chart-wrap"><canvas id="trend-chart" aria-label="选中测点模拟数据趋势"></canvas></div>
            <div class="chart-footer"><span><b class="legend-line"></b>模拟采样值</span><span id="target-legend"><b class="legend-line dashed"></b>参考水位 0.100 m</span><small id="sample-count">120 个采样点</small></div>
          </section>
        </div>
        <aside class="detail-sidebar">
          <div class="section-heading"><h2>测点详情</h2><button id="focus-selected" class="icon-button" title="定位选中测点" aria-label="定位选中测点">${icon('locate-fixed')}</button></div>
          <div class="detail-identity"><span class="detail-icon" id="detail-icon">${icon('waves')}</span><div><small id="detail-id">LT-03</small><h3 id="detail-name">渠道 3 水位</h3></div><span class="state-chip" id="detail-state">正常</span></div>
          <p class="location" id="detail-location">渠道 3 · 示意测点</p>
          <div class="reading-block"><span id="reading-label">当前水位</span><div><strong id="detail-value">0.101</strong><span id="detail-unit">m</span></div><small id="detail-time">更新于 --:--:--</small></div>
          <div class="range-meter"><div class="range-track"><span id="range-fill"></span><b id="range-thumb"></b></div><div><span id="range-min">0.040</span><span id="range-max">0.150 m</span></div></div>
          <dl class="detail-facts"><div><dt>数据来源</dt><dd>模拟数据</dd></div><div><dt>采样周期</dt><dd>1 s</dd></div><div><dt id="threshold-label">演示正常区间</dt><dd id="threshold-value">0.040–0.150 m</dd></div><div><dt>量程</dt><dd id="detail-range">0.000–0.300 m</dd></div></dl>
          <div class="detail-note" id="detail-note">${icon('circle-dot')}传感器布点为展示示意</div>
          <section class="events-section"><div class="section-heading"><h2>状态事件</h2><span class="count" id="event-count">1</span></div><div id="events"></div></section>
        </aside>
      </div>
      <section class="data-view" id="data-view" hidden><div class="data-view-heading"><h2>全部感知数据</h2><span>模拟数据 · 实时更新</span></div><div class="table-scroll"><table><thead><tr><th>编号</th><th>设备 / 测点</th><th>类型</th><th>当前值</th><th>状态</th><th>最近更新</th><th></th></tr></thead><tbody id="data-table"></tbody></table></div></section>
      <footer class="workspace-footer"><span>${icon('box')}原始模型 · ${profile.name}</span><span id="footer-status">模拟采集 / 1 Hz</span><span class="footer-right">本地演示 · 无硬件连接</span></footer>
    </main>
  </div>
  <dialog id="about-dialog"><div class="dialog-heading"><h2>数据与模型说明</h2><button class="icon-button" id="close-about" title="关闭" aria-label="关闭">${icon('x')}</button></div><p>三维几何结构来自你提供的“${profile.name}.zip”。原模型材质经过适配。</p><p>当前读数、历史曲线、设备状态及告警均为模拟数据，未连接现场设备。传感器类型、设备编号及测点绑定为展示示意，需现场核对。告警阈值仅供演示，不能作为实验安全阈值。</p><p>水流动画为视觉示意，不代表水动力计算结果。设备频率与闸门开度为模拟反馈，页面不会向设备发送控制指令。</p></dialog>
  <div class="toast" id="toast" role="status" hidden></div>
`;
paintIcons();
$('#model-select').onchange = e => {
  const url = new URL(location.href);
  url.searchParams.set('scene', e.target.value);
  location.href = url.href;
};

function stateLabel(p) { return p.quality === 'offline' ? '离线' : p.quality === 'alarm' ? '高水位' : sim.running ? '正常' : '已暂停'; }
function renderList() {
  const search = $('#search').value.trim().toLowerCase();
  const filtered = sim.points.filter(p => (deviceTab === 'sensor' ? ['level', 'flow'].includes(p.kind) : ['gate', 'pump'].includes(p.kind)) && `${p.id} ${p.name}`.toLowerCase().includes(search));
  $('#list-title').textContent = deviceTab === 'sensor' ? '感知测点' : '执行设备';
  $('#device-list').innerHTML = filtered.length ? filtered.map(p => `<button class="device-row ${p.id === selectedId ? 'selected' : ''} ${p.quality}" data-point="${p.id}"><span class="device-symbol">${icon(kindIcons[p.kind])}</span><span class="device-label"><strong>${p.name}</strong><small>${p.id}<b class="status-dot ${p.quality}"></b></small></span><span class="device-reading">${p.value.toFixed(p.digits)}<small>${p.unit}</small></span></button>`).join('') : '<p class="empty">没有匹配的测点</p>';
  $('#device-list').querySelectorAll('[data-point]').forEach(b => b.onclick = () => selectPoint(b.dataset.point));
  paintIcons();
}
function renderEvents() {
  $('#event-count').textContent = events.length;
  $('#events').innerHTML = events.slice(0, 4).map(e => `<div class="event-row ${e.type}"><span class="event-indicator"></span><div><strong>${e.title}</strong><small>${e.detail}</small><time>${time(e.time)}</time></div></div>`).join('');
}
function addEvent(title, detail, type = 'good') {
  events.unshift({ time: Date.now(), title, detail, type });
  if (events.length > 50) events.pop();
  renderEvents();
}
function selectPoint(id) {
  selectedId = id;
  scene?.select(id);
  const p = selected();
  $('#detail-icon').innerHTML = icon(kindIcons[p.kind]);
  $('#detail-id').textContent = p.id;
  $('#detail-name').textContent = p.name;
  $('#detail-location').textContent = p.location;
  $('#reading-label').textContent = `当前${kindNames[p.kind]}`;
  $('#detail-unit').textContent = p.unit;
  $('#detail-range').textContent = p.range;
  $('#threshold-label').textContent = p.kind === 'level' || p.kind === 'flow' ? '演示正常区间' : '运行范围';
  $('#threshold-value').textContent = `${p.min.toFixed(p.digits)}–${p.max.toFixed(p.digits)} ${p.unit}`;
  $('#range-min').textContent = p.min.toFixed(p.digits);
  $('#range-max').textContent = `${p.max.toFixed(p.digits)} ${p.unit}`;
  $('#detail-note').innerHTML = `${icon('circle-dot')}${['level', 'flow'].includes(p.kind) ? '传感器布点为展示示意' : '设备状态为模拟反馈'}`;
  $('#trend-point').textContent = p.id;
  $('#trend-description').textContent = `${p.name} / ${p.unit}`;
  $('#target-label').hidden = p.kind !== 'level';
  $('#target-legend').hidden = p.kind !== 'level' || !$('#show-target').checked;
  updateReadings();
  renderList();
  drawChart();
  paintIcons();
}
function updateReadings() {
  const p = selected();
  $('#detail-value').textContent = p.value.toFixed(p.digits);
  $('#detail-value').className = p.quality;
  $('#detail-state').textContent = stateLabel(p);
  $('#detail-state').className = `state-chip ${p.quality}`;
  $('#detail-time').textContent = `${p.quality === 'offline' ? '最后有效数据' : sim.running ? '更新于' : '已暂停于'} ${time(p.updated)}`;
  const percent = Math.max(0, Math.min(100, (p.value - p.min) / (p.max - p.min) * 100));
  $('#range-fill').style.width = `${percent}%`;
  $('#range-thumb').style.left = `${percent}%`;
  $('#range-fill').className = p.quality;
  for (const [key, id] of Object.entries({ level: 'LT-03', flow: 'FT-01', gate: 'G2', pump: 'P-01' })) {
    const value = sim.points.find(p => p.id === id);
    $(`#kpi-${key}`).textContent = value.value.toFixed(value.digits);
    $(`#kpi-${key}`).className = value.quality;
  }
  const offline = sim.scenario === 'offline';
  const alarm = sim.points.some(p => p.quality === 'alarm');
  $('#overall-state').textContent = offline ? '模拟通信中断' : !sim.running ? '模拟已暂停' : alarm ? '1 项水位告警' : '模拟运行中';
  $('#overall-count').textContent = `${pointCount} / ${pointCount} 测点${offline ? '离线' : '有数据'}`;
  $('#overall-dot').className = `status-dot ${offline ? 'offline' : alarm ? 'alarm' : 'good'}`;
  $('#source-state').textContent = offline ? '模拟数据源离线' : !sim.running ? '模拟数据已暂停' : '模拟数据源正常';
  $('.sidebar-bottom > .status-dot').className = `status-dot ${offline ? 'offline' : 'good'}`;
  $('#footer-status').textContent = offline ? '通信中断 / 保留最后有效值' : !sim.running ? '模拟已暂停' : '模拟采集 / 1 Hz';
}
function renderTable() {
  $('#data-table').innerHTML = sim.points.map(p => `<tr><td><strong>${p.id}</strong></td><td>${p.name}</td><td>${kindNames[p.kind]}</td><td class="table-value ${p.quality}">${p.value.toFixed(p.digits)} <small>${p.unit}</small></td><td><span class="state-chip ${p.quality}">${stateLabel(p)}</span></td><td>${time(p.updated)}</td><td><button class="icon-button" data-open="${p.id}" title="查看 ${p.id}" aria-label="查看 ${p.id}">${icon('arrow-up-right')}</button></td></tr>`).join('');
  $('#data-table').querySelectorAll('[data-open]').forEach(b => b.onclick = () => { setView('monitor'); selectPoint(b.dataset.open); });
  paintIcons();
}
function setView(value) {
  view = value;
  $('#monitor-view').hidden = value !== 'monitor';
  $('#data-view').hidden = value !== 'data';
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === value));
  if (value === 'data') renderTable();
  else requestAnimationFrame(drawChart);
}

function drawChart() {
  const canvas = $('#trend-chart');
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width < 1) return;
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  const pad = { left: 51, right: 16, top: 12, bottom: 25 };
  const p = selected();
  const range = Number($('#time-range').value);
  const history = p.history.slice(-range);
  const values = history.map(d => d.value);
  const showTarget = p.kind === 'level' && $('#show-target').checked;
  if (showTarget) values.push(p.target);
  let min = Math.min(...values), max = Math.max(...values);
  const spread = Math.max(max - min, { level: 0.016, flow: 1.5, gate: 0.015, pump: 2 }[p.kind]);
  const mid = (min + max) / 2;
  min = Math.max(0, mid - spread * 0.7);
  max = mid + spread * 0.7;
  const first = history[0].time;
  const last = history.at(-1).time;
  const x = t => pad.left + (t - first) / Math.max(last - first, 1000) * (w - pad.left - pad.right);
  const y = value => pad.top + (1 - (value - min) / (max - min)) * (h - pad.top - pad.bottom);
  ctx.font = '10px "Segoe UI", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 4; i++) {
    const value = min + (max - min) * i / 3;
    const py = y(value);
    ctx.strokeStyle = '#e8edf1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(w - pad.right, py); ctx.stroke();
    ctx.fillStyle = '#7b8995'; ctx.fillText(value.toFixed(p.digits), pad.left - 10, py + 3);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i < 4; i++) {
    const t = first + (last - first) * i / 3;
    ctx.fillText(time(t), x(t), h - 5);
  }
  if (showTarget) {
    ctx.strokeStyle = '#bc9256'; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(pad.left, y(p.target)); ctx.lineTo(w - pad.right, y(p.target)); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.beginPath();
  history.forEach((d, i) => i ? ctx.lineTo(x(d.time), y(d.value)) : ctx.moveTo(x(d.time), y(d.value)));
  ctx.lineTo(x(last), h - pad.bottom); ctx.lineTo(x(first), h - pad.bottom); ctx.closePath();
  ctx.fillStyle = p.quality === 'alarm' ? '#fff0e8' : '#e5f4f6'; ctx.fill();
  ctx.beginPath();
  history.forEach((d, i) => i ? ctx.lineTo(x(d.time), y(d.value)) : ctx.moveTo(x(d.time), y(d.value)));
  ctx.strokeStyle = p.quality === 'offline' ? '#8d9aa4' : p.quality === 'alarm' ? '#d76d3c' : '#18859a';
  ctx.lineWidth = 2; ctx.stroke();
  const end = history.at(-1);
  ctx.beginPath(); ctx.arc(x(end.time), y(end.value), 3, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
  $('#sample-count').textContent = `${history.length} 个采样点${p.quality === 'offline' ? ' · 已断流' : !sim.running ? ' · 已暂停' : ''}`;
  $('#target-legend').hidden = !showTarget;
}
new ResizeObserver(drawChart).observe($('.chart-wrap'));

let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3000); }
function download(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
document.querySelectorAll('[data-device]').forEach(b => b.onclick = () => {
  deviceTab = b.dataset.device;
  document.querySelectorAll('[data-device]').forEach(el => el.classList.toggle('active', el === b));
  renderList();
});
$('#search').oninput = renderList;
$('#scenario').onchange = e => {
  sim.setScenario(e.target.value);
  if (e.target.value === 'alarm') { selectPoint('LT-03'); addEvent('LT-03 高水位告警', '模拟水位超过演示上限 0.150 m', 'alarm'); }
  else if (e.target.value === 'offline') addEvent('模拟通信中断', `保留最后有效值 · ${pointCount} 个测点离线`, 'offline');
  else addEvent(e.target.value === 'disturbance' ? '已切换来流扰动工况' : '已恢复稳定工况', '模拟数据更新中');
  refresh();
};
$('#pause').onclick = () => {
  sim.running = !sim.running;
  $('#pause').innerHTML = `${icon(sim.running ? 'pause' : 'play')}<span>${sim.running ? '暂停' : '继续'}</span>`;
  addEvent(sim.running ? '模拟采集已继续' : '模拟采集已暂停', sim.running ? '采样周期 1 s' : '当前数据与水流动画已冻结');
  refresh();
};
$('#export').onclick = () => {
  const lines = ['timestamp,point_id,name,value,unit,data_source'];
  sim.points.forEach(p => p.history.forEach(d => lines.push(`${new Date(d.time).toISOString()},${p.id},${p.name},${d.value.toFixed(p.digits)},${p.unit},simulation`)));
  const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  download(url, `${profile.name}_模拟采样_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`已导出 ${lines.length - 1} 条模拟采样记录`);
};
document.querySelectorAll('[data-camera]').forEach(b => b.onclick = () => {
  scene?.home(b.dataset.camera);
  document.querySelectorAll('[data-camera]').forEach(el => el.classList.toggle('active', el === b));
});
document.querySelectorAll('[data-layer]').forEach(b => b.onclick = () => {
  scene?.setLayer(b.dataset.layer);
  document.querySelectorAll('[data-layer]').forEach(el => el.classList.toggle('active', el === b));
});
$('#reset-camera').onclick = () => { scene?.home(); document.querySelector('[data-camera="perspective"]').click(); };
$('#rotate').onclick = () => { rotating = !rotating; scene?.rotate(rotating); $('#rotate').classList.toggle('active', rotating); $('#rotate').setAttribute('aria-pressed', rotating); };
$('#zoom-in').onclick = () => scene?.zoom(0.85);
$('#zoom-out').onclick = () => scene?.zoom(1.18);
$('#focus-selected').onclick = () => { setView('monitor'); scene?.focus(selectedId); };
$('#snapshot').onclick = () => { if (scene) { download(scene.snapshot(), `${profile.name}_三维模型.png`); toast('已保存三维模型截图'); } };
$('#fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('#scene-wrap').requestFullscreen(); } catch { toast('当前浏览器不支持全屏'); } };
$('#show-tags').onchange = e => scene?.setTags(e.target.checked);
$('#show-flow').onchange = e => scene?.setFlow(e.target.checked);
$('#transparent').onchange = e => scene?.setTransparent(e.target.checked);
$('#show-target').onchange = drawChart;
$('#time-range').onchange = drawChart;
$('#about').onclick = () => $('#about-dialog').showModal();
$('#close-about').onclick = () => $('#about-dialog').close();
$('#about-dialog').onclick = e => { if (e.target === $('#about-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } };
function refresh() {
  updateReadings(); renderList(); drawChart();
  if (view === 'data') renderTable();
  scene?.update();
  scene?.setMoving(sim.running && sim.scenario !== 'offline' && !matchMedia('(prefers-reduced-motion: reduce)').matches);
}
selectPoint(selectedId); renderEvents();
setInterval(() => { $('#clock').textContent = time(Date.now()); sim.tick(); refresh(); }, 1000);
$('#clock').textContent = time(Date.now());
createScene($('#scene-host'), sim.points, selectPoint, message => { $('#loading strong').textContent = message; })
  .then(api => { scene = api; $('#loading').remove(); scene.select(selectedId); refresh(); window.__flume = { scene, sim, selectPoint, ready: true }; })
  .catch(error => { console.error(error); $('#loading').innerHTML = '<strong>三维模型加载失败</strong><small>请刷新页面重试，并确认浏览器支持 WebGL。</small>'; });
