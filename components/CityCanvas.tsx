"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { CityBuilding, Zone } from "@/lib/classify";
import { computeCityLayout, type CityLayout } from "@/lib/cityLayout";

/* ============================ helpers ============================ */

function easeOutBack(x: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// soft additive glow blob (window bloom, neon, lamps)
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, strength = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = strength;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, groundY: number, w: number) {
  const g = ctx.createRadialGradient(cx, groundY + 3, 0, cx, groundY + 3, w * 0.62);
  g.addColorStop(0, "rgba(0,0,0,0.42)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 3, w * 0.62, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

// lit windows with a subtle bloom
function windows(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  cols: number, rows: number, color: string, t: number, seed: number
) {
  const cw = (w - 8) / cols;
  const ch = (h - 8) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = (Math.floor(t / 1100) + r * 5 + c * 3 + seed) % 6 !== 0;
      const px = x + 4 + c * cw + 1;
      const py = y + 4 + r * ch + 1;
      ctx.fillStyle = lit ? color : "rgba(180,200,255,0.06)";
      ctx.fillRect(px, py, cw - 2, ch - 2);
      if (lit) glow(ctx, px + (cw - 2) / 2, py + (ch - 2) / 2, cw * 0.9, color, 0.22);
    }
  }
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number, groundY: number, w: number, h: number,
  colorTop: string, colorBottom: string
) {
  const x = cx - w / 2;
  const y = groundY - h;
  const grad = ctx.createLinearGradient(x, y, x, groundY);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  // left/right shading for volume
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(x, y, w * 0.18, h);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x + w * 0.82, y, w * 0.18, h);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 3);
  ctx.stroke();
  return { x, y };
}

function drawHouseLike(
  ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number, seed: number,
  opts: { w: number; h: number; roof: string; wall: string; wallDark: string; win: string; door: string; doors?: number; flat?: boolean }
) {
  const w = opts.w * scale;
  const h = opts.h * scale;
  shadow(ctx, cx, groundY, w);
  const { x, y } = drawBox(ctx, cx, groundY, w, h, opts.wall, opts.wallDark);
  if (!opts.flat) {
    ctx.fillStyle = opts.roof;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + w / 2, y - h * 0.42);
    ctx.lineTo(x + w + 4, y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = opts.roof;
    ctx.fillRect(x - 3, y - 5, w + 6, 6);
  }
  const doors = opts.doors ?? 1;
  const dw = w * 0.2;
  for (let d = 0; d < doors; d++) {
    const dx = cx + (doors === 1 ? 0 : (d - (doors - 1) / 2) * w * 0.42);
    ctx.fillStyle = opts.door;
    roundRect(ctx, dx - dw / 2, groundY - h * 0.42, dw, h * 0.42, 2);
    ctx.fill();
  }
  windows(ctx, x, y + h * 0.12, w, h * 0.4, doors + 1, 1, opts.win, t, seed);
}

function drawTower(
  ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number, seed: number,
  opts: { w: number; h: number; top: string; bottom: string; win: string; beacon?: boolean; taper?: number }
) {
  const w = opts.w * scale;
  const h = opts.h * scale;
  const taper = opts.taper ?? 0;
  shadow(ctx, cx, groundY, w);
  const x = cx - w / 2;
  const y = groundY - h;
  const grad = ctx.createLinearGradient(x, y, x, groundY);
  grad.addColorStop(0, opts.top);
  grad.addColorStop(1, opts.bottom);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x + w * taper, y);
  ctx.lineTo(x + w - w * taper, y);
  ctx.lineTo(x + w, groundY);
  ctx.lineTo(x, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(x, y, w * 0.16, h);
  windows(ctx, x + w * taper, y + 6, w * (1 - taper * 2), h - 10, Math.max(2, Math.round(w / 16)), Math.max(4, Math.round(h / 20)), opts.win, t, seed);
  if (opts.beacon) {
    ctx.strokeStyle = opts.bottom;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y - h * 0.16);
    ctx.stroke();
    if (Math.sin(t / 350) > 0.3) {
      ctx.fillStyle = "#ff5c5c";
      ctx.beginPath();
      ctx.arc(cx, y - h * 0.16, 3.2, 0, Math.PI * 2);
      ctx.fill();
      glow(ctx, cx, y - h * 0.16, 14, "rgba(255,92,92,0.7)", 0.8);
    }
  }
}

function drawCivic(
  ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number, seed: number,
  opts: { w: number; h: number; body: string; bodyDark: string; accent: string; columns: number; dome?: boolean }
) {
  const w = opts.w * scale;
  const h = opts.h * scale;
  shadow(ctx, cx, groundY, w);
  const { x, y } = drawBox(ctx, cx, groundY, w, h, opts.body, opts.bodyDark);
  ctx.fillStyle = opts.accent;
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(cx, y - h * 0.22);
  ctx.lineTo(x + w + 6, y);
  ctx.closePath();
  ctx.fill();
  if (opts.dome) {
    ctx.fillStyle = opts.accent;
    ctx.beginPath();
    ctx.arc(cx, y - h * 0.2, w * 0.16, Math.PI, 0);
    ctx.fill();
  }
  const colW = w / (opts.columns * 2.2);
  for (let i = 0; i < opts.columns; i++) {
    const colX = x + w * 0.08 + i * ((w * 0.84) / (opts.columns - 1 || 1));
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillRect(colX - colW / 2, y + h * 0.1, colW, h * 0.85);
  }
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(x - 8, groundY - 4, w + 16, 4);
}

