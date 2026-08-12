"use client";

import { useEffect, useRef } from "react";
import type { CityBuilding, ItemType } from "@/lib/classify";
import { computeCityLayout, PositionedItem } from "@/lib/cityLayout";

function seededRand(address: string) {
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) & 0xffffff;
  let state = Math.abs(h) || 1;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state % 1000) / 1000;
  };
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

function windows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  color: string,
  t: number,
  seed: number
) {
  const cw = (w - 8) / cols;
  const ch = (h - 8) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = (Math.floor(t / 1100) + r * 5 + c * 3 + seed) % 6 !== 0;
      ctx.fillStyle = lit ? color : "rgba(255,255,255,0.05)";
      ctx.fillRect(x + 4 + c * cw + 1, y + 4 + r * ch + 1, cw - 2, ch - 2);
    }
  }
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, groundY: number, w: number) {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 2, w * 0.55, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  w: number,
  h: number,
  colorTop: string,
  colorBottom: string
) {
  const x = cx - w / 2;
  const y = groundY - h;
  const grad = ctx.createLinearGradient(x, y, x, groundY);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  return { x, y };
}

function drawHouseLike(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  scale: number,
  t: number,
  seed: number,
  opts: { w: number; h: number; roof: string; wall: string; wallDark: string; win: string; door: string }
) {
  const w = opts.w * scale;
  const h = opts.h * scale;
  shadow(ctx, cx, groundY, w);
  const { x, y } = drawBox(ctx, cx, groundY, w, h, opts.wall, opts.wallDark);
  ctx.fillStyle = opts.roof;
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + w / 2, y - h * 0.42);
  ctx.lineTo(x + w + 4, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = opts.door;
  const dw = w * 0.22;
  roundRect(ctx, cx - dw / 2, groundY - h * 0.42, dw, h * 0.42, 2);
  ctx.fill();
  windows(ctx, x, y + h * 0.12, w, h * 0.4, 2, 1, opts.win, t, seed);
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  scale: number,
  t: number,
  seed: number,
  opts: { w: number; h: number; top: string; bottom: string; win: string; beacon: boolean }
) {
  const w = opts.w * scale;
  const h = opts.h * scale;
  shadow(ctx, cx, groundY, w);
  const { x, y } = drawBox(ctx, cx, groundY, w, h, opts.top, opts.bottom);
  windows(ctx, x, y, w, h, Math.max(2, Math.round(w / 16)), Math.max(4, Math.round(h / 20)), opts.win, t, seed);
  if (opts.beacon) {
    ctx.strokeStyle = opts.bottom;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y - h * 0.18);
    ctx.stroke();
    if (Math.sin(t / 350) > 0.3) {
      ctx.fillStyle = "#ff5c5c";
      ctx.beginPath();
      ctx.arc(cx, y - h * 0.18, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCivic(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  scale: number,
  t: number,
  seed: number,
  opts: { w: number; h: number; body: string; bodyDark: string; accent: string; columns: number }
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
  const colW = w / (opts.columns * 2.2);
  for (let i = 0; i < opts.columns; i++) {
    const colX = x + w * 0.08 + i * ((w * 0.84) / (opts.columns - 1 || 1));
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(colX - colW / 2, y + h * 0.1, colW, h * 0.85);
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x - 8, groundY - 4, w + 16, 4);
}

function drawIndustrial(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  scale: number,
  t: number,
  seed: number,
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
    ctx.fillStyle = "rgba(190,190,190,0.28)";
    for (let p = 0; p < 3; p++) {
      const puff = (t / 45 + p * 26 + i * 13) % 60;
      ctx.beginPath();
      ctx.arc(sx + w * 0.045, y - sh - puff, 4 + p * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTrashCan(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 20 * scale;
  const h = 26 * scale;
  shadow(ctx, cx, groundY, w * 1.4);
  ctx.fillStyle = "#4a5568";
  roundRect(ctx, cx - w / 2, groundY - h, w, h, 3);
  ctx.fill();
  ctx.fillStyle = "#5f6b7a";
  ctx.fillRect(cx - w / 2 - 2, groundY - h - 4, w + 4, 5);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + (w / 3) * i, groundY - h + 4);
    ctx.lineTo(cx - w / 2 + (w / 3) * i, groundY - 3);
    ctx.stroke();
  }
}

function drawOldBench(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 34 * scale;
  shadow(ctx, cx, groundY, w);
  ctx.strokeStyle = "#6b5a4a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, groundY - 10);
  ctx.lineTo(cx + w / 2, groundY - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, groundY - 16);
  ctx.lineTo(cx - w / 2, groundY - 10);
  ctx.moveTo(cx + w / 2, groundY - 16);
  ctx.lineTo(cx + w / 2, groundY - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, groundY - 10);
  ctx.lineTo(cx - w / 2, groundY);
  ctx.moveTo(cx + w / 2, groundY - 10);
  ctx.lineTo(cx + w / 2, groundY);
  ctx.stroke();
}

function drawTrashPile(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  shadow(ctx, cx, groundY, 40 * scale);
  const colors = ["#5a5346", "#4a4438", "#6b6152"];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const bw = (10 + (i % 3) * 6) * scale;
    const bh = (8 + (i % 2) * 5) * scale;
    const bx = cx - 20 * scale + i * 9 * scale;
    roundRect(ctx, bx, groundY - bh, bw, bh, 2);
    ctx.fill();
  }
}

function drawAbandonedLot(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 60 * scale;
  shadow(ctx, cx, groundY, w);
  ctx.fillStyle = "#3a3a35";
  ctx.fillRect(cx - w / 2, groundY - 8 * scale, w, 8 * scale);
  ctx.strokeStyle = "#2a2a26";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + (w / 4) * i, groundY - 8 * scale);
    ctx.lineTo(cx - w / 2 + (w / 4) * i, groundY);
    ctx.stroke();
  }
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

function drawRuin(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number) {
  const w = 50 * scale;
  const h = 32 * scale;
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
  ctx.strokeStyle = "rgba(255,90,90,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.1, groundY - h * 0.2);
  ctx.lineTo(cx + w * 0.05, groundY - h * 0.55);
  ctx.stroke();
}

const PALETTES: Record<string, { top: string; bottom: string; win: string }> = {
  violet: { top: "#6a4fc4", bottom: "#3f2f80", win: "#e3d9ff" },
  gold: { top: "#d4af37", bottom: "#8a6f1f", win: "#fff3c4" },
  teal: { top: "#2f8f7a", bottom: "#1e5c4d", win: "#bff5e6" },
  steel: { top: "#7a8590", bottom: "#4a525a", win: "#ff9a6c" },
};

function drawItem(ctx: CanvasRenderingContext2D, b: CityBuilding, cx: number, groundY: number, t: number, ghost: boolean) {
  const rnd = seededRand(b.address);
  const seed = Math.floor(rnd() * 1000);
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.55;

  switch (b.itemType as ItemType) {
    case "cottage":
      drawHouseLike(ctx, cx, groundY, b.scale * 0.8, t, seed, {
        w: 46, h: 34, roof: "#8a5a3a", wall: "#c9a877", wallDark: "#a3865c", win: "#ffd27a", door: "#5a3a22",
      });
      break;
    case "small_house":
      drawHouseLike(ctx, cx, groundY, b.scale * 0.9, t, seed, {
        w: 50, h: 36, roof: "#7a4a3a", wall: "#b98d6b", wallDark: "#93704f", win: "#ffd27a", door: "#4a2f1c",
      });
      break;
    case "house":
      drawHouseLike(ctx, cx, groundY, b.scale, t, seed, {
        w: 58, h: 42, roof: "#6b4a8a", wall: "#5b82c4", wallDark: "#3a5a8c", win: "#ffd27a", door: "#2a3a5c",
      });
      break;
    case "townhouse":
      drawHouseLike(ctx, cx, groundY, b.scale * 1.05, t, seed, {
        w: 52, h: 58, roof: "#8a3a3a", wall: "#c46b3a", wallDark: "#93502a", win: "#ffe9a8", door: "#4a2a16",
      });
      break;
    case "mansion":
      drawCivic(ctx, cx, groundY, b.scale * 1.05, t, seed, {
        w: 100, h: 56, body: "#e8dfc8", bodyDark: "#c9bd9c", accent: "#8a6f1f", columns: 4,
      });
      break;
    case "villa":
      drawCivic(ctx, cx, groundY, b.scale, t, seed, {
        w: 90, h: 50, body: "#f0e6d2", bodyDark: "#d6c7a3", accent: "#4a7a6b", columns: 3,
      });
      break;
    case "kiosk":
      drawHouseLike(ctx, cx, groundY, b.scale * 0.6, t, seed, {
        w: 34, h: 26, roof: "#c9432a", wall: "#e8c04a", wallDark: "#c49f34", win: "#fff3c4", door: "#7a4a1a",
      });
      break;
    case "market_stall": {
      const w = 44 * b.scale;
      shadow(ctx, cx, groundY, w);
      ctx.fillStyle = "#c9432a";
      ctx.fillRect(cx - w / 2 - 4, groundY - 34 * b.scale, w + 8, 8 * b.scale);
      ctx.fillStyle = "#8a5a3a";
      ctx.fillRect(cx - w / 2, groundY - 26 * b.scale, w, 26 * b.scale);
      ctx.fillStyle = "#e8c04a";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(cx - w / 2 + (i * w) / 4, groundY - 34 * b.scale, w / 8, 8 * b.scale);
      }
      break;
    }
    case "shop":
      drawBox(ctx, cx, groundY, 62 * b.scale, 46 * b.scale, "#e08b52", "#c46b3a");
      windows(ctx, cx - 26 * b.scale, groundY - 40 * b.scale, 52 * b.scale, 16 * b.scale, 3, 1, "#ffe9a8", t, seed);
      ctx.fillStyle = "#c9432a";
      ctx.fillRect(cx - 31 * b.scale, groundY - 22 * b.scale, 62 * b.scale, 7 * b.scale);
      break;
    case "mall":
      drawTower(ctx, cx, groundY, b.scale * 1.1, t, seed, {
        w: 96, h: 64, top: "#4fc9ae", bottom: "#2f8f7a", win: "#bff5e6", beacon: false,
      });
      ctx.fillStyle = "#ffe9a8";
      ctx.fillRect(cx - 46 * b.scale, groundY - 18 * b.scale, 92 * b.scale, 10 * b.scale);
      break;
    case "trading_floor":
      drawTower(ctx, cx, groundY, b.scale * 1.15, t, seed, {
        w: 88, h: 70, top: "#7cf7c4", bottom: "#1e5c4d", win: "#00ffb0", beacon: false,
      });
      break;
    case "tower":
      drawTower(ctx, cx, groundY, b.scale * 1.3, t, seed, {
        w: 62, h: 130, top: PALETTES.violet.top, bottom: PALETTES.violet.bottom, win: PALETTES.violet.win, beacon: true,
      });
      break;
    case "skyscraper":
      drawTower(ctx, cx, groundY, b.scale * 1.5, t, seed, {
        w: 78, h: 190, top: "#9b7bff", bottom: "#3f2f80", win: "#d9f0ff", beacon: true,
      });
      break;
    case "bank_vault":
      drawCivic(ctx, cx, groundY, b.scale * 1.2, t, seed, {
        w: 110, h: 74, body: PALETTES.gold.top, bodyDark: PALETTES.gold.bottom, accent: "#3a2f10", columns: 5,
      });
      break;
    case "office":
      drawTower(ctx, cx, groundY, b.scale * 1.2, t, seed, {
        w: 70, h: 110, top: PALETTES.teal.top, bottom: PALETTES.teal.bottom, win: PALETTES.teal.win, beacon: false,
      });
      break;
    case "dao_hall":
      drawCivic(ctx, cx, groundY, b.scale * 1.3, t, seed, {
        w: 130, h: 84, body: "#e9edf7", bodyDark: "#b9c3da", accent: "#2f6fed", columns: 6,
      });
      break;
    case "courthouse":
      drawCivic(ctx, cx, groundY, b.scale * 1.15, t, seed, {
        w: 104, h: 68, body: "#e2ded1", bodyDark: "#bdb5a0", accent: "#7a4a3a", columns: 4,
      });
      break;
    case "workshop":
      drawIndustrial(ctx, cx, groundY, b.scale * 0.85, t, seed, {
        w: 56, h: 40, body: "#8a8f96", bodyDark: "#5c6167", stacks: 1, win: "#ff9a6c",
      });
      break;
    case "warehouse":
      drawBox(ctx, cx, groundY, 78 * b.scale, 48 * b.scale, "#9aa0a6", "#6b7076");
      ctx.fillStyle = "#4a4f54";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(cx - 33 * b.scale + i * 24 * b.scale, groundY - 30 * b.scale, 16 * b.scale, 30 * b.scale);
      }
      break;
    case "factory":
      drawIndustrial(ctx, cx, groundY, b.scale, t, seed, {
        w: 84, h: 56, body: PALETTES.steel.top, bodyDark: PALETTES.steel.bottom, stacks: 2, win: PALETTES.steel.win,
      });
      break;
    case "power_plant":
      drawIndustrial(ctx, cx, groundY, b.scale * 1.15, t, seed, {
        w: 96, h: 70, body: "#8a94a0", bodyDark: "#565f68", stacks: 3, win: "#ffcf5c",
      });
      break;
    case "trash_can":
      drawTrashCan(ctx, cx, groundY, b.scale);
      break;
    case "old_bench":
      drawOldBench(ctx, cx, groundY, b.scale);
      break;
    case "trash_pile":
      drawTrashPile(ctx, cx, groundY, b.scale);
      break;
    case "abandoned_lot":
      drawAbandonedLot(ctx, cx, groundY, b.scale);
      break;
    case "ruin":
    default:
      drawRuin(ctx, cx, groundY, b.scale);
      break;
  }
  ctx.restore();
}

