"use client";

import { useEffect, useRef } from "react";
import type { CityBuilding, BuildingType } from "@/lib/classify";

const COLORS: Record<BuildingType, { base: string; accent: string; window: string }> = {
  house: { base: "#3a5a8c", accent: "#5b82c4", window: "#ffd27a" },
  shop: { base: "#c46b3a", accent: "#e08b52", window: "#ffe9a8" },
  office: { base: "#2f8f7a", accent: "#4fc9ae", window: "#bff5e6" },
  tower: { base: "#6a4fc4", accent: "#9b7bff", window: "#d9f0ff" },
  factory: { base: "#7a7a7a", accent: "#9c9c9c", window: "#ff8a5c" },
  ruin: { base: "#2a2a2a", accent: "#3d3d3d", window: "#222" },
};

// deterministic pseudo-random from address so a given building always looks the same
function seedFromAddress(addr: string) {
  let h = 0;
  for (let i = 0; i < addr.length; i++) {
    h = (h << 5) - h + addr.charCodeAt(i);
    h |= 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return (h % 1000) / 1000;
  };
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: CityBuilding,
  x: number,
  groundY: number,
  unit: number,
  t: number
) {
  const rand = seedFromAddress(b.address);
  const palette = COLORS[b.type];
  const width = unit * (1.4 + rand() * 0.6);
  const h = unit * (b.height * 1.1 + 1);
  const y = groundY - h;

  ctx.save();

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + width / 2, groundY + 3, width * 0.6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  const grad = ctx.createLinearGradient(x, y, x + width, y + h);
  grad.addColorStop(0, palette.accent);
  grad.addColorStop(1, palette.base);
  ctx.fillStyle = b.type === "ruin" ? palette.base : grad;
  ctx.fillRect(x, y, width, h);

  // outline
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, h);

  // roof / type-specific silhouette
  if (b.type === "house") {
    ctx.fillStyle = palette.base;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + width / 2, y - unit * 0.5);
    ctx.lineTo(x + width + 3, y);
    ctx.closePath();
    ctx.fill();
  } else if (b.type === "shop") {
    ctx.fillStyle = "#ffcf5c";
    ctx.fillRect(x - 2, y, width + 4, unit * 0.25);
  } else if (b.type === "tower") {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + width / 2 - 2, y - unit * 0.8, 4, unit * 0.8);
    // blinking beacon
    if (Math.sin(t / 300) > 0.4) {
      ctx.fillStyle = "#ff5c5c";
      ctx.beginPath();
      ctx.arc(x + width / 2, y - unit * 0.8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.type === "factory") {
    ctx.fillStyle = palette.base;
    ctx.fillRect(x + width * 0.15, y - unit * 0.9, unit * 0.18, unit * 0.9);
    ctx.fillRect(x + width * 0.6, y - unit * 0.6, unit * 0.16, unit * 0.6);
    // smoke
    ctx.fillStyle = "rgba(180,180,180,0.25)";
    for (let i = 0; i < 3; i++) {
      const sy = y - unit * 0.9 - i * 10 - ((t / 40 + i * 20) % 40);
      ctx.beginPath();
      ctx.arc(x + width * 0.24, sy, 5 + i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.type === "office") {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, width, unit * 0.3);
  } else if (b.type === "ruin") {
    // broken top
    ctx.fillStyle = "#05070f";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width * 0.3, y - 6);
    ctx.lineTo(x + width * 0.5, y + 4);
    ctx.lineTo(x + width * 0.75, y - 8);
    ctx.lineTo(x + width, y);
    ctx.closePath();
    ctx.fill();
  }

  // windows
  if (b.type !== "ruin") {
    const cols = Math.max(1, Math.floor(width / 10));
    const rows = Math.max(1, Math.floor(h / 12));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + 4 + c * (width - 8) / cols;
        const wy = y + 6 + r * (h - 10) / rows;
        const lit = (Math.floor(t / 900) + r * 7 + c * 3 + Math.floor(rand() * 10)) % 5 !== 0;
        ctx.fillStyle = lit ? palette.window : "rgba(255,255,255,0.08)";
        ctx.fillRect(wx, wy, Math.max(2, width / cols - 4), Math.max(2, (h - 10) / rows - 4));
      }
    }
  } else {
    ctx.fillStyle = "rgba(255,80,80,0.5)";
    ctx.fillRect(x + width * 0.3, y + h * 0.3, 3, h * 0.4);
  }

  ctx.restore();
}

export default function CityCanvas({
  buildings,
  onPick,
}: {
  buildings: CityBuilding[];
  onPick?: (b: CityBuilding) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      canvas!.width = parent.clientWidth * devicePixelRatio;
      canvas!.height = parent.clientHeight * devicePixelRatio;
      canvas!.style.width = parent.clientWidth + "px";
      canvas!.style.height = parent.clientHeight + "px";
      ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function frame(t: number) {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      const groundY = h - 40;

      // sky
      const sky = ctx!.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#060a16");
      sky.addColorStop(0.6, "#0c1530");
      sky.addColorStop(1, "#131b33");
      ctx!.fillStyle = sky;
      ctx!.fillRect(0, 0, w, h);

      // stars
      let starSeed = 1;
      for (let i = 0; i < 60; i++) {
        starSeed = (starSeed * 9301 + 49297) % 233280;
        const sx = (starSeed / 233280) * w;
        starSeed = (starSeed * 9301 + 49297) % 233280;
        const sy = ((starSeed / 233280) * (h - 100));
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t / 800 + i));
        ctx!.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.4})`;
        ctx!.fillRect(sx, sy, 1.4, 1.4);
      }

      // ground
      ctx!.fillStyle = "#0a1020";
      ctx!.fillRect(0, groundY, w, h - groundY);
      ctx!.strokeStyle = "rgba(79,178,255,0.25)";
      ctx!.beginPath();
      ctx!.moveTo(0, groundY);
      ctx!.lineTo(w, groundY);
      ctx!.stroke();

      const list = buildingsRef.current;
      if (list.length === 0) {
        ctx!.fillStyle = "#5b6b8c";
        ctx!.font = "14px sans-serif";
        ctx!.textAlign = "center";
        ctx!.fillText("شهر خالیه — یک آدرس Base وارد کن تا اولین ساختمان ساخته بشه", w / 2, h / 2);
      } else {
        const unit = Math.max(14, Math.min(34, w / (list.length * 2.2)));
        const totalWidth = list.length * unit * 2.2;
        let x = Math.max(20, w / 2 - totalWidth / 2);
        for (const b of list) {
          drawBuilding(ctx!, b, x, groundY, unit, t);
          x += unit * 2.2;
        }
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function handleClick(e: MouseEvent) {
      if (!onPick) return;
      const list = buildingsRef.current;
      if (list.length === 0) return;
      const w = canvas!.clientWidth;
      const unit = Math.max(14, Math.min(34, w / (list.length * 2.2)));
      const totalWidth = list.length * unit * 2.2;
      const startX = Math.max(20, w / 2 - totalWidth / 2);
      const idx = Math.floor((e.offsetX - startX) / (unit * 2.2));
      if (idx >= 0 && idx < list.length) onPick(list[idx]);
    }
    canvas.addEventListener("click", handleClick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", handleClick);
    };
  }, [onPick]);

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
