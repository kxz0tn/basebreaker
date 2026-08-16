/**
 * BASEBREAKER — Math, RNG, formatters
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Deterministic seeded RNG so a run can be reconstructed; hash noise
 * feeds corridor décor without ever repeating a texture file.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  var TAU = Math.PI * 2;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function saturate(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function damp(cur, tgt, lambda, dt) {
    return lerp(cur, tgt, 1 - Math.exp(-lambda * dt));
  }

  function hash(x, y, z) {
    var n = (x | 0) * 374761393 + (y | 0) * 668265263 + ((z | 0) + 1) * 1274126177;
    n = (n ^ (n >>> 13)) | 0;
    n = Math.imul(n, 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  /** Mulberry32 — cheap, decent period, seedable per run. */
  function rng(seed) {
    var s = seed >>> 0;
    if (!s) s = 0x9e3779b9;
    return function next() {
      s += 0x6d2b79f5;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rand, arr) {
    return arr[(rand() * arr.length) | 0];
  }

  function range(rand, a, b) {
    return a + rand() * (b - a);
  }

  function irange(rand, a, b) {
    return (a + rand() * (b - a + 1)) | 0;
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function aabbPad(ax, ay, aw, ah, bx, by, bw, bh, pad) {
    return aabb(ax - pad, ay - pad, aw + pad * 2, ah + pad * 2, bx, by, bw, bh);
  }

  /**
   * Conservative swept AABB: test start, end, and uniform substeps so a
   * thin column cannot be tunneled at high scroll speed. Displacement is
   * in world units for this frame (vx*dt, vy*dt).
   */
  function aabbSweep(ax, ay, aw, ah, dx, dy, bx, by, bw, bh) {
    if (aabb(ax, ay, aw, ah, bx, by, bw, bh)) return true;
    if (aabb(ax + dx, ay + dy, aw, ah, bx, by, bw, bh)) return true;
    var dist = Math.abs(dx) + Math.abs(dy);
    if (dist < 4) return false;
    var steps = Math.ceil(dist / 4);
    var i;
    var t;
    for (i = 1; i < steps; i++) {
      t = i / steps;
      if (aabb(ax + dx * t, ay + dy * t, aw, ah, bx, by, bw, bh)) return true;
    }
    return false;
  }

  /**
   * Both boxes moved this step. Reduce to A sweeping with relative
   * displacement against B at its start pose — closes hunter-through-
   * player tunnels the single-body sweep misses.
   */
  function aabbSweepRel(ax, ay, aw, ah, adx, ady, bx, by, bw, bh, bdx, bdy) {
    return aabbSweep(ax, ay, aw, ah, adx - bdx, ady - bdy, bx, by, bw, bh);
  }

  function formatScore(n) {
    n = Math.floor(n) || 0;
    var s = String(n);
    var out = "";
    var i;
    for (i = 0; i < s.length; i++) {
      if (i && (s.length - i) % 3 === 0) out += ",";
      out += s.charAt(i);
    }
    return out;
  }

  function formatTime(sec) {
    sec = Math.max(0, sec || 0);
    var m = (sec / 60) | 0;
    var s = (sec | 0) % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function formatMult(m) {
    return "x" + (Math.round(m * 10) / 10).toFixed(1);
  }

  BB.math = {
    TAU: TAU,
    clamp: clamp,
    lerp: lerp,
    saturate: saturate,
    damp: damp,
    hash: hash,
    rng: rng,
    pick: pick,
    range: range,
    irange: irange,
    aabb: aabb,
    aabbPad: aabbPad,
    aabbSweep: aabbSweep,
    aabbSweepRel: aabbSweepRel,
    formatScore: formatScore,
    formatTime: formatTime,
    formatMult: formatMult
  };
})(typeof window !== "undefined" ? window : globalThis);
