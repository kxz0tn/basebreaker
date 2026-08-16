/**
 * BASEBREAKER — Projectiles
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Hostile bolts and rail spikes. One pool; reclaim is cheap.
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

  function Projectiles() {
    C = BB.CONFIG.combat;
    this.bolts = new BB.Pool(boltFactory, C.maxAlienShots);
  }

  Projectiles.prototype.reset = function () {
    this.bolts.killAll();
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

  Projectiles.prototype.update = function (dt, camX) {
    this._step(this.bolts, dt, camX);
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
      if (p.life <= 0 || p.x < camX - 80 || p.x > camX + BB.VIEW_W + 200) {
        p.alive = false;
      }
    }
    pool.reclaim();
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
    ctx.restore();
  };

  BB.Projectiles = Projectiles;
})(typeof window !== "undefined" ? window : globalThis);
