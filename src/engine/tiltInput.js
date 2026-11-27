import { CONFIG } from '../config.js'

const TILT_DETECT_TIMEOUT_MS = 1000
const DRAG_MAX_RADIUS_PX = 64

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeTiltAxis(deg, deadzoneDeg, maxTiltDeg) {
  const abs = Math.abs(deg)
  if (abs <= deadzoneDeg) return 0
  const clamped = Math.min(abs, maxTiltDeg)
  return Math.sign(deg) * ((clamped - deadzoneDeg) / (maxTiltDeg - deadzoneDeg))
}

function getScreenOrientationAngle() {
  if (typeof window === 'undefined') return 0
  if (window.screen?.orientation && typeof window.screen.orientation.angle === 'number') {
    return window.screen.orientation.angle
  }
  if (typeof window.orientation === 'number') {
    return window.orientation
  }
  return 0
}

function mapOrientationAxes(dGamma, dBeta) {
  const angle = getScreenOrientationAngle()
  if (angle === 90) return { rawX: dBeta, rawY: -dGamma }
  if (angle === -90 || angle === 270) return { rawX: -dBeta, rawY: dGamma }
  if (angle === 180) return { rawX: -dGamma, rawY: -dBeta }
  return { rawX: dGamma, rawY: dBeta }
}

/**
 * Creates a unified tilt / drag / keyboard input controller.
 * Auto-calibrates on the first valid DeviceOrientation reading and falls back
 * to pointer drag + arrow/WASD keys if no orientation events arrive within 1s.
 */
