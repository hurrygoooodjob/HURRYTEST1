import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChevronDown,
  Download,
  ImagePlus,
  Minus,
  Plus,
  RotateCw,
  Type,
  Upload,
  X,
} from "lucide-react";
import "./styles.css";
import demoPortrait from "./assets/demo-portrait.jpg";

const EFFECTS = [
  ["mixed", "随机混合"],
  ["stretch", "横向拉伸"],
  ["pixel", "马赛克"],
  ["offset", "垂直错位"],
  ["scan", "扫描线"],
  ["color", "颜色偏移"],
];

const hash = (seed, index) => {
  let t = seed + index * 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        aria-pressed={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </label>
  );
}

function Range({ label, value, min, max, step = 1, suffix = "", onChange }) {
  return (
    <label className="control">
      <span className="control-head">
        <span>{label}</span>
        <output>{value}{suffix}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--range": `${((value - min) / (max - min)) * 100}%` }}
      />
    </label>
  );
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="stepper-row">
      <span>{label}</span>
      <div className="stepper">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`减少${label}`}>
          <Minus size={13} />
        </button>
        <span>{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`增加${label}`}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="panel-section">
      <header>
        <span>{title}</span>
        {hint && <small>{hint}</small>}
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}

function drawCover(ctx, image, x, y, width, height, sourceShiftX = 0, sourceShiftY = 0) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  let sw;
  let sh;
  let sx;
  let sy;
  if (imageRatio > targetRatio) {
    sh = image.height;
    sw = sh * targetRatio;
    sx = (image.width - sw) / 2;
    sy = 0;
  } else {
    sw = image.width;
    sh = sw / targetRatio;
    sx = 0;
    sy = (image.height - sh) / 2;
  }
  const maxSx = Math.max(0, image.width - sw);
  const maxSy = Math.max(0, image.height - sh);
  sx = Math.min(maxSx, Math.max(0, sx + sourceShiftX * sw));
  sy = Math.min(maxSy, Math.max(0, sy + sourceShiftY * sh));
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function renderArtwork(canvas, image, settings, scale = 1) {
  if (!canvas || !image?.complete) return;
  const width = Math.round(1200 * scale);
  const height = Math.round(1800 * scale);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.clearRect(0, 0, width, height);
  drawCover(ctx, image, 0, 0, width, height);

  const margin = settings.margin * 2.45 * scale;
  const gutter = settings.gutter * 1.15 * scale;
  const gridWidth = width - margin * 2;
  const gridHeight = height - margin * 2;
  const cellW = (gridWidth - gutter * (settings.cols - 1)) / settings.cols;
  const cellH = (gridHeight - gutter * (settings.rows - 1)) / settings.rows;
  const candidates = [];

  for (let row = 0; row < settings.rows; row++) {
    for (let col = 0; col < settings.cols; col++) {
      const index = row * settings.cols + col;
      if (hash(settings.seed, index) <= settings.ratio / 100) candidates.push({ row, col, index });
    }
  }

  const chosen = [];
  const occupied = new Set();
  for (const cell of candidates) {
    const key = `${cell.row}:${cell.col}`;
    if (occupied.has(key)) continue;
    let span = 1;
    if (
      settings.merge &&
      cell.row < settings.rows - 1 &&
      cell.col < settings.cols - 1 &&
      hash(settings.seed + 83, cell.index) > 0.62
    ) {
      span = 2;
      occupied.add(`${cell.row}:${cell.col + 1}`);
      occupied.add(`${cell.row + 1}:${cell.col}`);
      occupied.add(`${cell.row + 1}:${cell.col + 1}`);
    }
    occupied.add(key);
    chosen.push({ ...cell, span });
  }

  for (const cell of chosen) {
    const x = margin + cell.col * (cellW + gutter);
    const y = margin + cell.row * (cellH + gutter);
    const w = cellW * cell.span + gutter * (cell.span - 1);
    const h = cellH * cell.span + gutter * (cell.span - 1);
    const intensity = settings.intensity / 10;
    const pool = ["stretch", "pixel", "offset", "scan", "color"];
    const kind = settings.effect === "mixed"
      ? pool[Math.floor(hash(settings.seed + 211, cell.index) * pool.length)]
      : settings.effect;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    if (kind === "stretch") {
      const sourceY = (y + h * hash(settings.seed + 17, cell.index)) / height;
      const stripH = Math.max(8 * scale, h * (0.06 + (1 - intensity) * 0.1));
      const temp = document.createElement("canvas");
      temp.width = Math.max(1, Math.floor(width));
      temp.height = Math.max(1, Math.floor(stripH));
      const tctx = temp.getContext("2d");
      drawCover(tctx, image, 0, -sourceY * height, width, height);
      ctx.drawImage(temp, 0, 0, temp.width, temp.height, x - w * intensity * 0.4, y, w * (1 + intensity * 0.8), h);
    } else if (kind === "pixel") {
      const pixels = Math.max(4, Math.floor(28 - settings.intensity * 2));
      const temp = document.createElement("canvas");
      temp.width = pixels;
      temp.height = Math.max(4, Math.round(pixels * h / w));
      const tctx = temp.getContext("2d");
      tctx.imageSmoothingEnabled = true;
      drawCover(tctx, image, 0, 0, temp.width, temp.height, (x / width - 0.5) * 0.15, (y / height - 0.5) * 0.15);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(temp, x, y, w, h);
      ctx.imageSmoothingEnabled = true;
    } else if (kind === "offset") {
      const direction = hash(settings.seed + 39, cell.index) > 0.5 ? 1 : -1;
      const offset = direction * (0.06 + intensity * 0.2);
      ctx.translate(0, direction * h * intensity * 0.12);
      drawCover(ctx, image, x, y, w, h, 0, offset);
    } else if (kind === "scan") {
      const lines = 9 + settings.intensity * 2;
      const lineH = h / lines;
      for (let line = 0; line < lines; line++) {
        if (line % 2 === 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y + line * lineH, w, Math.max(1, lineH * 0.34));
          ctx.clip();
          const direction = line % 4 ? 1 : -1;
          drawCover(ctx, image, x + direction * w * intensity * 0.18, y, w, h);
          ctx.restore();
        }
      }
      ctx.fillStyle = "rgba(246, 242, 235, .28)";
      for (let line = 1; line < lines; line += 3) {
        ctx.fillRect(x, y + line * lineH, w * (0.42 + hash(settings.seed, line + cell.index) * 0.45), 1.2 * scale);
      }
    } else if (kind === "color") {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.58;
      ctx.drawImage(canvas, x, y, w, h, x - 9 * intensity * scale, y, w, h);
      ctx.fillStyle = "rgba(255, 20, 30, .26)";
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(0, 80, 150, .2)";
      ctx.fillRect(x + 8 * intensity * scale, y, w, h);
    }
    ctx.restore();
  }

  if (settings.decorative) {
    const boxW = gridWidth * 0.28;
    const boxH = gridHeight * 0.27;
    const boxX = margin + gridWidth * 0.59;
    const boxY = margin + gridHeight * 0.43;
    ctx.fillStyle = "rgba(247, 245, 240, .82)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = "rgba(32, 30, 28, .58)";
    ctx.font = `${12 * scale}px Arial, sans-serif`;
    const copy = ["Fragments of reality", "rearranged by chance,", "creating new orders", "inside the grid.", "", "A different story", "emerges."];
    copy.forEach((line, i) => ctx.fillText(line, boxX + 24 * scale, boxY + (40 + i * 20) * scale));
    ctx.fillRect(boxX + 24 * scale, boxY + boxH - 34 * scale, 32 * scale, 1 * scale);
  }

  if (settings.titleEnabled) {
    ctx.save();
    ctx.fillStyle = "#f3efe7";
    ctx.font = `700 ${Math.round(74 * scale)}px "Arial Narrow", Arial, sans-serif`;
    ctx.letterSpacing = `${-2 * scale}px`;
    const title = settings.title.trim() || "ORDER / CHAOS";
    ctx.translate(margin + 22 * scale, height - margin - 34 * scale);
    ctx.fillText(title.toUpperCase(), 0, 0, gridWidth - 40 * scale);
    ctx.restore();
  }

  if (settings.grid) {
    ctx.save();
    ctx.strokeStyle = "rgba(250, 247, 240, .32)";
    ctx.lineWidth = Math.max(1, scale);
    for (let row = 0; row < settings.rows; row++) {
      for (let col = 0; col < settings.cols; col++) {
        const x = margin + col * (cellW + gutter);
        const y = margin + row * (cellH + gutter);
        ctx.strokeRect(x, y, cellW, cellH);
        if (settings.coords) {
          ctx.fillStyle = "rgba(255,255,255,.54)";
          ctx.font = `${9 * scale}px ui-monospace, monospace`;
          ctx.fillText(`${col + 1}.${row + 1}`, x + 7 * scale, y + 14 * scale);
        }
      }
    }
    ctx.restore();
  }
  return chosen.length;
}