function drawIndustrial(
  ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number, seed: number,
  opts: { w: number; h: number; body: string; bodyDark: string; stacks: number; win: string }
) {
  const w = opts.w * scale;
  const h = opts.h * scale;
  shadow(ctx, cx, groundY, w);
  const { x, y } = drawBox(ctx, cx, groundY, w, h, opts.body, opts.bodyDark);
  windows(ctx, x, y + h * 0.5, w, h * 0.4, Math.max(2, Math.round(w / 20)), 2, opts.win, t, seed);
  for (let i = 0; i < opts.stacks; i++) {
    const sx = x + w * (0.2 + i * 0.3);
    const sh = h * (0.6 + (i % 2) * 0.25);
    ctx.fillStyle = opts.bodyDark;
    ctx.fillRect(sx, y - sh, w * 0.09, sh);
    ctx.fillStyle = "rgba(200,200,210,0.22)";
    for (let p = 0; p < 3; p++) {
      const puff = (t / 45 + p * 26 + i * 13) % 60;
      ctx.beginPath();
      ctx.arc(sx + w * 0.045, y - sh - puff, 4 + p * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// awning strip used by cafe / shop / boutique
function awning(ctx: CanvasRenderingContext2D, cx: number, groundY: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(cx - w / 2 - 3, groundY - h, w + 6, 7);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  for (let i = 0; i < 5; i++) ctx.fillRect(cx - w / 2 + (i * w) / 5, groundY - h, w / 10, 7);
}

function drawTrashCan(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 20 * scale, h = 26 * scale;
  shadow(ctx, cx, groundY, w * 1.4);
  ctx.fillStyle = "#4a5568";
  roundRect(ctx, cx - w / 2, groundY - h, w, h, 3);
  ctx.fill();
  ctx.fillStyle = "#5f6b7a";
  ctx.fillRect(cx - w / 2 - 2, groundY - h - 4, w + 4, 5);
}

function drawOldBench(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 34 * scale;
  shadow(ctx, cx, groundY, w);
  ctx.strokeStyle = "#6b5a4a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, groundY - 10); ctx.lineTo(cx + w / 2, groundY - 10);
  ctx.moveTo(cx - w / 2, groundY - 10); ctx.lineTo(cx - w / 2, groundY);
  ctx.moveTo(cx + w / 2, groundY - 10); ctx.lineTo(cx + w / 2, groundY);
  ctx.stroke();
}

function drawTrashPile(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  shadow(ctx, cx, groundY, 40 * scale);
  const colors = ["#5a5346", "#4a4438", "#6b6152"];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const bw = (10 + (i % 3) * 6) * scale, bh = (8 + (i % 2) * 5) * scale;
    roundRect(ctx, cx - 20 * scale + i * 9 * scale, groundY - bh, bw, bh, 2);
    ctx.fill();
  }
}

function drawRuin(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 50 * scale, h = 32 * scale;
  shadow(ctx, cx, groundY, w);
  ctx.fillStyle = "#302e2b";
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, groundY);
  ctx.lineTo(cx - w / 2, groundY - h * 0.4);
  ctx.lineTo(cx - w * 0.15, groundY - h * 0.9);
  ctx.lineTo(cx + w * 0.1, groundY - h * 0.5);
  ctx.lineTo(cx + w / 2, groundY - h * 0.7);
  ctx.lineTo(cx + w / 2, groundY);
  ctx.closePath();
  ctx.fill();
}

function drawAbandonedLot(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 60 * scale;
  shadow(ctx, cx, groundY, w);
  ctx.fillStyle = "#3a3a35";
  ctx.fillRect(cx - w / 2, groundY - 8 * scale, w, 8 * scale);
  ctx.strokeStyle = "#4a7a4a";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const wx = cx - w / 2 + ((i * 37) % 100) * (w / 100);
    ctx.beginPath();
    ctx.moveTo(wx, groundY);
    ctx.quadraticCurveTo(wx + 3, groundY - 10 * scale, wx - 2, groundY - 16 * scale);
    ctx.stroke();
  }
}

function drawCrackedRoad(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 58 * scale;
  shadow(ctx, cx, groundY, w);
  ctx.fillStyle = "#2f2f31";
  ctx.fillRect(cx - w / 2, groundY - 6 * scale, w, 6 * scale);
  ctx.strokeStyle = "#141416";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + (w / 4) * i, groundY - 6 * scale);
    ctx.lineTo(cx - w / 2 + (w / 4) * i + 6, groundY);
    ctx.stroke();
  }
  ctx.strokeStyle = "#d9c24a";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, groundY - 3 * scale);
  ctx.lineTo(cx + w / 2, groundY - 3 * scale);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDeadTree(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  shadow(ctx, cx, groundY, 22 * scale);
  ctx.strokeStyle = "#4a3c2e";
  ctx.lineWidth = 3.5 * scale;
  ctx.beginPath();
  ctx.moveTo(cx, groundY);
  ctx.lineTo(cx, groundY - 28 * scale);
  ctx.moveTo(cx, groundY - 18 * scale); ctx.lineTo(cx - 12 * scale, groundY - 30 * scale);
  ctx.moveTo(cx, groundY - 22 * scale); ctx.lineTo(cx + 11 * scale, groundY - 34 * scale);
  ctx.stroke();
}

function drawRubble(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  shadow(ctx, cx, groundY, 36 * scale);
  const cols = ["#6b5f52", "#544a40", "#7a6d5c"];
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(cx - 16 * scale + i * 6 * scale, groundY - (4 + (i % 3) * 4) * scale);
    ctx.rotate(((i * 53) % 40 - 20) / 60);
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(0, 0, 9 * scale, 6 * scale);
    ctx.restore();
  }
}

function drawBrokenCar(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 42 * scale, h = 15 * scale;
  shadow(ctx, cx, groundY, w);
  ctx.fillStyle = "#6e4442";
  roundRect(ctx, cx - w / 2, groundY - h, w, h, 4);
  ctx.fill();
  ctx.fillStyle = "#8a5a55";
  roundRect(ctx, cx - w * 0.28, groundY - h - 8 * scale, w * 0.5, 9 * scale, 3);
  ctx.fill();
  ctx.fillStyle = "#26282c";
  ctx.beginPath(); ctx.arc(cx - w * 0.28, groundY, 5 * scale, 0, Math.PI * 2);
  ctx.arc(cx + w * 0.28, groundY, 5 * scale, 0, Math.PI * 2); ctx.fill();
}

function drawScrapTent(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 40 * scale, h = 26 * scale;
  shadow(ctx, cx, groundY, w);
  ctx.fillStyle = "#6f6a52";
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, groundY);
  ctx.lineTo(cx, groundY - h);
  ctx.lineTo(cx + w / 2, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2a2a26";
  ctx.beginPath();
  ctx.moveTo(cx, groundY);
  ctx.lineTo(cx - w * 0.14, groundY);
  ctx.lineTo(cx, groundY - h * 0.5);
  ctx.closePath();
  ctx.fill();
}

/* ===================== special / neon draws ===================== */

// glass tower with a lit crown + optional neon sign strip
function drawGlassTower(
  ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number, seed: number,
  opts: { w: number; h: number; top: string; bottom: string; win: string; crown: string; sign?: string }
) {
  const w = opts.w * scale, h = opts.h * scale;
  const x = cx - w / 2, y = groundY - h;
  shadow(ctx, cx, groundY, w);
  const grad = ctx.createLinearGradient(x, y, x, groundY);
  grad.addColorStop(0, opts.top);
  grad.addColorStop(1, opts.bottom);
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  // vertical glass mullions
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w / 5) * i, y + 6);
    ctx.lineTo(x + (w / 5) * i, groundY - 4);
    ctx.stroke();
  }
  windows(ctx, x + 3, y + 8, w - 6, h - 14, Math.max(3, Math.round(w / 14)), Math.max(6, Math.round(h / 16)), opts.win, t, seed);
  // lit crown
  ctx.fillStyle = opts.crown;
  roundRect(ctx, x + 2, y, w - 4, 6, 2);
  ctx.fill();
  glow(ctx, cx, y + 2, w * 0.7, opts.crown, 0.5 + 0.2 * Math.sin(t / 600 + seed));
  if (opts.sign) {
    glow(ctx, cx, y + h * 0.3, w * 0.6, opts.sign, 0.3 + 0.15 * Math.sin(t / 300));
  }
}