function drawCityHall(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  const scale = 2.2;
  drawCivic(ctx, cx, groundY, scale, t, 1, {
    w: 130, h: 96, body: "#e9edf7", bodyDark: "#b9c3da", accent: "#2f6fed", columns: 7,
  });
  const topY = groundY - 96 * scale * 0.42 - 96 * scale;
  ctx.fillStyle = "#2f6fed";
  ctx.beginPath();
  ctx.arc(cx, topY, 30, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#888";
  ctx.beginPath();
  ctx.moveTo(cx, topY - 30);
  ctx.lineTo(cx, topY - 55);
  ctx.stroke();
  const wave = Math.sin(t / 260) * 4;
  ctx.fillStyle = "#4fb2ff";
  ctx.beginPath();
  ctx.moveTo(cx, topY - 55);
  ctx.lineTo(cx + 16, topY - 51 + wave);
  ctx.lineTo(cx, topY - 45);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, cx: number, groundY: number, scale: number, t: number) {
  ctx.fillStyle = "#5a3a22";
  ctx.fillRect(cx - 3 * scale, groundY - 20 * scale, 6 * scale, 20 * scale);
  const sway = Math.sin(t / 900 + cx) * 2;
  ctx.fillStyle = "#3a7a4a";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + sway * (i - 1) * 0.3, groundY - (28 + i * 10) * scale, (16 - i * 2) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFountain(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  ctx.fillStyle = "#8a94a0";
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 4, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4fb2ff";
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 5, 26, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9c9c9";
  ctx.fillRect(cx - 3, groundY - 34, 6, 30);
  const jet = 6 + Math.sin(t / 200) * 3;
  ctx.strokeStyle = "rgba(180,220,255,0.8)";
  ctx.lineWidth = 2;
  for (let a = -1; a <= 1; a++) {
    ctx.beginPath();
    ctx.moveTo(cx, groundY - 34);
    ctx.quadraticCurveTo(cx + a * 14, groundY - 34 - jet * 2, cx + a * 20, groundY - 10);
    ctx.stroke();
  }
}

function drawStreetLight(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  ctx.strokeStyle = "#2a3040";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, groundY);
  ctx.lineTo(cx, groundY - 46);
  ctx.stroke();
  ctx.fillStyle = "#ffe6a8";
  ctx.beginPath();
  ctx.arc(cx, groundY - 48, 4, 0, Math.PI * 2);
  ctx.fill();
  const glow = ctx.createRadialGradient(cx, groundY - 48, 0, cx, groundY - 48, 24);
  glow.addColorStop(0, "rgba(255,230,168,0.28)");
  glow.addColorStop(1, "rgba(255,230,168,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, groundY - 48, 24, 0, Math.PI * 2);
  ctx.fill();
}

function drawBridge(ctx: CanvasRenderingContext2D, startX: number, width: number, groundY: number) {
  ctx.strokeStyle = "#3a4258";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(startX, groundY - 20);
  ctx.lineTo(startX + width, groundY - 20);
  ctx.stroke();
  for (let i = 0; i <= 4; i++) {
    const x = startX + (width / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, groundY - 20);
    ctx.lineTo(x, groundY - 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#5b6b8c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, groundY - 46);
  ctx.quadraticCurveTo(startX + width / 2, groundY - 62, startX + width, groundY - 46);
  ctx.stroke();
}

function drawRiver(ctx: CanvasRenderingContext2D, startX: number, width: number, groundY: number, viewH: number, t: number) {
  const grad = ctx.createLinearGradient(startX, groundY - 10, startX, groundY + viewH);
  grad.addColorStop(0, "#1c4a6e");
  grad.addColorStop(1, "#0c2a44");
  ctx.fillStyle = grad;
  ctx.fillRect(startX, groundY - 10, width, viewH);
  ctx.strokeStyle = "rgba(180,220,255,0.15)";
  for (let i = 0; i < 5; i++) {
    const y = groundY + 10 + i * 18;
    const offset = Math.sin(t / 700 + i) * 8;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.quadraticCurveTo(startX + width / 2 + offset, y + 6, startX + width, y);
    ctx.stroke();
  }
}

const ZONE_GROUND: Record<string, string> = {
  wasteland: "#3a3428",
  residential: "#233824",
  commercial: "#2b2e35",
  downtown: "#20242e",
  industrial: "#292a26",
};

export interface Camera {
  x: number;
  scale: number;
}

export interface CameraControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

export default function CityCanvas({
  buildings,
  ghostBuilding,
  onPick,
  cameraRef,
}: {
  buildings: CityBuilding[];
  ghostBuilding?: CityBuilding | null;
  onPick?: (b: CityBuilding) => void;
  cameraRef?: React.MutableRefObject<CameraControls | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;
  const ghostRef = useRef(ghostBuilding);
  ghostRef.current = ghostBuilding;

  const camera = useRef<Camera>({ x: 0, scale: 1 });
  const dragging = useRef<{ startX: number; camX: number; active: boolean } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let initialized = false;
    const clampScale = (s: number) => Math.min(2.4, Math.max(0.35, s));

    function resize() {
      canvas!.width = window.innerWidth * devicePixelRatio;
      canvas!.height = window.innerHeight * devicePixelRatio;
      canvas!.style.width = window.innerWidth + "px";
      canvas!.style.height = window.innerHeight + "px";
      ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function worldToScreenX(wx: number, viewW: number) {
      return viewW / 2 + (wx - camera.current.x) * camera.current.scale;
    }

    function frame(t: number) {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      const groundY = h * 0.72;

      const layout = computeCityLayout(buildingsRef.current);
      if (!initialized && layout.worldWidth > 0) {
        camera.current.x = layout.worldWidth / 2;
        initialized = true;
      }

      const sky = ctx!.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0a1128");
      sky.addColorStop(0.55, "#152244");
      sky.addColorStop(1, "#1c2b4a");
      ctx!.fillStyle = sky;
      ctx!.fillRect(0, 0, w, h);

      let starSeed = 7;
      for (let i = 0; i < 90; i++) {
        starSeed = (starSeed * 9301 + 49297) % 233280;
        const sx = (starSeed / 233280) * w;
        starSeed = (starSeed * 9301 + 49297) % 233280;
        const sy = (starSeed / 233280) * (groundY - 60);
        const tw = 0.3 + 0.6 * Math.abs(Math.sin(t / 900 + i));
        ctx!.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.4})`;
        ctx!.fillRect(sx, sy, 1.3, 1.3);
      }

      ctx!.fillStyle = "rgba(20,28,50,0.55)";
      const parallax = -camera.current.x * 0.08;
      for (let i = -2; i < 20; i++) {
        const bw = 60;
        const bx = w / 2 + parallax + i * bw * 1.3;
        const bh = 60 + ((i * 37) % 90);
        ctx!.fillRect(bx, groundY - bh, bw, bh);
      }

      for (const zr of layout.zoneRanges) {
        const sx = worldToScreenX(zr.start, w);
        const ex = worldToScreenX(zr.end, w);
        if (ex < 0 || sx > w) continue;
        ctx!.fillStyle = ZONE_GROUND[zr.zone];
        ctx!.fillRect(sx, groundY, ex - sx, h - groundY);
        ctx!.fillStyle = "rgba(180,200,255,0.35)";
        ctx!.font = "11px sans-serif";
        ctx!.textAlign = "center";
        ctx!.fillText(zr.label.toUpperCase(), Math.max(40, Math.min(w - 40, (sx + ex) / 2)), groundY + 20);

        const lightSpacing = 220 * camera.current.scale;
        for (let lx = sx + 40; lx < ex - 20; lx += lightSpacing) {
          drawStreetLight(ctx!, lx, groundY, t);
        }
      }

      ctx!.strokeStyle = "rgba(255,255,255,0.12)";
      ctx!.setLineDash([14, 10]);
      ctx!.beginPath();
      ctx!.moveTo(0, groundY + 1);
      ctx!.lineTo(w, groundY + 1);
      ctx!.stroke();
      ctx!.setLineDash([]);

      for (const g of layout.genesis) {
        const sx = worldToScreenX(g.x, w);
        if (sx + g.width * camera.current.scale < -50 || sx > w + 50) continue;
        if (g.type === "park") {
          for (let i = 0; i < 5; i++) {
            drawTree(ctx!, sx + (i + 0.5) * ((g.width * camera.current.scale) / 5), groundY, camera.current.scale, t);
          }
          drawFountain(ctx!, sx + (g.width * camera.current.scale) / 2, groundY, t);
        } else if (g.type === "river") {
          drawRiver(ctx!, sx, g.width * camera.current.scale, groundY, h - groundY, t);
          drawBridge(ctx!, sx, g.width * camera.current.scale, groundY);
        } else if (g.type === "city_hall") {
          drawCityHall(ctx!, sx + 40 * camera.current.scale, groundY, t);
        }
      }

      if (layout.positioned.length === 0 && !ghostRef.current) {
        ctx!.fillStyle = "rgba(180,190,220,0.6)";
        ctx!.font = "15px sans-serif";
        ctx!.textAlign = "center";
        ctx!.fillText("Base City is empty — enter a wallet address to build the first item", w / 2, h / 2);
      }

      const sorted = [...layout.positioned].sort((a, b) => a.x - b.x);
      for (const p of sorted) {
        const sx = worldToScreenX(p.x, w);
        if (sx < -100 || sx > w + 100) continue;
        ctx!.save();
        ctx!.translate(sx, 0);
        ctx!.scale(camera.current.scale, camera.current.scale);
        drawItem(ctx!, p.building, 0, groundY / camera.current.scale, t, false);
        ctx!.restore();
      }

      if (ghostRef.current) {
        const sx = w / 2;
        const gScale = camera.current.scale * 1.15;
        ctx!.save();
        ctx!.translate(sx, 0);
        ctx!.scale(gScale, gScale);
        const bob = Math.sin(t / 400) * 4;
        ctx!.translate(0, bob / gScale);
        drawItem(ctx!, ghostRef.current, 0, groundY / gScale, t, true);
        ctx!.restore();
        ctx!.fillStyle = "rgba(79,178,255,0.9)";
        ctx!.font = "bold 12px sans-serif";
        ctx!.textAlign = "center";
        ctx!.fillText("PREVIEW", sx, groundY + 40);
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onPointerDown(e: PointerEvent) {
      dragging.current = { startX: e.clientX, camX: camera.current.x, active: false };
      canvas!.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.startX;
      if (Math.abs(dx) > 3) dragging.current.active = true;
      camera.current.x = dragging.current.camX - dx / camera.current.scale;
    }
    function onPointerUp(e: PointerEvent) {
      if (dragging.current && !dragging.current.active && onPick) {
        const layout = computeCityLayout(buildingsRef.current);
        const w = canvas!.clientWidth;
        const clickWorldX = camera.current.x + (e.clientX - w / 2) / camera.current.scale;
        let closest: PositionedItem | null = null;
        let bestDist = 45 / camera.current.scale;
        for (const p of layout.positioned) {
          const d = Math.abs(p.x - clickWorldX);
          if (d < bestDist) {
            bestDist = d;
            closest = p;
          }
        }
        if (closest) onPick(closest.building);
      }
      dragging.current = null;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const w = canvas!.clientWidth;
      const worldXAtCursor = camera.current.x + (e.clientX - w / 2) / camera.current.scale;
      const newScale = clampScale(camera.current.scale * (1 - e.deltaY * 0.0012));
      camera.current.scale = newScale;
      camera.current.x = worldXAtCursor - (e.clientX - w / 2) / newScale;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    if (cameraRef) {
      cameraRef.current = {
        zoomIn: () => (camera.current.scale = clampScale(camera.current.scale * 1.25)),
        zoomOut: () => (camera.current.scale = clampScale(camera.current.scale * 0.8)),
        reset: () => {
          const layout = computeCityLayout(buildingsRef.current);
          camera.current.x = layout.worldWidth / 2;
          camera.current.scale = 1;
        },
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [onPick, cameraRef]);

  return <canvas ref={canvasRef} style={{ display: "block", touchAction: "none" }} />;
}
