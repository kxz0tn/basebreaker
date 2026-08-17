/**
 * BASEBREAKER — World / camera / Helix Arc
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Setting: HELIX ARC, a corporate orbital megastructure under lockdown.
 * Parallax is architecture — habitat drums, trusses, transit tubes —
 * never biology. Sector index changes rib density and lamp cadence.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function World() {
    this.chunks = new BB.Chunks();
    this.camX = 0;
    this.shake = 0;
    this.kickX = 0;
    this.kickY = 0;
    this.time = 0;
    this.seed = 1;
    this.sector = 0;
    this.distance = 0;
  }

  World.prototype.reset = function (seed) {
    this.seed = seed || ((Math.random() * 0xffffffff) | 0);
    this.chunks.reset(this.seed);
    this.camX = -BB.CONFIG.world.playerScreenX;
    this.shake = 0;
    this.kickX = 0;
    this.kickY = 0;
    this.time = 0;
    this.sector = 0;
    this.distance = 0;
    this.chunks.ensure(0);
  };

  /** Instant camera impulse. Decays exponentially in update. */
  World.prototype.nudge = function (x, y) {
    this.kickX += x || 0;
    this.kickY += y || 0;
  };

  World.prototype.update = function (dt, playerX, difficulty, distance) {
    this.time += dt;
    this.distance = distance || 0;
    this.sector = BB.math.clamp((this.distance / BB.CONFIG.world.sectorMeters) | 0, 0, 3);
    this.chunks.setDifficulty(difficulty);
    this.chunks.sector = this.sector;
    this.camX = playerX - BB.CONFIG.world.playerScreenX;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 6);
    /* kick decays as 1 - exp(-λ dt), λ = 18 → ~90% gone in 0.13 s */
    this.kickX = BB.math.damp(this.kickX, 0, 18, dt);
    this.kickY = BB.math.damp(this.kickY, 0, 18, dt);
    this.chunks.ensure(this.camX);
  };

  World.prototype.sectorInfo = function () {
    return BB.SECTORS[this.sector] || BB.SECTORS[0];
  };

  World.prototype.groundAt = function (x, y) {
    return this.chunks.groundAt(x, y);
  };

  World.prototype.ceilingAt = function (x) {
    return this.chunks.ceilingAt(x);
  };

  World.prototype.hazardAhead = function (x, d) {
    return this.chunks.hazardAhead(x, d);
  };

  World.prototype.scanAhead = function (x, d) {
    return this.chunks.scanAhead(x, d);
  };

  World.prototype.hazardNear = function (x, behind, ahead) {
    return this.chunks.hazardNear(x, behind, ahead);
  };

  World.prototype.groundUnder = function (x0, x1, y) {
    return this.chunks.groundUnder(x0, x1, y);
  };

  World.prototype.drawBackdrop = function (ctx, quality) {
    var cam = this.camX;
    var t = this.time;
    var W = BB.VIEW_W;
    var H = BB.VIEW_H;
    var i;
    var x;
    var y;
    var w;
    var h;
    var n;
    var sec = this.sector;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    /* star field — orbital void */
    ctx.fillStyle = "#fff";
    n = quality === "low" ? 18 : 36;
    for (i = 0; i < n; i++) {
      x = ((BB.math.hash(i, 1, this.seed) * (W + 80) - cam * 0.02) % (W + 80));
      y = 12 + BB.math.hash(i, 2, this.seed) * 200;
      ctx.globalAlpha = 0.15 + BB.math.hash(i, 3, this.seed) * 0.45;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    /* far habitat drums / arcology blocks */
    ctx.fillStyle = "#0b0b0b";
    n = quality === "low" ? 6 : 9;
    for (i = 0; i < n; i++) {
      x = ((i * 210 - cam * 0.07) % (W + 240)) - 90;
      if (x < 0) x += W + 240;
      w = 70 + BB.math.hash(i, 4, this.seed) * 40;
      h = 110 + BB.math.hash(i, 5, this.seed) * 140;
      ctx.fillRect(x, H - 190 - h, w, h);
      ctx.fillRect(x + 10, H - 190 - h - 18, w * 0.45, 18);
      ctx.fillStyle = "#111";
      var wy;
      for (wy = 16; wy < h - 10; wy += 18) {
        ctx.fillRect(x + 8, H - 190 - h + wy, w - 16, 2);
      }
      ctx.fillStyle = "#0b0b0b";
    }

    /* orbital ring chord */
    ctx.strokeStyle = "#161616";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 78);
    ctx.quadraticCurveTo(W * 0.5, 54 + sec * 3, W, 82);
    ctx.stroke();
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 86);
    ctx.lineTo(W, 70 + sec * 4);
    ctx.stroke();
    ctx.lineWidth = 1;
    n = quality === "low" ? 5 : 8;
    for (i = 0; i < n; i++) {
      x = ((i * 200 - cam * 0.16) % (W + 200)) - 40;
      if (x < 0) x += W + 200;
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x + 24, 88);
      ctx.lineTo(x + 48, 40);
      ctx.stroke();
    }

    /* mid transit tubes */
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 210, W, 10);
    ctx.fillRect(0, 320 + sec * 8, W, 6);
    n = quality === "low" ? 5 : 8;
    for (i = 0; i < n; i++) {
      x = ((i * 240 - cam * 0.22) % (W + 260)) - 80;
      if (x < 0) x += W + 260;
      ctx.fillRect(x, H - 168 - 90, 40, 90);
      ctx.fillRect(x + 6, H - 168 - 104, 16, 14);
    }

    /* conduit cables */
    ctx.strokeStyle = "#181818";
    n = quality === "low" ? 4 : 7;
    for (i = 0; i < n; i++) {
      x = ((i * 300 - cam * 0.34) % (W + 300)) - 60;
      if (x < 0) x += W + 300;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 30, 70, x - 16, 150, x + 20, 230);
      ctx.stroke();
    }

    ctx.fillStyle = "#0e0e0e";
    ctx.fillRect(0, H - 148, W, 148);

    /* status pips */
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#fff";
    for (i = 0; i < 5; i++) {
      x = ((i * 260 - cam * 0.1 + t * 10) % (W + 40)) - 16;
      ctx.fillRect(x, 100 + (i % 2) * 28, 3, 8);
    }
    ctx.globalAlpha = 1;
  };

  World.prototype.drawCorridor = function (ctx, particles) {
    var cam = this.camX;
    var list = this.chunks.pool.alive;
    var i;
    var j;
    var c;
    var f;
    var sx;
    var G = BB.CONFIG.world.ground;
    var C = BB.CONFIG.world.ceiling;
    var k;
    var dec;
    var info = this.sectorInfo();

    for (i = 0; i < list.length; i++) {
      c = list[i];
      sx = c.x - cam;
      if (sx + c.w < -40 || sx > BB.VIEW_W + 40) continue;

      ctx.fillStyle = this.sector >= 2 ? "#080808" : "#0a0a0a";
      ctx.fillRect(sx, C, c.w, G - C);

      /* structural ribs — denser in later sectors */
      ctx.fillStyle = "#161616";
      for (j = 0; j < c.decor.length; j++) {
        dec = c.decor[j];
        ctx.fillRect(dec.x - cam, dec.y, dec.w, dec.h);
        ctx.fillStyle = "#222";
        ctx.fillRect(dec.x - cam + 2, dec.y, 1, dec.h);
        ctx.fillStyle = "#161616";
      }

      /* wall panel grid */
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 1;
      for (k = 0; k < c.w; k += 120) {
        ctx.strokeRect(sx + k + 16, C + 24, 88, G - C - 48);
      }

      /* ceiling tray */
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx, 0, c.w, C);
      ctx.fillStyle = "#000";
      ctx.fillRect(sx, C - 6, c.w, 2);
      ctx.fillStyle = "#cfcfcf";
      for (k = 0; k < c.w; k += 22) {
        ctx.fillRect(sx + k, C - 20, 14, 10);
      }

      /* sector stencil */
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#fff";
      ctx.font = "700 22px monospace";
      ctx.fillText(info.name, sx + 24, C + 56);
      ctx.globalAlpha = 1;

      for (j = 0; j < c.floors.length; j++) {
        f = c.floors[j];
        ctx.fillStyle = "#fff";
        ctx.fillRect(f.x - cam, f.y, f.w, f.h);
        ctx.fillStyle = "#000";
        ctx.fillRect(f.x - cam, f.y, f.w, 3);
        ctx.fillStyle = "#c4c4c4";
        var gx;
        for (gx = 0; gx < f.w; gx += 16) {
          ctx.fillRect(f.x - cam + gx, f.y + 8, 10, 2);
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(f.x - cam, f.y - 4, f.w, 2);
        /* edge running lights */
        ctx.fillStyle = this.sector >= 3 && ((this.time * 6) | 0) % 2 ? "#888" : "#000";
        for (gx = 0; gx < f.w; gx += 48) {
          ctx.fillRect(f.x - cam + gx + 8, f.y - 7, 8, 2);
        }
      }

      for (j = 0; j < c.hazards.length; j++) {
        if (c.hazards[j].type !== "pit") continue;
        f = c.hazards[j];
        ctx.fillStyle = "#000";
        ctx.fillRect(f.x - cam, f.y, f.w, BB.VIEW_H - f.y + 20);
        ctx.fillStyle = "#fff";
        ctx.fillRect(f.x - cam - 4, f.y - 8, 4, 16);
        ctx.fillRect(f.x - cam + f.w, f.y - 8, 4, 16);
        /* depth slats */
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(f.x - cam, f.y + 20, f.w, 2);
        ctx.fillRect(f.x - cam, f.y + 50, f.w, 2);
      }

      ctx.fillStyle = "#fff";
      for (j = 0; j < c.platforms.length; j++) {
        f = c.platforms[j];
        ctx.fillRect(f.x - cam, f.y, f.w, f.h);
        ctx.fillStyle = "#000";
        ctx.fillRect(f.x - cam + 3, f.y + 3, f.w - 6, 3);
        ctx.fillStyle = "#fff";
      }

      ctx.fillStyle = "#000";
      for (k = 0; k < c.w; k += 100) {
        ctx.fillRect(sx + k, G + 16, 12, 3);
      }

      for (j = 0; j < c.lights.length; j++) {
        this._lamp(ctx, c.lights[j], cam);
      }
    }
  };

  World.prototype._lamp = function (ctx, L, cam) {
    var sx = L.x - cam;
    var flicker = this.sector >= 3 ? 0.55 : 0.08;
    var on = (Math.sin(this.time * (2.4 + this.sector) + L.phase) * 0.5 + 0.5) > flicker;
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx - 12, L.y, 24, 5);
    if (on) {
      ctx.globalAlpha = 0.05 + this.sector * 0.01;
      ctx.beginPath();
      ctx.moveTo(sx - 12, L.y + 5);
      ctx.lineTo(sx + 12, L.y + 5);
      ctx.lineTo(sx + 78, L.y + 170);
      ctx.lineTo(sx - 78, L.y + 170);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#333";
      ctx.fillRect(sx - 4, L.y + 5, 8, 3);
    }
  };

  World.prototype.applyShake = function (ctx) {
    var mag = this.shake > 0 ? this.shake * 7 : 0;
    var kx = this.kickX || 0;
    var ky = this.kickY || 0;
    if (mag <= 0 && !kx && !ky) return;
    ctx.translate(
      kx + (mag ? (Math.random() - 0.5) * mag : 0),
      ky + (mag ? (Math.random() - 0.5) * mag : 0)
    );
  };

  BB.World = World;
})(typeof window !== "undefined" ? window : globalThis);
