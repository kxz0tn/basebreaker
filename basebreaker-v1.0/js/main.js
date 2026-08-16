/**
 * BASEBREAKER — Bootstrap
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Feature-detect Canvas 2D, then hand the canvas to Game. Failures
 * surface as a monochrome diagnostic instead of a blank page.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function canvasOk() {
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext && c.getContext("2d"));
    } catch (e) {
      return false;
    }
  }

  function fail(msg) {
    var el = document.getElementById("error");
    if (!el) return;
    el.classList.add("show");
    el.textContent = msg;
  }

  function start() {
    var canvas = document.getElementById("gl");
    if (!canvas) {
      fail("BASEBREAKER — canvas node missing.");
      return;
    }
    if (!canvasOk()) {
      fail("BASEBREAKER — Canvas 2D is unavailable on this device.");
      return;
    }
    try {
      BB.instance = new BB.Game(canvas);
    } catch (err) {
      fail("BASEBREAKER — init fault: " + (err && err.message ? err.message : err));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(typeof window !== "undefined" ? window : globalThis);
