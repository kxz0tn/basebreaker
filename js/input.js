/**
 * BASEBREAKER — Input
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Two modes share one keyboard:
 *   play  — jump / roll / shoot
 *   menu  — navigate / confirm / back
 * The Game sets menuMode from its state each tick so Space cannot
 * confirm a menu and also leak into play input on the same frame.
 *
 * Mobile (landscape): swipe up / down = jump / roll. A tap is a
 * release whose displacement stays under TAP_SLOP and whose duration
 * stays under TAP_MAX — that edge is shoot. A swipe never shoots.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  var SWIPE = 42;
  var TAP_SLOP = 28;
  var TAP_MAX = 320;

  function Input(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.menuMode = true;

    this.jump = false;
    this.roll = false;
    this.shoot = false;
    this.jumpHeld = false;
    this.pausePressed = false;
    this.mutePressed = false;
    this.scanPressed = false;

    this.menuUp = false;
    this.menuDown = false;
    this.menuLeft = false;
    this.menuRight = false;
    this.menuConfirm = false;
    this.menuBack = false;

    this._jumpEdge = false;
    this._rollEdge = false;
    this._shootEdge = false;
    this._pauseEdge = false;
    this._muteEdge = false;
    this._scanEdge = false;
    this._menuUp = false;
    this._menuDown = false;
    this._menuLeft = false;
    this._menuRight = false;
    this._menuConfirm = false;
    this._menuBack = false;
    this._padJump = false;
    this._jumpGrace = 0;

    this._pointer = {
      down: false,
      x: 0,
      y: 0,
      t: 0,
      sx: 0,
      sy: 0,
      swiped: false
    };

    this.touchEnabled = false;
    this._bind();
  }

  Input.prototype.setMenuMode = function (on) {
    this.menuMode = !!on;
  };

  Input.prototype._bind = function () {
    var self = this;
    var canvas = this.canvas;
    var stage = document.getElementById("stage") || canvas;

    window.addEventListener(
      "keydown",
      function (e) {
        var code = e.code;
        if (
          code === "Space" ||
          code === "ArrowUp" ||
          code === "ArrowDown" ||
          code === "ArrowLeft" ||
          code === "ArrowRight" ||
          code === "Tab" ||
          code === "Enter"
        ) {
          e.preventDefault();
        }
        if (e.repeat) {
          self.keys[code] = true;
          return;
        }
        self.keys[code] = true;

        if (self.menuMode) {
          if (code === "ArrowUp" || code === "KeyW") self._menuUp = true;
          if (code === "ArrowDown" || code === "KeyS") self._menuDown = true;
          if (code === "ArrowLeft" || code === "KeyA") self._menuLeft = true;
          if (code === "ArrowRight" || code === "KeyD") self._menuRight = true;
          if (code === "Enter" || code === "Space") self._menuConfirm = true;
          if (code === "Escape") self._menuBack = true;
          if (code === "Tab") {
            if (e.shiftKey) self._menuLeft = true;
            else self._menuRight = true;
          }
        } else {
          if (code === "ArrowUp" || code === "KeyW") self._jumpEdge = true;
          if (code === "ArrowDown" || code === "KeyS") self._rollEdge = true;
          if (code === "Space") self._shootEdge = true;
          if (code === "Escape" || code === "KeyP") self._pauseEdge = true;
        }
        if (code === "KeyM") self._muteEdge = true;
        if (code === "KeyG") self._scanEdge = true;
      },
      { passive: false }
    );

    window.addEventListener("keyup", function (e) {
      self.keys[e.code] = false;
    });

    window.addEventListener("blur", function () {
      self.keys = Object.create(null);
      self.jumpHeld = false;
      self._padJump = false;
      self._pointer.down = false;
    });

    function pointFrom(e) {
      var rect = canvas.getBoundingClientRect();
      var src = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e;
      return {
        x: src.clientX - rect.left,
        y: src.clientY - rect.top
      };
    }

    function fromUi(el) {
      if (!el || !el.closest) return false;
      return !!el.closest(".btn, .pad, .panel, #rotate, #error");
    }

    function onDown(e) {
      if (fromUi(e.target)) return;
      if (e.cancelable) e.preventDefault();
      if (e.button !== undefined && e.button !== 0) return;
      var p = pointFrom(e);
      self._pointer.down = true;
      self._pointer.x = p.x;
      self._pointer.y = p.y;
      self._pointer.sx = p.x;
      self._pointer.sy = p.y;
      self._pointer.t = performance.now();
      self._pointer.swiped = false;
    }

    function onMove(e) {
      if (!self._pointer.down) return;
      if (e.cancelable) e.preventDefault();
      var p = pointFrom(e);
      self._pointer.x = p.x;
      self._pointer.y = p.y;
      var dy = p.y - self._pointer.sy;
      var dx = p.x - self._pointer.sx;
      if (!self._pointer.swiped && Math.abs(dy) > SWIPE && Math.abs(dy) > Math.abs(dx) * 0.85) {
        self._pointer.swiped = true;
        if (self.menuMode) return;
        if (dy < 0) {
          self._jumpEdge = true;
          self._jumpGrace = 0.14;
        } else {
          self._rollEdge = true;
        }
      }
    }

    function onUp(e) {
      if (!self._pointer.down) return;
      if (e.cancelable) e.preventDefault();
      var p = pointFrom(e);
      var dx = p.x - self._pointer.sx;
      var dy = p.y - self._pointer.sy;
      var held = performance.now() - self._pointer.t;
      var dist = Math.sqrt(dx * dx + dy * dy);
      self._pointer.down = false;
      if (self.menuMode) return;
      /* Tap = short, small, not a swipe. Anywhere on the stage fires. */
      if (!self._pointer.swiped && dist < TAP_SLOP && held < TAP_MAX) {
        self._shootEdge = true;
      }
    }

    stage.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    stage.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp, { passive: false });
    window.addEventListener("touchcancel", onUp, { passive: false });

    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    ["gesturestart", "gesturechange", "gestureend"].forEach(function (type) {
      document.addEventListener(type, function (e) {
        e.preventDefault();
      });
    });

    document.addEventListener(
      "touchmove",
      function (e) {
        if (e.scale !== undefined && e.scale !== 1) e.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
      },
      { passive: false }
    );
  };

  Input.prototype.bindPads = function (jumpEl, rollEl) {
    var self = this;

    function press(el, down, up) {
      if (!el) return;
      function d(e) {
        e.preventDefault();
        e.stopPropagation();
        down();
      }
      function u(e) {
        if (e) e.preventDefault();
        if (up) up();
      }
      el.addEventListener("pointerdown", d);
      el.addEventListener("pointerup", u);
      el.addEventListener("pointerleave", u);
      el.addEventListener("pointercancel", u);
      el.addEventListener("touchstart", d, { passive: false });
      el.addEventListener("touchend", u, { passive: false });
    }

    press(
      jumpEl,
      function () {
        self._jumpEdge = true;
        self._padJump = true;
        self._jumpGrace = 0.14;
      },
      function () {
        self._padJump = false;
      }
    );
    press(rollEl, function () {
      self._rollEdge = true;
    }, null);
  };

  Input.prototype.showTouch = function (on) {
    this.touchEnabled = !!on;
    var el = document.getElementById("touch-ui");
    if (!el) return;
    /* v2.0: swipe + tap anywhere. Pads stay hidden so they cannot
       steal taps that should fire the rail. */
    el.classList.add("hidden");
  };

  Input.prototype.poll = function (dt) {
    if (this._jumpGrace > 0) this._jumpGrace = Math.max(0, this._jumpGrace - (dt || 0.016));

    this.mutePressed = this._muteEdge;
    this.scanPressed = this._scanEdge;
    this._muteEdge = false;
    this._scanEdge = false;

    if (this.menuMode) {
      this.jump = false;
      this.roll = false;
      this.shoot = false;
      this.jumpHeld = false;
      this.pausePressed = false;
      this.menuUp = this._menuUp;
      this.menuDown = this._menuDown;
      this.menuLeft = this._menuLeft;
      this.menuRight = this._menuRight;
      this.menuConfirm = this._menuConfirm;
      this.menuBack = this._menuBack;
      this._menuUp = false;
      this._menuDown = false;
      this._menuLeft = false;
      this._menuRight = false;
      this._menuConfirm = false;
      this._menuBack = false;
      this._jumpEdge = false;
      this._rollEdge = false;
      this._shootEdge = false;
      this._pauseEdge = false;
      return;
    }

    this.menuUp = this.menuDown = this.menuLeft = this.menuRight = false;
    this.menuConfirm = false;
    this.menuBack = false;
    this._menuUp = this._menuDown = this._menuLeft = this._menuRight = false;
    this._menuConfirm = this._menuBack = false;

    this.jump = this._jumpEdge;
    this.roll = this._rollEdge;
    this.shoot = this._shootEdge;
    this.pausePressed = this._pauseEdge;
    this._jumpEdge = false;
    this._rollEdge = false;
    this._shootEdge = false;
    this._pauseEdge = false;

    this.jumpHeld = !!(
      this.keys.ArrowUp ||
      this.keys.KeyW ||
      this._padJump ||
      this._jumpGrace > 0
    );
  };

  BB.Input = Input;
})(typeof window !== "undefined" ? window : globalThis);