// neon-signed shop front (arcade, cafe, boutique, supermarket, mall, hotel)
function drawNeonShop(
  ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number, seed: number,
  opts: { w: number; h: number; wall: string; wallDark: string; neon: string; win: string; awn?: string; floors?: number }
) {
  const w = opts.w * scale, h = opts.h * scale;
  const { x, y } = drawBox(ctx, cx, groundY, w, h, opts.wall, opts.wallDark);
  const floors = opts.floors ?? 1;
  for (let f = 0; f < floors; f++) {
    windows(ctx, x, y + 6 + f * (h / floors), w, (h / floors) * 0.62, Math.max(3, Math.round(w / 16)), 1, opts.win, t, seed + f);
  }
  if (opts.awn) awning(ctx, cx, groundY, w * 0.9, h * 0.34, opts.awn);
  // neon sign band near the top
  const flick = (Math.floor(t / 140) + seed) % 11 !== 0;
  ctx.fillStyle = flick ? opts.neon : "rgba(255,255,255,0.12)";
  roundRect(ctx, x + w * 0.14, y + 6, w * 0.72, 8, 3);
  ctx.fill();
  if (flick) glow(ctx, cx, y + 10, w * 0.75, opts.neon, 0.6);
}

// observatory / dome roof landmark
function drawObservatory(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number, seed: number) {
  const w = 96 * scale, h = 88 * scale;
  const { x, y } = drawBox(ctx, cx, groundY, w, h, "#243247", "#141d2c");
  windows(ctx, x, y + h * 0.34, w, h * 0.5, 4, 3, "#8fd6ff", t, seed);
  ctx.fillStyle = "#cfd8e6";
  ctx.beginPath();
  ctx.arc(cx, y, w * 0.34, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#6fb5ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, y - w * 0.1);
  ctx.lineTo(cx + w * 0.26, y - w * 0.34);
  ctx.stroke();
  glow(ctx, cx + w * 0.26, y - w * 0.34, 12, "rgba(111,181,255,0.8)", 0.6 + 0.3 * Math.sin(t / 500));
}

// solar farm — angled reflective panels
function drawSolarFarm(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number) {
  const w = 86 * scale;
  shadow(ctx, cx, groundY, w);
  for (let i = 0; i < 4; i++) {
    const px = cx - w / 2 + i * (w / 4) + 8;
    const py = groundY - 8;
    ctx.fillStyle = "#1a2b44";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 22 * scale, py - 24 * scale);
    ctx.lineTo(px + 30 * scale, py - 18 * scale);
    ctx.lineTo(px + 8 * scale, py + 6);
    ctx.closePath();
    ctx.fill();
    const shimmer = 0.25 + 0.2 * Math.sin(t / 400 + i);
    ctx.fillStyle = `rgba(120,200,255,${shimmer})`;
    ctx.fill();
    ctx.fillStyle = "#33465e";
    ctx.fillRect(px + 12 * scale, py, 3, 8);
  }
}

/* ===================== master item dispatcher ===================== */

