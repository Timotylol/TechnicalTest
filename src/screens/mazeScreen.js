import { CONFIG } from '../config.js'
import { saveRecord } from '../api.js'
import mazesData from '../data/mazes.json'
import { createTiltInput } from '../engine/tiltInput.js'
import {
  stepBall,
  resolveWallCollisions,
  isBallInCircle,
  createPhysicsLoop,
} from '../engine/ballPhysics.js'

function loadImage(src) {
  const img = new Image()
  img.src = src
  return img
}

export function mount(container, ctx) {
  const mazeLayout = mazesData[CONFIG.miniGame.mazeId] || mazesData['classic-1']

  const bgImg = loadImage('/assets/Background.png')
  const playerImg = loadImage('/assets/Player.png')
  const goalImg = loadImage('/assets/Goal.png')
  const badImg = loadImage('/assets/Bad.png')
  const wallImg = loadImage('/assets/Wall.png')
  const wallTallImg = loadImage('/assets/Wall2.png')
  const wallSquareImg = loadImage('/assets/Wall3.png')

  let timeRemainingSec = CONFIG.miniGame.timeLimitSec
  let isFinished = false
  let isDestroyed = false

  let respawningUntil = 0
  let invulnUntil = 0

  let arenaWidth = 340
  let arenaHeight = 460
  const ball = { x: 48, y: 48, vx: 0, vy: 0, r: 16 }
  let walls = []
  let holes = []
  let goal = { x: 280, y: 400, r: 24 }
  let startPos = { x: 48, y: 48 }

  container.innerHTML = `
    <section class="screen maze-screen" aria-label="Tilt-Ball Maze">
      <div class="game-hud">
        <button type="button" class="hud-btn" id="maze-back-btn" aria-label="Back to Menu">
          ← Back
        </button>
        <div class="hud-stats">
          <span class="hud-pill hud-pill-timer" id="maze-timer">${CONFIG.miniGame.timeLimitSec}s</span>
        </div>
        <div class="hud-controls">
          <button type="button" class="hud-btn" id="maze-recenter-btn" title="Re-center tilt">
            Re-center
          </button>
          <button type="button" class="hud-btn hud-btn-mode" id="maze-mode-btn">
            Tilt
          </button>
        </div>
      </div>

      <div class="maze-banner">
        <p class="quiz-hint" id="maze-hint-text">Tilt to reach the green flag! Avoid the cacti.</p>
      </div>

      <div class="arena-wrap maze-arena-wrap" id="maze-arena-wrap">
        <canvas class="game-canvas" id="maze-canvas"></canvas>
        <div class="feedback-toast" id="maze-toast" hidden></div>
      </div>

      <div class="result-overlay" id="maze-result-overlay" hidden></div>
    </section>
  `

  const backBtn = container.querySelector('#maze-back-btn')
  const timerEl = container.querySelector('#maze-timer')
  const recenterBtn = container.querySelector('#maze-recenter-btn')
  const modeBtn = container.querySelector('#maze-mode-btn')
  const hintTextEl = container.querySelector('#maze-hint-text')
  const arenaWrap = container.querySelector('#maze-arena-wrap')
  const canvas = container.querySelector('#maze-canvas')
  const toastEl = container.querySelector('#maze-toast')
  const resultOverlay = container.querySelector('#maze-result-overlay')
  const canvasCtx = canvas.getContext('2d')

  let toastTimer = null

  function updateModeUI(mode) {
    modeBtn.textContent = mode === 'tilt' ? 'Tilt' : 'Drag / Tap'
    if (mode === 'tilt') {
      hintTextEl.textContent = 'Tilt to roll the ball to the flag! Avoid the cacti.'
    } else if (typeof window !== 'undefined' && !window.isSecureContext) {
      hintTextEl.textContent = 'Tilt needs HTTPS on phone — drag anywhere to steer the ball'
    } else {
      hintTextEl.textContent = 'Drag anywhere on the board to steer the ball to the flag!'
    }
  }

  const tiltInput = createTiltInput({
    targetEl: canvas,
    initialMode: 'tilt',
    onModeChange: (nextMode) => {
      updateModeUI(nextMode)
    },
  })
  updateModeUI(tiltInput.getMode())

  function showToast(text, durationMs = 900) {
    if (toastTimer !== null) window.clearTimeout(toastTimer)
    toastEl.hidden = false
    toastEl.className = 'feedback-toast is-wrong'
    toastEl.textContent = text
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true
      toastTimer = null
    }, durationMs)
  }

  function rebuildGeometry(resetBall = false) {
    const minDim = Math.min(arenaWidth, arenaHeight)
    ball.r = Math.max(12, Math.min(18, minDim * 0.044))

    startPos = {
      x: mazeLayout.start.x * arenaWidth,
      y: mazeLayout.start.y * arenaHeight,
    }
    goal = {
      x: mazeLayout.goal.x * arenaWidth,
      y: mazeLayout.goal.y * arenaHeight,
      r: mazeLayout.goal.r * minDim,
    }
    walls = mazeLayout.walls.map((w) => ({
      x: w.x * arenaWidth,
      y: w.y * arenaHeight,
      w: w.w * arenaWidth,
      h: w.h * arenaHeight,
    }))
    holes = mazeLayout.holes.map((h) => ({
      x: h.x * arenaWidth,
      y: h.y * arenaHeight,
      r: h.r * minDim,
    }))

    if (resetBall) {
      ball.x = startPos.x
      ball.y = startPos.y
      ball.vx = 0
      ball.vy = 0
    }
  }

  function resizeCanvas() {
    const rect = arenaWrap.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const prevW = arenaWidth
    const prevH = arenaHeight
    arenaWidth = rect.width
    arenaHeight = rect.height

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(arenaWidth * dpr)
    canvas.height = Math.round(arenaHeight * dpr)
    canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const wasInitial = prevW === 340 && prevH === 460 && ball.x === 48 && ball.y === 48
    rebuildGeometry(wasInitial)
    if (!wasInitial && prevW > 0 && prevH > 0) {
      ball.x = (ball.x / prevW) * arenaWidth
      ball.y = (ball.y / prevH) * arenaHeight
    }
  }

  function updateTimerUI() {
    const secs = Math.max(0, Math.ceil(timeRemainingSec))
    timerEl.textContent = `${secs}s`
    timerEl.classList.toggle('is-urgent', secs <= 10)
  }

  function drawWall(wall) {
    const isHorizontal = wall.w > wall.h
    const ratio = isHorizontal ? wall.w / wall.h : wall.h / wall.w
    let sprite = wallSquareImg
    if (ratio >= 3.2) {
      sprite = wallTallImg
    } else if (ratio >= 1.5) {
      sprite = wallImg
    }

    if (sprite.complete && sprite.naturalWidth > 0) {
      canvasCtx.save()
      if (isHorizontal) {
        canvasCtx.translate(wall.x + wall.w / 2, wall.y + wall.h / 2)
        canvasCtx.rotate(Math.PI / 2)
        canvasCtx.drawImage(sprite, -wall.h / 2, -wall.w / 2, wall.h, wall.w)
      } else {
        canvasCtx.drawImage(sprite, wall.x, wall.y, wall.w, wall.h)
      }
      canvasCtx.restore()
    } else {
      canvasCtx.fillStyle = '#8d99ae'
      canvasCtx.fillRect(wall.x, wall.y, wall.w, wall.h)
      canvasCtx.strokeStyle = '#4a5568'
      canvasCtx.lineWidth = 2
      canvasCtx.strokeRect(wall.x, wall.y, wall.w, wall.h)
    }
  }

  function drawScene(now) {
    canvasCtx.clearRect(0, 0, arenaWidth, arenaHeight)

    if (bgImg.complete && bgImg.naturalWidth > 0) {
      canvasCtx.drawImage(bgImg, 0, 0, arenaWidth, arenaHeight)
    } else {
      canvasCtx.fillStyle = '#a47148'
      canvasCtx.fillRect(0, 0, arenaWidth, arenaHeight)
    }

    // Start pad
    canvasCtx.save()
    canvasCtx.beginPath()
    canvasCtx.arc(startPos.x, startPos.y, ball.r * 1.15, 0, Math.PI * 2)
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    canvasCtx.fill()
    canvasCtx.restore()

    // Goal pad + flag
    canvasCtx.save()
    canvasCtx.beginPath()
    canvasCtx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2)
    canvasCtx.fillStyle = 'rgba(216, 243, 220, 0.9)'
    canvasCtx.fill()
    canvasCtx.lineWidth = 3
    canvasCtx.strokeStyle = '#2b9348'
    canvasCtx.stroke()
    if (goalImg.complete && goalImg.naturalWidth > 0) {
      const iconSize = goal.r * 1.45
      canvasCtx.drawImage(
        goalImg,
        goal.x - iconSize / 2,
        goal.y - iconSize / 2,
        iconSize,
        iconSize
      )
    }
    canvasCtx.restore()

    // Hazards (cacti)
    holes.forEach((hole) => {
      canvasCtx.save()
      canvasCtx.beginPath()
      canvasCtx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2)
      canvasCtx.fillStyle = 'rgba(40, 22, 12, 0.25)'
      canvasCtx.fill()
      if (badImg.complete && badImg.naturalWidth > 0) {
        const size = hole.r * 2.1
        canvasCtx.drawImage(badImg, hole.x - size / 2, hole.y - size / 2, size, size)
      } else {
        canvasCtx.fillStyle = '#2b9348'
        canvasCtx.fill()
      }
      canvasCtx.restore()
    })

    // Walls
    walls.forEach(drawWall)

    // Player ball
    const isRespawning = now < respawningUntil
    const isInvuln = now < invulnUntil
    const scale = isRespawning ? 0.55 : 1
    const alpha = isInvuln && Math.floor(now / 80) % 2 === 0 ? 0.45 : 1

    canvasCtx.save()
    canvasCtx.globalAlpha = alpha
    canvasCtx.beginPath()
    canvasCtx.arc(ball.x + 2, ball.y + 4, ball.r * scale, 0, Math.PI * 2)
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.24)'
    canvasCtx.fill()

    if (playerImg.complete && playerImg.naturalWidth > 0) {
      const size = ball.r * 2 * scale
      canvasCtx.drawImage(playerImg, ball.x - size / 2, ball.y - size / 2, size, size)
    } else {
      canvasCtx.beginPath()
      canvasCtx.arc(ball.x, ball.y, ball.r * scale, 0, Math.PI * 2)
      canvasCtx.fillStyle = '#2a9d8f'
      canvasCtx.fill()
    }
    canvasCtx.restore()
  }

  function finishMaze(passed) {
    if (isFinished) return
    isFinished = true
    loop.stop()

    const elapsedSec = Math.max(
      1,
      Math.round(CONFIG.miniGame.timeLimitSec - Math.max(0, timeRemainingSec))
    )
    const score = passed ? CONFIG.miniGame.maxScore : 0

    saveRecord({
      type: 'game_result',
      game: 'minigame',
      passed,
      score,
      maxScore: CONFIG.miniGame.maxScore,
      durationSec: elapsedSec,
      sessionId: ctx.getState().sessionId,
    }).catch(() => {})

    const currentState = ctx.getState()
    const nextPatch = {}
    if (passed) {
      nextPatch.miniGamePassed = true
      nextPatch.miniGameBestTime =
        currentState.miniGameBestTime === null
          ? elapsedSec
          : Math.min(currentState.miniGameBestTime, elapsedSec)
    }
    const updated = ctx.updateState(nextPatch)
    const bothPassed = updated.quizPassed && updated.miniGamePassed

    resultOverlay.hidden = false
    resultOverlay.innerHTML = `
      <div class="result-card">
        <span class="result-badge ${passed ? 'is-pass' : 'is-fail'}">
          ${passed ? 'Maze Cleared!' : "Time's Up!"}
        </span>
        <h2 class="result-title">${passed ? `Finished in ${elapsedSec}s` : 'So Close!'}</h2>
        <p class="result-desc">
          ${
            passed
              ? 'Awesome control! You guided the ball to the goal.'
              : 'Reach the green flag before the 60s timer runs out.'
          }
        </p>
        <div class="result-actions">
          ${
            bothPassed
              ? '<button type="button" class="btn btn-prize btn-xl" id="maze-claim-btn">View Prize Claim ID</button>'
              : ''
          }
          <button type="button" class="btn btn-primary btn-xl" id="maze-retry-btn">
            Try Again
          </button>
          <button type="button" class="btn btn-secondary btn-xl" id="maze-menu-btn">
            Back to Menu
          </button>
        </div>
      </div>
    `

    resultOverlay.querySelector('#maze-claim-btn')?.addEventListener('click', () => {
      ctx.navigate('final')
    })
    resultOverlay.querySelector('#maze-retry-btn').addEventListener('click', restartMaze)
    resultOverlay.querySelector('#maze-menu-btn').addEventListener('click', () => {
      ctx.navigate('menu')
    })
  }

  function restartMaze() {
    timeRemainingSec = CONFIG.miniGame.timeLimitSec
    isFinished = false
    respawningUntil = 0
    invulnUntil = 0
    resultOverlay.hidden = true
    resultOverlay.innerHTML = ''
    toastEl.hidden = true
    updateTimerUI()
    rebuildGeometry(true)
    loop.start()
  }

  const loop = createPhysicsLoop((dt, now) => {
    if (isFinished || isDestroyed) return

    timeRemainingSec = Math.max(0, timeRemainingSec - dt)
    updateTimerUI()

    if (timeRemainingSec <= 0) {
      drawScene(now)
      finishMaze(false)
      return
    }

    if (now >= respawningUntil) {
      const vec = tiltInput.getVector()
      stepBall(ball, vec, { width: arenaWidth, height: arenaHeight }, CONFIG.physics, dt)
      resolveWallCollisions(ball, walls, CONFIG.physics.wallBounce)

      if (now >= invulnUntil) {
        for (let i = 0; i < holes.length; i += 1) {
          const hole = holes[i]
          const dist = Math.hypot(ball.x - hole.x, ball.y - hole.y)
          if (dist < hole.r + ball.r * 0.45) {
            respawningUntil = now + 350
            invulnUntil = now + 350 + CONFIG.miniGame.respawnInvulnMs
            if (CONFIG.miniGame.holePenaltySec > 0) {
              timeRemainingSec = Math.max(0, timeRemainingSec - CONFIG.miniGame.holePenaltySec)
            }
            ball.x = startPos.x
            ball.y = startPos.y
            ball.vx = 0
            ball.vy = 0
            showToast('Ouch! Back to start', 850)
            break
          }
        }
      }

      if (isBallInCircle(ball, goal)) {
        drawScene(now)
        finishMaze(true)
        return
      }
    }

    drawScene(now)
  })

  const handleBack = () => ctx.navigate('menu')
  const handleRecenter = async () => {
    await tiltInput.requestPermission()
    tiltInput.calibrate()
  }
  const handleToggleMode = async () => {
    const next = tiltInput.getMode() === 'tilt' ? 'drag' : 'tilt'
    if (next === 'tilt') {
      await tiltInput.requestPermission()
    }
    tiltInput.setMode(next)
  }

  backBtn.addEventListener('click', handleBack)
  recenterBtn.addEventListener('click', handleRecenter)
  modeBtn.addEventListener('click', handleToggleMode)

  let resizeObserver = null
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(arenaWrap)
  }
  window.addEventListener('resize', resizeCanvas)

  updateTimerUI()
  resizeCanvas()
  rebuildGeometry(true)
  loop.start()

  return () => {
    isDestroyed = true
    loop.stop()
    if (toastTimer !== null) window.clearTimeout(toastTimer)
    resizeObserver?.disconnect()
    window.removeEventListener('resize', resizeCanvas)
    backBtn.removeEventListener('click', handleBack)
    recenterBtn.removeEventListener('click', handleRecenter)
    modeBtn.removeEventListener('click', handleToggleMode)
    tiltInput.destroy()
  }
}
