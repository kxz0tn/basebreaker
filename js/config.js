/**
 * BASEBREAKER — Config
 * Copyright (c) 2026 kxz0tn
 * SPDX-License-Identifier: MIT
 *
 * All motion tunables are SI-style game units: pixels and seconds.
 * Hostiles never receive a permanent speed advantage over the runner.
 *
 * v2.0 adds a rail gun (relative muzzle velocity) and the Devil unit.
 * Bullet world velocity is v_player + v_muzzle so shots always outrun
 * the corridor, independent of current scroll speed.
 */
(function (global) {
  "use strict";

  var BB = (global.BB = global.BB || {});

  BB.VERSION = "2.0";
  BB.STORAGE_HI = "basebreaker.v2.hiscore";
  BB.STORAGE_LIST = "basebreaker.v2.scores";
  BB.STORAGE_SCAN = "basebreaker.v2.scan";

  BB.PALETTE = {
    black: "#000000",
    void: "#050505",
    ink: "#0c0c0c",
    charcoal: "#161616",
    steel: "#2a2a2a",
    iron: "#3c3c3c",
    gray: "#6e6e6e",
    silver: "#b4b4b4",
    white: "#ffffff"
  };

  BB.VIEW_W = 1280;
  BB.VIEW_H = 720;

  BB.SECTORS = [
    { id: 0, name: "RING ACCESS", rib: 86 },
    { id: 1, name: "TRANSIT SPINE", rib: 64 },
    { id: 2, name: "DATA VAULT", rib: 52 },
    { id: 3, name: "CORE LOCK", rib: 40 }
  ];

  BB.CONFIG = {
    renderer: {
      maxPixelRatio: 1.75,
      lowPixelRatio: 1.0
    },

    world: {
      ground: 598,
      ceiling: 78,
      playerScreenX: 248,
      lookAhead: 1680,
      recyclePad: 280,
      sectorMeters: 480,
      /* Gap under a lintel. Must be > rollH and < stand h. */
      rollClear: 40
    },

    player: {
      w: 30,
      h: 56,
      rollW: 46,
      rollH: 22,
      /* g, px/s². Semi-implicit Euler: v += g*dt; y += v*dt. */
      gravity: 2200,
      /* Instantaneous Δv. Held peak h = v²/(2g) ≈ 131 px. */
      jumpImpulse: -760,
      /* Extra g while rising after release. Shortens remaining arc. */
      jumpCut: 2.7,
      coyote: 0.08,
      coyoteFlow: 0.05,
      jumpBuffer: 0.1,
      /*
       * Parkour slide. COM drop time ≈ sqrt(2 Δh / g) for Δh = standH-rollH.
       * Kinetic friction a = μ g during the slide. Rise is a push-up
       * acceleration back toward targetVx. rollH is the full-crouch box
       * and must stay 22 so existing lintels still require the duck.
       */
      /* Collision crouches on the first step. Visual drop is 2–3 frames. */
      /* Low-box hold = max(rollMinT, rollClearPx / vx) so a 52px lintel
         is always clearable at current speed. Rise is visual only. */
      rollMinT: 0.2,
      rollClearPx: 76,
      rollDrop: 0.03,
      rollRise: 0.07,
      rollMu: 0.06,
      rollFloor: 0.92,
      rollCrouchHit: 0.01,
      rollIFrame: 0.1,
      rollAirIFrame: 0.05,
      impactRest: 0.74,
      impactAccel: 1650,
      impactMin: 0.11,
      impactIFrame: 0.08,
      maxFall: 1400
    },

    boost: {
      surgeTime: 2.3,
      surgeMul: 1.22,
      aegisTime: 2.15,
      overTime: 2.5,
      overMult: 0.55
    },

    run: {
      startSpeed: 320,
      maxSpeed: 540,
      accelPerSec: 2.8,
      distAccel: 0.022,
      /* Additive speed from flow: vx = base * (1 + flow * this). */
      flowSpeed: 0.14
    },

    /*
     * Rail dart. Fired in the runner's rest frame at `muzzle` px/s, then
     * composed into world space:
     *   v_world = v_player + v_muzzle
     * so the projectile always leads the camera by the same relative
     * distance, at 320 px/s or at 540 px/s. Zero gravity: a 2200 px/s²
     * drop over a 0.7 s flight is 540 px — the dart would hit the floor
     * before the first seal. A rail is a kinematic ray with thickness.
     */
    gun: {
      ammoStart: 6,
      ammoMax: 12,
      fireCD: 0.155,
      dryCD: 0.16,
      muzzle: 880,
      boltW: 15,
      boltH: 4,
      life: 0.7,
      kickX: -5,
      kickY: 0,
      shake: 0.2,
      refillSurge: 3,
      refillAegis: 4,
      refillOver: 5,
      refillCell: 3,
      refillDevil: 2
    },

    combat: {
      alienBoltSpeed: 380,
      maxAliens: 14,
      maxAlienShots: 24,
      maxPlayerShots: 16
    },

    /*
     * Devil — high-threat stalker that holds a LEAD (it is always ahead
     * so forward fire connects). Gap close is a P-controller on lead:
     *   targetX = player.x + lead
     *   extra   = (targetX - x) * k
     *   vx      = damp(vx, player.vx + extra)
     * Lead shrinks from stalk → lunge → execute. If hp remains when
     * age >= deadline, lead collapses to killLead and contact is a
     * guaranteed kill. HP and deadline interpolate with survival time.
     */
    devil: {
      firstAt: 13.2,
      interval0: 16.8,
      interval1: 8.4,
      breath: 2.8,
      hp0: 3,
      hp1: 5,
      hpRampT: 96,
      deadline0: 4.45,
      deadline1: 2.7,
      spawnLead: 348,
      stalkLead: 296,
      lungeLead: 78,
      killLead: 14,
      stalkT: 0.92,
      intro: 0.5,
      pGain: 2.4,
      maxExtra: 260,
      weave0: 6,
      weave1: 22,
      weaveFreq: 3.4,
      dodgeDiff: 0.38,
      dodgeY: 20,
      dodgeCD: 0.42,
      knock: 22,
      w: 58,
      h: 70,
      score: 260,
      scorePerHp: 38,
      warnT: 0.75
    },

    sim: {
      step: 1 / 60,
      maxSteps: 4
    },

    /*
     * Gap-band pursuit. gap = player.x - hunter.x (world px).
     * extra is added to player.vx then damped. After integrate, x is
     * clamped so gap cannot fall below minGap. Speed-kill is illegal.
     */
    hunt: {
      firstHunt: 2.6,
      maxChasers: 2,
      secondAt: 0.62,
      crawlerInterval: 6.2,
      sentinelInterval: 7.4,
      minGap: 88,
      fallMinGap: 20,
      fallMaxClose: 82,
      comfortGap: 152,
      maxGap: 228,
      spawnBehind: 280,
      respawn: 2.1,
      accel: 9,
      maxClose: 30,
      maxFlee: 38,
      shock: 1.2,
      shockExtra: -96,
      crawlerLead: 110,
      crawlerRel: 110,
      sentinelLead: 480,
      boltInterval: 1.9,
      chargeTime: 0.44
    },

    flow: {
      max: 1,
      jump: 0.09,
      roll: 0.09,
      near: 0.16,
      brk: 0.12,
      kill: 0.28,
      idleBeforeDecay: 0.85,
      decayPerSec: 0.32
    },

    score: {
      perMeter: 2.4,
      perSecond: 10,
      nearMiss: 28,
      cleanMove: 12,
      boostGrab: 35,
      crateBreak: 44,
      sealBreak: 96,
      nodeBreak: 30,
      devilKill: 260,
      multDecay: 3.1,
      multPerStreak: 0.2,
      multMax: 8,
      nearMissPad: 16
    },

    fx: {
      maxParticles: 420
    }
  };

  BB.detectQuality = function detectQuality() {
    var mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    if (mobile || cores <= 4 || mem <= 4) return "low";
    if (cores <= 8 || mem <= 8) return "med";
    return "high";
  };
})(typeof window !== "undefined" ? window : globalThis);
