/**
 * BASEBREAKER — Hazards
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Readability at speed is the constraint. Every killer is a solid
 * geometric mass with a collision box that matches the filled pixels:
 *
 *   barrier — short floor block, jump
 *   pipe    — hanging pillar (capital / shaft / foot), roll
 *   laser   — column housings + a thin timed beam
 *   field   — two posts + a timed force pane
 *   break   — lock crate (jump or shoot) / node (shoot) / seal (MUST shoot)
 *
 * Lasers and fields that are OFF have no body. Pits and vents never
 * collide here. Seals are full-height plates: no jump, no roll. The
 * rail is the only legal path.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function Hazards() {}

  Hazards.prototype.laserOn = function (h, t) {
    var cycle = (t + h.phase) % h.period;
    return cycle < h.period * h.duty;
  };

  Hazards.prototype.fieldOn = function (h, t) {
    return this.laserOn(h, t);
  };

  /** True during the last 0.22s of the OFF window — readable telegraph. */
  Hazards.prototype.telegraph = function (h, t) {
    var cycle = (t + h.phase) % h.period;
    var off = h.period * (1 - h.duty);
    var intoOff = cycle - h.period * h.duty;
    return intoOff >= 0 && intoOff > off - 0.22;
  };

  /**
   * Collision body. For timed hazards this is empty when off so a roll
   * through a dark gate is a real success, not a coin-flip.
   */
  Hazards.prototype.body = function (h, t) {
    if (h.type === "pit" || h.type === "vent") return null;
    if (h.type === "boost") return null;
    if (h.type === "slap" && h.broken) return null;
    if (h.type === "break" && h.hp <= 0) return null;
    if (h.type === "break" && h.node) return null;
    if (h.type === "laser" && !this.laserOn(h, t)) return null;
    if (h.type === "field" && !this.fieldOn(h, t)) return null;
    return { x: h.x, y: h.y, w: h.w, h: h.h };
  };

  /**
   * Swept test against the player's previous and current hitbox.
   * Returns 'hit' | 'near' | null.
   */
  Hazards.prototype.testSweep = function (h, hb, dx, dy, t, pad) {
    var b = this.body(h, t);
    if (!b) return null;
    if (BB.math.aabbSweep(hb.x - dx, hb.y - dy, hb.w, hb.h, dx, dy, b.x, b.y, b.w, b.h)) {
      return "hit";
    }
    if (BB.math.aabbPad(hb.x, hb.y, hb.w, hb.h, b.x, b.y, b.w, b.h, pad)) return "near";
    return null;
  };

  Hazards.prototype.draw = function (ctx, h, camX, t, particles) {
    var sx = h.x - camX;
    if (sx + h.w < -30 || sx > BB.VIEW_W + 30) return;
    ctx.save();
    if (h.type === "barrier") this._drawBarrier(ctx, sx, h);
    else if (h.type === "pipe") this._drawPillar(ctx, sx, h);
    else if (h.type === "laser") this._drawLaser(ctx, sx, h, t);
    else if (h.type === "field") this._drawField(ctx, sx, h, t);
    else if (h.type === "vent") this._drawVent(ctx, sx, h, particles);
    else if (h.type === "break" && h.hp > 0) this._drawBreak(ctx, sx, h, t);
    else if (h.type === "slap" && !h.broken) this._drawSlap(ctx, sx, h, t);
    else if (h.type === "boost") this._drawBoost(ctx, sx, h, t);
    ctx.restore();
  };

  /**
   * Low lintel: foot sits in the roll-test band. Down-chevrons read
   * "slide" at speed. Collision box is the shaft, same as the fill.
   */
  Hazards.prototype._drawPillar = function (ctx, sx, h) {
    var foot = 14;
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx - 8, h.y, h.w + 16, 10);
    ctx.fillRect(sx, h.y, h.w, h.h);
    ctx.fillRect(sx - 10, h.y + h.h - foot, h.w + 20, foot);
    ctx.fillStyle = "#000";
    ctx.fillRect(sx + 6, h.y + 14, 3, h.h - foot - 20);
    ctx.fillRect(sx + h.w - 9, h.y + 14, 3, h.h - foot - 20);
    ctx.fillStyle = "#000";
    var i;
    var fy = h.y + h.h - 2;
    for (i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + 8 + i * 14, fy - 18);
      ctx.lineTo(sx + 16 + i * 14, fy - 18);
      ctx.lineTo(sx + 12 + i * 14, fy - 8);
      ctx.closePath();
      ctx.fill();
    }
  };

  /** Hard-to-see floating pane. Dashed, low alpha, readable on approach. */
  Hazards.prototype._drawSlap = function (ctx, sx, h, t) {
    var pulse = 0.16 + Math.sin(t * 7 + h.x * 0.01) * 0.08;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#fff";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, h.y, h.w, h.h);
    ctx.setLineDash([]);
    ctx.globalAlpha = pulse * 0.55;
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx + 2, h.y + 2, h.w - 4, h.h - 4);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(sx + h.w * 0.5 - 1, h.y - 6, 2, 6);
    ctx.fillRect(sx + h.w * 0.5 - 1, h.y + h.h, 2, 6);
  };

  Hazards.prototype._drawBoost = function (ctx, sx, h, t) {
    var bob = Math.sin(t * 6 + h.x * 0.02) * 4;
    var cx = sx + h.w * 0.5;
    var cy = h.y + h.h * 0.5 + bob;
    ctx.translate(cx, cy);
    ctx.rotate(t * 2);
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.9;
    if (h.kind === "surge") {
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(8, 2);
      ctx.lineTo(2, 2);
      ctx.lineTo(2, 10);
      ctx.lineTo(-6, -2);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
    } else if (h.kind === "aegis") {
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(-3, -3, 6, 6);
    } else if (h.kind === "cell") {
      ctx.strokeRect(-8, -10, 16, 20);
      ctx.fillRect(-5, -6, 10, 3);
      ctx.fillRect(-2, -2, 4, 10);
      ctx.fillRect(-5, 2, 10, 2);
    } else {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
        else ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
      }
      ctx.closePath();
      ctx.stroke();
    }
  };

  Hazards.prototype._drawBreak = function (ctx, sx, h, t) {
    if (h.seal) {
      this._drawSeal(ctx, sx, h, t);
      return;
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx, h.y, h.w, h.h);
    ctx.fillStyle = "#000";
    ctx.fillRect(sx + 3, h.y + 3, h.w - 6, h.h - 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx + 6, h.y + 6, h.w - 12, 3);
    ctx.fillRect(sx + h.w * 0.5 - 2, h.y + 12, 4, h.h - 18);
    if (h.node) {
      ctx.fillRect(sx + 4, h.y + 4, h.w - 8, h.h - 8);
      ctx.fillStyle = "#000";
      ctx.fillRect(sx + 7, h.y + 7, 6, 6);
    }
    /* small target pip — this crate is shootable */
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx + h.w * 0.5 - 3, h.y + h.h * 0.45, 6, 6);
    ctx.fillStyle = "#000";
    ctx.fillRect(sx + h.w * 0.5 - 1, h.y + h.h * 0.45 - 2, 2, 10);
    ctx.fillRect(sx + h.w * 0.5 - 5, h.y + h.h * 0.45 + 2, 10, 2);
  };

  /**
   * Necessary breach plate. Full corridor height, diamond target,
   * HP pips, pulse. Cannot be jumped or rolled. The rail is the key.
   */
  Hazards.prototype._drawSeal = function (ctx, sx, h, t) {
    var pulse = 0.55 + Math.sin(t * 10 + h.x * 0.02) * 0.35;
    var midX = sx + h.w * 0.5;
    var midY = h.y + h.h * 0.5;
    var i;
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx, h.y, h.w, h.h);
    ctx.fillStyle = "#000";
    ctx.fillRect(sx + 3, h.y + 8, h.w - 6, h.h - 16);

    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(midX, midY - 22);
    ctx.lineTo(midX + 16, midY);
    ctx.lineTo(midX, midY + 22);
    ctx.lineTo(midX - 16, midY);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX - 10, midY);
    ctx.lineTo(midX + 10, midY);
    ctx.moveTo(midX, midY - 10);
    ctx.lineTo(midX, midY + 10);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#fff";
    for (i = 0; i < (h.hpMax || h.hp || 2); i++) {
      ctx.globalAlpha = i < h.hp ? 1 : 0.25;
      ctx.fillRect(sx + h.w + 6, midY - 12 + i * 10, 6, 6);
    }
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.fillRect(sx - 4, h.y, 2, h.h);
    ctx.fillRect(sx + h.w + 2, h.y, 2, h.h);
    ctx.globalAlpha = 1;
  };

  Hazards.prototype._drawBarrier = function (ctx, sx, h) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx, h.y, h.w, h.h);
    ctx.fillStyle = "#000";
    ctx.fillRect(sx + 4, h.y + 5, h.w - 8, 3);
    ctx.fillRect(sx + 4, h.y + h.h - 9, h.w - 8, 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx - 3, h.y + h.h - 5, h.w + 6, 5);
  };

  Hazards.prototype._drawLaser = function (ctx, sx, h, t) {
    var on = this.laserOn(h, t);
    var tel = this.telegraph(h, t);
    var mid = sx + h.w * 0.5;
    ctx.fillStyle = "#fff";
    ctx.fillRect(mid - 14, h.y - 10, 28, 10);
    ctx.fillRect(mid - 14, h.y + h.h, 28, 10);
    ctx.fillRect(mid - 5, h.y - 4, 10, 6);
    ctx.fillRect(mid - 5, h.y + h.h - 2, 10, 6);
    ctx.fillStyle = "#000";
    ctx.fillRect(mid - 8, h.y - 7, 16, 4);
    ctx.fillRect(mid - 8, h.y + h.h + 3, 16, 4);
    if (on) {
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.85 + Math.sin(t * 70) * 0.15;
      ctx.fillRect(sx, h.y, h.w, h.h);
      ctx.globalAlpha = 0.22;
      ctx.fillRect(sx - 4, h.y, h.w + 8, h.h);
    } else if (tel) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 50) * 0.25;
      ctx.fillStyle = "#fff";
      ctx.fillRect(mid - 1, h.y, 2, h.h);
    } else {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#fff";
      ctx.fillRect(mid - 1, h.y, 2, h.h);
    }
  };

  Hazards.prototype._drawField = function (ctx, sx, h, t) {
    var on = this.fieldOn(h, t);
    var tel = this.telegraph(h, t);
    var post = 7;
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx, h.y, post, h.h);
    ctx.fillRect(sx + h.w - post, h.y, post, h.h);
    ctx.fillRect(sx - 3, h.y, h.w + 6, 6);
    ctx.fillRect(sx - 3, h.y + h.h - 6, h.w + 6, 6);
    ctx.fillStyle = "#000";
    ctx.fillRect(sx + 2, h.y + 10, 3, h.h - 20);
    ctx.fillRect(sx + h.w - 5, h.y + 10, 3, h.h - 20);
    if (on) {
      ctx.globalAlpha = 0.5 + Math.sin(t * 36) * 0.18;
      ctx.fillStyle = "#fff";
      var i;
      for (i = 10; i < h.h - 10; i += 7) {
        ctx.fillRect(sx + post, h.y + i, h.w - post * 2, 3);
      }
    } else if (tel) {
      ctx.globalAlpha = 0.28 + Math.sin(t * 44) * 0.2;
      ctx.strokeStyle = "#fff";
      ctx.setLineDash([5, 6]);
      ctx.strokeRect(sx + post + 2, h.y + 10, h.w - post * 2 - 4, h.h - 20);
      ctx.setLineDash([]);
    }
  };

  Hazards.prototype._drawVent = function (ctx, sx, h, particles) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx, h.y, h.w, h.h);
    ctx.fillStyle = "#000";
    var i;
    for (i = 0; i < 4; i++) {
      ctx.fillRect(sx + 3, h.y + 3 + i * 5, h.w - 6, 2);
    }
    if (particles && Math.random() < 0.4) {
      particles.vent(h.x, h.y + h.h);
    }
  };

  BB.Hazards = Hazards;
})(typeof window !== "undefined" ? window : globalThis);
