import { CONFIG } from '../config.js'
import { saveRecord } from '../api.js'
import questionsData from '../data/questions.json'
import { createTiltInput } from '../engine/tiltInput.js'
import {
  stepBall,
  isBallInCircle,
  isPointInCircle,
  createPhysicsLoop,
} from '../engine/ballPhysics.js'

function shuffleArray(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function prepareQuestions() {
  const pool = CONFIG.quiz.shuffleQuestions
    ? shuffleArray(questionsData)
    : [...questionsData]
  const count = Math.min(CONFIG.quiz.questionCount, pool.length)
  return pool.slice(0, count)
}

function loadImage(src) {
  const img = new Image()
  img.src = src
  return img
}

function computeZonePositions(count, width, height) {
  if (count === 2) {
    return [
      { x: width * 0.25, y: height * 0.5 },
      { x: width * 0.75, y: height * 0.5 },
    ]
  }
  if (count === 3) {
    return [
      { x: width * 0.27, y: height * 0.27 },
      { x: width * 0.73, y: height * 0.27 },
      { x: width * 0.5, y: height * 0.74 },
    ]
  }
  if (count === 4) {
    return [
      { x: width * 0.26, y: height * 0.26 },
      { x: width * 0.74, y: height * 0.26 },
      { x: width * 0.26, y: height * 0.74 },
      { x: width * 0.74, y: height * 0.74 },
    ]
  }

  const ringRadius = Math.min(width, height) * 0.33
  const cx = width * 0.5
  const cy = height * 0.5
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
    return {
      x: cx + Math.cos(angle) * ringRadius,
      y: cy + Math.sin(angle) * ringRadius,
    }
  })
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.closePath()
}

