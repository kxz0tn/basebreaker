/**
 * BASEBREAKER — HUD + menus
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * DOM overlays on top of the 2D canvas. The HUD is holographic
 * chrome; menus are full-frame CRT cards. Score freeze is displayed
 * verbatim on the Game Over panel.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});
  var M = BB.math;

  function UI(game) {
    this.game = game;
    this.el = {
      boot: document.getElementById("boot"),
      title: document.getElementById("title"),
      how: document.getElementById("how"),
      scores: document.getElementById("scores"),
      pause: document.getElementById("pause"),
      over: document.getElementById("over"),
      hud: document.getElementById("hud"),
      score: document.getElementById("hud-score"),
      mult: document.getElementById("hud-mult"),
      dist: document.getElementById("hud-dist"),
      speed: document.getElementById("hud-speed"),
      threat: document.getElementById("hud-threat"),
      sector: document.getElementById("hud-sector"),
      best: document.getElementById("hud-best"),
      toast: document.getElementById("toast"),
      hiscore: document.getElementById("hiscore"),
      hiscoreOver: document.getElementById("over-hiscore"),
      overScore: document.getElementById("over-score"),
      overDist: document.getElementById("over-dist"),
      overTime: document.getElementById("over-time"),
      overMult: document.getElementById("over-mult"),
      flavor: document.getElementById("over-flavor"),
      copyStatus: document.getElementById("copy-status"),
      flowBar: document.getElementById("bar-flow"),
      flowVal: document.getElementById("hud-flow-val"),
      sectorName: document.getElementById("hud-sector-name"),
      boostLab: document.getElementById("hud-boost"),
      ammoBar: document.getElementById("bar-ammo"),
      ammoVal: document.getElementById("hud-ammo-val"),
      ammoWrap: document.getElementById("hud-ammo")
    };
    this._toastT = 0;
    this._menuId = null;
    this._focus = 0;
    this._hi = BB.Score.loadHigh();
    this.refreshHigh();
    this._bind();
    this._bindNavHover();
    var ver = document.getElementById("ver-tag");
    if (ver) ver.textContent = "v" + BB.VERSION;
  }

  UI.prototype._bind = function () {
    var g = this.game;
    var self = this;
    function click(id, fn) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", function () {
        if (g.audio) g.audio.ui();
        fn();
      });
    }
    click("btn-start", function () {
      g.startRun();
    });
    click("btn-how-start", function () {
      g.startRun();
    });
    click("btn-how", function () {
      self.showHow();
    });
    click("btn-how-back", function () {
      self.showTitle();
    });
    click("btn-scores", function () {
      self.showScores();
    });
    click("btn-scores-back", function () {
      self.showTitle();
    });
    click("btn-resume", function () {
      g.togglePause(false);
    });
    click("btn-retry", function () {
      g.startRun();
    });
    click("btn-restart", function () {
      g.startRun();
    });
    click("btn-menu", function () {
      g.gotoTitle();
    });
    click("btn-menu-pause", function () {
      g.gotoTitle();
    });
    click("btn-mute-pause", function () {
      g.audio.setMuted(!g.audio.muted);
      var b = document.getElementById("btn-mute-pause");
      if (b) b.textContent = g.audio.muted ? "Unmute" : "Mute";
      self.toast(g.audio.muted ? "AUDIO MUTE" : "AUDIO LIVE");
    });
    click("btn-copy", function () {
      self.copyScore();
    });
  };

  UI.MENUS = {
    title: ["btn-start", "btn-how", "btn-scores"],
    how: ["btn-how-start", "btn-how-back"],
    scores: ["btn-scores-back"],
    pause: ["btn-resume", "btn-restart", "btn-menu-pause", "btn-mute-pause"],
    over: ["btn-retry", "btn-copy", "btn-menu"]
  };

  UI.prototype._bindNavHover = function () {
    var self = this;
    Object.keys(UI.MENUS).forEach(function (menu) {
      UI.MENUS[menu].forEach(function (id, idx) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("mouseenter", function () {
          if (self._menuId !== menu) return;
          self._focus = idx;
          self._applyFocus();
        });
      });
    });
  };

  UI.prototype.setMenu = function (id) {
    this._menuId = id;
    this._focus = 0;
    this._applyFocus();
  };

  UI.prototype._applyFocus = function () {
    var ids;
    var el;
    Object.keys(UI.MENUS).forEach(function (menu) {
      UI.MENUS[menu].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) b.classList.remove("nav-focus");
      });
    });
    if (!this._menuId || !UI.MENUS[this._menuId]) return;
    ids = UI.MENUS[this._menuId];
    if (this._focus < 0) this._focus = ids.length - 1;
    if (this._focus >= ids.length) this._focus = 0;
    el = document.getElementById(ids[this._focus]);
    if (el) {
      el.classList.add("nav-focus");
      try {
        el.focus({ preventScroll: true });
      } catch (e) {
        el.focus();
      }
    }
  };

  UI.prototype.handleNav = function (input) {
    if (!this._menuId || !input) return;
    var ids = UI.MENUS[this._menuId];
    if (!ids || !ids.length) return;
    var n = ids.length;
    if (input.menuRight || input.menuDown) {
      this._focus = (this._focus + 1) % n;
      this._applyFocus();
      if (this.game.audio) this.game.audio.ui();
    } else if (input.menuLeft || input.menuUp) {
      this._focus = (this._focus - 1 + n) % n;
      this._applyFocus();
      if (this.game.audio) this.game.audio.ui();
    }
    if (input.menuConfirm) {
      var el = document.getElementById(ids[this._focus]);
      if (el) el.click();
    }
    if (input.menuBack) {
      if (this._menuId === "how" || this._menuId === "scores") {
        this.showTitle();
      } else if (this._menuId === "pause") {
        this.game.togglePause(false);
      }
    }
  };

  UI.prototype.refreshHigh = function () {
    this._hi = BB.Score.loadHigh();
    if (this.el.hiscore) this.el.hiscore.textContent = M.formatScore(this._hi);
    if (this.el.best) this.el.best.textContent = M.formatScore(this._hi);
  };

  UI.prototype.hideAll = function () {
    ["boot", "title", "how", "scores", "pause", "over"].forEach(function (k) {
      var el = document.getElementById(k);
      if (el) el.classList.add("hidden");
    });
  };

  UI.prototype.showTitle = function () {
    this.hideAll();
    document.body.classList.add("menu-open");
    if (this.el.title) this.el.title.classList.remove("hidden");
    if (this.el.hud) this.el.hud.classList.remove("on");
    this.setMenu("title");
    this.refreshHigh();
  };

  UI.prototype.showHow = function () {
    this.hideAll();
    document.body.classList.add("menu-open");
    if (this.el.how) this.el.how.classList.remove("hidden");
    this.setMenu("how");
  };

  UI.prototype.showScores = function () {
    this.hideAll();
    document.body.classList.add("menu-open");
    if (this.el.scores) this.el.scores.classList.remove("hidden");
    this.setMenu("scores");
    this._renderScores();
  };

  UI.prototype._renderScores = function () {
    var box = document.getElementById("score-list");
    if (!box) return;
    var list = BB.Score.loadList();
    var html =
      '<div class="score-row head"><span>#</span><span>Score</span><span>Range</span><span>Time</span></div>';
    var i;
    var row;
    if (!list.length) {
      html += '<div class="score-row"><span>—</span><b>NO RECORDS</b><span>RUN UNLOGGED</span><span></span></div>';
    } else {
      for (i = 0; i < list.length; i++) {
        row = list[i];
        html +=
          '<div class="score-row"><span>' +
          (i + 1) +
          "</span><b>" +
          M.formatScore(row.score) +
          "</b><span>" +
          row.dist +
          " M</span><span>" +
          M.formatTime(row.time) +
          "</span></div>";
      }
    }
    box.innerHTML = html;
  };

  UI.prototype.showPlay = function () {
    this.hideAll();
    document.body.classList.remove("menu-open");
    if (this.el.hud) this.el.hud.classList.add("on");
    this._menuId = null;
    this.refreshHigh();
  };

  UI.prototype.showPause = function (on) {
    if (this.el.pause) this.el.pause.classList.toggle("hidden", !on);
    document.body.classList.toggle("menu-open", on);
    var mute = document.getElementById("btn-mute-pause");
    if (mute && this.game && this.game.audio) {
      mute.textContent = this.game.audio.muted ? "Unmute" : "Mute";
    }
    if (on) this.setMenu("pause");
  };

  UI.prototype.showOver = function (stats) {
    this.hideAll();
    document.body.classList.add("menu-open");
    if (this.el.over) this.el.over.classList.remove("hidden");
    if (this.el.hud) this.el.hud.classList.remove("on");
    var hi = BB.Score.saveHigh(stats.score);
    BB.Score.pushList(stats);
    if (this.el.overScore) this.el.overScore.textContent = M.formatScore(stats.score);
    if (this.el.overDist) this.el.overDist.textContent = Math.floor(stats.distance) + " M";
    if (this.el.overTime) this.el.overTime.textContent = M.formatTime(stats.time);
    if (this.el.hiscoreOver) this.el.hiscoreOver.textContent = M.formatScore(hi);
    if (this.el.overMult) this.el.overMult.textContent = M.formatMult(stats.peakMult || 1);
    if (this.el.flavor) this.el.flavor.textContent = UI.flavor(stats);
    if (this.el.copyStatus) this.el.copyStatus.textContent = "";
    this._lastSnap = stats;
    this.setMenu("over");
    this.refreshHigh();
  };

  UI.flavor = function (s) {
    if (s.score > 40000) return "Helix Arc blinked first. The Devil is scrap. RUNNER-01 remains unlisted.";
    if (s.distance > 2500) return "A long white scar through the vault. Spent cells. The units are still following.";
    if (s.time < 12) return "Contact at the airlock. The rail never left the holster.";
    return "Signal cut. Suit integrity zero. The score is frozen.";
  };

  UI.prototype.copyScore = function () {
    var s = this._lastSnap;
    var text;
    var status = this.el.copyStatus;
    if (!s) return;
    text =
      "BASEBREAKER v" +
      BB.VERSION +
      "\nSCORE " +
      Math.floor(s.score) +
      "\nDIST " +
      Math.floor(s.distance) +
      "m  TIME " +
      M.formatTime(s.time) +
      "\nMULT PEAK " +
      M.formatMult(s.peakMult || 1);
    function ok() {
      if (status) status.textContent = "SCORE COPIED";
    }
    function fail() {
      if (status) status.textContent = "COPY FAILED — SELECT MANUALLY";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(function () {
        UI._fallbackCopy(text) ? ok() : fail();
      });
    } else {
      UI._fallbackCopy(text) ? ok() : fail();
    }
  };

  UI._fallbackCopy = function (text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  };

  UI.prototype.toast = function (msg) {
    if (!this.el.toast) return;
    this.el.toast.textContent = msg;
    this.el.toast.classList.add("show");
    this._toastT = 1.5;
  };

  UI.prototype.update = function (dt, state) {
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0 && this.el.toast) this.el.toast.classList.remove("show");
    }
    if (!state || !state.playing) return;

    if (this.el.score) this.el.score.textContent = M.formatScore(state.score);
    if (this.el.mult) {
      this.el.mult.textContent = M.formatMult(state.mult);
      this.el.mult.classList.toggle("hot", state.mult >= 2);
    }
    if (this.el.dist) this.el.dist.textContent = Math.floor(state.distance) + " M";
    if (this.el.speed) this.el.speed.textContent = String(Math.round(state.speed / 10));
    if (this.el.sector) {
      var sec = (state.sector || 0) + 1;
      this.el.sector.textContent = sec < 10 ? "0" + sec : String(sec);
    }
    if (this.el.sectorName) this.el.sectorName.textContent = state.sectorName || "RING ACCESS";
    if (this.el.flowBar) {
      this.el.flowBar.style.transform = "scaleX(" + BB.math.clamp(state.flow || 0, 0, 1) + ")";
    }
    if (this.el.flowVal) {
      this.el.flowVal.textContent = String(Math.round((state.flow || 0) * 100));
    }
    if (this.el.threat) {
      var label = "QUIET";
      var hot = false;
      if (state.fallen) {
        label = "STUMBLE";
        hot = true;
      } else if (state.threat >= 4) {
        label = "DEVIL";
        hot = true;
      } else if (state.threat >= 3) {
        label = "CONTACT";
        hot = true;
      } else if (state.threat === 2) {
        label = "HUNT";
        hot = true;
      } else if (state.threat === 1) {
        label = "PROXIMITY";
      }
      this.el.threat.textContent = label;
      this.el.threat.classList.toggle("hot", hot);
    }
    if (this.el.boostLab) {
      if (state.boostKind) {
        var name = state.boostKind === "aegis" ? "AEGIS" : state.boostKind === "over" ? "OVERDRIVE" : "SURGE";
        var left = Math.max(0, state.boostT || 0).toFixed(1);
        this.el.boostLab.textContent = name + "  " + left + "S";
        this.el.boostLab.classList.add("hot");
      } else {
        this.el.boostLab.textContent = "";
        this.el.boostLab.classList.remove("hot");
      }
    }
    if (this.el.ammoBar || this.el.ammoVal) {
      var ammo = state.ammo || 0;
      var ammoMax = state.ammoMax || 12;
      var ratio = ammoMax > 0 ? ammo / ammoMax : 0;
      if (this.el.ammoBar) this.el.ammoBar.style.transform = "scaleX(" + BB.math.clamp(ratio, 0, 1) + ")";
      if (this.el.ammoVal) {
        this.el.ammoVal.textContent = (ammo < 10 ? "0" : "") + ammo;
      }
      if (this.el.ammoWrap) this.el.ammoWrap.classList.toggle("empty", !!state.dry || ammo <= 0);
    }
  };

  BB.UI = UI;
})(typeof window !== "undefined" ? window : globalThis);
