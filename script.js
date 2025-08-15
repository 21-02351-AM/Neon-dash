// DOM Elements
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOver");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const levelEl = document.getElementById("level");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const restartBtn = document.getElementById("restartBtn");
const retryBtn = document.getElementById("retryBtn");
const shareBtn = document.getElementById("shareBtn");
const summaryEl = document.getElementById("summary");
const dashBtn = document.getElementById("dashBtn");

// Mobile joystick elements
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");

// Canvas utilities
const W = () => canvas.width;
const H = () => canvas.height;

// Resize canvas to container size
const resize = () => {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
};
new ResizeObserver(resize).observe(canvas.parentElement);
resize();

// Game state
let playing = false,
  paused = false,
  over = false;
let t0 = 0,
  last = 0,
  score = 0,
  best = Number(localStorage.getItem("neon.best") || 0),
  level = 1;
bestEl.textContent = best;

// Player object
const player = {
  x: 120,
  y: 200,
  r: 12,
  speed: 230,
  vx: 0,
  vy: 0,
  dash: { cd: 2.2, left: 2.2, power: 370, time: 0.12, t: 0 },
};

// Obstacles
const obs = [];
let spawnTimer = 0,
  baseSpawn = 0.85,
  baseSpeed = 120;

// Utility functions
function resetGame() {
  playing = false;
  paused = false;
  over = false;
  score = 0;
  level = 1;
  last = 0;
  t0 = 0;
  player.x = Math.min(140, W() * 0.2);
  player.y = H() / 2;
  player.vx = 0;
  player.vy = 0;
  player.dash.left = player.dash.cd;
  player.dash.t = 0;
  obs.length = 0;
  spawnTimer = 0;
  baseSpawn = 0.85;
  baseSpeed = 120;
  scoreEl.textContent = "0";
  levelEl.textContent = "1";
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function irand(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function rand(a, b) {
  return Math.random() * (b - a) + a;
}

// Input handling
const keys = new Set();

window.addEventListener("keydown", (e) => {
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "w",
      "a",
      "s",
      "d",
      "W",
      "A",
      "S",
      "D",
    ].includes(e.key)
  ) {
    keys.add(e.key.toLowerCase());
    e.preventDefault();
  }
  if (e.code === "Space") {
    tryDash();
    e.preventDefault();
  }
  if (e.key.toLowerCase() === "p") togglePause();
  if (e.key.toLowerCase() === "r") {
    resetGame();
    start();
  }
});

window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// Mobile joystick logic
let joyActive = false,
  joyVector = { x: 0, y: 0 };

const joyRect = () => joystick.getBoundingClientRect();

function startJoy(e) {
  joyActive = true;
  moveJoy(e);
  e.preventDefault();
}

function moveJoy(e) {
  if (!joyActive) return;
  const pt = getPoint(e);
  const r = joyRect();
  const cx = r.left + r.width / 2,
    cy = r.top + r.height / 2;
  let dx = pt.x - cx,
    dy = pt.y - cy;
  const max = r.width / 2 - 10;
  const mag = Math.hypot(dx, dy) || 1;
  dx = (dx / mag) * Math.min(max, mag);
  dy = (dy / mag) * Math.min(max, mag);
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
  stick.style.left = "50%";
  stick.style.top = "50%";
  joyVector.x = dx / max;
  joyVector.y = dy / max;
}

function endJoy() {
  joyActive = false;
  joyVector.x = 0;
  joyVector.y = 0;
  stick.style.transform = "translate(-50%, -50%)";
}

