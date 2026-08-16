/**
 * BASEBREAKER — Flow / momentum
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Flow is a [0,1] scalar built by clean play and spent by hesitation.
 * It is NOT a second score. It is the agency lever:
 *   vx_player = v_base * (1 + flow * k)
 *   extra_hunt = f(flow, gap)   with extra <= 0 when flow is high
 *
 * Feed events are impulses (dimensionless). Decay is per second after
 * an idle window, so a brief pause does not dump the meter.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function Flow() {
    this.reset();
  }

  Flow.prototype.reset = function () {
    this.value = 0;
    this.idle = 0;
    this.peak = 0;
    this.shock = 0;
  };

  Flow.prototype.feed = function (kind) {
    var F = BB.CONFIG.flow;
    var add = 0;
    if (kind === "jump" || kind === "roll") add = F.jump;
    else if (kind === "near") add = F.near;
    else if (kind === "break") add = F.brk;
    else add = 0.06;
    this.value = BB.math.clamp(this.value + add, 0, F.max);
    this.idle = 0;
    if (this.value > this.peak) this.peak = this.value;
  };

  Flow.prototype.tick = function (dt) {
    var F = BB.CONFIG.flow;
    this.idle += dt;
    this.shock = Math.max(0, this.shock - dt);
    if (this.idle > F.idleBeforeDecay) {
      this.value = Math.max(0, this.value - F.decayPerSec * dt);
    }
  };

  Flow.prototype.hesitating = function () {
    return this.idle > 1.4 && this.value < 0.18;
  };

  /** Speed scale. 1 at flow 0, 1+k at flow 1. */
  Flow.prototype.speedMul = function () {
    return 1 + this.value * BB.CONFIG.run.flowSpeed;
  };

  Flow.prototype.coyoteBonus = function () {
    return this.value * BB.CONFIG.player.coyoteFlow;
  };

  BB.Flow = Flow;
})(typeof window !== "undefined" ? window : globalThis);
