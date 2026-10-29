const ringPoints = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `LT-0${i + 1}`, name: `渠道 ${i + 1} 水位`, short: `渠 ${i + 1}`,
    kind: 'level', unit: 'm', digits: 3, base: [0.108, 0.103, 0.101, 0.097, 0.094, 0.088][i],
    mesh: `liuti_${[2, 4, 5, 7, 8, 10][i]}`, min: 0.04, max: 0.15,
    location: `渠道 ${i + 1} · 示意测点`, target: 0.1, range: '0.000 – 0.300 m',
  })),
  { id: 'FT-01', name: '进水流量', short: '进水流量', kind: 'flow', unit: 'L/s', digits: 2, base: 12.6, mesh: 'JinShuiGuan', min: 5, max: 18, location: '回流泵出口 · 示意测点', range: '0.00 – 25.00 L/s' },
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `G${i}`, name: `${i === 0 ? '前池' : '渠道 ' + i}闸门`, short: `闸门 G${i}`,
    kind: 'gate', unit: 'm', digits: 3, base: [0.15, 0.12, 0.135, 0.11, 0.125, 0.115, 0.14][i],
    mesh: `PingBanZhaMen_${i + 1}`, min: 0, max: 0.3, location: i === 0 ? '恒压前池出口' : `渠道 ${i} 出口`, range: '0.000 – 0.300 m',
  })),
  { id: 'P-01', name: '回流泵', short: '回流泵', kind: 'pump', unit: 'Hz', digits: 1, base: 37.5, mesh: 'Beng', min: 0, max: 50, location: '集水池回流管路', range: '0.0 – 50.0 Hz' },
];
const sandboxPoints = [
  ...['高位水箱', '下层蓄水池', '中层渠段 A', '中层渠段 B', '中层渠段 C'].map((name, i) => ({
    id: `LT-0${i + 1}`, name: `${name}水位`, short: ['高位水箱', '蓄水池', '渠段 A', '渠段 B', '渠段 C'][i],
    kind: 'level', unit: 'm', digits: 3, base: [0.118, 0.106, 0.101, 0.097, 0.094][i],
    mesh: `JianCe${i + 1}`, min: 0.04, max: 0.15,
    location: `${name} / 模型检测部件 JianCe${i + 1}`, target: 0.1, range: '0.000 – 0.300 m',
  })),
  { id: 'FT-01', name: '管路流量', short: '流量计', kind: 'flow', unit: 'L/s', digits: 2, base: 12.6, mesh: 'LiuLiangJi', min: 5, max: 18, location: '模型流量计 LiuLiangJi', range: '0.00 – 25.00 L/s' },
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `G${i + 1}`, name: `闸门 ${i + 1}`, short: `闸门 ${i + 1}`, kind: 'gate', unit: 'm', digits: 3,
    base: [0.12, 0.135, 0.11, 0.125, 0.115][i], mesh: `DangBan_${i + 1}`, min: 0, max: 0.3,
    location: `模型闸门组件 DangBan_${i + 1}`, range: '0.000 – 0.300 m',
  })),
  ...['A', 'B', 'C'].map((name, i) => ({
    id: `P-0${i + 1}`, name: `泵组 ${name}`, short: `泵组 ${name}`, kind: 'pump', unit: 'Hz', digits: 1,
    base: [37.5, 32, 28][i], mesh: `Beng_${name}`, min: 0, max: 50,
    location: `模型泵组件 Beng_${name}`, range: '0.0 – 50.0 Hz',
  })),
];
export const isSandbox = new URLSearchParams(globalThis.location?.search ?? '').get('scene') !== 'ring';
export const points = isSandbox ? sandboxPoints : ringPoints;
export const profile = isSandbox ? {
  name: '水槽沙盘', description: '高位水箱 / 多段水渠 / 五组闸门 / 循环管路',
  revision: '14 个示意测点 · 原始沙盘模型', source: '/sandbox', geometryDir: 'geometries-data', geometryCount: 6,
} : {
  name: '环形水槽', description: '前池 / 六段渠道 / 集水池 / 回流泵',
  revision: '模型原始编号 G0–G6', source: '/model', geometryDir: 'geometries', geometryCount: 7,
};
export const kindNames = { level: '水位', flow: '流量', gate: '闸门开度', pump: '运行频率' };
export const kindIcons = { level: 'waves', flow: 'gauge', gate: 'panel-top', pump: 'fan' };

export class Simulation {
  constructor() {
    this.scenario = 'steady';
    this.running = true;
    this.elapsed = 0;
    this.started = Date.now();
    this.points = points.map((p) => ({ ...p, value: p.base, quality: 'good', updated: this.started, history: [] }));
    // The prefilled history uses the same explicitly simulated signal as the live preview.
    for (let i = -119; i <= 0; i++) this.sample(this.started + i * 1000, i);
  }
  sample(now, t) {
    this.points.forEach((p, index) => {
      let value = p.base;
      const wave = Math.sin(t / 10 + index * 0.7) + Math.sin(t / 3.8 + index) * 0.18;
      value += wave * ({ level: 0.003, flow: 0.22, gate: 0.0015, pump: 0.16 }[p.kind]);
      if (this.scenario === 'disturbance') value += ({ level: 0.018, flow: 2.8, gate: 0.025, pump: 5 }[p.kind]) * (0.65 + 0.35 * Math.sin(t / 9));
      if (this.scenario === 'alarm' && p.id === 'LT-03') value = 0.167 + wave * 0.004;
      p.value = Math.max(p.min, Math.min(p.kind === 'level' ? 0.3 : p.max, value));
      p.updated = now;
      p.quality = p.value > p.max || p.value < p.min ? 'alarm' : 'good';
      p.history.push({ time: now, value: p.value });
      if (p.history.length > 600) p.history.shift();
    });
  }
  tick() {
    if (!this.running) return;
    this.elapsed += 1;
    if (this.scenario === 'offline') {
      this.points.forEach(p => { p.quality = 'offline'; });
      return;
    }
    this.sample(Date.now(), this.elapsed);
  }
  setScenario(value) {
    this.scenario = value;
    if (value === 'offline') this.points.forEach(p => { p.quality = 'offline'; });
    else this.sample(Date.now(), this.elapsed);
  }
}