export function createTiltInput({
  targetEl = null,
  initialMode = 'tilt',
  onModeChange = null,
  onPermissionChange = null,
} = {}) {
  let mode = initialMode === 'drag' ? 'drag' : 'tilt'
  let permissionState = getInitialPermissionState()

  let hasOrientationData = false
  let calibrated = false
  let baseBeta = 0
  let baseGamma = 0
  let lastRawBeta = null
  let lastRawGamma = null

  let tiltVec = { ax: 0, ay: 0 }
  let dragVec = { ax: 0, ay: 0 }
  let dragOrigin = null
  let activePointerId = null

  const pressedKeys = new Set()
  let detectTimer = null
  let destroyed = false

  function getInitialPermissionState() {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      return 'unsupported'
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      return 'prompt'
    }
    return 'granted'
  }

  function clearDetectTimer() {
    if (detectTimer !== null) {
      window.clearTimeout(detectTimer)
      detectTimer = null
    }
  }

  function switchMode(nextMode, reason) {
    if (mode === nextMode) return
    mode = nextMode
    if (mode === 'tilt') {
      dragVec = { ax: 0, ay: 0 }
      dragOrigin = null
      activePointerId = null
    }
    onModeChange?.(mode, reason)
  }

  function handleDeviceOrientation(event) {
    if (destroyed) return
    const { beta, gamma } = event
    if (typeof beta !== 'number' || typeof gamma !== 'number') return

    hasOrientationData = true
    clearDetectTimer()
    lastRawBeta = beta
    lastRawGamma = gamma

    if (!calibrated) {
      baseBeta = beta
      baseGamma = gamma
      calibrated = true
    }

    const { rawX, rawY } = mapOrientationAxes(gamma - baseGamma, beta - baseBeta)
    const { deadzoneDeg, maxTiltDeg } = CONFIG.physics
    tiltVec = {
      ax: normalizeTiltAxis(rawX, deadzoneDeg, maxTiltDeg),
      ay: normalizeTiltAxis(rawY, deadzoneDeg, maxTiltDeg),
    }
  }

  function handlePointerDown(event) {
    if (destroyed || mode !== 'drag') return
    activePointerId = event.pointerId
    dragOrigin = { x: event.clientX, y: event.clientY }
    dragVec = { ax: 0, ay: 0 }
    try {
      targetEl?.setPointerCapture?.(event.pointerId)
    } catch {
      // Ignore pointer capture errors
    }
  }

  function handlePointerMove(event) {
    if (destroyed || mode !== 'drag' || !dragOrigin) return
    if (activePointerId !== null && event.pointerId !== activePointerId) return

    const dx = event.clientX - dragOrigin.x
    const dy = event.clientY - dragOrigin.y
    const dist = Math.hypot(dx, dy)
    if (dist < 4) {
      dragVec = { ax: 0, ay: 0 }
      return
    }

    const scale = Math.min(dist, DRAG_MAX_RADIUS_PX) / DRAG_MAX_RADIUS_PX
    dragVec = {
      ax: (dx / dist) * scale,
      ay: (dy / dist) * scale,
    }
  }

  function handlePointerEnd(event) {
    if (activePointerId !== null && event.pointerId !== activePointerId) return
    activePointerId = null
    dragOrigin = null
    dragVec = { ax: 0, ay: 0 }
  }

  function handleKeyDown(event) {
    if (
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight' ||
      event.code === 'KeyW' ||
      event.code === 'KeyA' ||
      event.code === 'KeyS' ||
      event.code === 'KeyD'
    ) {
      pressedKeys.add(event.code)
    }
  }

  function handleKeyUp(event) {
    pressedKeys.delete(event.code)
  }

  function getKeyboardVector() {
    let kx = 0
    let ky = 0
    if (pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA')) kx -= 1
    if (pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD')) kx += 1
    if (pressedKeys.has('ArrowUp') || pressedKeys.has('KeyW')) ky -= 1
    if (pressedKeys.has('ArrowDown') || pressedKeys.has('KeyS')) ky += 1
    const mag = Math.hypot(kx, ky)
    if (mag > 1) {
      kx /= mag
      ky /= mag
    }
    return { ax: kx, ay: ky }
  }

  function startFallbackTimer() {
    clearDetectTimer()
    if (typeof window === 'undefined' || mode !== 'tilt') return
    if (permissionState === 'unsupported' || permissionState === 'denied') {
      switchMode('drag', 'auto-fallback')
      return
    }
    detectTimer = window.setTimeout(() => {
      if (!destroyed && !hasOrientationData && mode === 'tilt') {
        switchMode('drag', 'auto-fallback')
      }
    }, TILT_DETECT_TIMEOUT_MS)
  }

  async function requestPermission() {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const res = await DeviceOrientationEvent.requestPermission()
        permissionState = res === 'granted' ? 'granted' : 'denied'
      } catch {
        permissionState = 'denied'
      }
      onPermissionChange?.(permissionState)
      if (permissionState === 'denied') {
        switchMode('drag', 'permission-denied')
      } else if (permissionState === 'granted') {
        startFallbackTimer()
      }
    }
    return permissionState
  }

  function calibrate() {
    if (lastRawBeta !== null && lastRawGamma !== null) {
      baseBeta = lastRawBeta
      baseGamma = lastRawGamma
      calibrated = true
      tiltVec = { ax: 0, ay: 0 }
    } else {
      calibrated = false
    }
  }

  function setMode(nextMode) {
    const normalized = nextMode === 'drag' ? 'drag' : 'tilt'
    switchMode(normalized, 'manual')
    if (normalized === 'tilt' && !hasOrientationData) {
      startFallbackTimer()
    }
  }

  function getVector() {
    const keyVec = getKeyboardVector()
    if (mode === 'tilt' && hasOrientationData) {
      return {
        ax: clamp(tiltVec.ax + keyVec.ax, -1, 1),
        ay: clamp(tiltVec.ay + keyVec.ay, -1, 1),
      }
    }
    return {
      ax: clamp(dragVec.ax + keyVec.ax, -1, 1),
      ay: clamp(dragVec.ay + keyVec.ay, -1, 1),
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('deviceorientation', handleDeviceOrientation)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  }

  if (targetEl) {
    targetEl.addEventListener('pointerdown', handlePointerDown)
    targetEl.addEventListener('pointermove', handlePointerMove)
    targetEl.addEventListener('pointerup', handlePointerEnd)
    targetEl.addEventListener('pointercancel', handlePointerEnd)
  }

  startFallbackTimer()

  return {
    getVector,
    calibrate,
    requestPermission,
    setMode,
    getMode: () => mode,
    hasTiltSupport: () => hasOrientationData,
    getPermissionState: () => permissionState,
    destroy() {
      if (destroyed) return
      destroyed = true
      clearDetectTimer()
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleDeviceOrientation)
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
      if (targetEl) {
        targetEl.removeEventListener('pointerdown', handlePointerDown)
        targetEl.removeEventListener('pointermove', handlePointerMove)
        targetEl.removeEventListener('pointerup', handlePointerEnd)
        targetEl.removeEventListener('pointercancel', handlePointerEnd)
      }
    },
  }
}