export function mount(container, ctx) {
  const bgImg = loadImage('/assets/Background.png')
  const playerImg = loadImage('/assets/Player.png')
  const answerImg = loadImage('/assets/Answer.png')

  let questions = prepareQuestions()
  let currentIndex = 0
  let score = 0
  let isFinished = false

  let feedbackState = null // { selectedIndex, correctIndex, isCorrect }
  let feedbackTimer = null

  let dwellZoneIndex = -1
  let dwellElapsedMs = 0

  let arenaWidth = 360
  let arenaHeight = 360
  const ball = { x: 180, y: 180, vx: 0, vy: 0, r: 20 }
  let zones = []

  let tapStart = null
  let isDestroyed = false

  container.innerHTML = `
    <section class="screen quiz-screen" aria-label="Fun-Fact Quiz">
      <div class="game-hud">
        <button type="button" class="hud-btn" id="quiz-back-btn" aria-label="Back to Menu">
          ← Back
        </button>
        <div class="hud-stats">
          <span class="hud-pill" id="quiz-progress">Q 1 / ${questions.length}</span>
          <span class="hud-pill hud-pill-score" id="quiz-score">Score: 0</span>
        </div>
        <div class="hud-controls">
          <button type="button" class="hud-btn" id="quiz-recenter-btn" title="Re-center tilt">
            Re-center
          </button>
          <button type="button" class="hud-btn hud-btn-mode" id="quiz-mode-btn">
            Tilt
          </button>
        </div>
      </div>

      <div class="question-card" aria-live="polite">
        <p class="question-text" id="quiz-question-text"></p>
        <p class="quiz-hint" id="quiz-hint-text">Tilt your phone to roll the ball into an answer</p>
      </div>

      <div class="arena-wrap" id="quiz-arena-wrap">
        <canvas class="game-canvas" id="quiz-canvas"></canvas>
        <div class="feedback-toast" id="quiz-feedback-toast" hidden></div>
      </div>

      <div class="result-overlay" id="quiz-result-overlay" hidden></div>
    </section>
  `

  const backBtn = container.querySelector('#quiz-back-btn')
  const progressEl = container.querySelector('#quiz-progress')
  const scoreEl = container.querySelector('#quiz-score')
  const recenterBtn = container.querySelector('#quiz-recenter-btn')
  const modeBtn = container.querySelector('#quiz-mode-btn')
  const questionTextEl = container.querySelector('#quiz-question-text')
  const hintTextEl = container.querySelector('#quiz-hint-text')
  const arenaWrap = container.querySelector('#quiz-arena-wrap')
  const canvas = container.querySelector('#quiz-canvas')
  const feedbackToast = container.querySelector('#quiz-feedback-toast')
  const resultOverlay = container.querySelector('#quiz-result-overlay')
  const canvasCtx = canvas.getContext('2d')

  function updateModeUI(mode) {
    modeBtn.textContent = mode === 'tilt' ? 'Tilt' : 'Drag / Tap'
    if (mode === 'tilt') {
      hintTextEl.textContent = 'Tilt to roll the ball into an answer'
    } else if (typeof window !== 'undefined' && !window.isSecureContext) {
      hintTextEl.textContent = 'Tilt needs HTTPS on phone — drag or tap an answer'
    } else {
      hintTextEl.textContent = 'Drag to roll the ball, or tap an answer directly'
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

  function rebuildZones() {
    const q = questions[currentIndex]
    if (!q) return
    const zoneR = Math.max(38, Math.min(54, Math.min(arenaWidth, arenaHeight) * 0.145))
    const positions = computeZonePositions(q.options.length, arenaWidth, arenaHeight)
    zones = q.options.map((label, idx) => ({
      x: positions[idx].x,
      y: positions[idx].y,
      r: zoneR,
      label,
    }))
    ball.r = Math.max(16, Math.min(22, Math.min(arenaWidth, arenaHeight) * 0.056))
  }

  function resetBallToCenter() {
    ball.x = arenaWidth / 2
    ball.y = arenaHeight / 2
    ball.vx = 0
    ball.vy = 0
    dwellZoneIndex = -1
    dwellElapsedMs = 0
  }

  function renderQuestionHeader() {
    const q = questions[currentIndex]
    progressEl.textContent = `Q ${currentIndex + 1} / ${questions.length}`
    scoreEl.textContent = `Score: ${score}`
    questionTextEl.textContent = q ? q.question : ''
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

    if (prevW > 0 && prevH > 0) {
      ball.x = (ball.x / prevW) * arenaWidth
      ball.y = (ball.y / prevH) * arenaHeight
    } else {
      ball.x = arenaWidth / 2
      ball.y = arenaHeight / 2
    }
    rebuildZones()
  }

  function drawScene() {
    canvasCtx.clearRect(0, 0, arenaWidth, arenaHeight)

    // Board background
    if (bgImg.complete && bgImg.naturalWidth > 0) {
      canvasCtx.drawImage(bgImg, 0, 0, arenaWidth, arenaHeight)
    } else {
      canvasCtx.fillStyle = '#e9f5db'
      canvasCtx.fillRect(0, 0, arenaWidth, arenaHeight)
    }

    // Answer zones
    zones.forEach((zone, idx) => {
      let fill = 'rgba(255, 255, 255, 0.9)'
      let stroke = 'rgba(29, 53, 87, 0.22)'

      if (feedbackState) {
        if (idx === feedbackState.correctIndex) {
          fill = 'rgba(216, 243, 220, 0.96)'
          stroke = '#2b9348'
        } else if (idx === feedbackState.selectedIndex && !feedbackState.isCorrect) {
          fill = 'rgba(255, 224, 224, 0.96)'
          stroke = '#d62828'
        }
      } else if (idx === dwellZoneIndex) {
        fill = 'rgba(255, 250, 224, 0.96)'
        stroke = '#2a9d8f'
      }

      // Zone circle
      canvasCtx.save()
      canvasCtx.beginPath()
      canvasCtx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2)
      canvasCtx.fillStyle = fill
      canvasCtx.fill()
      canvasCtx.lineWidth = 4
      canvasCtx.strokeStyle = stroke
      canvasCtx.stroke()

      // Radial dwell progress ring
      if (!feedbackState && idx === dwellZoneIndex && dwellElapsedMs > 0) {
        const progress = Math.min(1, dwellElapsedMs / CONFIG.quiz.dwellMs)
        canvasCtx.beginPath()
        canvasCtx.arc(
          zone.x,
          zone.y,
          zone.r + 3,
          -Math.PI / 2,
          -Math.PI / 2 + progress * Math.PI * 2
        )
        canvasCtx.lineWidth = 6
        canvasCtx.lineCap = 'round'
        canvasCtx.strokeStyle = '#fb8500'
        canvasCtx.stroke()
      }

      // Answer icon
      const iconSize = Math.round(zone.r * 0.72)
      if (answerImg.complete && answerImg.naturalWidth > 0) {
        canvasCtx.drawImage(
          answerImg,
          zone.x - iconSize / 2,
          zone.y - iconSize / 2 - 8,
          iconSize,
          iconSize
        )
      }

      // Option label pill
      canvasCtx.font = '700 13px system-ui, -apple-system, sans-serif'
      const textWidth = canvasCtx.measureText(zone.label).width
      const pillW = Math.min(Math.max(textWidth + 18, 56), arenaWidth * 0.44)
      const pillH = 24
      const pillX = Math.max(6, Math.min(arenaWidth - pillW - 6, zone.x - pillW / 2))
      const pillY = Math.min(arenaHeight - pillH - 4, zone.y + zone.r * 0.48)

      drawRoundedRect(canvasCtx, pillX, pillY, pillW, pillH, 10)
      canvasCtx.fillStyle = '#1d3557'
      canvasCtx.fill()

      canvasCtx.fillStyle = '#ffffff'
      canvasCtx.textAlign = 'center'
      canvasCtx.textBaseline = 'middle'
      canvasCtx.fillText(zone.label, pillX + pillW / 2, pillY + pillH / 2 + 0.5, pillW - 10)
      canvasCtx.restore()
    })

    // Player ball shadow + sprite
    canvasCtx.save()
    canvasCtx.beginPath()
    canvasCtx.ellipse(
      ball.x + 2,
      ball.y + ball.r * 0.78,
      ball.r * 0.85,
      ball.r * 0.36,
      0,
      0,
      Math.PI * 2
    )
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.24)'
    canvasCtx.fill()

    if (playerImg.complete && playerImg.naturalWidth > 0) {
      canvasCtx.drawImage(
        playerImg,
        ball.x - ball.r,
        ball.y - ball.r,
        ball.r * 2,
        ball.r * 2
      )
    } else {
      canvasCtx.beginPath()
      canvasCtx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
      canvasCtx.fillStyle = '#e86f51'
      canvasCtx.fill()
      canvasCtx.lineWidth = 3
      canvasCtx.strokeStyle = '#ffffff'
      canvasCtx.stroke()
    }
    canvasCtx.restore()
  }

  function finishQuiz() {
    isFinished = true
    loop.stop()

    const total = questions.length
    const passThreshold = Math.ceil(total * CONFIG.quiz.passMark)
    const passed = score >= passThreshold

    saveRecord({
      type: 'game_result',
      game: 'quiz',
      passed,
      score,
      maxScore: total,
      sessionId: ctx.getState().sessionId,
    }).catch(() => {})

    const currentState = ctx.getState()
    const nextPatch = {
      quizBestScore: Math.max(currentState.quizBestScore || 0, score),
    }
    if (passed) {
      nextPatch.quizPassed = true
    }
    const updated = ctx.updateState(nextPatch)
    const bothPassed = updated.quizPassed && updated.miniGamePassed

    resultOverlay.hidden = false
    resultOverlay.innerHTML = `
      <div class="result-card">
        <span class="result-badge ${passed ? 'is-pass' : 'is-fail'}">
          ${passed ? 'Quiz Passed!' : 'Keep Trying!'}
        </span>
        <h2 class="result-title">${score} / ${total} Correct</h2>
        <p class="result-desc">
          ${
            passed
              ? 'Great job! You cleared the Fun-Fact Quiz.'
              : `You need at least ${passThreshold} correct answers to pass.`
          }
        </p>
        <div class="result-actions">
          ${
            bothPassed
              ? '<button type="button" class="btn btn-prize btn-xl" id="quiz-claim-btn">View Prize Claim ID</button>'
              : ''
          }
          <button type="button" class="btn btn-primary btn-xl" id="quiz-retry-btn">
            Try Again
          </button>
          <button type="button" class="btn btn-secondary btn-xl" id="quiz-menu-btn">
            Back to Menu
          </button>
        </div>
      </div>
    `

    const claimBtn = resultOverlay.querySelector('#quiz-claim-btn')
    const retryBtn = resultOverlay.querySelector('#quiz-retry-btn')
    const menuBtn = resultOverlay.querySelector('#quiz-menu-btn')

    claimBtn?.addEventListener('click', () => ctx.navigate('final'))
    retryBtn.addEventListener('click', restartQuiz)
    menuBtn.addEventListener('click', () => ctx.navigate('menu'))
  }

  function lockAnswer(selectedIndex) {
    if (feedbackState || isFinished || isDestroyed) return
    const q = questions[currentIndex]
    const isCorrect = selectedIndex === q.answerIndex
    if (isCorrect) {
      score += 1
      scoreEl.textContent = `Score: ${score}`
    }

    feedbackState = {
      selectedIndex,
      correctIndex: q.answerIndex,
      isCorrect,
    }

    feedbackToast.hidden = false
    feedbackToast.className = `feedback-toast ${isCorrect ? 'is-correct' : 'is-wrong'}`
    feedbackToast.textContent = isCorrect ? 'Correct! ✓' : 'Not quite!'

    feedbackTimer = window.setTimeout(() => {
      if (isDestroyed) return
      feedbackState = null
      feedbackToast.hidden = true
      currentIndex += 1
      if (currentIndex >= questions.length) {
        finishQuiz()
      } else {
        renderQuestionHeader()
        rebuildZones()
        resetBallToCenter()
      }
    }, CONFIG.quiz.feedbackMs)
  }

  function restartQuiz() {
    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer)
      feedbackTimer = null
    }
    questions = prepareQuestions()
    currentIndex = 0
    score = 0
    isFinished = false
    feedbackState = null
    feedbackToast.hidden = true
    resultOverlay.hidden = true
    resultOverlay.innerHTML = ''
    renderQuestionHeader()
    rebuildZones()
    resetBallToCenter()
    loop.start()
  }

  const loop = createPhysicsLoop((dt) => {
    if (isFinished) return

    if (!feedbackState) {
      const vec = tiltInput.getVector()
      stepBall(ball, vec, { width: arenaWidth, height: arenaHeight }, CONFIG.physics, dt)

      let hitIndex = -1
      for (let i = 0; i < zones.length; i += 1) {
        if (isBallInCircle(ball, zones[i])) {
          hitIndex = i
          break
        }
      }

      if (hitIndex !== -1) {
        if (dwellZoneIndex === hitIndex) {
          dwellElapsedMs += dt * 1000
        } else {
          dwellZoneIndex = hitIndex
          dwellElapsedMs = dt * 1000
        }
        if (dwellElapsedMs >= CONFIG.quiz.dwellMs) {
          lockAnswer(hitIndex)
        }
      } else {
        dwellZoneIndex = -1
        dwellElapsedMs = 0
      }
    }

    drawScene()
  })

  function handleCanvasPointerDown(e) {
    tapStart = { x: e.clientX, y: e.clientY }
  }

  function handleCanvasPointerUp(e) {
    if (!tapStart || tiltInput.getMode() !== 'drag' || feedbackState || isFinished) {
      tapStart = null
      return
    }
    const moveDist = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y)
    tapStart = null
    if (moveDist > 12) return

    const rect = canvas.getBoundingClientRect()
    const lx = e.clientX - rect.left
    const ly = e.clientY - rect.top
    for (let i = 0; i < zones.length; i += 1) {
      if (isPointInCircle(lx, ly, zones[i])) {
        lockAnswer(i)
        break
      }
    }
  }

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
  canvas.addEventListener('pointerdown', handleCanvasPointerDown)
  canvas.addEventListener('pointerup', handleCanvasPointerUp)

  let resizeObserver = null
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(arenaWrap)
  } else {
    window.addEventListener('resize', resizeCanvas)
  }

  renderQuestionHeader()
  resizeCanvas()
  resetBallToCenter()
  loop.start()

  return () => {
    isDestroyed = true
    loop.stop()
    tiltInput.destroy()
    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer)
      feedbackTimer = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
    } else {
      window.removeEventListener('resize', resizeCanvas)
    }
    backBtn.removeEventListener('click', handleBack)
    recenterBtn.removeEventListener('click', handleRecenter)
    modeBtn.removeEventListener('click', handleToggleMode)
    canvas.removeEventListener('pointerdown', handleCanvasPointerDown)
    canvas.removeEventListener('pointerup', handleCanvasPointerUp)
  }
}