function drawItem(ctx: CanvasRenderingContext2D, b: CityBuilding, cx: number, groundY: number, t: number) {
  const s = b.scale;
  const seed = Math.abs(Math.floor(cx)) % 97;
  switch (b.itemType) {
    /* ---- wasteland ---- */
    case "ruin": return drawRuin(ctx, cx, groundY, s);
    case "abandoned_lot": return drawAbandonedLot(ctx, cx, groundY, s);
    case "trash_pile": return drawTrashPile(ctx, cx, groundY, s);
    case "trash_can": return drawTrashCan(ctx, cx, groundY, s);
    case "old_bench": return drawOldBench(ctx, cx, groundY, s);
    case "cracked_road": return drawCrackedRoad(ctx, cx, groundY, s);
    case "dead_tree": return drawDeadTree(ctx, cx, groundY, s);
    case "rubble": return drawRubble(ctx, cx, groundY, s);
    case "broken_car": return drawBrokenCar(ctx, cx, groundY, s);
    case "scrap_tent": return drawScrapTent(ctx, cx, groundY, s);

    /* ---- residential ---- */
    case "cottage":
      return drawHouseLike(ctx, cx, groundY, s, t, seed, { w: 62, h: 54, roof: "#8a5a3a", wall: "#d9b98a", wallDark: "#a5865f", win: "#ffe6a0", door: "#5a3d28" });
    case "small_house":
      return drawHouseLike(ctx, cx, groundY, s, t, seed, { w: 66, h: 58, roof: "#7a4a3a", wall: "#c99f78", wallDark: "#967250", win: "#ffdf8f", door: "#4a3020" });
    case "house":
      return drawHouseLike(ctx, cx, groundY, s, t, seed, { w: 72, h: 66, roof: "#3a5a8a", wall: "#7d9fce", wallDark: "#4d6a99", win: "#ffe9a8", door: "#2a3f5f" });
    case "bungalow":
      return drawHouseLike(ctx, cx, groundY, s, t, seed, { w: 78, h: 50, roof: "#8a7a4a", wall: "#c8b98a", wallDark: "#948453", win: "#ffe6a0", door: "#5a4a2a" });
    case "townhouse":
      return drawHouseLike(ctx, cx, groundY, s, t, seed, { w: 74, h: 78, roof: "#a5542a", wall: "#d98a5a", wallDark: "#a5613a", win: "#ffdf9a", door: "#5a2f1a", doors: 2 });
    case "duplex":
      return drawHouseLike(ctx, cx, groundY, s, t, seed, { w: 88, h: 70, roof: "#3a5a7a", wall: "#7d9ac9", wallDark: "#4d6a94", win: "#ffe6a0", door: "#2a3f5f", doors: 2 });
    case "apartment":
      return drawHouseLike(ctx, cx, groundY, s, t, seed, { w: 80, h: 108, roof: "#4a5f7a", wall: "#8296b5", wallDark: "#54687f", win: "#ffe4a0", door: "#33455f", doors: 2, flat: true });
    case "loft":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 76, h: 128, top: "#5a4d7a", bottom: "#2e2745", win: "#c9b8ff", crown: "#b58bff" });
    case "garden_villa":
      return drawHouseLike(ctx, cx, groundY, s, t, seed, { w: 96, h: 72, roof: "#3a7a4a", wall: "#8fc79a", wallDark: "#5a9068", win: "#fff0b0", door: "#3a5a2a", doors: 2 });
    case "mansion":
      return drawCivic(ctx, cx, groundY, s, t, seed, { w: 120, h: 90, body: "#e8dfc8", bodyDark: "#b8ac8f", accent: "#d4c39a", columns: 4 });
    case "villa":
      return drawCivic(ctx, cx, groundY, s, t, seed, { w: 132, h: 100, body: "#f0e6d2", bodyDark: "#c4b896", accent: "#e0cfa0", columns: 5, dome: true });
    case "penthouse":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 84, h: 168, top: "#6a4dbf", bottom: "#2a2145", win: "#e0d0ff", crown: "#b58bff", sign: "rgba(181,139,255,0.6)" });

    /* ---- commercial ---- */
    case "kiosk":
      return drawNeonShop(ctx, cx, groundY, s, t, seed, { w: 52, h: 46, wall: "#c8a83a", wallDark: "#8f761f", neon: "#ffe45c", win: "#fff2b0", awn: "#e8c04a" });
    case "market_stall":
      return drawNeonShop(ctx, cx, groundY, s, t, seed, { w: 60, h: 44, wall: "#b5432a", wallDark: "#7e2c1a", neon: "#ff7a5c", win: "#ffd8b0", awn: "#c9432a" });
    case "cafe":
      return drawNeonShop(ctx, cx, groundY, s, t, seed, { w: 64, h: 52, wall: "#a5764a", wallDark: "#6f4f2f", neon: "#ffb05c", win: "#ffe4b0", awn: "#c98a4a" });
    case "boutique":
      return drawNeonShop(ctx, cx, groundY, s, t, seed, { w: 62, h: 60, wall: "#b5567a", wallDark: "#7e3a53", neon: "#ff7ac4", win: "#ffd0ec", awn: "#d46b9a" });
    case "shop":
      return drawNeonShop(ctx, cx, groundY, s, t, seed, { w: 68, h: 58, wall: "#c07a42", wallDark: "#85512b", neon: "#ffb060", win: "#ffe6c0", awn: "#e08b52" });
    case "supermarket":
      return drawNeonShop(ctx, cx, groundY, s, t, seed, { w: 108, h: 66, wall: "#3f9068", wallDark: "#286048", neon: "#7cf7b0", win: "#e6fff0", floors: 1 });
    case "arcade":
      return drawNeonShop(ctx, cx, groundY, s, t, seed, { w: 78, h: 96, wall: "#3a2f6a", wallDark: "#221a45", neon: "#a06bff", win: "#c9b8ff", floors: 2 });
    case "hotel":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 86, h: 150, top: "#3a7abf", bottom: "#1a3550", win: "#bfe6ff", crown: "#4fb2ff", sign: "rgba(79,178,255,0.6)" });
    case "mall":
      return drawNeonShop(ctx, cx, groundY, s, t, seed, { w: 128, h: 80, wall: "#3f9088", wallDark: "#276058", neon: "#4fc9ae", win: "#dffff6", floors: 2 });
    case "trading_floor":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 96, h: 156, top: "#2a7a5f", bottom: "#123528", win: "#a8ffd8", crown: "#7cf7c4", sign: "rgba(124,247,196,0.6)" });

    /* ---- downtown ---- */
    case "office":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 92, h: 190, top: "#2f6a5f", bottom: "#123028", win: "#a8ecd8", crown: "#2f8f7a" });
    case "hq_tower":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 96, h: 220, top: "#2f6abf", bottom: "#122a50", win: "#bfe6ff", crown: "#4fb2ff", sign: "rgba(79,178,255,0.5)" });
    case "courthouse":
      return drawCivic(ctx, cx, groundY, s, t, seed, { w: 150, h: 110, body: "#e2ded1", bodyDark: "#b4b0a2", accent: "#cfc7b0", columns: 6, dome: false });
    case "museum":
      return drawCivic(ctx, cx, groundY, s, t, seed, { w: 158, h: 108, body: "#d8c9a0", bodyDark: "#ab9d78", accent: "#c4b487", columns: 6, dome: false });
    case "embassy":
      return drawCivic(ctx, cx, groundY, s, t, seed, { w: 150, h: 116, body: "#e9edf7", bodyDark: "#bcc2d0", accent: "#cfd6e6", columns: 5, dome: true });
    case "dao_hall":
      return drawCivic(ctx, cx, groundY, s, t, seed, { w: 164, h: 124, body: "#2f6fed", bodyDark: "#1a3f99", accent: "#4fd0ff", columns: 6, dome: true });
    case "observatory":
      return drawObservatory(ctx, cx, groundY, s, t, seed);
    case "tower":
      return drawTower(ctx, cx, groundY, s, t, seed, { w: 74, h: 210, top: "#9b7bff", bottom: "#3a2a6a", win: "#d8ccff", beacon: true, taper: 0.08 });
    case "spire":
      return drawTower(ctx, cx, groundY, s, t, seed, { w: 70, h: 270, top: "#a06bff", bottom: "#2a1f55", win: "#e0d0ff", beacon: true, taper: 0.16 });
    case "skyscraper":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 92, h: 280, top: "#5a4dbf", bottom: "#1a1435", win: "#d0c4ff", crown: "#9b7bff", sign: "rgba(155,123,255,0.6)" });
    case "exchange":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 108, h: 240, top: "#bf9a2a", bottom: "#4a3a10", win: "#ffe9a0", crown: "#ffcf5c", sign: "rgba(255,207,92,0.7)" });
    case "bank_vault":
      return drawCivic(ctx, cx, groundY, s, t, seed, { w: 148, h: 130, body: "#d4af37", bodyDark: "#977c1f", accent: "#ffe08a", columns: 6, dome: true });

    /* ---- industrial ---- */
    case "workshop":
      return drawIndustrial(ctx, cx, groundY, s, t, seed, { w: 80, h: 58, body: "#8a8f96", bodyDark: "#5f646b", stacks: 1, win: "#ffd98f" });
    case "warehouse":
      return drawIndustrial(ctx, cx, groundY, s, t, seed, { w: 118, h: 62, body: "#9aa0a6", bodyDark: "#6b7076", stacks: 0, win: "#ffe0a0" });
    case "factory":
      return drawIndustrial(ctx, cx, groundY, s, t, seed, { w: 128, h: 78, body: "#7a8590", bodyDark: "#4f5860", stacks: 3, win: "#ffcf8f" });
    case "shipyard":
      return drawIndustrial(ctx, cx, groundY, s, t, seed, { w: 132, h: 70, body: "#4f7a92", bodyDark: "#2f5060", stacks: 2, win: "#b0e6ff" });
    case "refinery":
      return drawIndustrial(ctx, cx, groundY, s, t, seed, { w: 130, h: 92, body: "#a5824a", bodyDark: "#6f562f", stacks: 3, win: "#ffdf8f" });
    case "power_plant":
      return drawIndustrial(ctx, cx, groundY, s, t, seed, { w: 138, h: 96, body: "#8a94a0", bodyDark: "#565f6b", stacks: 2, win: "#c9f0ff" });
    case "solar_farm":
      return drawSolarFarm(ctx, cx, groundY, s, t);
    case "data_center":
      return drawGlassTower(ctx, cx, groundY, s, t, seed, { w: 118, h: 92, top: "#2f7a74", bottom: "#123230", win: "#7cf7ec", crown: "#4fd0c9", sign: "rgba(79,208,201,0.5)" });

    default:
      return drawBox(ctx, cx, groundY, 60 * s, 60 * s, "#556", "#334");
  }
}

/* ===================== genesis landmarks ===================== */

function drawCityHall(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  drawCivic(ctx, cx, groundY, 1.5, t, 3, {
    w: 150, h: 120, body: "#2f6fed", bodyDark: "#123c9c", accent: "#4fd0ff", columns: 6, dome: true,
  });
  ctx.fillStyle = "#ffcf5c";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BASE CITY HALL", cx, groundY - 130 * 1.5 - 12);
  ctx.textAlign = "left";
}