function getPoint(e) {
  if (e.touches && e.touches[0])
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

// Mobile joystick event listeners
joystick.addEventListener("pointerdown", startJoy);
joystick.addEventListener("pointermove", moveJoy);
window.addEventListener("pointerup", endJoy);

dashBtn.addEventListener("click", () => tryDash());

// Button event listeners
startBtn.addEventListener("click", start);

restartBtn.addEventListener("click", () => {
  resetGame();
  start();
});

retryBtn.addEventListener("click", () => {
  resetGame();
  start();
});

shareBtn.addEventListener("click", async () => {
  const text = `I scored ${Math.floor(score)} on Neon Dodge! Can you beat me?`;
  try {
    await navigator.clipboard.writeText(text);
    shareBtn.textContent = "Copied!";
    setTimeout(() => (shareBtn.textContent = "Share"), 1200);
  } catch {
    alert(text);
  }
});

pauseBtn.addEventListener("click", () => {
  if (!playing || over) return;
  paused = true;
  pauseBtn.disabled = true;
  resumeBtn.disabled = false;
});

resumeBtn.addEventListener("click", () => {
  if (!playing || over) return;
  paused = false;
  pauseBtn.disabled = false;
  resumeBtn.disabled = true;
  last = performance.now();
  loop(last);
});

function togglePause() {
  if (!playing || over) return;
  paused = !paused;
  pauseBtn.disabled = paused;
  resumeBtn.disabled = !paused;
  if (!paused) {
    last = performance.now();
    loop(last);
  }
}

// Game logic
function start() {
  startOverlay.style.display = "none";
  gameOverOverlay.style.display = "none";
  resetGame();
  playing = true;
  last = performance.now();
  t0 = last;
  loop(last);
}

function loop(ts) {
  if (!playing || paused) return;
  const dt = Math.min(0.033, (ts - last) / 1000);
  last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  // Increase difficulty over time
  const elapsed = (last - t0) / 1000;
  level = 1 + Math.floor(elapsed / 15);
  levelEl.textContent = level;
  const difficulty = 1 + elapsed / 60; // ramps slowly

  // Movement
  const input = {
    x:
      (keys.has("arrowright") || keys.has("d")) -
      (keys.has("arrowleft") || keys.has("a")) +
      joyVector.x,
    y:
      (keys.has("arrowdown") || keys.has("s")) -
      (keys.has("arrowup") || keys.has("w")) +
      joyVector.y,
  };
  const mag = Math.hypot(input.x, input.y) || 1;
  const nx = input.x / mag,
    ny = input.y / mag;
  const base = player.speed + (level - 1) * 18;
  let spd = base;
  if (player.dash.t > 0) {
    spd += player.dash.power;
    player.dash.t -= dt;
  }
  player.vx = nx * spd;
  player.vy = ny * spd;

  player.x = clamp(player.x + player.vx * dt, player.r + 2, W() - player.r - 2);
  player.y = clamp(player.y + player.vy * dt, player.r + 2, H() - player.r - 2);

  // Spawn obstacles
  spawnTimer -= dt;
  const spawnEvery = baseSpawn / difficulty;
  if (spawnTimer <= 0) {
    spawnTimer = rand(spawnEvery * 0.7, spawnEvery * 1.3);
    const side = irand(0, 3); // 0=left,1=right,2=top,3=bottom
    const size = rand(16, 38 + 8 * Math.min(4, level));
    let x, y, vx, vy;
    const speed = (baseSpeed + elapsed * 4 + level * 22) * rand(0.9, 1.2);

    if (side === 0) {
      x = -size;
      y = rand(0, H());
      vx = speed;
      vy = rand(-speed * 0.5, speed * 0.5);
    } else if (side === 1) {
      x = W() + size;
      y = rand(0, H());
      vx = -speed;
      vy = rand(-speed * 0.5, speed * 0.5);
    } else if (side === 2) {
      x = rand(0, W());
      y = -size;
      vx = rand(-speed * 0.5, speed * 0.5);
      vy = speed;
    } else {
      x = rand(0, W());
      y = H() + size;
      vx = rand(-speed * 0.5, speed * 0.5);
      vy = -speed;
    }
    obs.push({ x, y, w: size, h: size, vx, vy, t: 0, life: rand(5, 12) });
  }

  // Update obstacles
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.t += dt;
    o.life -= dt;
    if (
      o.x < -80 ||
      o.x > W() + 80 ||
      o.y < -80 ||
      o.y > H() + 80 ||
      o.life <= 0
    )
      obs.splice(i, 1);
  }

  // Collisions
  for (const o of obs) {
    if (circleRect(player.x, player.y, player.r, o)) {
      return gameOver();
    }
  }

  // Scoring
  score += dt * 10 * difficulty;
  scoreEl.textContent = Math.floor(score);

  // Recharge dash
  player.dash.left = Math.min(player.dash.cd, player.dash.left + dt * 0.8);
}