function App() {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const [image, setImage] = useState(null);
  const [hitCount, setHitCount] = useState(0);
  const [settings, setSettings] = useState({
    cols: 5,
    rows: 4,
    gutter: 18,
    margin: 28,
    grid: true,
    coords: true,
    decorative: true,
    ratio: 26,
    intensity: 7,
    merge: true,
    effect: "mixed",
    seed: 2487,
    titleEnabled: false,
    title: "ORDER / CHAOS",
  });

  const update = useCallback((key, value) => setSettings((current) => ({ ...current, [key]: value })), []);

  useEffect(() => {
    const source = new Image();
    source.src = demoPortrait;
    source.onload = () => setImage(source);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const hits = renderArtwork(canvasRef.current, image, settings, 1);
      if (typeof hits === "number") setHitCount(hits);
    });
    return () => cancelAnimationFrame(frame);
  }, [image, settings]);

  const upload = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const source = new Image();
      source.onload = () => setImage(source);
      source.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const exportPng = () => {
    const exportCanvas = document.createElement("canvas");
    renderArtwork(exportCanvas, image, settings, 2);
    const link = document.createElement("a");
    link.download = `grid-random-${settings.seed}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark"><span /><span /><span /></div>
          <h1>网格随机效果生成器</h1>
        </div>

        <div className="sidebar-scroll">
          <Section title="上传图片">
            <button className="upload-zone" type="button" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
              <span>选择图片</span>
              <small>JPG / PNG，最大 20MB</small>
            </button>
            <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0])} />
          </Section>

          <Section title="画布">
            <div className="canvas-size">
              <div><span>宽度</span><strong>2400</strong><small>px</small></div>
              <span>×</span>
              <div><span>高度</span><strong>3600</strong><small>px</small></div>
              <button type="button" aria-label="画布预设"><ChevronDown size={14} /></button>
            </div>
          </Section>

          <Section title="网格系统">
            <Stepper label="列数 Columns" value={settings.cols} min={2} max={12} onChange={(v) => update("cols", v)} />
            <Stepper label="行数 Rows" value={settings.rows} min={2} max={12} onChange={(v) => update("rows", v)} />
            <Range label="槽宽 Gutter" value={settings.gutter} min={0} max={64} suffix=" px" onChange={(v) => update("gutter", v)} />
            <Range label="页边距 Margin" value={settings.margin} min={0} max={80} suffix=" px" onChange={(v) => update("margin", v)} />
            <div className="toggle-stack">
              <Toggle label="显示网格线" checked={settings.grid} onChange={(v) => update("grid", v)} />
              <Toggle label="显示网格坐标" checked={settings.coords} onChange={(v) => update("coords", v)} />
              <Toggle label="装饰性文本段落" checked={settings.decorative} onChange={(v) => update("decorative", v)} />
            </div>
          </Section>

          <Section title="随机效果">
            <Range label="效果网格比例" value={settings.ratio} min={5} max={80} suffix="%" onChange={(v) => update("ratio", v)} />
            <Range label="效果强度" value={settings.intensity} min={1} max={10} onChange={(v) => update("intensity", v)} />
            <Toggle label="合并相邻 2×2 网格" checked={settings.merge} onChange={(v) => update("merge", v)} />
            <div className="effect-label">效果类型</div>
            <div className="effect-grid">
              {EFFECTS.map(([key, label]) => (
                <button
                  type="button"
                  className={settings.effect === key ? "selected" : ""}
                  key={key}
                  onClick={() => update("effect", key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="大标题">
            {settings.titleEnabled ? (
              <div className="title-editor">
                <Type size={15} />
                <input value={settings.title} maxLength={28} onChange={(e) => update("title", e.target.value)} aria-label="标题文字" />
                <button type="button" onClick={() => update("titleEnabled", false)} aria-label="删除标题"><X size={14} /></button>
              </div>
            ) : (
              <button className="add-title" type="button" onClick={() => update("titleEnabled", true)}>
                <Plus size={15} /> 添加标题
              </button>
            )}
            <p className="section-note">标题会固定在安全边距内，并随导出尺寸等比缩放。</p>
          </Section>
        </div>

        <div className="action-bar">
          <button className="primary" type="button" onClick={() => update("seed", Math.floor(Math.random() * 999999))}>
            <RotateCw size={15} />重新随机
          </button>
          <button type="button" onClick={exportPng}>
            <Download size={15} />导出 PNG
          </button>
        </div>
      </aside>

      <section className="workspace">
        <div className="workspace-tools">
          <span><ImagePlus size={14} />2400 × 3600 px</span>
          <i />
          <span>▦&nbsp;&nbsp;{settings.cols} × {settings.rows}</span>
          <i />
          <span>影响单元格 <strong>{hitCount} / {settings.cols * settings.rows}</strong></span>
        </div>
        <div className="canvas-wrap">
          <canvas ref={canvasRef} aria-label="网格随机效果画布" />
        </div>
        <div className="status-bar">
          <span>SEED {settings.seed}</span>
          <span>100%</span>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
