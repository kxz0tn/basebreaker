/**
 * BASEBREAKER — Scoring
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Primary: survival time + distance. Secondary: clean jump/roll
 * streaks, near-misses. Multiplier is fed by those streaks and decays
 * when the astronaut goes quiet. The running total FREEZES the instant
 * contact is registered — that frozen integer is the final score.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function Score() {
    this.reset();
  }

  Score.prototype.reset = function () {
    this.value = 0;
    this.frozen = false;
    this.final = 0;
    this.time = 0;
    this.distance = 0;
    this.near = 0;
    this.cleans = 0;
    this.mult = 1;
    this.peakMult = 1;
    this.streak = 0;
    this.idle = 0;
  };

  Score.prototype.add = function (n) {
    if (this.frozen) return;
    this.value += n * this.mult;
  };

  Score.prototype.tick = function (dt, distDelta, overdrive) {
    if (this.frozen) return;
    var S = BB.CONFIG.score;
    var mul = this.mult + (overdrive ? BB.CONFIG.boost.overMult : 0);
    this.time += dt;
    this.distance += distDelta;
    this.value += (distDelta * S.perMeter + dt * S.perSecond) * mul;
    this.idle += dt;
    if (this.idle > S.multDecay) {
      this.streak = Math.max(0, this.streak - dt * 1.6);
      this._recompute();
    }
  };

  Score.prototype._feed = function (amount) {
    if (this.frozen) return;
    var S = BB.CONFIG.score;
    this.idle = 0;
    this.streak += 1;
    this._recompute();
    this.value += amount * this.mult;
  };

  Score.prototype._recompute = function () {
    var S = BB.CONFIG.score;
    this.mult = BB.math.clamp(1 + this.streak * S.multPerStreak, 1, S.multMax);
    if (this.mult > this.peakMult) this.peakMult = this.mult;
  };

  Score.prototype.nearMiss = function () {
    this.near += 1;
    this._feed(BB.CONFIG.score.nearMiss);
  };

  Score.prototype.clean = function () {
    this.cleans += 1;
    this._feed(BB.CONFIG.score.cleanMove);
  };

  Score.prototype.freeze = function () {
    if (this.frozen) return this.final;
    this.frozen = true;
    this.final = Math.floor(this.value);
    this.value = this.final;
    this.mult = this.mult;
    return this.final;
  };

  Score.prototype.snapshot = function () {
    return {
      score: this.frozen ? this.final : Math.floor(this.value),
      time: this.time,
      distance: this.distance,
      near: this.near,
      cleans: this.cleans,
      mult: this.mult,
      peakMult: this.peakMult
    };
  };

  Score.loadHigh = function () {
    try {
      var n = parseInt(localStorage.getItem(BB.STORAGE_HI) || "0", 10);
      return isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  };

  Score.saveHigh = function (n) {
    var prev = Score.loadHigh();
    n = Math.floor(n);
    try {
      if (n > prev) localStorage.setItem(BB.STORAGE_HI, String(n));
    } catch (e) {
      return Math.max(prev, n);
    }
    return Math.max(prev, n);
  };

  Score.loadList = function () {
    try {
      var raw = localStorage.getItem(BB.STORAGE_LIST);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  };

  Score.pushList = function (snap) {
    var list = Score.loadList();
    list.push({
      score: snap.score,
      dist: Math.floor(snap.distance),
      time: snap.time,
      at: Date.now()
    });
    list.sort(function (a, b) {
      return b.score - a.score;
    });
    list = list.slice(0, 8);
    try {
      localStorage.setItem(BB.STORAGE_LIST, JSON.stringify(list));
    } catch (e) {
      /* quota — ignore */
    }
    return list;
  };

  BB.Score = Score;
})(typeof window !== "undefined" ? window : globalThis);
