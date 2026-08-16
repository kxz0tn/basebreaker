/**
 * BASEBREAKER — Corridor chunk generator
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Each run is a unique stream of modular corridor slices. Floors,
 * ceilings, platforms, hazards, décor, and alien spawners are packed
 * into pooled chunk records. The first slices stay readable; later
 * slices densify with the difficulty parameter.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function chunkFactory() {
    return {
      alive: false,
      x: 0,
      w: 0,
      floors: [],
      ceilings: [],
      platforms: [],
      hazards: [],
      spawners: [],
      decor: [],
      lights: [],
      id: 0
    };
  }

  function Chunks() {
    this.pool = new BB.Pool(chunkFactory, 14);
    this.rand = BB.math.rng(1);
    this.nextX = 0;
    this.index = 0;
    this.difficulty = 0;
    this.sector = 0;
  }

  Chunks.prototype.reset = function (seed) {
    this.pool.killAll();
    this.rand = BB.math.rng(seed);
    this.nextX = -200;
    this.index = 0;
    this.difficulty = 0;
    this.sector = 0;
  };

  Chunks.prototype.setDifficulty = function (d) {
    this.difficulty = BB.math.clamp(d, 0, 1);
  };

  Chunks.prototype.ensure = function (camX) {
    var look = camX + BB.CONFIG.world.lookAhead;
    while (this.nextX < look) {
      this._emit();
    }
    var list = this.pool.alive;
    var i;
    var c;
    for (i = 0; i < list.length; i++) {
      c = list[i];
      if (c.x + c.w < camX - BB.CONFIG.world.recyclePad) c.alive = false;
    }
    this.pool.reclaim();
  };

  Chunks.prototype._emit = function () {
    var c = this.pool.spawn();
    var w;
    var kind;
    c.floors.length = 0;
    c.ceilings.length = 0;
    c.platforms.length = 0;
    c.hazards.length = 0;
    c.spawners.length = 0;
    c.decor.length = 0;
    c.lights.length = 0;
    c.x = this.nextX;
    c.id = this.index;

    if (this.index < 2) {
      w = 1100;
      kind = "intro";
    } else if (this.index === 2) {
      w = 1000;
      kind = "tutorial";
    } else {
      w = (880 + this.rand() * 420) | 0;
      kind = this._pickKind();
    }

    c.w = w;
    this._build(c, kind);
    this.nextX += w;
    this.index += 1;
  };

  Chunks.prototype._pickKind = function () {
    var d = this.difficulty;
    var r = this.rand();
    var bag;
    if (this.sector <= 0 && d < 0.25) {
      bag = ["flat", "flat", "pit", "pipe", "combat", "barrier"];
    } else if (this.sector <= 1) {
      bag = ["flat", "pit", "pipe", "laser", "combat", "barrier", "mixed", "vent"];
    } else if (this.sector === 2) {
      bag = ["pit", "pipe", "laser", "field", "combat", "mixed", "vent", "gauntlet"];
    } else {
      bag = ["laser", "field", "mixed", "gauntlet", "doublepit", "combat", "vent", "pipe", "pit"];
    }
    return bag[(r * bag.length) | 0];
  };

  Chunks.prototype._build = function (c, kind) {
    var G = BB.CONFIG.world.ground;
    var C = BB.CONFIG.world.ceiling;
    var x = c.x;
    var w = c.w;
    var r = this.rand;
    var d = this.difficulty;

    c.ceilings.push({ x: x, y: 0, w: w, h: C });

    if (kind === "intro") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      this._ribs(c);
      this._lights(c, 3);
      return;
    }

    if (kind === "tutorial") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      c.hazards.push({ type: "barrier", x: x + 380, y: G - 38, w: 36, h: 38, tagged: false });
      this._pipe(c, x + 680);
      this._slap(c, x + 880);
      this._ribs(c);
      this._lights(c, 3);
      return;
    }

    if (kind === "flat") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      if (r() < 0.45 + d * 0.3) {
        c.hazards.push({ type: "vent", x: x + w * 0.4, y: C, w: 22, h: 18, tagged: false });
      }
      if (r() < 0.28) this._barrier(c, x + w * 0.55);
      else if (r() < 0.55) this._breakable(c, x + w * 0.52, G);
      if (r() < 0.4) this._boost(c, x + w * 0.72, G);
      if (r() < 0.35) this._slap(c, x + w * 0.78);
      this._maybeSpawn(c, x + w * 0.7, G, "ground");
      this._ribs(c);
      this._lights(c, 3);
      return;
    }

    if (kind === "barrier") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      this._barrier(c, x + w * 0.35);
      if (d > 0.35) this._barrier(c, x + w * 0.68);
      this._ribs(c);
      this._lights(c, 2);
      return;
    }

    if (kind === "pipe") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      this._pipe(c, x + w * 0.3);
      if (d > 0.25) this._pipe(c, x + w * 0.62);
      if (d > 0.65) this._slap(c, x + w * 0.82);
      this._ribs(c);
      this._lights(c, 2);
      return;
    }

    if (kind === "pit" || kind === "doublepit") {
      this._pits(c, kind === "doublepit" ? 2 : 1);
      this._ribs(c);
      this._lights(c, 2);
      this._maybeSpawn(c, x + 80, G, "ground");
      return;
    }

    if (kind === "laser") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      this._laser(c, x + w * 0.4);
      if (d > 0.4) this._laser(c, x + w * 0.68);
      if (d > 0.75) this._laser(c, x + w * 0.85);
      this._ribs(c);
      this._lights(c, 3);
      return;
    }

    if (kind === "field") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      this._field(c, x + w * 0.48);
      if (d > 0.6) this._field(c, x + w * 0.78);
      this._ribs(c);
      this._lights(c, 2);
      return;
    }

    if (kind === "vent") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      this._pipe(c, x + w * 0.28);
      this._pipe(c, x + w * 0.48);
      this._pipe(c, x + w * 0.68);
      c.hazards.push({ type: "vent", x: x + w * 0.3, y: C, w: 22, h: 18, tagged: false });
      c.hazards.push({ type: "vent", x: x + w * 0.55, y: C, w: 22, h: 18, tagged: false });
      this._maybeSpawn(c, x + w * 0.5, C + 24, "ceil");
      this._ribs(c);
      this._lights(c, 2);
      return;
    }

    if (kind === "combat") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      if (r() < 0.5) {
        c.platforms.push({ x: x + w * 0.4, y: G - 110, w: 120, h: 14 });
      }
      this._breakable(c, x + w * 0.32, G);
      this._node(c, x + w * 0.58, G - 96);
      this._boost(c, x + w * 0.48, G);
      this._maybeSpawn(c, x + w * 0.35, G, "ground");
      this._maybeSpawn(c, x + w * 0.7, G - 40, "air");
      this._maybeSpawn(c, x + w * 0.55, C + 24, "ceil");
      this._ribs(c);
      this._lights(c, 3);
      return;
    }

    if (kind === "mixed" || kind === "gauntlet") {
      c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
      this._barrier(c, x + w * 0.28);
      this._pipe(c, x + w * 0.5);
      if (r() < 0.55) this._slap(c, x + w * 0.38);
      if (kind === "gauntlet" || d > 0.5) this._laser(c, x + w * 0.74);
      if (kind === "gauntlet" && d > 0.55) this._field(c, x + w * 0.9);
      if (r() < 0.55) this._breakable(c, x + w * 0.4, G);
      this._maybeSpawn(c, x + w * 0.6, G, "ground");
      this._ribs(c);
      this._lights(c, 3);
      return;
    }

    c.floors.push({ x: x, y: G, w: w, h: BB.VIEW_H - G });
    this._ribs(c);
    this._lights(c, 2);
  };

  Chunks.prototype._pits = function (c, n) {
    var G = BB.CONFIG.world.ground;
    var x = c.x;
    var w = c.w;
    var r = this.rand;
    var gap = (90 + r() * (70 + this.difficulty * 50)) | 0;
    var left = (220 + r() * 80) | 0;
    if (n === 1) {
      c.floors.push({ x: x, y: G, w: left, h: BB.VIEW_H - G });
      c.floors.push({
        x: x + left + gap,
        y: G,
        w: w - left - gap,
        h: BB.VIEW_H - G
      });
      c.hazards.push({ type: "pit", x: x + left, y: G, w: gap, h: BB.VIEW_H - G, tagged: false });
      if (r() < 0.4 + this.difficulty * 0.3) {
        c.platforms.push({
          x: x + left + gap * 0.28,
          y: G - (70 + r() * 50),
          w: 70,
          h: 12
        });
      }
    } else {
      var mid = (140 + r() * 80) | 0;
      var gap2 = (80 + r() * 60) | 0;
      var a = left;
      var b = a + gap;
      var c0 = b + mid;
      var d0 = c0 + gap2;
      c.floors.push({ x: x, y: G, w: a, h: BB.VIEW_H - G });
      c.floors.push({ x: x + b, y: G, w: mid, h: BB.VIEW_H - G });
      c.floors.push({ x: x + d0, y: G, w: w - d0, h: BB.VIEW_H - G });
      c.hazards.push({ type: "pit", x: x + a, y: G, w: gap, h: BB.VIEW_H - G, tagged: false });
      c.hazards.push({ type: "pit", x: x + c0, y: G, w: gap2, h: BB.VIEW_H - G, tagged: false });
    }
  };

  Chunks.prototype._barrier = function (c, x) {
    var G = BB.CONFIG.world.ground;
    var h = 34 + (this.rand() * 8) | 0;
    c.hazards.push({ type: "barrier", x: x, y: G - h, w: 36, h: h, tagged: false });
  };

  Chunks.prototype._pipe = function (c, x) {
    var G = BB.CONFIG.world.ground;
    var C = BB.CONFIG.world.ceiling;
    var gap = BB.CONFIG.world.rollClear;
    var w = 52;
    var h = G - C - gap;
    c.hazards.push({ type: "pipe", x: x, y: C, w: w, h: h, tagged: false });
  };

  Chunks.prototype._slap = function (c, x) {
    var G = BB.CONFIG.world.ground;
    c.hazards.push({
      type: "slap",
      x: x,
      y: G - 56,
      w: 54,
      h: 16,
      tagged: false
    });
  };

  Chunks.prototype._boost = function (c, x, G) {
    var kinds = ["surge", "aegis", "over"];
    var kind = kinds[(this.rand() * kinds.length) | 0];
    c.hazards.push({
      type: "boost",
      kind: kind,
      x: x,
      y: G - 78,
      w: 22,
      h: 22,
      taken: false,
      tagged: false
    });
  };

  Chunks.prototype._laser = function (c, x) {
    var G = BB.CONFIG.world.ground;
    var C = BB.CONFIG.world.ceiling;
    var period = 1.55 - this.difficulty * 0.28 + this.rand() * 0.25;
    var duty = 0.36 + this.difficulty * 0.08;
    c.hazards.push({
      type: "laser",
      x: x,
      y: C + 6,
      w: 10,
      h: G - C - 12,
      period: period,
      duty: duty,
      phase: this.rand() * period,
      tagged: false
    });
  };

  Chunks.prototype._field = function (c, x) {
    var G = BB.CONFIG.world.ground;
    var C = BB.CONFIG.world.ceiling;
    var period = 1.7 - this.difficulty * 0.22 + this.rand() * 0.25;
    c.hazards.push({
      type: "field",
      x: x,
      y: C + 6,
      w: 36,
      h: G - C - 12,
      period: period,
      duty: 0.46,
      phase: this.rand() * period,
      tagged: false
    });
  };

  Chunks.prototype._maybeSpawn = function (c, x, y, where) {
    var r = this.rand();
    var type;
    if (where === "ground") return;
    if (r > 0.62 + this.difficulty * 0.2) return;
    type = where === "ceil" ? 1 : 2;
    c.spawners.push({ x: x, y: y, type: type, fired: false });
  };

  Chunks.prototype._breakable = function (c, x, G) {
    c.hazards.push({
      type: "break",
      x: x,
      y: G - 42,
      w: 28,
      h: 42,
      hp: 1,
      tagged: false
    });
  };

  Chunks.prototype._node = function (c, x, y) {
    c.hazards.push({
      type: "break",
      x: x,
      y: y,
      w: 20,
      h: 20,
      hp: 1,
      tagged: false,
      node: true
    });
  };

  Chunks.prototype._ribs = function (c) {
    var i;
    var info = BB.SECTORS[this.sector] || BB.SECTORS[0];
    var step = info.rib || 70;
    for (i = 0; i < c.w; i += step) {
      c.decor.push({
        kind: "rib",
        x: c.x + i,
        y: BB.CONFIG.world.ceiling,
        w: 8,
        h: BB.CONFIG.world.ground - BB.CONFIG.world.ceiling
      });
    }
  };

  Chunks.prototype._lights = function (c, n) {
    var i;
    for (i = 0; i < n; i++) {
      c.lights.push({
        x: c.x + ((i + 0.5) / n) * c.w,
        y: BB.CONFIG.world.ceiling + 6,
        phase: this.rand() * 10
      });
    }
  };

  Chunks.prototype.groundUnder = function (x0, x1, py) {
    var samples = [x0, (x0 + x1) * 0.5, x1];
    var best = null;
    var i;
    var g;
    for (i = 0; i < samples.length; i++) {
      g = this.groundAt(samples[i], py);
      if (g !== null && (best === null || g < best)) best = g;
    }
    return best;
  };

  Chunks.prototype.groundAt = function (px, py) {
    var best = null;
    var i;
    var j;
    var c;
    var f;
    var y;
    for (i = 0; i < this.pool.alive.length; i++) {
      c = this.pool.alive[i];
      if (px < c.x - 8 || px > c.x + c.w + 8) continue;
      for (j = 0; j < c.floors.length; j++) {
        f = c.floors[j];
        if (px >= f.x && px <= f.x + f.w) {
          y = f.y;
          if (py >= y - 80 && (best === null || y < best)) best = y;
        }
      }
      for (j = 0; j < c.platforms.length; j++) {
        f = c.platforms[j];
        if (px >= f.x && px <= f.x + f.w) {
          y = f.y;
          if (py >= y - 24 && py <= y + 18 && (best === null || y < best)) best = y;
        }
      }
    }
    return best;
  };

  Chunks.prototype.ceilingAt = function (px) {
    var i;
    var j;
    var c;
    var f;
    for (i = 0; i < this.pool.alive.length; i++) {
      c = this.pool.alive[i];
      if (px < c.x || px > c.x + c.w) continue;
      for (j = 0; j < c.ceilings.length; j++) {
        f = c.ceilings[j];
        if (px >= f.x && px <= f.x + f.w) return f.h;
      }
    }
    return BB.CONFIG.world.ceiling;
  };

  Chunks.prototype.forHazards = function (fn) {
    var i;
    var j;
    var c;
    for (i = 0; i < this.pool.alive.length; i++) {
      c = this.pool.alive[i];
      for (j = 0; j < c.hazards.length; j++) fn(c.hazards[j], c);
    }
  };

  Chunks.prototype.forSpawners = function (fn) {
    var i;
    var j;
    var c;
    var s;
    for (i = 0; i < this.pool.alive.length; i++) {
      c = this.pool.alive[i];
      for (j = 0; j < c.spawners.length; j++) {
        s = c.spawners[j];
        if (!s.fired) fn(s, c);
      }
    }
  };

  Chunks.prototype.hazardAhead = function (px, dist) {
    var scan = this.scanAhead(px, dist);
    return scan ? scan.type : null;
  };

  Chunks.prototype.hazardNear = function (px, behind, ahead) {
    var found = false;
    this.forHazards(function (h) {
      if (h.type === "vent" || h.type === "pit") return;
      if (h.hp !== undefined && h.hp <= 0) return;
      if (h.x + h.w >= px - behind && h.x <= px + ahead) found = true;
    });
    return found;
  };

  Chunks.prototype.scanAhead = function (px, dist) {
    var hit = null;
    this.forHazards(function (h) {
      if (h.x > px && h.x < px + dist && (h.type === "barrier" || h.type === "pit")) {
        if (!hit || h.x < hit.x) hit = { type: h.type, x: h.x, w: h.w };
      }
    });
    return hit;
  };

  BB.Chunks = Chunks;
})(typeof window !== "undefined" ? window : globalThis);
