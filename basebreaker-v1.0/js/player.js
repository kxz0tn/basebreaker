/**
 * BASEBREAKER — Player (RUNNER-01)
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Semi-implicit Euler: v += a·dt; x += v·dt.
 *
 * ROLL — parkour slide from first principles:
 *   drop:  crouch 0→1 in t = sqrt(2 Δh / g)
 *   slide: a = −μ g  (kinetic friction), vx floored so momentum lives
 *   rise:  crouch 1→0, a toward targetVx
 * Hitbox height tracks crouch; it is low enough to clear lintels only
 * after crouch ≥ rollCrouchHit.
 *
 * IMPACT (stance FALL) — upright hitch:
 *   vx ← rest * vx, then a = impactAccel until vx ≈ targetVx.
 * No lie-down. Hunt reads the slower vx and closes. That is the punish.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  var STANCE = {
    RUN: "run",
    AIR: "air",
    ROLL: "roll",
    FALL: "fall",
    DEAD: "dead"
  };

  function Player() {
    this.reset();
  }

  Player.prototype.reset = function () {
    var P = BB.CONFIG.player;
    this.x = 0;
    this.y = BB.CONFIG.world.ground;
    this.px = 0;
    this.py = this.y;
    this.vx = BB.CONFIG.run.startSpeed;
    this.vy = 0;
    this.w = P.w;
    this.h = P.h;
    this.stance = STANCE.RUN;
    this.grounded = true;
    this.rolling = false;
    this.rollAge = 0;
    this.rollPhase = "";
    this.crouch = 0;
    this.visCrouch = 0;
    this.targetVx = BB.CONFIG.run.startSpeed;
    this.iframe = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.phase = 0;
    this.alive = true;
    this.deadT = 0;
    this.landDust = 0;
    this.wasGrounded = true;
    this.jumpHeld = false;
    this.coyoteBonus = 0;
    this.fallT = 0;
    this.boostKind = null;
    this.boostT = 0;
    this.boostMax = 0;
    this.scrape = 0;
    this._holdT = 0;
  };

  Player.prototype.rollHold = function () {
    var P = BB.CONFIG.player;
    var v = Math.max(this.vx, 200);
    if (this._holdT > 0) return this._holdT;
    return Math.max(P.rollMinT, P.rollClearPx / v);
  };

  Player.prototype.rollDuration = function () {
    var P = BB.CONFIG.player;
    return P.rollDrop + this.rollHold() + P.rollRise;
  };

  Player.prototype._syncRollPhase = function () {
    var P = BB.CONFIG.player;
    var hold = this.rollHold();
    if (this.rollAge < P.rollDrop) this.rollPhase = "drop";
    else if (this.rollAge < P.rollDrop + hold) this.rollPhase = "slide";
    else this.rollPhase = "rise";
  };

  Player.prototype.lowHit = function () {
    return this.stance === STANCE.ROLL && this.crouch >= BB.CONFIG.player.rollCrouchHit;
  };

  Player.prototype.hitbox = function () {
    var P = BB.CONFIG.player;
    if (this.stance === STANCE.ROLL) {
      return {
        x: this.x - P.rollW * 0.3,
        y: this.y - P.rollH,
        w: P.rollW,
        h: P.rollH
      };
    }
    return {
      x: this.x - P.w * 0.35,
      y: this.y - P.h,
      w: P.w,
      h: P.h
    };
  };

  Player.prototype.requestJump = function () {
    this.buffer = BB.CONFIG.player.jumpBuffer;
  };

  Player.prototype.requestRoll = function () {
    var P = BB.CONFIG.player;
    if (!this.alive) return false;
    if (this.stance === STANCE.ROLL || this.stance === STANCE.FALL) return false;
    var grounded = this.grounded || this.coyote > 0;
    this.stance = STANCE.ROLL;
    this.rolling = true;
    this.rollAge = 0;
    this._holdT = 0;
    this._holdT = this.rollHold();
    this.crouch = 1;
    this.visCrouch = 0.85;
    this._syncRollPhase();
    this.iframe = grounded ? P.rollIFrame : P.rollAirIFrame;
    return true;
  };

  Player.prototype.knockdown = function () {
    var P = BB.CONFIG.player;
    if (!this.alive || this.stance === STANCE.DEAD) return false;
    if (this.stance === STANCE.FALL) {
      this.vx *= 0.92;
      this.fallT = 0;
      return true;
    }
    this.stance = STANCE.FALL;
    this.rolling = false;
    this.rollPhase = "";
    this.crouch = 0;
    this.fallT = 0;
    this.vx *= P.impactRest;
    if (this.vy < 0) this.vy = 0;
    this.iframe = Math.max(this.iframe, P.impactIFrame);
    this.buffer = 0;
    return true;
  };

  Player.prototype.giveBoost = function (kind) {
    var B = BB.CONFIG.boost;
    this.boostKind = kind;
    if (kind === "surge") this.boostMax = B.surgeTime;
    else if (kind === "aegis") this.boostMax = B.aegisTime;
    else this.boostMax = B.overTime;
    this.boostT = this.boostMax;
    if (kind === "aegis") this.iframe = Math.max(this.iframe, B.aegisTime);
  };

  Player.prototype.update = function (dt, input, world, particles) {
    var P = BB.CONFIG.player;
    var ev = {
      jumped: false,
      rolled: false,
      landed: false,
      fell: false,
      recovered: false,
      boostEnd: null
    };

    this.px = this.x;
    this.py = this.y;

    if (!this.alive) {
      this.stance = STANCE.DEAD;
      this.deadT += dt;
      this.vy += P.gravity * dt;
      this.y += this.vy * dt;
      return ev;
    }

    if (this.boostT > 0) {
      this.boostT = Math.max(0, this.boostT - dt);
      if (this.boostKind === "aegis") this.iframe = Math.max(this.iframe, 0.05);
      if (this.boostT <= 0) {
        ev.boostEnd = this.boostKind;
        this.boostKind = null;
      }
    }

    this.jumpHeld = !!input.jumpHeld;
    this.iframe = Math.max(0, this.iframe - dt);
    this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? P.coyote + (this.coyoteBonus || 0) : Math.max(0, this.coyote - dt);

    var stunned = this.stance === STANCE.FALL && this.fallT < 0.06;

    if (!stunned) {
      if (input.jump) this.requestJump();
      if (input.roll && this.stance !== STANCE.FALL) {
        if (this.requestRoll()) ev.rolled = true;
      }
    }

    if (this.stance !== STANCE.FALL) this._tryJump(P, ev);

    if (this.stance === STANCE.ROLL) this._stepRoll(dt, P, particles);
    if (this.stance === STANCE.FALL) this._stepImpact(dt, P, ev);

    var g = P.gravity;
    if (this.stance === STANCE.AIR && this.vy < 0 && !this.jumpHeld) {
      g = P.gravity * P.jumpCut;
    }
    this.vy += g * dt;
    if (this.vy > P.maxFall) this.vy = P.maxFall;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this._resolveGround(world, ev, P);
    this._resolveCeiling(world, P);

    this.phase += dt * (this.grounded && this.stance === STANCE.RUN ? this.vx * 0.018 : 8);

    if (this.grounded && this.stance === STANCE.RUN) {
      this.landDust += dt;
      if (this.landDust > 0.045) {
        this.landDust = 0;
        particles.dust(this.x - 8, this.y - 2, 1);
      }
    }

    if (ev.jumped) particles.thruster(this.x - 10, this.y - 18, 10);
    else if (this.stance === STANCE.AIR && this.vy < -40) {
      particles.thruster(this.x - 10, this.y - 18, 2);
    }

    return ev;
  };

  Player.prototype._stepRoll = function (dt, P, particles) {
    var tgt = this.targetVx || this.vx;
    var floor = tgt * P.rollFloor;
    var aFric;
    this.rollAge += dt;
    this._syncRollPhase();

    this.crouch = 1;
    if (this.rollPhase === "drop") {
      this.visCrouch = 0.75 + 0.25 * BB.math.saturate(this.rollAge / P.rollDrop);
    } else if (this.rollPhase === "slide") {
      this.visCrouch = 1;
      if (this.grounded) {
        aFric = P.rollMu * P.gravity;
        this.vx -= aFric * dt;
        if (this.vx < floor) this.vx = floor;
      }
    } else {
      this.visCrouch = BB.math.saturate(1 - (this.rollAge - P.rollDrop - this.rollHold()) / P.rollRise);
      if (this.vx < tgt) {
        this.vx += ((tgt - this.vx) / Math.max(P.rollRise, dt)) * dt;
        if (this.vx > tgt) this.vx = tgt;
      }
    }

    if (this.rollAge >= this.rollDuration()) {
      this.rolling = false;
      this.rollPhase = "";
      this.crouch = 0;
      this.visCrouch = 0;
      this._holdT = 0;
      this.vx = tgt;
      this.stance = this.grounded ? STANCE.RUN : STANCE.AIR;
    } else if (this.grounded && this.rollPhase === "slide") {
      this.scrape += dt;
      if (this.scrape > 0.028) {
        this.scrape = 0;
        particles.dust(this.x + 8, this.y - 2, 1);
        particles.dust(this.x - 4, this.y - 1, 1);
      }
    }
  };

  Player.prototype._stepImpact = function (dt, P, ev) {
    var tgt = this.targetVx || this.vx;
    this.fallT += dt;
    this.vx += P.impactAccel * dt;
    if (this.vx > tgt) this.vx = tgt;
    if (this.fallT >= P.impactMin && this.vx >= tgt * 0.92) {
      this.vx = tgt;
      this.stance = this.grounded ? STANCE.RUN : STANCE.AIR;
      ev.recovered = true;
    }
  };

  Player.prototype._tryJump = function (P, ev) {
    if (this.buffer <= 0) return;
    if (this.stance === STANCE.FALL) return;
    if (this.stance === STANCE.ROLL) return;
    if (!(this.grounded || this.coyote > 0)) return;

    this.vy = P.jumpImpulse;
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.rolling = false;
    this.rollPhase = "";
    this.stance = STANCE.AIR;
    this.jumpHeld = true;
    ev.jumped = true;
  };

  Player.prototype._resolveGround = function (world, ev, P) {
    var hb = this.hitbox();
    var ground = world.groundUnder(hb.x + 2, hb.x + hb.w - 2, this.y);
    this.wasGrounded = this.grounded;

    if (ground !== null && this.vy >= 0 && this.py <= ground + 4 && this.y >= ground) {
      if (!this.grounded && this.vy > 180) ev.landed = true;
      this.y = ground;
      this.vy = 0;
      this.grounded = true;
      if (this.stance === STANCE.AIR) this.stance = STANCE.RUN;
    } else if (ground === null) {
      this.grounded = false;
      if (this.stance === STANCE.RUN) this.stance = STANCE.AIR;
    } else if (this.y < ground - 2) {
      this.grounded = false;
      if (this.stance === STANCE.RUN) this.stance = STANCE.AIR;
    }
  };

  Player.prototype._resolveCeiling = function (world, P) {
    var ceil = world.ceilingAt(this.x);
    var top = this.y - (this.lowHit() ? P.rollH : P.h);
    if (ceil !== null && top < ceil) {
      this.y = ceil + (this.lowHit() ? P.rollH : P.h);
      if (this.vy < 0) this.vy = 0;
    }
  };

  Player.prototype.kill = function () {
    this.alive = false;
    this.stance = STANCE.DEAD;
    this.deadT = 0;
    this.vy = -220;
  };

  Player.prototype.draw = function (ctx, camX, t) {
    var sx = this.x - camX;
    var sy = this.y;

    ctx.save();
    ctx.translate(sx, sy);

    if (!this.alive) {
      ctx.globalAlpha = Math.max(0, 1 - this.deadT * 1.6);
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
    }

    if (this.stance === STANCE.FALL) {
      this._drawStagger(ctx, t);
      ctx.restore();
      if (this.boostKind) this._boostAura(ctx, sx, sy, t);
      return;
    }

    if (this.stance === STANCE.ROLL) {
      this._drawSlide(ctx);
      ctx.restore();
      if (this.boostKind) this._boostAura(ctx, sx, sy, t);
      return;
    }

    var run = Math.sin(this.phase * BB.math.TAU);
    var run2 = Math.sin(this.phase * BB.math.TAU + Math.PI);
    var air = this.stance === STANCE.AIR;
    var legA = air ? 0.35 : run * 0.55;
    var legB = air ? 0.15 : run2 * 0.55;
    var armA = air ? -0.5 : run2 * 0.4;
    var bob = this.grounded ? Math.abs(run) * 1.4 : 0;

    ctx.translate(0, -bob);
    this._drawBody(ctx, t, air, armA);
    this._leg(ctx, -4, -18, legA, air);
    this._leg(ctx, 4, -18, legB, air);
    ctx.restore();

    if (this.iframe > 0 && this.alive) this._iframeRing(ctx, sx, sy);
    if (this.boostKind) this._boostAura(ctx, sx, sy, t);
  };

  Player.prototype._drawBody = function (ctx, t, air, armA) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(-16, -40, 8, 22);
    ctx.fillRect(-14, -18, 4, 5);
    ctx.fillRect(-17, -16, 3, 4);
    ctx.fillRect(-12, -16, 3, 4);
    ctx.fillStyle = "#000";
    ctx.fillRect(-14, -36, 4, 10);

    ctx.save();
    ctx.translate(-2, -34);
    ctx.rotate(armA * 0.6 + 0.2);
    ctx.fillStyle = "#cfcfcf";
    ctx.fillRect(-2, 0, 4, 16);
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(-8, -44);
    ctx.lineTo(10, -44);
    ctx.lineTo(12, -18);
    ctx.lineTo(-10, -18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillRect(-4, -40, 10, 2);
    ctx.fillRect(-3, -34, 8, 2);
    ctx.fillRect(-2, -28, 6, 5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-1, -26, 4, 1);

    ctx.save();
    ctx.translate(8, -34);
    ctx.rotate(air ? -0.15 : armA * 0.25);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-2, 0, 4, 16);
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(2, -54, 12, 0, BB.math.TAU);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillRect(-6, -58, 16, 7);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-4, -56, 12, 2);
    ctx.fillRect(12, -62, 2, 8);
    ctx.fillRect(11, -64, 4, 2);
    ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.1;
    ctx.fillRect(-3, -57, 3, 1);
    ctx.globalAlpha = 1;
  };

  Player.prototype._drawSlide = function (ctx) {
    var u = this.visCrouch;
    var lift = (1 - u) * 16;
    ctx.translate(6, -11 - lift);
    ctx.rotate(0.12 * (1 - u));
    ctx.fillStyle = "#fff";
    ctx.fillRect(-16, -6, 32, 11);
    ctx.fillRect(-4, -11, 12, 7);
    ctx.beginPath();
    ctx.arc(14, -2, 7, 0, BB.math.TAU);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillRect(8, -5, 11, 4);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-20, -2, 6, 5);
    ctx.fillRect(18, 1, 8, 3);
    ctx.globalAlpha = 0.3 * u;
    ctx.fillRect(-22, 5, 14, 2);
  };

  Player.prototype._drawStagger = function (ctx, t) {
    var tgt = this.targetVx || 1;
    var lost = BB.math.saturate(1 - this.vx / tgt);
    var run = Math.sin(this.phase * BB.math.TAU);
    var run2 = Math.sin(this.phase * BB.math.TAU + Math.PI);
    ctx.translate(Math.sin(t * 22) * lost * 2, -Math.abs(run) * 1.2);
    ctx.rotate(0.16 * lost);
    this._drawBody(ctx, t, false, run2 * 0.35);
    this._leg(ctx, -4, -18, run * 0.5, false);
    this._leg(ctx, 4, -18, run2 * 0.5, false);
  };

  Player.prototype._iframeRing = function (ctx, sx, sy) {
    var P = BB.CONFIG.player;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(sx - P.rollW * 0.4, sy - P.rollH - 4, P.rollW + 4, P.rollH + 4);
    ctx.restore();
  };

  Player.prototype._boostAura = function (ctx, sx, sy, t) {
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.sin(t * 14) * 0.08;
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(sx - 22, sy - 64, 44, 68);
    ctx.restore();
  };

  Player.prototype._leg = function (ctx, x, y, swing, air) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(swing);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-3, 0, 6, air ? 12 : 16);
    ctx.translate(0, air ? 12 : 16);
    ctx.rotate(air ? 0.6 : Math.max(0, -swing) * 0.8);
    ctx.fillRect(-3, 0, 6, 14);
    ctx.fillRect(-4, 12, 10, 4);
    ctx.restore();
  };

  Player.STANCE = STANCE;
  BB.Player = Player;
})(typeof window !== "undefined" ? window : globalThis);
