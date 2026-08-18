/**
 * BASEBREAKER — Procedural audio
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Every sound is synthesized on the AudioContext graph. No samples.
 * Browsers require a user gesture before resume(); unlock() is called
 * from the title-screen click.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.muted = false;
    this._drone = null;
    this._run = null;
    this._started = false;
    this._noise = null;
  }

  AudioEngine.prototype.unlock = function () {
    if (this.ready) {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.38;
    this.master.connect(this.ctx.destination);
    this._noise = this._noiseBuffer(1.2);
    this._buildBeds();
    this.ready = true;
    this.ctx.resume();
  };

  AudioEngine.prototype.setMuted = function (m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.38;
  };

  AudioEngine.prototype._now = function () {
    return this.ctx ? this.ctx.currentTime : 0;
  };

  AudioEngine.prototype._gain = function (parent, value) {
    var g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(parent || this.master);
    return g;
  };

  AudioEngine.prototype._osc = function (type, freq, dest) {
    var o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    return o;
  };

  AudioEngine.prototype._noiseBuffer = function (seconds) {
    var len = Math.floor((this.ctx.sampleRate * seconds) | 0);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    var b0 = 0;
    var b1 = 0;
    var b2 = 0;
    var white;
    var i;
    for (i = 0; i < len; i++) {
      white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    }
    return buf;
  };

  AudioEngine.prototype._noiseSrc = function (dest, loop) {
    var s = this.ctx.createBufferSource();
    s.buffer = this._noise;
    s.loop = !!loop;
    s.connect(dest);
    return s;
  };

  AudioEngine.prototype._buildBeds = function () {
    var droneG = this._gain(this.master, 0);
    var o1 = this._osc("sine", 48, droneG);
    var o2 = this._osc("triangle", 72.4, droneG);
    o1.start();
    o2.start();
    this._drone = droneG;

    var runG = this._gain(this.master, 0);
    var filt = this.ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 900;
    filt.connect(runG);
    var n = this._noiseSrc(filt, true);
    n.start();
    this._run = runG;
  };

  AudioEngine.prototype.setRunning = function (on, speedNorm) {
    if (!this.ready) return;
    var t = this._now();
    var drone = on ? 0.045 : 0.02;
    var run = on ? 0.018 + speedNorm * 0.035 : 0;
    this._drone.gain.cancelScheduledValues(t);
    this._drone.gain.linearRampToValueAtTime(drone, t + 0.12);
    this._run.gain.cancelScheduledValues(t);
    this._run.gain.linearRampToValueAtTime(run, t + 0.08);
  };

  AudioEngine.prototype.ui = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("square", 880, g);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.05);
    o.start(t);
    o.stop(t + 0.08);
  };

  AudioEngine.prototype.jump = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("sawtooth", 180, g);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.14);
    o.start(t);
    o.stop(t + 0.2);
    var ng = this._gain(this.master, 0);
    var n = this._noiseSrc(ng, false);
    ng.gain.setValueAtTime(0.06, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    n.start(t);
    n.stop(t + 0.12);
  };

  AudioEngine.prototype.roll = function () {
    if (!this.ready) return;
    var t = this._now();
    var ng = this._gain(this.master, 0);
    var filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 700;
    ng.connect(filt);
    filt.connect(this.master);
    var n = this._noiseSrc(ng, false);
    ng.gain.setValueAtTime(0.08, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    n.start(t);
    n.stop(t + 0.24);
  };

  AudioEngine.prototype.impact = function () {
    if (!this.ready) return;
    var t = this._now();
    var ng = this._gain(this.master, 0);
    var n = this._noiseSrc(ng, false);
    ng.gain.setValueAtTime(0.12, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.start(t);
    n.stop(t + 0.18);
    var g = this._gain(this.master, 0);
    var o = this._osc("triangle", 140, g);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    o.start(t);
    o.stop(t + 0.15);
  };

  AudioEngine.prototype.near = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("sine", 1480, g);
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.start(t);
    o.stop(t + 0.09);
  };

  AudioEngine.prototype.death = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("sawtooth", 220, g);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.65);
    o.start(t);
    o.stop(t + 0.72);
    var ng = this._gain(this.master, 0);
    var n = this._noiseSrc(ng, false);
    ng.gain.setValueAtTime(0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    n.start(t);
    n.stop(t + 0.46);
  };

  /** Rail dart — sharp click + short noise burst. */
  AudioEngine.prototype.shoot = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("square", 920, g);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.06);
    o.start(t);
    o.stop(t + 0.08);
    var ng = this._gain(this.master, 0);
    var filt = this.ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 1800;
    ng.connect(filt);
    filt.connect(this.master);
    var n = this._noiseSrc(ng, false);
    ng.gain.setValueAtTime(0.08, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.start(t);
    n.stop(t + 0.06);
  };

  AudioEngine.prototype.dry = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("square", 140, g);
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.start(t);
    o.stop(t + 0.06);
  };

  AudioEngine.prototype.hitMetal = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("triangle", 640, g);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    o.start(t);
    o.stop(t + 0.1);
    var ng = this._gain(this.master, 0);
    var n = this._noiseSrc(ng, false);
    ng.gain.setValueAtTime(0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.start(t);
    n.stop(t + 0.07);
  };

  AudioEngine.prototype.devilWarn = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("sawtooth", 70, g);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    o.start(t);
    o.stop(t + 0.56);
  };

  AudioEngine.prototype.devilHit = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("square", 110, g);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    o.start(t);
    o.stop(t + 0.15);
  };

  AudioEngine.prototype.devilDown = function () {
    if (!this.ready) return;
    var t = this._now();
    var g = this._gain(this.master, 0);
    var o = this._osc("sawtooth", 180, g);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    o.start(t);
    o.stop(t + 0.44);
    var ng = this._gain(this.master, 0);
    var n = this._noiseSrc(ng, false);
    ng.gain.setValueAtTime(0.14, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    n.start(t);
    n.stop(t + 0.3);
  };

  BB.AudioEngine = AudioEngine;
})(typeof window !== "undefined" ? window : globalThis);
