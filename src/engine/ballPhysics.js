import { CONFIG } from '../config.js'

const MAX_DT_SEC = 0.05

/**
 * Integrates ball velocity and position for a single frame and resolves
 * arena boundary bounces.
 */
export function stepBall(ball, inputVec, bounds, physicsConfig = CONFIG.physics, dt = 1 / 60) {
  const { sensitivity, friction, maxSpeed, wallBounce } = physicsConfig

  ball.vx += inputVec.ax * sensitivity * dt * 60
  ball.vy += inputVec.ay * sensitivity * dt * 60

  const damp = Math.pow(friction, dt * 60)
  ball.vx *= damp
  ball.vy *= damp

  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed
    ball.vx *= scale
    ball.vy *= scale
  }

  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  if (ball.x < ball.r) {
    ball.x = ball.r
    ball.vx = Math.abs(ball.vx) * wallBounce
  } else if (ball.x > bounds.width - ball.r) {
    ball.x = bounds.width - ball.r
    ball.vx = -Math.abs(ball.vx) * wallBounce
  }

  if (ball.y < ball.r) {
    ball.y = ball.r
    ball.vy = Math.abs(ball.vy) * wallBounce
  } else if (ball.y > bounds.height - ball.r) {
    ball.y = bounds.height - ball.r
    ball.vy = -Math.abs(ball.vy) * wallBounce
  }
}

/**
 * Resolves circle vs. AABB rectangle wall collisions by pushing the ball out
 * along the shallowest axis and reflecting velocity by wallBounce.
 */
export function resolveWallCollisions(ball, walls, wallBounce = CONFIG.physics.wallBounce) {
  for (let i = 0; i < walls.length; i += 1) {
    const wall = walls[i]
    const closestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.w))
    const closestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.h))
    const dx = ball.x - closestX
    const dy = ball.y - closestY
    const distSq = dx * dx + dy * dy

    if (distSq >= ball.r * ball.r) continue

    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq)
      const nx = dx / dist
      const ny = dy / dist
      const overlap = ball.r - dist
      ball.x += nx * overlap
      ball.y += ny * overlap

      const vn = ball.vx * nx + ball.vy * ny
      if (vn < 0) {
        ball.vx -= (1 + wallBounce) * vn * nx
        ball.vy -= (1 + wallBounce) * vn * ny
      }
    } else {
      // Ball center is inside the wall rect; push out along minimum penetration axis
      const leftPen = ball.x - wall.x
      const rightPen = wall.x + wall.w - ball.x
      const topPen = ball.y - wall.y
      const bottomPen = wall.y + wall.h - ball.y
      const minPen = Math.min(leftPen, rightPen, topPen, bottomPen)

      if (minPen === leftPen) {
        ball.x = wall.x - ball.r
        ball.vx = -Math.abs(ball.vx) * wallBounce
      } else if (minPen === rightPen) {
        ball.x = wall.x + wall.w + ball.r
        ball.vx = Math.abs(ball.vx) * wallBounce
      } else if (minPen === topPen) {
        ball.y = wall.y - ball.r
        ball.vy = -Math.abs(ball.vy) * wallBounce
      } else {
        ball.y = wall.y + wall.h + ball.r
        ball.vy = Math.abs(ball.vy) * wallBounce
      }
    }
  }
}

/**
 * Returns true when the ball center is within the circular zone radius.
 */
export function isBallInCircle(ball, zone) {
  return Math.hypot(ball.x - zone.x, ball.y - zone.y) < zone.r
}

/**
 * Returns true when a point (px, py) is inside a circular zone.
 */
export function isPointInCircle(px, py, zone) {
  return Math.hypot(px - zone.x, py - zone.y) <= zone.r
}

/**
 * Creates a requestAnimationFrame loop with delta-time clamped to 0.05s.
 */
export function createPhysicsLoop(onTick) {
  let rafId = null
  let lastTime = 0
  let running = false

  function frame(now) {
    if (!running) return
    const rawDt = lastTime ? (now - lastTime) / 1000 : 1 / 60
    lastTime = now
    const dt = Math.min(Math.max(rawDt, 0), MAX_DT_SEC)

    onTick(dt, now)

    if (running) {
      rafId = window.requestAnimationFrame(frame)
    }
  }

  return {
    start() {
      if (running) return
      running = true
      lastTime = performance.now()
      rafId = window.requestAnimationFrame(frame)
    },
    stop() {
      running = false
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
    },
    isRunning: () => running,
  }
}
