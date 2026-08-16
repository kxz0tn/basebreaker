/**
 * BASEBREAKER — Game loop
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Owns state, systems, and the rAF tick. Physics is delta-time based
 * and clamped so a backgrounded tab cannot tunnel the astronaut
 * through a laser on resume.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.quality = BB.detectQuality();
    this.input = new BB.Input(canvas);
    this.audio = new BB.AudioEngine();
    this.particles = new BB.Particles(this.quality);
    this.projectiles = new BB.Projectiles();
    this.player = new BB.Player();
    this.aliens = new BB.Aliens();
    this.hazards = new BB.Hazards();
    this.world = new BB.World();
    this.fx = new BB.FX();
    this.score = new BB.Score();
    this.flow = new BB.Flow();
    this.ui = new BB.UI(this);

    this.state = "boot";
    this.playing = false;
    this.paused = false;
    this.overT = 0;
    this.crawlerT = 0;
    this.sentinelT = 0;
    this.elapsed = 0;
    this.last = 0;
    this.acc = 0;
    this.chaseCD = 0;
    this.menuCam = 0;
    this._boundFrame = this.frame.bind(this);
    this._touch = /Mobi|Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent || "") ||
      (navigator.maxTouchPoints || 0) > 1;

    this.input.bindPads(
      document.getElementById("pad-jump"),
      document.getElementById("pad-roll")
    );

    this._resize();
    var self = this;
    function onView() {
      self._resize();
    }
    window.addEventListener("resize", onView);
    window.addEventListener("orientationchange", onView);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onView);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && self.state === "play") self.togglePause(true);
    });

    this.world.reset(((Math.random() * 0xffffffff) | 0));
    this._bootThenTitle();
    requestAnimationFrame(this._boundFrame);
  }

  Game.prototype._viewSize = function () {
    var vv = window.visualViewport;
    return {
      w: vv && vv.width ? vv.width : window.innerWidth || BB.VIEW_W,
      h: vv && vv.height ? vv.height : window.innerHeight || BB.VIEW_H
    };
  };

  Game.prototype._applyOrient = function () {
    var el = document.getElementById("rotate");
    var view;
    var portrait;
    var block;
    if (!el) return;
    view = this._viewSize();
    portrait = view.h > view.w;
    block = !!this._touch && portrait;
    el.classList.toggle("show", block);
    if (block && this.state === "play") this.togglePause(true);
  };

  Game.prototype._resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var cap = this.quality === "low" ? BB.CONFIG.renderer.lowPixelRatio : BB.CONFIG.renderer.maxPixelRatio;
    var view;
    var scale;
    if (dpr > cap) dpr = cap;
    var canvas = this.canvas;
    canvas.width = (BB.VIEW_W * dpr) | 0;
    canvas.height = (BB.VIEW_H * dpr) | 0;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    view = this._viewSize();
    scale = Math.min(view.w / BB.VIEW_W, view.h / BB.VIEW_H);
    canvas.style.width = BB.VIEW_W * scale + "px";
    canvas.style.height = BB.VIEW_H * scale + "px";
    this._applyOrient();
  };

  Game.prototype._bootThenTitle = function () {
    var log = document.getElementById("boot-log");
    var lines = [
      ["CANVAS 2D CONTEXT", true],
      ["PALETTE LOCK  MONOCHROME", true],
      ["RUNNER-01  GEOMETRY", true],
      ["HELIX ARC  LOCKDOWN", true],
      ["SECURITY GRID  ONLINE", true],
      ["AUDIO  SYNTHESIZED", true],
      ["BUILD  v" + BB.VERSION, true]
    ];
    var i = 0;
    var self = this;
    function step() {
      if (i < lines.length && log) {
        var row = document.createElement("div");
        row.className = lines[i][1] ? "ok" : "";
        row.textContent = (lines[i][1] ? "[ OK ]  " : "[ .. ]  ") + lines[i][0];
        log.appendChild(row);
        i += 1;
        setTimeout(step, 90);
      } else {
        setTimeout(function () {
          self.gotoTitle();
        }, 280);
      }
    }
    setTimeout(step, 160);
  };

  Game.prototype.gotoTitle = function () {
    this.state = "title";
    this.playing = false;
    this.paused = false;
    this.input.showTouch(false);
    this.audio.setRunning(false, 0);
    this.ui.showTitle();
  };

  Game.prototype.startRun = function () {
    this.audio.unlock();
    var seed = ((Math.random() * 0xffffffff) | 0) ^ (Date.now() & 0xffff);
    this.world.reset(seed);
    this.player.reset();
    this.aliens.reset();
    this.projectiles.reset();
    this.particles.pool.killAll();
    this.score.reset();
    this.flow.reset();
    this.elapsed = 0;
    this.overT = 0;
    this.crawlerT = 7.4;
    this.sentinelT = 10.5;
    this.chaseCD = 0;
    this.acc = 0;
    this.last = 0;
    this.playing = true;
    this.paused = false;
    this.state = "play";
    this.input.showTouch(this._touch);
    this.ui.showPlay();
    this.ui.toast("LOCKDOWN BREACH");
    this.audio.setRunning(true, 0);
  };

  Game.prototype.togglePause = function (on) {
    if (this.state !== "play" && this.state !== "pause") return;
    if (on === undefined) on = !this.paused;
    this.paused = !!on;
    this.state = this.paused ? "pause" : "play";
    this.ui.showPause(this.paused);
    if (!this.paused) {
      this.ui.showPlay();
      this.last = 0;
      this.acc = 0;
    }
    this.audio.setRunning(!this.paused && this.playing, this._speedNorm());
  };

  Game.prototype._baseSpeed = function () {
    var R = BB.CONFIG.run;
    return Math.min(R.maxSpeed, R.startSpeed + this.elapsed * R.accelPerSec + this.score.distance * R.distAccel);
  };

  Game.prototype._speed = function () {
    return this._baseSpeed() * (this.flow ? this.flow.speedMul() : 1);
  };

  Game.prototype._speedNorm = function () {
    var R = BB.CONFIG.run;
    return BB.math.saturate((this._speed() - R.startSpeed) / (R.maxSpeed - R.startSpeed));
  };

  Game.prototype._difficulty = function () {
    return BB.math.saturate(this.elapsed / 90 + this.score.distance / 3500);
  };

  Game.prototype.frame = function (now) {
    if (!this.last) this.last = now;
    var dt = (now - this.last) / 1000;
    this.last = now;
    if (dt < 0) dt = 0;
    if (dt > 0.25) dt = 0.25;

    this.input.setMenuMode(this.state !== "play");
    this.input.poll(dt);
    this._handleGlobal();

    if (this.state === "play" && !this.paused) {
      var step = BB.CONFIG.sim.step;
      var n = 0;
      this.acc += dt;
      while (this.acc >= step && n < BB.CONFIG.sim.maxSteps) {
        this.update(step);
        this.acc -= step;
        n += 1;
      }
      if (n >= BB.CONFIG.sim.maxSteps) this.acc = 0;
    } else {
      this.acc = 0;
      this.updateMenu(Math.min(dt, 0.033));
    }

    this.draw();
    requestAnimationFrame(this._boundFrame);
  };

  Game.prototype._handleGlobal = function () {
    if (this.input.mutePressed) {
      this.audio.setMuted(!this.audio.muted);
      this.ui.toast(this.audio.muted ? "AUDIO MUTE" : "AUDIO LIVE");
    }
    if (this.input.scanPressed) {
      var on = this.fx.toggleScan();
      this.ui.toast(on ? "SCAN ON" : "SCAN OFF");
    }
    if (this.input.pausePressed) {
      if (this.state === "play" || this.state === "pause") this.togglePause();
    }
    if (this.state !== "play") this.ui.handleNav(this.input);
  };

  Game.prototype.updateMenu = function (dt) {
    this.menuCam += dt * 80;
    this.world.camX = this.menuCam;
    this.world.chunks.ensure(this.menuCam);
    this.world.time += dt;
    this.particles.update(dt);
    this.fx.update(dt);
  };

  Game.prototype.update = function (dt) {
    var player = this.player;
    var speed = this._speed();
    var prevX = player.x;
    var hunt;
    if (player.boostKind === "surge") speed *= BB.CONFIG.boost.surgeMul;
    player.targetVx = speed;
    if (player.stance !== BB.Player.STANCE.ROLL && player.stance !== BB.Player.STANCE.FALL) {
      player.vx = speed;
    }
    player.coyoteBonus = this.flow.coyoteBonus();

    var ev = player.update(dt, this.input, this.world, this.particles);
    if (ev.jumped) {
      this.audio.jump();
      this.score.clean();
      if (this.world.hazardNear(player.x, 30, 200)) this.flow.feed("jump");
    }
    if (ev.rolled) {
      this.audio.roll();
      this.score.clean();
      if (this.world.hazardNear(player.x, 20, 160)) this.flow.feed("roll");
    }
    if (ev.boostEnd) this.ui.toast("BOOST END");

    this.elapsed += dt;
    this.flow.tick(dt);
    this.world.update(dt, player.x, this._difficulty(), this.score.distance);
    this.projectiles.update(dt, this.world.camX);

    hunt = {
      flow: this.flow.value,
      shock: this.flow.shock,
      fallen: player.stance === BB.Player.STANCE.FALL
    };
    this.aliens.update(dt, this.world, player, this.projectiles, hunt);
    this._spawn(dt, speed);
    this._collisions();
    if (player.alive) {
      this.particles.speedLines(player.x, this.world.camX, this.flow.value, speed);
    }
    this.particles.update(dt);
    this.fx.setFlow(this.flow.value);
    this.fx.update(dt);

    if (player.alive) {
      this.score.tick(dt, Math.max(0, player.x - prevX) / 10, player.boostKind === "over");
    } else {
      this.overT += dt;
      if (this.overT > 1.05 && this.state === "play") this._endRun();
    }

    this.audio.setRunning(player.alive && !this.paused, this._speedNorm());
    this.ui.update(dt, this._hudState());
  };

  Game.prototype._spawn = function (dt, speed) {
    var self = this;
    var A = BB.CONFIG.hunt;
    var want;
    if (!this.player.alive) return;

    this.chaseCD = Math.max(0, this.chaseCD - dt);
    if (this.elapsed >= A.firstHunt && this.chaseCD <= 0) {
      want = 1;
      if (this._difficulty() >= A.secondAt && this.flow.value < 0.35) want = A.maxChasers;
      while (this.aliens.countType(0) < want) {
        if (
          !this.aliens.spawn(
            0,
            this.player.x - A.spawnBehind - this.aliens.countType(0) * 80,
            BB.CONFIG.world.ground,
            speed
          )
        ) {
          break;
        }
      }
    }

    this.crawlerT -= dt;
    if (this.crawlerT <= 0 && this.aliens.countType(1) < (this.flow.value > 0.55 ? 1 : 2)) {
      this.aliens.spawn(
        1,
        this.player.x + 400 + Math.random() * 100,
        BB.CONFIG.world.ceiling + 22,
        speed
      );
      this.crawlerT = A.crawlerInterval - this._difficulty() * 1.4;
    }

    this.sentinelT -= dt;
    if (this.sentinelT <= 0 && this.aliens.countType(2) < 1) {
      this.aliens.spawn(
        2,
        this.player.x + A.sentinelLead + 40,
        300 + Math.random() * 80,
        speed
      );
      this.sentinelT = A.sentinelInterval - this._difficulty() * 1.2;
    }

    this.world.chunks.forSpawners(function (s) {
      if (s.x < self.world.camX + BB.VIEW_W + 40 && s.x > self.player.x + 120) {
        s.fired = true;
        if (s.type === 0) return;
        var y = s.type === 1 ? BB.CONFIG.world.ceiling + 22 : s.y;
        if (s.type === 1 && self.aliens.countType(1) >= 2) return;
        if (s.type === 2 && self.aliens.countType(2) >= 1) return;
        self.aliens.spawn(s.type, s.x, y, speed);
      }
    });
  };

  Game.prototype._collisions = function () {
    var player = this.player;
    if (!player.alive) return;
    var hb = player.hitbox();
    var dx = player.x - player.px;
    var dy = player.y - player.py;
    var t = this.world.time;
    var pad = BB.CONFIG.score.nearMissPad;
    var self = this;
    var res;
    var i;
    var a;
    var ah;
    var p;
    var threat = 0;

    if (player.y > BB.VIEW_H + 10) {
      this._kill("pit");
      return;
    }

    this.world.chunks.forHazards(function (hz) {
      if (!player.alive) return;
      if (hz.type === "pit") return;
      if (hz.type === "boost" && !hz.taken) {
        if (BB.math.aabb(hb.x, hb.y, hb.w, hb.h, hz.x, hz.y, hz.w, hz.h)) {
          hz.taken = true;
          player.giveBoost(hz.kind || "surge");
          self.score.add(BB.CONFIG.score.boostGrab);
          self.flow.feed("break");
          self.particles.shatter(hz.x, hz.y, hz.w, hz.h);
          self.audio.ui();
          self.ui.toast(
            hz.kind === "aegis" ? "AEGIS" : hz.kind === "over" ? "OVERDRIVE" : "SURGE"
          );
        }
        return;
      }
      res = self.hazards.testSweep(hz, hb, dx, dy, t, pad);
      if (res === "hit") {
        if (player.iframe > 0 && (hz.type === "laser" || hz.type === "field" || hz.type === "slap" || hz.type === "pipe")) {
          return;
        }
        if (hz.type === "pipe" || hz.type === "slap") {
          if (player.knockdown()) {
            self.audio.impact();
            self.fx.nearMiss();
            self.world.shake = 0.6;
            self.particles.sparks(player.x, player.y - 20, 14);
            self.ui.toast("STUMBLE");
            self.flow.value = Math.max(0, self.flow.value * 0.35);
          }
          return;
        }
        self._kill(hz.type);
      } else if (res === "near" && !hz.tagged) {
        hz.tagged = true;
        self.score.nearMiss();
        self.flow.feed("near");
        self.fx.nearMiss();
        self.audio.near();
        self.ui.toast("NEAR MISS");
        threat = Math.max(threat, 2);
      }
    });
    if (!player.alive) return;

    for (i = 0; i < this.aliens.pool.alive.length; i++) {
      a = this.aliens.pool.alive[i];
      if (!a.alive) continue;
      ah = this.aliens.hitbox(a);
      if (Math.abs(a.x - player.x) < 280) threat = Math.max(threat, 2);
      if (a.intro > 0) continue;
      if (
        BB.math.aabbSweepRel(
          hb.x - dx,
          hb.y - dy,
          hb.w,
          hb.h,
          dx,
          dy,
          ah.x - (a.x - a.px),
          ah.y - (a.y - a.py),
          ah.w,
          ah.h,
          a.x - a.px,
          a.y - a.py
        )
      ) {
        if (player.iframe > 0) continue;
        this._kill("alien");
        return;
      }
      if (!a.nearMissed && BB.math.aabbPad(hb.x, hb.y, hb.w, hb.h, ah.x, ah.y, ah.w, ah.h, pad + 8)) {
        a.nearMissed = true;
        this.score.nearMiss();
        this.flow.feed("near");
        this.fx.nearMiss();
        this.audio.near();
        threat = 3;
      }
    }

    for (i = 0; i < this.projectiles.bolts.alive.length; i++) {
      p = this.projectiles.bolts.alive[i];
      if (!p.alive) continue;
      if (
        BB.math.aabbSweep(
          p.px,
          p.py,
          p.w,
          p.h,
          p.x - p.px,
          p.y - p.py,
          hb.x,
          hb.y,
          hb.w,
          hb.h
        )
      ) {
        if (player.iframe > 0) continue;
        p.alive = false;
        this._kill("bolt");
        return;
      }
    }

    this._threat = threat || (this.aliens.pool.alive.length ? 1 : 0);
  };

  Game.prototype._kill = function (reason) {
    if (!this.player.alive) return;
    this.score.freeze();
    this.player.kill();
    this.particles.deathGlitch(this.player.x, this.player.y);
    this.fx.hit();
    this.world.shake = 1;
    this.audio.death();
    this.ui.toast("CONTACT");
    this.overT = 0;
    this._killReason = reason;
  };

  Game.prototype._endRun = function () {
    this.state = "over";
    this.playing = false;
    this.input.showTouch(false);
    this.audio.setRunning(false, 0);
    this.ui.showOver(this.score.snapshot());
  };

  Game.prototype._hudState = function () {
    return {
      playing: this.state === "play",
      score: this.score.frozen ? this.score.final : this.score.value,
      mult: this.score.mult,
      distance: this.score.distance,
      speed: this.player.vx,
      threat: this._threat || 0,
      flow: this.flow.value,
      sectorName: this.world.sectorInfo().name,
      sector: this.world.sector,
      boostKind: this.player.boostKind,
      boostT: this.player.boostT,
      boostMax: this.player.boostMax,
      fallen: this.player.stance === BB.Player.STANCE.FALL
    };
  };

  Game.prototype.draw = function () {
    var ctx = this.ctx;
    var cam = this.world.camX;
    ctx.setTransform((this.canvas.width / BB.VIEW_W), 0, 0, (this.canvas.height / BB.VIEW_H), 0, 0);
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    this.world.applyShake(ctx);
    this.world.drawBackdrop(ctx, this.quality);
    this.world.drawCorridor(ctx, this.particles);
    this.world.chunks.forHazards(function (h) {
      this.hazards.draw(ctx, h, cam, this.world.time, this.particles);
    }.bind(this));
    this.aliens.draw(ctx, cam, this.world.time);
    this.projectiles.draw(ctx, cam);
    if (this.state === "play" || this.state === "pause" || this.state === "over") {
      this.player.draw(ctx, cam, this.world.time);
    } else {
      this._drawMenuRunner(ctx);
    }
    this.particles.draw(ctx, cam);
    ctx.restore();

    this.fx.draw(ctx);
  };

  Game.prototype._drawMenuRunner = function (ctx) {
    var p = this.player;
    p.x = this.world.camX + BB.CONFIG.world.playerScreenX;
    p.y = this.world.groundAt(p.x, BB.CONFIG.world.ground) || BB.CONFIG.world.ground;
    p.grounded = true;
    p.alive = true;
    p.rolling = false;
    p.stance = BB.Player.STANCE.RUN;
    p.phase += 0.016 * 8;
    p.draw(ctx, this.world.camX, this.world.time);
  };

  BB.Game = Game;
})(typeof window !== "undefined" ? window : globalThis);
