/**
 * BASEBREAKER — Projectiles
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Two pools share the same kinematic integrator:
 *   bolts  — hostile (fromAlien)
 *   slugs  — player rail darts
 *
 * Integration is semi-implicit Euler with a = 0:
 *   x += vx * dt;  y += vy * dt
 * Collision is a conservative swept AABB against the travel of this
 * step, so a 15 px dart at ~1400 px/s cannot tunnel a 18 px seal
 * (step displacement at 60 Hz is ~23 px; substeps of 4 px cover it).
 *
 * Player darts are composed in world space as
 *   vx = player.vx + muzzle
 * so relative lead is independent of corridor speed.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});
  var C = null;

  function boltFactory() {
    return {
      alive: false,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      w: 16,
      h: 3,
      life: 1,
      fromAlien: true,
      kind: 0
    };
  }

  function slugFactory() {
    return {
      alive: false,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      w: 15,
      h: 4,
      life: 1,
      fromAlien: false,
      kind: 3
    };
  }

  function Projectiles() {
    C = BB.CONFIG.combat;
    this.bolts = new BB.Pool(boltFactory, C.maxAlienShots);
    this.slugs = new BB.Pool(slugFactory, C.maxPlayerShots);
  }

  Projectiles.prototype.reset = function () {
    this.bolts.killAll();
    this.slugs.killAll();
  };

  Projectiles.prototype.fireAlien = function (x, y, vx, vy) {
    var p = this.bolts.spawn();
    p.x = x;
    p.y = y;
    p.px = x;
    p.py = y;
    p.vx = vx;
    p.vy = vy || 0;
    p.w = 12;
    p.h = 4;
    p.life = 2.4;
    p.fromAlien = true;
    p.kind = 1;
    return p;
  };

  Projectiles.prototype.dropSpike = function (x, y) {
    var p = this.bolts.spawn();
    p.x = x;
    p.y = y;
    p.px = x;
    p.py = y;
    p.vx = 0;
    p.vy = 360;
    p.w = 6;
    p.h = 14;
    p.life = 2.2;
    p.fromAlien = true;
    p.kind = 2;
    return p;
  };

  /**
   * Rail dart. vx/vy are already world-frame (caller adds player.vx).
   * Kind 3 is the chevron slug; it carries no gravity by design.
   */
  Projectiles.prototype.firePlayer = function (x, y, vx, vy) {
    var G = BB.CONFIG.gun;
    var p = this.slugs.spawn();
    p.x = x;
    p.y = y;
    p.px = x;
    p.py = y;
    p.vx = vx;
    p.vy = vy || 0;
    p.w = G.boltW;
    p.h = G.boltH;
    p.life = G.life;
    p.fromAlien = false;
    p.kind = 3;
    return p;
  };

  Projectiles.prototype.update = function (dt, camX) {
    this._step(this.bolts, dt, camX);
    this._step(this.slugs, dt, camX);
  };

  Projectiles.prototype._step = function (pool, dt, camX) {
    var list = pool.alive;
    var i;
    var p;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!p.alive) continue;
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < camX - 80 || p.x > camX + BB.VIEW_W + 220) {
        p.alive = false;
      }
    }
    pool.reclaim();
  };

  /**
   * Swept test of a player slug against a world AABB.
   * Uses the slug's travel this step (x - px, y - py).
   */
  Projectiles.prototype.slugHits = function (p, bx, by, bw, bh) {
    return BB.math.aabbSweep(p.px, p.py, p.w, p.h, p.x - p.px, p.y - p.py, bx, by, bw, bh);
  };

  Projectiles.prototype.draw = function (ctx, camX) {
    var i;
    var p;
    var sx;
    ctx.save();
    ctx.fillStyle = "#fff";
    for (i = 0; i < this.bolts.alive.length; i++) {
      p = this.bolts.alive[i];
      sx = p.x - camX;
      if (p.kind === 2) {
        ctx.beginPath();
        ctx.moveTo(sx, p.y);
        ctx.lineTo(sx + p.w, p.y);
        ctx.lineTo(sx + p.w * 0.5, p.y + p.h);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.4;
        ctx.fillRect(sx - 4, p.y, p.w + 8, p.h);
        ctx.globalAlpha = 1;
        ctx.fillRect(sx, p.y, p.w, p.h);
      }
    }
    for (i = 0; i < this.slugs.alive.length; i++) {
      this._drawSlug(ctx, this.slugs.alive[i], camX);
    }
    ctx.restore();
  };

  /**
   * Small chevron dart + a thin speed streak. Reads as a rail spike,
   * not a blob. Trail length scales with |vx| so faster shots look
   * sharper, not longer-lived.
   */
  Projectiles.prototype._drawSlug = function (ctx, p, camX) {
    var sx = p.x - camX;
    var sy = p.y;
    var streak = 10 + Math.min(18, Math.abs(p.vx) * 0.012);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx - streak, sy + 1, streak, 2);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(sx + p.w + 3, sy + p.h * 0.5);
    ctx.lineTo(sx, sy - 2);
    ctx.lineTo(sx + 4, sy + p.h * 0.5);
    ctx.lineTo(sx, sy + p.h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(sx + 1, sy, p.w - 4, p.h);
    ctx.restore();
  };

  BB.Projectiles = Projectiles;
})(typeof window !== "undefined" ? window : globalThis);