function drawTree(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number, seed: number) {
  shadow(ctx, cx, groundY, 26);
  ctx.fillStyle = "#5a3f28";
  ctx.fillRect(cx - 3, groundY - 22, 6, 22);
  const sway = Math.sin(t / 900 + seed) * 2;
  ctx.fillStyle = "#2f7a4a";
  ctx.beginPath();
  ctx.arc(cx + sway, groundY - 30, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a9058";
  ctx.beginPath();
  ctx.arc(cx + sway - 6, groundY - 26, 11, 0, Math.PI * 2);
  ctx.arc(cx + sway + 8, groundY - 28, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawPark(ctx: CanvasRenderingContext2D, x: number, width: number, groundY: number, t: number) {
  // lawn
  const g = ctx.createLinearGradient(0, groundY - 14, 0, groundY);
  g.addColorStop(0, "#2b6b3f");
  g.addColorStop(1, "#1c4a2b");
  ctx.fillStyle = g;
  ctx.fillRect(x, groundY - 12, width, 12);
  // path
  ctx.fillStyle = "#7a6f55";
  ctx.fillRect(x + width * 0.44, groundY - 8, width * 0.12, 8);
  const trees = Math.max(3, Math.round(width / 90));
  for (let i = 0; i < trees; i++) {
    const tx = x + 40 + (i * (width - 80)) / (trees - 1 || 1);
    drawTree(ctx, tx, groundY, t, i * 7);
  }
  // fountain center
  const fx = x + width / 2;
  ctx.fillStyle = "#3a6a9a";
  ctx.beginPath();
  ctx.ellipse(fx, groundY - 4, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let d = 0; d < 6; d++) {
    const a = (t / 300 + d) % 8;
    glow(ctx, fx + Math.sin(d) * 6, groundY - 8 - a * 1.4, 4, "rgba(150,220,255,0.5)", 0.4);
  }
}

function drawRiver(ctx: CanvasRenderingContext2D, x: number, width: number, groundY: number, t: number) {
  const g = ctx.createLinearGradient(x, groundY - 10, x, groundY);
  g.addColorStop(0, "#1c4a7a");
  g.addColorStop(1, "#0e2e50");
  ctx.fillStyle = g;
  ctx.fillRect(x, groundY - 10, width, 10);
  ctx.strokeStyle = "rgba(150,210,255,0.35)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const ry = groundY - 8 + i * 1.8;
    ctx.beginPath();
    for (let px = x; px < x + width; px += 8) {
      ctx.lineTo(px, ry + Math.sin(px / 20 + t / 400 + i) * 1.2);
    }
    ctx.stroke();
  }
  // bridge
  const bx = x + width / 2;
  ctx.strokeStyle = "#6b5a4a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx - 40, groundY - 10);
  ctx.quadraticCurveTo(bx, groundY - 26, bx + 40, groundY - 10);
  ctx.stroke();
}

function drawStreetLight(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  ctx.strokeStyle = "#39424f";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, groundY);
  ctx.lineTo(cx, groundY - 40);
  ctx.stroke();
  ctx.fillStyle = "#ffe6a0";
  ctx.beginPath();
  ctx.arc(cx, groundY - 42, 3.2, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, cx, groundY - 42, 26, "rgba(255,214,120,0.6)", 0.5 + 0.1 * Math.sin(t / 700 + cx));
}

/* ===================== atmosphere / background ===================== */

const ZONE_GROUND: Record<string, [string, string]> = {
  wasteland: ["#26221d", "#171410"],
  residential: ["#20304a", "#141d2e"],
  commercial: ["#2a2740", "#181628"],
  downtown: ["#1c2740", "#0f1626"],
  industrial: ["#262a2f", "#15181c"],
};

// accent per district, used by the marker signs and the horizon glow
const ZONE_ACCENT: Record<string, string> = {
  wasteland: "#8a8f99",
  residential: "#6f9ade",
  commercial: "#e6a06a",
  downtown: "#a98dff",
  industrial: "#8b98a6",
};

// A small illuminated district marker standing on the promenade, in place of
// the old wall-of-text zone label: accent dot, name, and a thin light bar.
function drawDistrictSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  label: string,
  accent: string,
  fs: number
) {
  ctx.save();
  ctx.font = `600 ${fs}px sans-serif`;
  const spacing = fs * 0.16;
  const canSpace = "letterSpacing" in ctx;
  if (canSpace) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  const text = label.toUpperCase();
  const tw = ctx.measureText(text).width;
  const padX = fs * 1.1;
  const w = tw + padX * 2 + fs * 1.4;
  const h = fs * 2.1;
  const x = cx - w / 2;

  // plaque
  ctx.fillStyle = "rgba(9, 14, 26, 0.72)";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = accent + "44";
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
  ctx.stroke();

  // accent dot with a soft halo
  const dotX = x + padX * 0.85;
  const dotY = y + h / 2;
  const halo = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, fs * 1.1);
  halo.addColorStop(0, accent + "88");
  halo.addColorStop(1, accent + "00");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(dotX, dotY, fs * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(dotX, dotY, fs * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // name
  ctx.fillStyle = "rgba(226,235,255,0.82)";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, dotX + fs * 0.75, dotY + 0.5);

  // light bar beneath the plaque
  const barW = w * 0.5;
  const bar = ctx.createLinearGradient(cx - barW / 2, 0, cx + barW / 2, 0);
  bar.addColorStop(0, accent + "00");
  bar.addColorStop(0.5, accent + "66");
  bar.addColorStop(1, accent + "00");
  ctx.fillStyle = bar;
  ctx.fillRect(cx - barW / 2, y + h + fs * 0.45, barW, 1.5);

  if (canSpace) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

interface Star { x: number; y: number; r: number; tw: number }
interface Cloud { x: number; y: number; s: number; v: number }

function makeStars(n: number, w: number, h: number): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.6,
      r: Math.random() * 1.3 + 0.2,
      tw: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

function makeClouds(n: number, w: number, h: number): Cloud[] {
  const out: Cloud[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: Math.random() * w,
      y: h * 0.1 + Math.random() * h * 0.3,
      s: 0.6 + Math.random() * 1.4,
      v: 0.004 + Math.random() * 0.01,
    });
  }
  return out;
}

// deep sky gradient + moon + aurora ribbons
type Weather = "clear" | "rain" | "fog";
interface RainDrop { x: number; y: number; len: number; v: number }

// real-clock day/night: 0 = deep night, 1 = midday
function dayFactorNow(): number {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  // peak at 13:00, trough at 01:00
  return Math.max(0, Math.min(1, (Math.cos(((h - 13) / 24) * Math.PI * 2) + 1) / 2));
}

// weather rotates through the real day so it "changes with real time"
function weatherNow(): Weather {
  const d = new Date();
  const bucket = Math.floor((d.getHours() * 60 + d.getMinutes()) / 90); // changes ~every 90 min
  const seq: Weather[] = ["clear", "clear", "fog", "clear", "rain", "clear", "clear", "fog", "rain", "clear"];
  const daySalt = d.getDate() + d.getMonth() * 31;
  return seq[(bucket + daySalt) % seq.length];
}

