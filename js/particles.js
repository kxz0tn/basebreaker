/**
 * BASEBREAKER — Particles
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Pooled rects, sparks, and glitch shards. All monochrome. Emitters
 * are fire-and-forget; the pool reclaims expired motes each frame.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function particleFactory() {
    return {
      alive: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      max: 1,
      w: 2,
      h: 2,
      g: 0,
      kind: 0,
      rot: 0,
      vr: 0
    };
  }

  function Particles(quality) {
    var cap = BB.CONFIG.fx.maxParticles;
    if (quality === "low") cap = 180;
    else if (quality === "med") cap = 300;
    this.pool = new BB.Pool(particleFactory, cap);
    this.cap = cap;
    this.quality = quality;
  }

  Particles.prototype._emit = function (x, y, vx, vy, life, w, h, g, kind) {
    if (this.pool.alive.length >= this.cap) return null;
    var p = this.pool.spawn();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.w = w;
    p.h = h;
    p.g = g;
    p.kind = kind || 0;
    p.rot = 0;
    p.vr = 0;
    return p;
  };

  Particles.prototype.thruster = function (x, y, n) {
    var i;
    n = this.quality === "low" ? Math.min(n, 4) : n;
    for (i = 0; i < n; i++) {
      this._emit(
        x - 4 + Math.random() * 8,
        y + Math.random() * 4,
        -80 - Math.random() * 140,
        40 + Math.random() * 90,
        0.18 + Math.random() * 0.16,
        2 + (Math.random() * 3) | 0,
        2,
        200,
        0
      );
    }
  };

  Particles.prototype.dust = function (x, y, dir) {
    if (this.quality === "low" && Math.random() > 0.4) return;
    this._emit(
      x,
      y,
      -40 * dir + (Math.random() - 0.5) * 30,
      -20 - Math.random() * 30,
      0.22 + Math.random() * 0.15,
      2,
      2,
      280,
      0
    );
  };

  Particles.prototype.sparks = function (x, y, n) {
    var i;
    var a;
    n = this.quality === "low" ? Math.min(n, 8) : n;
    for (i = 0; i < n; i++) {
      a = Math.random() * BB.math.TAU;
      this._emit(
        x,
        y,
        Math.cos(a) * (120 + Math.random() * 260),
        Math.sin(a) * (120 + Math.random() * 260),
        0.18 + Math.random() * 0.2,
        1 + (Math.random() * 4) | 0,
        1,
        400,
        1
      );
    }
  };

  Particles.prototype.deathGlitch = function (x, y) {
    var i;
    var p;
    var n = this.quality === "low" ? 18 : 36;
    for (i = 0; i < n; i++) {
      p = this._emit(
        x + (Math.random() - 0.5) * 28,
        y - Math.random() * 50,
        (Math.random() - 0.5) * 320,
        (Math.random() - 0.6) * 280,
        0.45 + Math.random() * 0.55,
        3 + (Math.random() * 10) | 0,
        2 + (Math.random() * 8) | 0,
        180,
        2
      );
      if (p) {
        p.rot = Math.random() * 2;
        p.vr = (Math.random() - 0.5) * 12;
      }
    }
  };

  Particles.prototype.shatter = function (x, y, w, h) {
    var i;
    var n = this.quality === "low" ? 8 : 16;
    for (i = 0; i < n; i++) {
      this._emit(
        x + Math.random() * w,
        y + Math.random() * h,
        (Math.random() - 0.3) * 280,
        -40 - Math.random() * 220,
        0.28 + Math.random() * 0.25,
        2 + (Math.random() * 6) | 0,
        2 + (Math.random() * 5) | 0,
        500,
        2
      );
    }
  };

  Particles.prototype.speedLines = function (playerX, camX, flow, speed) {
    if (flow < 0.35 && speed < 400) return;
    if (this.quality === "low" && Math.random() > 0.5) return;
    var n = flow > 0.7 ? 3 : 1;
    var i;
    for (i = 0; i < n; i++) {
      this._emit(
        playerX + 20 + Math.random() * 80,
        100 + Math.random() * 400,
        -speed * (0.8 + flow),
        0,
        0.12 + flow * 0.1,
        18 + flow * 24,
        1,
        0,
        1
      );
    }
  };

  Particles.prototype.muzzle = function (x, y) {
    var i;
    var n = this.quality === "low" ? 4 : 8;
    for (i = 0; i < n; i++) {
      this._emit(
        x + Math.random() * 6,
        y - 2 + Math.random() * 4,
        80 + Math.random() * 180,
        (Math.random() - 0.5) * 160,
        0.06 + Math.random() * 0.08,
        2 + (Math.random() * 4) | 0,
        1,
        0,
        1
      );
    }
  };

  Particles.prototype.impact = function (x, y) {
    this.sparks(x, y, this.quality === "low" ? 6 : 12);
  };

  Particles.prototype.devilBurst = function (x, y) {
    var i;
    var p;
    var n = this.quality === "low" ? 22 : 40;
    for (i = 0; i < n; i++) {
      p = this._emit(
        x + (Math.random() - 0.5) * 48,
        y - Math.random() * 70,
        (Math.random() - 0.35) * 420,
        -60 - Math.random() * 320,
        0.4 + Math.random() * 0.45,
        3 + (Math.random() * 12) | 0,
        2 + (Math.random() * 8) | 0,
        520,
        2
      );
      if (p) {
        p.rot = Math.random() * 2;
        p.vr = (Math.random() - 0.5) * 14;
      }
    }
  };

  Particles.prototype.vent = function (x, y) {
    if (Math.random() > 0.5) return;
    this._emit(
      x + Math.random() * 16,
      y,
      (Math.random() - 0.5) * 20,
      30 + Math.random() * 40,
      0.4 + Math.random() * 0.3,
      1,
      3 + Math.random() * 6,
      0,
      0
    );
  };

  Particles.prototype.update = function (dt) {
    var list = this.pool.alive;
    var i;
    var p;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.pool.reclaim();
  };

  Particles.prototype.draw = function (ctx, camX) {
    var list = this.pool.alive;
    var i;
    var p;
    var a;
    var sx;
    ctx.save();
    for (i = 0; i < list.length; i++) {
      p = list[i];
      a = p.life / p.max;
      sx = p.x - camX;
      if (sx < -20 || sx > BB.VIEW_W + 20) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.kind === 2 && a < 0.4 ? "#888" : "#fff";
      if (p.rot) {
        ctx.save();
        ctx.translate(sx, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
        ctx.restore();
      } else {
        ctx.fillRect(sx, p.y, p.w, p.h);
      }
    }
    ctx.restore();
  };

  BB.Particles = Particles;
})(typeof window !== "undefined" ? window : globalThis);
