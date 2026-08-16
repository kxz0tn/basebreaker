/**
 * BASEBREAKER — Security units
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * Pure industrial silhouettes. No biology.
 *
 *   0 PURSUIT  — rear hunter. Same g as the runner. extra(vx) is a
 *                function of gap and flow, never a permanent lead.
 *   1 RAIL     — ceiling rail unit. Holds a lead, telegraphs, drops.
 *   2 SENTINEL — forward turret. Holds station ahead, charges, fires.
 *
 * Gap-band law (see CONFIG.hunt):
 *   target = lerp(comfort, max, flow)
 *   extra  = clamp(P * (gap - target))
 *   extra  <= (gap - minGap) / dt     // this step cannot enter minGap
 *   x      = max(x, player.x - minGap)
 * Rear units create pressure. They do not speed-kill.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  var TYPE = {
    CHASER: 0,
    CRAWLER: 1,
    SENTINEL: 2
  };

  function unitFactory() {
    return {
      alive: false,
      type: 0,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      w: 34,
      h: 28,
      hp: 1,
      t: 0,
      cd: 0,
      phase: 0,
      tagged: false,
      nearMissed: false,
      charging: 0,
      jumpCd: 0,
      intro: 0
    };
  }

  function Aliens() {
    this.pool = new BB.Pool(unitFactory, BB.CONFIG.combat.maxAliens);
  }

  Aliens.prototype.reset = function () {
    this.pool.killAll();
  };

  Aliens.prototype.countType = function (type) {
    var n = 0;
    var i;
    for (i = 0; i < this.pool.alive.length; i++) {
      if (this.pool.alive[i].alive && this.pool.alive[i].type === type) n += 1;
    }
    return n;
  };

  Aliens.prototype.spawn = function (type, x, y, speed) {
    if (this.pool.alive.length >= BB.CONFIG.combat.maxAliens) return null;
    var a = this.pool.spawn();
    a.type = type;
    a.x = x;
    a.y = y;
    a.px = x;
    a.py = y;
    a.vx = speed || 0;
    a.vy = 0;
    a.t = 0;
    a.cd = type === TYPE.SENTINEL ? 0.9 : 0.6;
    a.phase = Math.random() * 10;
    a.tagged = false;
    a.nearMissed = false;
    a.charging = 0;
    a.jumpCd = 0;
    a.intro = type === TYPE.CHASER ? 0.65 : 0.4;
    if (type === TYPE.CHASER) {
      a.w = 32;
      a.h = 26;
      a.hp = 1;
    } else if (type === TYPE.CRAWLER) {
      a.w = 30;
      a.h = 18;
      a.hp = 1;
    } else {
      a.w = 30;
      a.h = 36;
      a.hp = 2;
    }
    return a;
  };

  /**
   * @param {object} hunt { flow, shock, dt }
   */
  Aliens.prototype.update = function (dt, world, player, projectiles, hunt) {
    var list = this.pool.alive;
    var i;
    var a;
    hunt.dt = dt;
    for (i = 0; i < list.length; i++) {
      a = list[i];
      if (!a.alive) continue;
      a.px = a.x;
      a.py = a.y;
      a.t += dt;
      a.phase += dt;
      a.cd = Math.max(0, a.cd - dt);
      a.jumpCd = Math.max(0, a.jumpCd - dt);
      a.intro = Math.max(0, a.intro - dt);

      if (a.type === TYPE.CHASER) this._chase(a, dt, world, player, hunt);
      else if (a.type === TYPE.CRAWLER) this._rail(a, dt, world, player, projectiles, hunt);
      else this._sentinel(a, dt, player, projectiles, hunt);

      if (a.y > BB.VIEW_H + 80) a.alive = false;
      if (a.x < player.x - 620) a.alive = false;
    }
    this.pool.reclaim();
  };

  Aliens.prototype.targetGap = function (flow) {
    var H = BB.CONFIG.hunt;
    flow = BB.math.clamp(flow || 0, 0, 1);
    return BB.math.lerp(H.comfortGap, H.maxGap, flow);
  };

  Aliens.prototype._extra = function (gap, hunt) {
    var H = BB.CONFIG.hunt;
    var dt = hunt.dt || BB.CONFIG.sim.step;
    var extra;
    var maxCloseNow;

    if (hunt.fallen) {
      extra = H.fallMaxClose;
      maxCloseNow = (gap - H.fallMinGap) / dt;
    } else if (hunt.shock > 0) {
      extra = H.shockExtra;
      maxCloseNow = (gap - H.minGap) / dt;
    } else {
      extra = (gap - this.targetGap(hunt.flow)) * 0.55;
      extra = BB.math.clamp(extra, -H.maxFlee, H.maxClose);
      maxCloseNow = (gap - H.minGap) / dt;
    }

    if (maxCloseNow < 0) maxCloseNow = 0;
    if (extra > maxCloseNow) extra = maxCloseNow;
    return extra;
  };

  Aliens.prototype._chase = function (a, dt, world, player, hunt) {
    var P = BB.CONFIG.player;
    var H = BB.CONFIG.hunt;
    var gap = player.x - a.x;
    var extra = this._extra(gap, hunt);
    var desired = player.vx + extra;
    var ground;
    var scan;
    var eta;

    a.vx = BB.math.damp(a.vx, desired, hunt.fallen ? H.accel + 5 : H.accel, dt);
    a.x += a.vx * dt;
    if (hunt.fallen) {
      if (player.x - a.x < H.fallMinGap) a.x = player.x - H.fallMinGap;
    } else if (player.x - a.x < H.minGap) {
      a.x = player.x - H.minGap;
    }

    a.vy += P.gravity * dt;
    if (a.vy > P.maxFall) a.vy = P.maxFall;
    a.y += a.vy * dt;

    ground = world.groundAt(a.x, a.y);
    if (ground !== null && a.vy >= 0 && a.py <= ground + 6 && a.y >= ground) {
      a.y = ground;
      a.vy = 0;
      scan = world.scanAhead(a.x, Math.max(160, a.vx * 0.45));
      if (scan && a.jumpCd <= 0 && a.vx > 40) {
        eta = (scan.x - a.x) / a.vx;
        if (scan.type === "pit" && eta > 0 && eta < 0.4) {
          a.vy = P.jumpImpulse;
          a.jumpCd = 0.65;
        } else if (scan.type === "barrier" && eta > 0 && eta < 0.3) {
          a.vy = P.jumpImpulse * 0.9;
          a.jumpCd = 0.5;
        }
      }
    }
  };

  Aliens.prototype._rail = function (a, dt, world, player, projectiles, hunt) {
    var H = BB.CONFIG.hunt;
    var ceil = world.ceilingAt(a.x);
    var target = player.x + H.crawlerLead;
    var err = target - a.x;
    var rel = BB.math.clamp(err * 2.0, -H.crawlerRel, H.crawlerRel);
    var desired;
    if (hunt.flow > 0.6) rel *= 0.5;
    if (hunt.shock > 0) rel -= 70;
    desired = player.vx * 0.25 + rel;
    a.vx = BB.math.damp(a.vx, desired, H.accel, dt);
    a.x += a.vx * dt;
    a.y = (ceil !== null ? ceil : BB.CONFIG.world.ceiling) + a.h + 2;

    if (a.x < player.x + 24) a.x = player.x + H.crawlerLead + 40;

    if (a.charging > 0) {
      a.charging -= dt;
      if (a.charging <= 0) {
        a.charging = 0;
        projectiles.dropSpike(a.x, a.y + 4);
        a.cd = 1.75;
      }
    } else if (a.cd <= 0 && a.x > player.x + 20 && a.x < player.x + 140) {
      a.charging = 0.38;
    }
  };

  Aliens.prototype._sentinel = function (a, dt, player, projectiles, hunt) {
    var H = BB.CONFIG.hunt;
    var C = BB.CONFIG.combat;
    var station = player.x + H.sentinelLead;
    var err = station - a.x;
    var desired = player.vx * 0.2 + err * 1.2;
    desired = BB.math.clamp(desired, player.vx * 0.08, player.vx + 20);
    if (hunt.shock > 0) desired = player.vx * 0.45;
    a.vx = BB.math.damp(a.vx, desired, H.accel, dt);
    a.x += a.vx * dt;
    a.y += Math.sin(a.phase * 2.0) * 22 * dt;
    a.y = BB.math.clamp(a.y, BB.CONFIG.world.ceiling + 100, BB.CONFIG.world.ground - 80);

    if (a.x < player.x + 90) {
      a.x = player.x + H.sentinelLead;
      a.intro = 0.25;
    }

    if (a.charging > 0) {
      a.charging -= dt;
      if (a.charging <= 0) {
        var tx = player.x + player.vx * 0.2;
        var ty = player.y - 28;
        var dx = tx - a.x;
        var dy = ty - (a.y - a.h * 0.4);
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var spd = C.alienBoltSpeed;
        a.charging = 0;
        projectiles.fireAlien(a.x - 10, a.y - a.h * 0.4, (dx / len) * spd, (dy / len) * spd * 0.55);
        a.cd = H.boltInterval + hunt.flow * 0.45;
      }
    } else if (a.cd <= 0 && a.x > player.x + 220) {
      a.charging = H.chargeTime;
    }
  };

  Aliens.prototype.hitbox = function (a) {
    return { x: a.x - a.w * 0.5, y: a.y - a.h, w: a.w, h: a.h };
  };

  Aliens.prototype.draw = function (ctx, camX) {
    var i;
    var a;
    var sx;
    for (i = 0; i < this.pool.alive.length; i++) {
      a = this.pool.alive[i];
      sx = a.x - camX;
      if (sx < -70 || sx > BB.VIEW_W + 70) continue;
      ctx.save();
      ctx.translate(sx, a.y);
      if (a.type === TYPE.CHASER) this._drawPursuit(ctx, a);
      else if (a.type === TYPE.CRAWLER) this._drawRail(ctx, a);
      else this._drawSentinel(ctx, a);
      ctx.restore();
    }
  };

  Aliens.prototype._drawPursuit = function (ctx, a) {
    var bob = Math.sin(a.phase * 16) * 1;
    ctx.translate(0, bob);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-16, -22, 32, 16);
    ctx.fillRect(-14, -8, 10, 8);
    ctx.fillRect(4, -8, 10, 8);
    ctx.fillStyle = "#000";
    ctx.fillRect(-10, -18, 16, 4);
    ctx.fillStyle = "#fff";
    ctx.fillRect(16, -16, 8, 4);
    ctx.fillRect(-4, -26, 3, 6);
    ctx.fillRect(-18, -12, 4, 3);
  };

  Aliens.prototype._drawRail = function (ctx, a) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(-16, 0, 32, 10);
    ctx.fillRect(-20, 2, 6, 6);
    ctx.fillRect(14, 2, 6, 6);
    ctx.fillRect(-3, 10, 6, a.charging > 0 ? 12 : 6);
    ctx.fillStyle = "#000";
    ctx.fillRect(-8, 3, 16, 4);
    if (a.charging > 0) {
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.4 + Math.sin(a.phase * 36) * 0.3;
      ctx.fillRect(-2, 16, 4, 10);
    }
  };

  Aliens.prototype._drawSentinel = function (ctx, a) {
    var hover = Math.sin(a.phase * 2.1) * 2;
    ctx.translate(0, hover);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-12, -28, 24, 20);
    ctx.fillRect(-8, -8, 16, 8);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -18, 14, 0, BB.math.TAU);
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.fillRect(-6, -24, 12, 5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-22, -16, 12, 5);
    ctx.fillRect(-24, -18, 4, 9);
    if (a.charging > 0) {
      ctx.globalAlpha = 0.55 + Math.sin(a.phase * 28) * 0.4;
      ctx.fillRect(-26, -20, 8, 8);
    }
  };

  Aliens.TYPE = TYPE;
  BB.Aliens = Aliens;
})(typeof window !== "undefined" ? window : globalThis);