function tryDash() {
  if (player.dash.left >= player.dash.cd * 0.98) {
    player.dash.t = player.dash.time;
    player.dash.left = 0;
    pulse();
  }
}

function circleRect(cx, cy, cr, r) {
  const testX = clamp(cx, r.x, r.x + r.w);
  const testY = clamp(cy, r.y, r.y + r.h);
  const dx = cx - testX;
  const dy = cy - testY;
  return dx * dx + dy * dy <= cr * cr;
}

// Visual rendering
const trail = [];

function draw() {
  // Background
  ctx.clearRect(0, 0, W(), H());
  // Subtle grid
  ctx.globalAlpha = 0.25;
  drawGrid();
  ctx.globalAlpha = 1;
  // Player trail
  drawPlayer();
  // Obstacles
  drawObstacles();
  // Dash meter
  drawDash();
}

function drawGrid() {
  const gap = 26;
  ctx.strokeStyle = "#162147";
  ctx.lineWidth = 1;
  const ox = (last / 30) % gap;
  const oy = (last / 25) % gap;
  ctx.beginPath();
  for (let x = -gap + ox; x < W() + gap; x += gap) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H());
  }
  for (let y = -gap + oy; y < H() + gap; y += gap) {
    ctx.moveTo(0, y);
    ctx.lineTo(W(), y);
  }
  ctx.stroke();
}

function drawPlayer() {
  trail.push({ x: player.x, y: player.y, r: player.r });
  if (trail.length > 20) trail.shift();

  // Glow trail
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const a = i / trail.length;
    ctx.fillStyle = `rgba(120,243,255,${a * 0.18})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + i * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Core
  const grd = ctx.createRadialGradient(
    player.x - 4,
    player.y - 4,
    2,
    player.x,
    player.y,
    player.r + 10
  );
  grd.addColorStop(0, "#e8fdff");
  grd.addColorStop(0.4, "#78f3ff");
  grd.addColorStop(1, "#2759ff");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawObstacles() {
  for (const o of obs) {
    const t = (Math.sin((o.t + o.w) * 2) + 1) / 2; // shimmer
    const c1 = `rgba(157,123,255,${0.25 + t * 0.25})`;
    ctx.fillStyle = c1;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#2a3a77";
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
  }
}

function drawDash() {
  const w = 120,
    h = 10,
    x = W() - w - 14,
    y = H() - h - 14;
  ctx.fillStyle = "#0b1226";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#2b3a72";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const pct = player.dash.left / player.dash.cd;
  ctx.fillStyle = "#5bffb4";
  ctx.fillRect(x, y, w * pct, h);
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillStyle = "#9bb0d6";
  ctx.fillText("DASH", x, y - 6);
}

function pulse() {
  // Quick screen pulse on dash
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "rgba(121,243,255,0.08)";
  ctx.fillRect(0, 0, W(), H());
  ctx.restore();
}

function gameOver() {
  playing = false;
  over = true;
  const s = Math.floor(score);
  if (s > best) {
    best = s;
    localStorage.setItem("neon.best", best);
  }
  bestEl.textContent = best;
  summaryEl.textContent = `Score: ${s}  •  Best: ${best}  •  Level reached: ${level}`;
  gameOverOverlay.style.display = "grid";
}

// Initialize with idle render
draw();
