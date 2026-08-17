/**
 * BASEBREAKER — Post FX
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Monochrome edge glitch / slice tear on near-death and impact.
 * Scanlines live in CSS; this module drives the DOM overlays and a
 * canvas-space slice copy so the world itself tears.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function FX() {
    this.glitch = 0;
    this.near = 0;
    this.flowEdge = 0;
    this.flashEl = document.getElementById("fx-flash");
    this.dmgEl = document.getElementById("fx-damage");
    this.glitchEl = document.getElementById("fx-glitch");
    this.scanEl = document.getElementById("fx-scan");
    this.scanOn = true;
    try {
      var saved = localStorage.getItem(BB.STORAGE_SCAN);
      if (saved === "0") this.scanOn = false;
    } catch (e) {
      /* ignore */
    }
    this.applyScan();
  }

  FX.prototype.applyScan = function () {
    if (!this.scanEl) return;
    this.scanEl.classList.toggle("off", !this.scanOn);
  };

  FX.prototype.toggleScan = function () {
    this.scanOn = !this.scanOn;
    try {
      localStorage.setItem(BB.STORAGE_SCAN, this.scanOn ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
    this.applyScan();
    return this.scanOn;
  };

  FX.prototype.hit = function () {
    this.glitch = 1;
    this.flash(0.45);
    if (this.dmgEl) this.dmgEl.style.opacity = "1";
  };

  FX.prototype.setFlow = function (flow) {
    this.flowEdge = flow;
  };

  FX.prototype.nearMiss = function () {
    this.near = 0.55;
    if (this.glitchEl) this.glitchEl.style.opacity = "0.7";
  };

  FX.prototype.flash = function (amt) {
    var el = this.flashEl;
    if (!el) return;
    el.style.opacity = String(amt == null ? 0.3 : amt);
    setTimeout(function () {
      el.style.opacity = "0";
    }, 70);
  };

  FX.prototype.update = function (dt) {
    if (this.glitch > 0) this.glitch = Math.max(0, this.glitch - dt * 1.8);
    if (this.near > 0) this.near = Math.max(0, this.near - dt * 2.4);
    /* flowEdge is latched by setFlow each tick — do not decay it here */
    if (this.dmgEl) this.dmgEl.style.opacity = String(this.glitch);
    if (this.glitchEl) this.glitchEl.style.opacity = String(this.near * 0.85);
  };

  /**
   * Slice-copy the framebuffer horizontally. Cheap chromatic stand-in
   * that stays strictly black and white.
   */
  FX.prototype.draw = function (ctx) {
    var amt = Math.max(this.glitch, this.near * 0.6);
    if (this.flowEdge > 0.78) amt = Math.max(amt, 0.07);
    if (amt <= 0.02) return;
    var slices = 8;
    var i;
    var y;
    var h;
    var dx;
    var W = BB.VIEW_W;
    var H = BB.VIEW_H;
    ctx.save();
    for (i = 0; i < slices; i++) {
      if (Math.random() > amt) continue;
      y = (Math.random() * H) | 0;
      h = 2 + ((Math.random() * 18 * amt) | 0);
      dx = ((Math.random() - 0.5) * 28 * amt) | 0;
      try {
        ctx.drawImage(ctx.canvas, 0, y, W, h, dx, y, W, h);
      } catch (e) {
        /* tainted canvas should never happen — no external images */
      }
    }
    if (amt > 0.4) {
      ctx.globalAlpha = amt * 0.12;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 6, H);
      ctx.fillRect(W - 6, 0, 6, H);
    }
    ctx.restore();
  };

  BB.FX = FX;
})(typeof window !== "undefined" ? window : globalThis);
