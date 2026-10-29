# 水槽设备三维感知展示

默认展示 `水槽沙盘.zip` 中的原始几何模型，可在“实验场景”切换到已有的环形水槽。

## 运行

需要 Node.js 20.19+ 或 22.12+。

```powershell
git clone https://github.com/q4444zpf/3D-display-shebei.git
cd 3D-display-shebei
npm ci
npm run dev -- --port 5173
```

打开 http://127.0.0.1:5173/ 查看水槽沙盘，或 http://127.0.0.1:5173/?scene=ring 查看环形水槽。构建命令为 `npm run build`，构建后可用 `npm run preview` 本地预览。

仓库包含运行所需的模型 JSON 和几何数据，无需另行解压原始模型压缩包。开发依赖、构建产物、日志和自动化验证输出不纳入版本管理。

## 服务器部署

生产环境使用 Nginx 静态托管，网页端口为 `20005`，参考配置位于 `deploy/nginx.conf`。

- 环形水槽入口：`http://39.108.91.166:20005/?scene=ring`
- 水槽沙盘入口：`http://39.108.91.166:20005/`
- 发布目录：`/var/www/3d-display-shebei/releases/<release-id>`
- 当前版本软链接：`/var/www/3d-display-shebei/current`
- Nginx 配置：`/etc/nginx/conf.d/3d-display-shebei-20005.conf`

更新时先执行 `npm ci` 与 `npm run build`，将 `dist` 内容上传到新的发布目录，再切换 `current` 软链接。原始 ZIP 是解压备份，可不纳入发布包。修改 Nginx 配置后先运行 `nginx -t`，通过后执行 `systemctl reload nginx`。回滚可将 `current` 指回旧发布目录。服务器登录凭据不保存在仓库中。

## 展示内容

- 沙盘原始三维模型，支持旋转、缩放、俯视、正视、全屏和截图。
- 5 个水位测点、1 个流量测点、5 组闸门和 3 组泵，共 14 个展示测点。
- 场景标签、设备列表、当前值、状态、趋势与数据表同步联动。
- 每秒更新模拟采样，提供稳定运行、来流扰动、高水位告警、通信中断四种工况。
- 离线时保留最后有效值与时间；支持暂停采样及导出模拟历史 CSV。

全部读数、设备状态、历史记录与阈值均为模拟。传感器类型、测点名称和模型绑定是展示方案，不是现场校验过的设备台账。水流动画是方向示意，不是水动力计算。

环形水槽场景包含 6 个水位测点、1 个流量测点、G0–G6 共 7 组闸门和 1 台回流泵，共 15 个展示测点。模型保留 G0–G6 原始编号，尚未与实验方案中的 ZM1–ZM5 建立现场对应关系。

## 数据接入位置

`src/data.js` 集中定义测点与 `Simulation` 数据源；`src/main.js` 每秒调用 `tick()` 并刷新界面。真实数据接入时可在该数据层替换采样来源，保持测点的 `id`、`value`、`quality`、`updated` 和 `history` 字段一致，并核对单位、量程、阈值及现场设备与模型部件的映射。

`quality` 使用 `good`、`alarm` 或 `offline`；`updated` 为毫秒时间戳。历史记录项为 `{ time, value }`。当前没有连接 MQTT、WebSocket、HTTP 或现场控制系统。

## 验证

`verify.mjs` 为本机 Playwright 验证脚本，需要本机 Chrome 及 Codex 提供的 Playwright 依赖。先启动开发服务，再运行 `node verify.mjs`。结果和截图保存在 `verification/`。
