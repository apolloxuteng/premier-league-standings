/**
 * Manchester United vs Manchester City — Match Simulator
 * Canvas-based 2D football simulator with Dribble / Pass / Shoot logic.
 * Players per team configurable from 2 to 11.
 */

(function () {
  'use strict';

  // --- Pitch & game constants ---
  const PITCH_WIDTH = 800;
  const PITCH_HEIGHT = 500;
  const GOAL_WIDTH = 120;
  const GOAL_Y = (PITCH_HEIGHT - GOAL_WIDTH) / 2;
  const CENTER_X = PITCH_WIDTH / 2;
  const CENTER_Y = PITCH_HEIGHT / 2;
  const PLAYER_RADIUS = 14;
  const BALL_RADIUS = 10;

  const HOME = 0;   // Manchester United (red), attacks right
  const AWAY = 1;   // Manchester City (blue), attacks left

  const COLORS = {
    pitch: '#2d6a4f',
    line: '#ffffff',
    home: '#e63946',
    away: '#4361ee',
    ball: '#ffffff',
  };

  // Possession: only a player within this distance can perform an action
  const POSSESSION_RADIUS = 52;
  const ACTION_COOLDOWN_MS = 700;
  const PLAYER_SPEED = 0.04;
  const PLAYER_DAMPING = 0.89;
  const PASS_POWER = 0.38;
  const SHOT_POWER = 0.42;
  const ATTACKING_THIRD_X = 180;

  // --- State ---
  let canvas, ctx;
  let scoreHome = 0, scoreAway = 0;
  let matchTimeSeconds = 0;
  let isRunning = false;
  let animationId = null;
  let lastTime = 0;
  let lastActionTime = 0;
  let lastGoalTime = 0;
  const GOAL_COOLDOWN_MS = 150;

  let ball = { x: CENTER_X, y: CENTER_Y, vx: 0, vy: 0, attachedTo: null };
  let players = [];

  /** Read players per team from UI (2–11). */
  function getPlayersPerTeam() {
    const el = document.getElementById('players-per-team');
    if (!el) return 5;
    const n = parseInt(el.value, 10);
    return Math.min(11, Math.max(2, isNaN(n) ? 5 : n));
  }

  /**
   * Initialize players. Uses configurable count per team; formation spreads
   * players in own half. Extend for custom formations.
   */
  function initPlayers() {
    players = [];
    const n = getPlayersPerTeam();
    const spacingX = (CENTER_X - 100) / (n - 1 || 1);
    const spacingY = PITCH_HEIGHT / (n + 1);

    for (let i = 0; i < n; i++) {
      players.push({
        id: 'h' + i,
        team: HOME,
        x: 60 + i * spacingX + (Math.random() - 0.5) * 25,
        y: spacingY * (i + 1) + (Math.random() - 0.5) * 15,
        vx: 0,
        vy: 0,
      });
    }
    for (let i = 0; i < n; i++) {
      players.push({
        id: 'a' + i,
        team: AWAY,
        x: PITCH_WIDTH - 60 - i * spacingX + (Math.random() - 0.5) * 25,
        y: spacingY * (i + 1) + (Math.random() - 0.5) * 15,
        vx: 0,
        vy: 0,
      });
    }
  }

  function resetBall() {
    ball.x = CENTER_X;
    ball.y = CENTER_Y;
    ball.vx = 0;
    ball.vy = 0;
    ball.attachedTo = null;
  }

  function drawPitch() {
    const w = PITCH_WIDTH;
    const h = PITCH_HEIGHT;
    ctx.fillStyle = COLORS.pitch;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.beginPath();
    ctx.moveTo(CENTER_X, 0);
    ctx.lineTo(CENTER_X, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(0, GOAL_Y - 40, 80, GOAL_WIDTH + 80);
    ctx.strokeRect(w - 80, GOAL_Y - 40, 80, GOAL_WIDTH + 80);
    ctx.lineWidth = 3;
    ctx.strokeRect(0, GOAL_Y, 8, GOAL_WIDTH);
    ctx.strokeRect(w - 8, GOAL_Y, 8, GOAL_WIDTH);
  }

  function drawPlayer(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = p.team === HOME ? COLORS.home : COLORS.away;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ball;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** Closest player to the ball within possession radius, or null. */
  function getPossessor() {
    let best = null;
    let bestD = Infinity;
    for (const p of players) {
      const d = Math.hypot(ball.x - p.x, ball.y - p.y);
      if (d < POSSESSION_RADIUS && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /**
   * Dribble score: best when in open field (few players near the ball).
   * Returns 0–1; higher = more space to dribble.
   */
  function getDribbleScore(player) {
    const radius = 75;
    let count = 0;
    for (const p of players) {
      if (p === player) continue;
      const d = Math.hypot(p.x - ball.x, p.y - ball.y);
      if (d < radius) count++;
    }
    return 1 / (1 + count * 0.6);
  }

  /**
   * Check if the passing lane from ball to target is clear (no one in the way).
   * Uses segment-to-point distance; anyone within laneRadius blocks.
   */
  function isPassLaneClear(targetPlayer, laneRadius) {
    const ax = ball.x;
    const ay = ball.y;
    const bx = targetPlayer.x;
    const by = targetPlayer.y;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;

    for (const p of players) {
      if (p === targetPlayer) continue;
      const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (len * len)));
      const px = ax + t * dx;
      const py = ay + t * dy;
      const dist = Math.hypot(p.x - px, p.y - py);
      if (dist < (laneRadius || 28)) return false;
    }
    return true;
  }

  /**
   * Pass score: best when a teammate is in range and the lane is clear (fast ball movement).
   * Returns 0–1; higher = good pass option.
   */
  function getPassScore(player) {
    let best = 0;
    for (const p of players) {
      if (p.team !== player.team || p === player) continue;
      const dx = p.x - ball.x;
      const dy = p.y - ball.y;
      const d = Math.hypot(dx, dy);
      if (d < 35 || d > 220) continue;
      if (!isPassLaneClear(p, 26)) continue;
      const score = 0.3 + 0.7 * (1 - (d - 35) / 185);
      if (score > best) best = score;
    }
    return best;
  }

  /**
   * Shoot score: best when close to the opponent's goal (in attacking third).
   * Returns 0–1; higher = better shooting position.
   */
  function getShootScore(player) {
    const goalX = player.team === HOME ? PITCH_WIDTH : 0;
    const distToGoal = Math.hypot(goalX - ball.x, CENTER_Y - ball.y);
    const inAttackingThird = player.team === HOME
      ? ball.x > PITCH_WIDTH - ATTACKING_THIRD_X
      : ball.x < ATTACKING_THIRD_X;
    if (!inAttackingThird) return 0;
    return Math.max(0, 1 - distToGoal / 180);
  }

  /**
   * Choose action for the player in possession: dribble, pass, or shoot.
   * Uses scores and simple thresholds so dribble is default in open field,
   * pass when lane is clear, shoot when close to goal.
   */
  function chooseAction(player) {
    const dribble = getDribbleScore(player);
    const pass = getPassScore(player);
    const shoot = getShootScore(player);

    if (shoot > 0.4) return 'shoot';
    if (pass > 0.5 && pass >= dribble) return 'pass';
    return 'dribble';
  }

  /** Kick ball toward a point (for pass or shot). */
  function kickBallToward(tx, ty, power) {
    ball.attachedTo = null;
    const dx = tx - ball.x;
    const dy = ty - ball.y;
    const d = Math.hypot(dx, dy) || 1;
    ball.vx = (dx / d) * power;
    ball.vy = (dy / d) * power;
  }

  /** Execute pass: find best teammate with clear lane and kick. */
  function executePass(player) {
    let best = null;
    let bestScore = 0;
    for (const p of players) {
      if (p.team !== player.team || p === player) continue;
      const dx = p.x - ball.x;
      const dy = p.y - ball.y;
      const d = Math.hypot(dx, dy);
      if (d < 40 || d > 200) continue;
      if (!isPassLaneClear(p, 26)) continue;
      const score = 1 - d / 200;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) kickBallToward(best.x, best.y, PASS_POWER);
  }

  /** Execute shot: kick toward goal with small random offset. */
  function executeShoot(player) {
    const goalX = player.team === HOME ? PITCH_WIDTH + 10 : -10;
    const goalY = CENTER_Y + (Math.random() - 0.5) * 50;
    kickBallToward(goalX, goalY, SHOT_POWER);
  }

  /**
   * Perform one action for the possessor (dribble / pass / shoot).
   * Called when action cooldown has elapsed. Dribble is handled in updatePlayer.
   */
  function tryAction(timestamp) {
    if (timestamp - lastActionTime < ACTION_COOLDOWN_MS) return;
    const possessor = getPossessor();
    if (!possessor) return;
    if (ball.attachedTo && ball.attachedTo !== possessor) return;

    lastActionTime = timestamp;
    const action = chooseAction(possessor);

    if (action === 'shoot') {
      executeShoot(possessor);
      return;
    }
    if (action === 'pass') {
      executePass(possessor);
      return;
    }
    // dribble: attach ball to player; movement is handled in updatePlayer
    ball.attachedTo = possessor;
  }

  /**
   * Update a single player: move toward ball or support, and if in possession
   * and dribbling, move with the ball. Extend for custom AI or user control.
   */
  function updatePlayer(p, dt) {
    const isHome = p.team === HOME;
    const homeHalf = (x) => isHome ? x < CENTER_X : x > CENTER_X;
    const dxBall = ball.x - p.x;
    const dyBall = ball.y - p.y;
    const distBall = Math.hypot(dxBall, dyBall);
    const isPossessor = ball.attachedTo === p;

    if (isPossessor) {
      ball.attachedTo = p;
      const goalX = isHome ? PITCH_WIDTH - 30 : 30;
      const toGoalX = goalX - p.x;
      const toGoalY = CENTER_Y - p.y;
      const len = Math.hypot(toGoalX, toGoalY) || 1;
      p.vx += (toGoalX / len) * PLAYER_SPEED * dt;
      p.vy += (toGoalY / len) * PLAYER_SPEED * dt;
      p.vx *= PLAYER_DAMPING;
      p.vy *= PLAYER_DAMPING;
      p.x += p.vx;
      p.y += p.vy;
      p.x = Math.max(PLAYER_RADIUS, Math.min(PITCH_WIDTH - PLAYER_RADIUS, p.x));
      p.y = Math.max(PLAYER_RADIUS, Math.min(PITCH_HEIGHT - PLAYER_RADIUS, p.y));
      ball.x = p.x + (p.vx * 8);
      ball.y = p.y + (p.vy * 8);
      ball.vx = 0;
      ball.vy = 0;
      ball.y = Math.max(BALL_RADIUS, Math.min(PITCH_HEIGHT - BALL_RADIUS, ball.y));
      if (Math.hypot(ball.x - p.x, ball.y - p.y) > 50) ball.attachedTo = null;
      return;
    }

    let tx = p.x;
    let ty = p.y;
    if (distBall < 220) {
      tx = ball.x - (dxBall / distBall) * 45;
      ty = ball.y - (dyBall / distBall) * 45;
      if (!homeHalf(tx)) tx = CENTER_X + (isHome ? -90 : 90);
    } else {
      tx = p.x + (Math.random() - 0.5) * 50;
      ty = p.y + (Math.random() - 0.5) * 35;
      if (!homeHalf(tx)) tx = CENTER_X + (isHome ? -100 : 100);
      tx = Math.max(25, Math.min(PITCH_WIDTH - 25, tx));
      ty = Math.max(25, Math.min(PITCH_HEIGHT - 25, ty));
    }

    const dx = tx - p.x;
    const dy = ty - p.y;
    const len = Math.hypot(dx, dy) || 1;
    p.vx += (dx / len) * PLAYER_SPEED * dt;
    p.vy += (dy / len) * PLAYER_SPEED * dt;
    p.vx *= PLAYER_DAMPING;
    p.vy *= PLAYER_DAMPING;
    p.x += p.vx;
    p.y += p.vy;
    p.x = Math.max(PLAYER_RADIUS, Math.min(PITCH_WIDTH - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(PITCH_HEIGHT - PLAYER_RADIUS, p.y));
  }

  /**
   * Reset ball to center and give possession to the conceding team (kickoff).
   * concedingTeam = team that was scored on (HOME or AWAY).
   * Ball is placed clearly inside the pitch so goal detection doesn't re-fire.
   */
  function resetBallAndKickoff(concedingTeam) {
    ball.vx = 0;
    ball.vy = 0;
    ball.attachedTo = null;
    let best = null;
    let bestD = Infinity;
    for (const p of players) {
      if (p.team !== concedingTeam) continue;
      const d = Math.hypot(p.x - CENTER_X, p.y - CENTER_Y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    const margin = 50;
    if (best) {
      ball.x = Math.max(margin, Math.min(PITCH_WIDTH - margin, best.x));
      ball.y = Math.max(margin, Math.min(PITCH_HEIGHT - margin, best.y));
      ball.attachedTo = best;
    } else {
      ball.x = CENTER_X;
      ball.y = CENTER_Y;
    }
  }

  function updateBall(dt, timestamp) {
    // Goal check first (including when ball is dribbled over the line).
    // Cooldown prevents re-triggering right after kickoff.
    const canDetectGoal = !lastGoalTime || (timestamp - lastGoalTime > GOAL_COOLDOWN_MS);
    if (canDetectGoal) {
      if (ball.x < -BALL_RADIUS) {
        lastGoalTime = timestamp;
        scoreAway++;
        updateScoreboard();
        resetBallAndKickoff(HOME);
        return;
      }
      if (ball.x > PITCH_WIDTH + BALL_RADIUS) {
        lastGoalTime = timestamp;
        scoreHome++;
        updateScoreboard();
        resetBallAndKickoff(AWAY);
        return;
      }
    }

    if (ball.attachedTo) return;

    const friction = 0.992;
    ball.vx *= friction;
    ball.vy *= friction;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y < BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy *= -0.6; }
    if (ball.y > PITCH_HEIGHT - BALL_RADIUS) {
      ball.y = PITCH_HEIGHT - BALL_RADIUS;
      ball.vy *= -0.6;
    }

    ball.x = Math.max(BALL_RADIUS, Math.min(PITCH_WIDTH - BALL_RADIUS, ball.x));
  }

  function tick(timestamp) {
    const dt = Math.min(50, timestamp - lastTime);
    lastTime = timestamp;

    if (isRunning) {
      matchTimeSeconds += dt / 1000;
      document.getElementById('timer').textContent = formatTime(matchTimeSeconds);
      tryAction(timestamp);
      players.forEach((p) => updatePlayer(p, dt));
      updateBall(dt, timestamp);
    }

    drawPitch();
    players.forEach(drawPlayer);
    drawBall();
    animationId = requestAnimationFrame(tick);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updateScoreboard() {
    const homeEl = document.getElementById('score-home');
    const awayEl = document.getElementById('score-away');
    if (homeEl) {
      homeEl.textContent = String(scoreHome);
      homeEl.innerText = String(scoreHome);
    }
    if (awayEl) {
      awayEl.textContent = String(scoreAway);
      awayEl.innerText = String(scoreAway);
    }
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    document.getElementById('btn-pause').textContent = 'Pause';
  }

  function pause() {
    isRunning = false;
    document.getElementById('btn-pause').textContent = 'Resume';
  }

  function reset() {
    pause();
    scoreHome = 0;
    scoreAway = 0;
    matchTimeSeconds = 0;
    lastActionTime = 0;
    lastGoalTime = 0;
    initPlayers();
    resetBall();
    updateScoreboard();
    document.getElementById('timer').textContent = '0:00';
    document.getElementById('btn-pause').textContent = 'Pause';
  }

  function togglePause() {
    isRunning = !isRunning;
    document.getElementById('btn-pause').textContent = isRunning ? 'Pause' : 'Resume';
  }

  function init() {
    canvas = document.getElementById('pitch');
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    initPlayers();
    resetBall();
    updateScoreboard();

    document.getElementById('btn-start').addEventListener('click', start);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-reset').addEventListener('click', reset);

    const sel = document.getElementById('players-per-team');
    if (sel) sel.addEventListener('change', () => { reset(); });

    lastTime = performance.now();
    animationId = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
