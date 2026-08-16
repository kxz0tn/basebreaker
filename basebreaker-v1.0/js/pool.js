/**
 * BASEBREAKER — Object pool
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Projectiles, particles, aliens, and chunk records are rented from
 * fixed pools so the mid-run GC spike never shows up on mobile.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function Pool(factory, n) {
    this.factory = factory;
    this.alive = [];
    this.dead = [];
    var i;
    n = n || 0;
    for (i = 0; i < n; i++) this.dead.push(factory());
  }

  Pool.prototype.spawn = function () {
    var o = this.dead.length ? this.dead.pop() : this.factory();
    o.alive = true;
    this.alive.push(o);
    return o;
  };

  /**
   * Compact in place: dead entries move to `dead`, alive stay packed
   * at the front of `alive`. Call once per system per frame.
   */
  Pool.prototype.reclaim = function () {
    var src = this.alive;
    var w = 0;
    var i;
    var o;
    for (i = 0; i < src.length; i++) {
      o = src[i];
      if (o.alive) {
        src[w++] = o;
      } else {
        this.dead.push(o);
      }
    }
    src.length = w;
  };

  Pool.prototype.killAll = function () {
    var i;
    for (i = 0; i < this.alive.length; i++) {
      this.alive[i].alive = false;
      this.dead.push(this.alive[i]);
    }
    this.alive.length = 0;
  };

  Pool.prototype.forEach = function (fn) {
    var i;
    var list = this.alive;
    for (i = 0; i < list.length; i++) {
      if (list[i].alive) fn(list[i], i);
    }
  };

  BB.Pool = Pool;
})(typeof window !== "undefined" ? window : globalThis);
