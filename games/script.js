/**
 * Manchester United vs Manchester City — Match Simulator
 * Canvas-based 2D football vibe simulator. Structure is kept modular for
 * future extension (AI, user controls, tactics).
 */

(function () {
  'use strict';

  // --- Constants (extend for different formations / difficulty) ---
  const PITCH_WIDTH = 800;
  const PITCH_HEIGHT = 500;
  const GOAL_WIDTH = 120;
  const GOAL_Y = (PITCH_HEIGHT - GOAL_WIDTH) / 2;
  const CENTER_X = PITCH_WIDTH / 2;
  const CENTER_Y = PITCH_HEIGHT / 2;
  const PLAYER_RADIUS = 14;
  const BALL_RADIUS = 10;
  const PLAYERS_PER_TEAM = 5;

  // Team ids for goals and drawing
  const HOME = 0;   // Manchester United (red)
  const AWAY = 1;   // Manchester City (blue)

  const COLORS = {
    pitch: '#2d6a4f',
    line: '#ffffff',
    home: '#e63946',
    away: '#4361ee',
    ball: '#ffffff',
  };

  // --- State ---
  let canvas, ctx;
  let scoreHome = 0, scoreAway = 0;
  let matchTimeSeconds = 0;
  let isRunning = false;
  let animationId = null;
  let lastTime = 0;

  let ball = { x: CENTER_X, y: CENTER_Y, vx: 0, vy: 0 };
  let players = [];

  /**
   * Initialize players on the pitch. Extend this to load formations or AI config.
   */
  function initPlayers() {
    players = [];
    const spacingX = (CENTER_X - 80) / (PLAYERS_PER_TEAM - 1 || 1);
    const spacingY = PITCH_HEIGHT / (PLAYERS_PER_TEAM + 1);

    for (let i = 0; i < PLAYERS_PER_TEAM; i++) {
      players.push({
        id: 'h' + i,
        team: HOME,
        x: 80 + i * spacingX + (Math.random() - 0.5) * 30,
        y: spacingY * (i + 1) + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        targetX: null,
        targetY: null,
      });
    }

    for (let i = 0; i < PLAYERS_PER_TEAM; i++) {
      players.push({
        id: 'a' + i,
        team: AWAY,
        x: PITCH_WIDTH - 80 - i * spacingX + (Math.random() - 0.5) * 30,
        y: spacingY * (i + 1) + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        targetX: null,
        targetY: null,
      });
    }
  }

  /**
   * Reset ball to center. Call after goal or on reset.
   */
  function resetBall() {
    ball.x = CENTER_X;
    ball.y = CENTER_Y;
    ball.vx = 0;
    ball.vy = 0;
  }

  /**
   * Draw the pitch (green + white lines). Extend to add more markings.
   */
  function drawPitch() {
    const w = PITCH_WIDTH;
    const h = PITCH_HEIGHT;
    ctx.fillStyle = COLORS.pitch;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;

    // Outline
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(CENTER_X, 0);
    ctx.lineTo(CENTER_X, h);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Goal areas (simplified rectangles)
    ctx.strokeRect(0, GOAL_Y - 40, 80, GOAL_WIDTH + 80);
    ctx.strokeRect(w - 80, GOAL_Y - 40, 80, GOAL_WIDTH + 80);

    // Goal lines
    ctx.lineWidth = 3;
    ctx.strokeRect(0, GOAL_Y, 8, GOAL_WIDTH);
    ctx.strokeRect(w - 8, GOAL_Y, 8, GOAL_WIDTH);
  }

  /**
   * Draw a single player (circle). Replace with sprite/icon later if needed.
   */
  function drawPlayer(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = p.team === HOME ? COLORS.home : COLORS.away;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Draw the ball.
   */
  function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ball;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Find closest player to the ball (any team). Useful for pass/kick logic.
   */
  function getClosestPlayerToBall() {
    let best = null;
    let bestD = Infinity;
    for (const p of players) {
      const dx = ball.x - p.x;
      const dy = ball.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /**
   * Find a teammate to pass to (closest in range). Extend for AI passing choice.
   */
  function getPassTarget(passer) {
    let best = null;
    let bestD = Infinity;
    for (const p of players) {
    if (p.team !== passer.team || p === passer) continue;
      const dx = p.x - ball.x;
      const dy = p.y - ball.y;
      const d = Math.hypot(dx, dy);
      if (d > 40 && d < 200 && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /**
   * Kick the ball toward a target (x,y). Used for passes and shots.
   */
  function kickBallToward(tx, ty, power = 0.4) {
    const dx = tx - ball.x;
    const dy = ty - ball.y;
    const d = Math.hypot(dx, dy) || 1;
    ball.vx += (dx / d) * power;
    ball.vy += (dy / d) * power;
  }

  let lastKickTime = 0;
  /**
   * Simulate a pass: nearest player kicks ball toward a teammate. Call from game loop.
   * Extend to add shot-on-goal logic or user-triggered passes.
   */
  function tryPass(timestamp) {
    if (timestamp - lastKickTime < 1500) return;
    const closest = getClosestPlayerToBall();
    if (!closest) return;
    const distToBall = Math.hypot(ball.x - closest.x, ball.y - closest.y);
    if (distToBall > 60) return;

    const target = getPassTarget(closest);
    if (target) {
      kickBallToward(target.x, target.y, 0.35);
      lastKickTime = timestamp;
    } else {
      // No pass target: kick toward goal (simple shot)
      const goalY = CENTER_Y + (Math.random() - 0.5) * 60;
      if (closest.team === HOME) kickBallToward(PITCH_WIDTH - 20, goalY, 0.4);
      else kickBallToward(20, goalY, 0.4);
      lastKickTime = timestamp;
    }
  }

  /**
   * Update player movement: move toward ball or wander in half. Extend for AI.
   */
  function updatePlayer(p, dt) {
    const half = p.team === HOME ? 1 : -1;
    const homeHalf = p.team === HOME ? (x) => x < CENTER_X : (x) => x > CENTER_X;

    const dxBall = ball.x - p.x;
    const dyBall = ball.y - p.y;
    const distBall = Math.hypot(dxBall, dyBall);

    let tx = p.x;
    let ty = p.y;

    if (distBall < 250) {
      tx = ball.x - (dxBall / distBall) * 50;
      ty = ball.y - (dyBall / distBall) * 50;
      if (!homeHalf(tx)) tx = CENTER_X - half * 80;
    } else {
      tx = p.x + (Math.random() - 0.5) * 60;
      ty = p.y + (Math.random() - 0.5) * 40;
      if (!homeHalf(tx)) tx = CENTER_X - half * 100;
      tx = Math.max(30, Math.min(PITCH_WIDTH - 30, tx));
      ty = Math.max(30, Math.min(PITCH_HEIGHT - 30, ty));
    }

    const speed = 0.08 * dt;
    p.vx += (tx - p.x) * speed;
    p.vy += (ty - p.y) * speed;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.x += p.vx;
    p.y += p.vy;
    p.x = Math.max(PLAYER_RADIUS, Math.min(PITCH_WIDTH - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(PITCH_HEIGHT - PLAYER_RADIUS, p.y));
  }

  /**
   * Update ball physics (friction, bounds). Add spin/collision later if needed.
   */
  function updateBall(dt) {
    const friction = 0.99;
    ball.vx *= friction;
    ball.vy *= friction;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y < BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy *= -0.6; }
    if (ball.y > PITCH_HEIGHT - BALL_RADIUS) { ball.y = PITCH_HEIGHT - BALL_RADIUS; ball.vy *= -0.6; }

    // Goal detection
    if (ball.x < -BALL_RADIUS) {
      scoreAway++;
      updateScoreboard();
      resetBall();
    } else if (ball.x > PITCH_WIDTH + BALL_RADIUS) {
      scoreHome++;
      updateScoreboard();
      resetBall();
    } else {
      ball.x = Math.max(BALL_RADIUS, Math.min(PITCH_WIDTH - BALL_RADIUS, ball.x));
    }
  }

  /**
   * Single tick of the simulation. Extend to add more events or AI.
   */
  function tick(timestamp) {
    const dt = Math.min(50, timestamp - lastTime);
    lastTime = timestamp;

    if (isRunning) {
      matchTimeSeconds += dt / 1000;
      document.getElementById('timer').textContent = formatTime(matchTimeSeconds);

      tryPass(timestamp);
      players.forEach((p) => updatePlayer(p, dt));
      updateBall(dt);
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
    document.getElementById('score-home').textContent = scoreHome;
    document.getElementById('score-away').textContent = scoreAway;
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

    lastTime = performance.now();
    animationId = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