function mix(a: string, b: string, f: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function makeRain(n: number, w: number, h: number): RainDrop[] {
  const out: RainDrop[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: Math.random() * w, y: Math.random() * h, len: 10 + Math.random() * 14, v: 0.5 + Math.random() * 0.5 });
  }
  return out;
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, day: number) {
  // night → day palette blend
  const top = mix("050914", "1d4e8a", day);
  const mid = mix("0a1330", "3d7fc4", day);
  const low = mix("132148", "8fc0e6", day);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // aurora (fades out in daylight)
  if (day < 0.7) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1 - day / 0.7;
    for (let i = 0; i < 3; i++) {
      const ay = h * 0.16 + i * 26;
      const grad = ctx.createLinearGradient(0, ay - 40, 0, ay + 40);
      const hue = ["rgba(79,208,255,", "rgba(124,247,196,", "rgba(155,123,255,"][i];
      grad.addColorStop(0, hue + "0)");
      grad.addColorStop(0.5, hue + (0.05 + 0.03 * Math.sin(t / 2000 + i)) + ")");
      grad.addColorStop(1, hue + "0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, ay);
      for (let x = 0; x <= w; x += 30) ctx.lineTo(x, ay + Math.sin(x / 220 + t / 1600 + i) * 26);
      ctx.lineTo(w, ay + 80);
      ctx.lineTo(0, ay + 80);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // celestial body arcs across the sky with the clock
  const arcX = w * (0.12 + 0.7 * day);
  const arcY = h * (0.42 - 0.26 * Math.sin(day * Math.PI));
  if (day > 0.35) {
    // sun
    glow(ctx, arcX, arcY, 90, "rgba(255,225,150,0.55)", 0.7 * day);
    ctx.fillStyle = "#fff2c8";
    ctx.beginPath();
    ctx.arc(arcX, arcY, 30, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // moon
    const mx = w * 0.82, my = h * 0.2;
    glow(ctx, mx, my, 70, "rgba(220,235,255,0.5)", 0.7 * (1 - day));
    ctx.fillStyle = "#eef4ff";
    ctx.beginPath();
    ctx.arc(mx, my, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(150,170,210,0.25)";
    ctx.beginPath();
    ctx.arc(mx - 8, my - 6, 6, 0, Math.PI * 2);
    ctx.arc(mx + 7, my + 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// rain streaks / fog veil drawn over everything
function drawWeather(ctx: CanvasRenderingContext2D, w: number, h: number, weather: Weather, rain: RainDrop[], dt: number, day: number) {
  if (weather === "rain") {
    ctx.strokeStyle = `rgba(170,200,240,${0.28 + 0.12 * (1 - day)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const d of rain) {
      d.y += d.v * dt * 1.6;
      d.x += d.v * dt * 0.25;
      if (d.y > h) { d.y = -20; d.x = Math.random() * w; }
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 2, d.y + d.len);
    }
    ctx.stroke();
  } else if (weather === "fog") {
    const fg = ctx.createLinearGradient(0, h * 0.4, 0, h);
    fg.addColorStop(0, "rgba(150,170,200,0)");
    fg.addColorStop(1, `rgba(150,170,200,${0.16 + 0.06 * day})`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, h * 0.4, w, h * 0.6);
  }
}


function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], t: number, day: number) {
  if (day > 0.75) return;
  const dim = 1 - day / 0.75;
  for (const s of stars) {
    const a = (0.4 + 0.6 * Math.abs(Math.sin(t / 900 + s.tw))) * dim;
    ctx.fillStyle = `rgba(220,235,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, clouds: Cloud[], w: number, dt: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const c of clouds) {
    c.x += c.v * dt;
    if (c.x > w + 120) c.x = -120;
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 90 * c.s);
    grad.addColorStop(0, "rgba(120,150,210,0.08)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 90 * c.s, 34 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// distant parallax skyline silhouettes with atmospheric haze.
// Layer bases are anchored to the horizon so the silhouettes still sit just
// behind the city when the horizon moves up on tall/narrow (mini app) frames.
function drawSkyline(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, groundY: number) {
  // On a short frame the backdrop has to shrink too, otherwise the distant
  // silhouettes tower over the actual city standing on the horizon.
  const s = Math.max(0.45, Math.min(1, h / 900));
  const lift = (f: number) => Math.min(h * f, 900 * f);
  const layers = [
    { color: "#0c1428", speed: 0.15, base: groundY - lift(0.24), hMax: 90 * s, step: 46 * s },
    { color: "#111c38", speed: 0.3, base: groundY - lift(0.18), hMax: 130 * s, step: 62 * s },
    { color: "#16244a", speed: 0.5, base: groundY - lift(0.12), hMax: 180 * s, step: 80 * s },
  ];
  for (const L of layers) {
    ctx.fillStyle = L.color;
    const off = -(camX * L.speed * zoom) % L.step;
    for (let x = off - L.step; x < w + L.step; x += L.step) {
      const seed = Math.abs(Math.floor((x - off) / L.step) * 2654435761) % 1000;
      const bh = 40 * s + (seed % L.hMax);
      const bw = L.step * (0.6 + (seed % 30) / 100);
      ctx.fillRect(x, L.base - bh, bw, bh + 40);
      // sparse lit windows in far towers
      if (seed % 3 === 0) {
        ctx.fillStyle = "rgba(120,170,255,0.10)";
        for (let wy = L.base - bh + 8; wy < L.base; wy += 10) {
          ctx.fillRect(x + 4, wy, bw - 8, 3);
        }
        ctx.fillStyle = L.color;
      }
    }
    // haze band above each layer
    const haze = ctx.createLinearGradient(0, L.base - L.hMax, 0, L.base);
    haze.addColorStop(0, "rgba(20,40,80,0)");
    haze.addColorStop(1, "rgba(30,55,100,0.22)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, L.base - L.hMax, w, L.hMax);
  }
}

/* ===================== camera + component ===================== */

// The world always begins with the (usually empty) wasteland on the far left,
// so opening at x=0 stares at a blank lot while every landmark — the park with
// its trees, the river, BASE CITY HALL — and all the claimed buildings sit far
// off to the right, unseen. Frame the camera on the real content instead: the
// centre of mass of the buildings, or, while the city is still empty, the park,
// so the first thing on screen is the green and the trees rather than dirt.
function cityFocusX(layout: CityLayout): number {
  if (layout.positioned.length) {
    let sum = 0;
    for (const p of layout.positioned) sum += p.x;
    return sum / layout.positioned.length;
  }
  const park = layout.genesis.find((g) => g.type === "park");
  if (park) return park.x + park.width / 2;
  const hall = layout.genesis.find((g) => g.type === "city_hall");
  if (hall) return hall.x + hall.width / 2;
  return layout.worldWidth / 2;
}

export interface CameraControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  focusOn: (worldX: number) => void;
  getState: () => { x: number; zoom: number; worldWidth: number; viewW: number };
  snapshot: () => string | null;
}

interface Props {
  buildings: CityBuilding[];
  ghostBuilding?: (CityBuilding & { alreadyMinted?: boolean }) | null;
  onPick?: (b: CityBuilding | null) => void;
  cameraRef?: MutableRefObject<CameraControls | null>;
  zoneFilter?: Zone | null;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.4;

export default function CityCanvas({ buildings, ghostBuilding, onPick, cameraRef, zoneFilter }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cam = useRef({ x: 0, zoom: 0.9, targetX: 0, targetZoom: 0.9, worldWidth: 0 });
  const stars = useRef<Star[]>([]);
  const clouds = useRef<Cloud[]>([]);
  const rain = useRef<RainDrop[]>([]);
  const spawnAt = useRef<Map<string, number>>(new Map());
  const drag = useRef({ active: false, moved: false, lastX: 0 });
  const buildingsRef = useRef(buildings);
  const ghostRef = useRef(ghostBuilding);
  const onPickRef = useRef(onPick);
  const filterRef = useRef(zoneFilter);
  buildingsRef.current = buildings;
  ghostRef.current = ghostBuilding;
  onPickRef.current = onPick;
  filterRef.current = zoneFilter;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const start = performance.now();

    // Auto-framing state: the city opens focused on its content and stays framed
    // as buildings arrive over the poll, until the user pans/zooms and takes over.
    let userMoved = false;
    let didFirstCenter = false;

    // The canvas backing store is fitted to the viewport here. A mini-app host
    // (Farcaster / Base) opens as a sheet that animates up, so at mount the
    // webview can report a zero / not-yet-settled size — and WKWebView does not
    // reliably fire a window `resize` when the sheet finishes. So: bail on a
    // zero size, remember the size we actually applied, and let the render loop
    // (plus a ResizeObserver) re-fit the moment real dimensions arrive.
    let viewW = 0;
    let viewH = 0;
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w < 2 || h < 2) return; // not laid out yet — try again next frame
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars.current = makeStars(160, w, h);
      clouds.current = makeClouds(6, w, h);
      rain.current = makeRain(220, w, h);
      viewW = w;
      viewH = h;
    }
    resize();
    window.addEventListener("resize", resize);
    // Catch the mini-app sheet settling to its final height even when no window
    // resize event is dispatched.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => resize());
      ro.observe(document.documentElement);
    }

    // ---- camera controls exposed to parent ----
    if (cameraRef) {
      cameraRef.current = {
        zoomIn: () => (cam.current.targetZoom = Math.min(MAX_ZOOM, cam.current.targetZoom * 1.25)),
        zoomOut: () => (cam.current.targetZoom = Math.max(MIN_ZOOM, cam.current.targetZoom / 1.25)),
        reset: () => {
          cam.current.targetZoom = defaultZoom();
          userMoved = false; // resume auto-framing on the city's content
        },
        focusOn: (wx: number) => {
          userMoved = true;
          cam.current.targetX = wx - window.innerWidth / 2 / cam.current.targetZoom;
        },
        getState: () => ({
          x: cam.current.x,
          zoom: cam.current.zoom,
          worldWidth: cam.current.worldWidth,
          viewW: window.innerWidth,
        }),
        snapshot: () => {
          try {
            return canvas.toDataURL("image/png");
          } catch {
            return null;
          }
        },
      };
    }

    // Where the horizon sits, as a fraction of viewport height. A wide desktop
    // window can afford a lot of sky; a tall, narrow mini-app frame cannot —
    // there the horizon moves up so the ground and the buildings standing on it
    // get most of the frame instead of the sky.
    const groundRatio = () => {
      const W = window.innerWidth, H = window.innerHeight;
      if (H > W * 1.45) return 0.62; // tall portrait — Farcaster mini frame
      if (H > W * 1.1) return 0.68;  // portrait phone
      if (H > W) return 0.74;
      return 0.82;                   // landscape / desktop — unchanged
    };
    const groundScreen = () => window.innerHeight * groundRatio();

    // Buildings are drawn at a fixed world scale, so a narrow frame needs a
    // closer camera for them to read at all.
    const defaultZoom = () => {
      const W = window.innerWidth, H = window.innerHeight;
      // A narrow frame needs to pull *back*, not in: buildings are up to ~200
      // world units wide, so anything near 1× shows barely two of them and the
      // city stops reading as a city.
      if (H > W * 1.45) return 0.7;
      if (H > W) return 0.78;
      return 0.9;
    };
    cam.current.zoom = cam.current.targetZoom = defaultZoom();
    const worldXToScreen = (wx: number) => (wx - cam.current.x) * cam.current.zoom;
    const screenToWorldX = (sx: number) => sx / cam.current.zoom + cam.current.x;

    // ---- pointer + wheel handlers ----
    function onDown(e: PointerEvent) {
      drag.current = { active: true, moved: false, lastX: e.clientX };
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      if (Math.abs(dx) > 2) { drag.current.moved = true; userMoved = true; }
      cam.current.x -= dx / cam.current.zoom;
      cam.current.targetX = cam.current.x;
      drag.current.lastX = e.clientX;
    }
    function onUp(e: PointerEvent) {
      canvas.style.cursor = "grab";
      const wasDrag = drag.current.moved;
      drag.current.active = false;
      if (wasDrag) return;
      // click → pick nearest building
      const worldX = screenToWorldX(e.clientX);
      const layout = computeCityLayout(buildingsRef.current);
      let best: CityBuilding | null = null;
      let bestD = 70;
      for (const p of layout.positioned) {
        const d = Math.abs(p.x - worldX);
        if (d < bestD) { bestD = d; best = p.building; }
      }
      onPickRef.current?.(best);
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      userMoved = true;
      const before = screenToWorldX(e.clientX);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      cam.current.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.current.zoom * factor));
      cam.current.targetZoom = cam.current.zoom;
      // keep cursor anchored on the same world point
      cam.current.x = before - e.clientX / cam.current.zoom;
      cam.current.targetX = cam.current.x;
    }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ---- render loop ----
    function renderFrame(now: number) {
      const dt = Math.min(48, now - last);
      last = now;
      const t = now - start;
      const W = window.innerWidth, H = window.innerHeight;

      // Self-heal: if the viewport changed — or was 0 at mount and only now has
      // a real size (mini-app sheet finished animating up) — re-fit the canvas
      // before drawing, so it can't get stuck blank.
      if ((W !== viewW || H !== viewH) && W > 1 && H > 1) resize();

      // ease camera toward targets
      cam.current.zoom += (cam.current.targetZoom - cam.current.zoom) * 0.12;
      cam.current.x += (cam.current.targetX - cam.current.x) * 0.12;

      ctx.clearRect(0, 0, W, H);

      const day = dayFactorNow();
      const weather = weatherNow();

      const gY = groundScreen();

      // background (screen space)
      drawSky(ctx, W, H, t, day);
      drawStars(ctx, stars.current, t, day);
      drawClouds(ctx, clouds.current, W, dt);
      drawSkyline(ctx, W, H, cam.current.x, cam.current.zoom, gY);

      const layout = computeCityLayout(buildingsRef.current);
      cam.current.worldWidth = layout.worldWidth;
      const zoom = cam.current.zoom;

      // Frame the camera on the actual content (buildings, or the park while the
      // city is empty) rather than the blank left edge. Runs every frame until
      // the user pans/zooms, so the view re-centres gently as buildings arrive;
      // the very first framed frame snaps so there's no long slide from x=0.
      if (!userMoved && W > 1) {
        const desiredX = cityFocusX(layout) - W / 2 / cam.current.zoom;
        cam.current.targetX = desiredX;
        if (!didFirstCenter) {
          cam.current.x = desiredX;
          didFirstCenter = true;
        }
      }

      // base ground across the whole frame — the zone strips only cover the
      // claimed part of the world, and with a high horizon the gaps would
      // otherwise show sky below the horizon line
      {
        const g = ctx.createLinearGradient(0, gY, 0, H);
        g.addColorStop(0, "#141c2e");
        g.addColorStop(1, "#080c16");
        ctx.fillStyle = g;
        ctx.fillRect(0, gY, W, H - gY);
      }

      // ground strips per zone
      for (const zr of layout.zoneRanges) {
        const sx = worldXToScreen(zr.start);
        const ex = worldXToScreen(zr.end);
        if (ex < -50 || sx > W + 50) continue;
        const [c0, c1] = ZONE_GROUND[zr.zone];
        const g = ctx.createLinearGradient(0, gY, 0, H);
        g.addColorStop(0, c0);
        g.addColorStop(1, c1);
        ctx.fillStyle = g;
        ctx.fillRect(sx, gY, ex - sx, H - gY);

        // Districts now read by colour instead of a wall of text: a soft accent
        // wash hugging the horizon, plus a thin divider at the boundary.
        const accent = ZONE_ACCENT[zr.zone] || "#7f9ad0";
        const glowH = Math.max(18, (H - gY) * 0.16);
        const glow = ctx.createLinearGradient(0, gY, 0, gY + glowH);
        glow.addColorStop(0, accent + "2e");
        glow.addColorStop(1, accent + "00");
        ctx.fillStyle = glow;
        ctx.fillRect(sx, gY, ex - sx, glowH);
        if (sx > 0 && sx < W) {
          const div = ctx.createLinearGradient(0, gY, 0, gY + (H - gY) * 0.3);
          div.addColorStop(0, accent + "55");
          div.addColorStop(1, accent + "00");
          ctx.fillStyle = div;
          ctx.fillRect(sx, gY, 1, (H - gY) * 0.3);
        }
      }
      // ground edge highlight
      ctx.strokeStyle = "rgba(120,160,230,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, gY);
      ctx.lineTo(W, gY);
      ctx.stroke();

      // Promenade in front of the buildings. The horizon sits high on tall
      // frames, so the ground would otherwise be a large flat wash — a kerb, a
      // dashed centre line that scrolls with the camera, and a bottom vignette
      // give it depth.
      {
        const groundH = H - gY;
        const kerbY = gY + groundH * 0.2;
        ctx.fillStyle = "rgba(10, 16, 32, 0.28)";
        ctx.fillRect(0, kerbY, W, groundH);
        ctx.strokeStyle = "rgba(150,185,255,0.12)";
        ctx.beginPath();
        ctx.moveTo(0, kerbY);
        ctx.lineTo(W, kerbY);
        ctx.stroke();

        const laneY = gY + groundH * 0.44;
        const dash = 58 * zoom;
        const off = -((cam.current.x * zoom) % (dash * 2));
        ctx.strokeStyle = "rgba(190,215,255,0.13)";
        ctx.lineWidth = Math.max(2, 3 * zoom);
        ctx.beginPath();
        for (let x = off - dash * 2; x < W + dash * 2; x += dash * 2) {
          ctx.moveTo(x, laneY);
          ctx.lineTo(x + dash, laneY);
        }
        ctx.stroke();
        ctx.lineWidth = 1;

        const vig = ctx.createLinearGradient(0, H - groundH * 0.45, 0, H);
        vig.addColorStop(0, "rgba(4,6,14,0)");
        vig.addColorStop(1, "rgba(4,6,14,0.6)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, H - groundH * 0.45, W, groundH * 0.45);
      }

      // District markers — one small illuminated plaque per visible district,
      // sitting on the promenade. Only the district nearest the centre of the
      // frame is shown at full strength, so the foreground never gets crowded.
      {
        const groundH = H - gY;
        const fs = Math.round(Math.max(9, Math.min(13, W / 34)));
        const signY = gY + groundH * 0.24;
        let nearest: { d: number; zr: (typeof layout.zoneRanges)[number]; cx: number } | null = null;
        for (const zr of layout.zoneRanges) {
          const sx = worldXToScreen(zr.start);
          const ex = worldXToScreen(zr.end);
          if (ex < 0 || sx > W) continue;
          // centre of the district's *visible* part, so a wide district still
          // labels itself while you pan through it
          const cx = (Math.max(sx, 0) + Math.min(ex, W)) / 2;
          if (!Number.isFinite(cx)) continue;
          const d = Math.abs(cx - W / 2);
          if (!nearest || d < nearest.d) nearest = { d, zr, cx };
        }
        if (nearest) {
          drawDistrictSign(
            ctx,
            nearest.cx,
            signY,
            nearest.zr.label,
            ZONE_ACCENT[nearest.zr.zone] || "#7f9ad0",
            fs
          );
        }
      }

      // genesis landmarks
      for (const f of layout.genesis) {
        const sx = worldXToScreen(f.x);
        const sw = f.width * zoom;
        if (sx + sw < -80 || sx > W + 80) continue;
        ctx.save();
        ctx.translate(sx, gY);
        ctx.scale(zoom, zoom);
        if (f.type === "city_hall") drawCityHall(ctx, 0, 0, t);
        else if (f.type === "park") drawPark(ctx, 0, f.width, 0, t);
        else if (f.type === "river") drawRiver(ctx, 0, f.width, 0, t);
        ctx.restore();
      }

      // street lights along the promenade
      for (let lx = 0; lx < layout.worldWidth; lx += 260) {
        const sx = worldXToScreen(lx);
        if (sx < -40 || sx > W + 40) continue;
        ctx.save();
        ctx.translate(sx, gY);
        ctx.scale(zoom, zoom);
        drawStreetLight(ctx, 0, 0, t);
        ctx.restore();
      }

      // buildings (depth: draw in world order, spawn pop-in)
      const activeFilter = filterRef.current;
      for (const p of layout.positioned) {
        const sx = worldXToScreen(p.x);
        if (sx < -160 || sx > W + 160) continue;
        const addr = p.building.address;
        if (!spawnAt.current.has(addr)) spawnAt.current.set(addr, now);
        const age = now - (spawnAt.current.get(addr) || now);
        const pop = age < 520 ? easeOutBack(age / 520) : 1;
        ctx.save();
        if (activeFilter && p.building.zone !== activeFilter) ctx.globalAlpha = 0.16;
        ctx.translate(sx, gY);
        ctx.scale(zoom * pop, zoom * pop);
        drawItem(ctx, p.building, 0, 0, t);
        ctx.restore();
      }

      // ghost preview building (pulsing, semi-transparent) at city entrance
      const ghost = ghostRef.current;
      if (ghost && !ghost.alreadyMinted) {
        const gx = worldXToScreen(layout.worldWidth + 160);
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t / 400);
        ctx.translate(gx, gY);
        ctx.scale(zoom, zoom);
        drawItem(ctx, ghost, 0, 0, t);
        ctx.restore();
      }

      // foreground weather (rain streaks / fog)
      drawWeather(ctx, W, H, weather, rain.current, dt, day);
    }

    // One bad frame must not take the whole city down: the loop always
    // reschedules, and the first failure is reported once.
    let frameErrorLogged = false;
    function frame(now: number) {
      try {
        renderFrame(now);
      } catch (err) {
        if (!frameErrorLogged) {
          frameErrorLogged = true;
          console.error("[CityCanvas] render frame failed", err);
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="city-canvas"
      // touchAction:none is essential inside the Farcaster / Base mini app: the
      // host WebView otherwise claims horizontal swipes as its own scroll and
      // cancels the pointer drag, so the city can't be panned left/right on
      // touch (it works with a mouse, which is why it's fine in Chrome).
      style={{ position: "fixed", inset: 0, display: "block", cursor: "grab", touchAction: "none" }}
    />
  );
}

