import { CONFIG } from '../config.js'

const WALK_IN_DURATION_MS = 950

function requestTiltPermissionNonBlocking() {
  try {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      DeviceOrientationEvent.requestPermission().catch(() => {
        // Non-blocking: tiltInput will handle fallback if denied
      })
    }
  } catch {
    // Ignore permission API errors on unsupported browsers
  }
}

export function mount(container, ctx) {
  let walkTimer = null
  let isEntering = false

  container.innerHTML = `
    <section class="screen landing-screen" aria-label="Welcome">
      <button
        type="button"
        class="corner-admin-btn"
        id="landing-admin-btn"
        aria-label="Open Admin Dashboard"
        title="Admin"
      >
        <img src="/assets/gear.png" width="22" height="22" alt="" />
      </button>

      <header class="screen-header">
        <span class="event-pill">${CONFIG.event.eventName}</span>
        <h1 class="hero-title">${CONFIG.copy.landingTitle}</h1>
        <p class="hero-subtitle">${CONFIG.copy.landingSubtitle}</p>
      </header>

      <div class="entrance-stage" id="entrance-stage">
        <div
          class="building-sprite"
          role="img"
          aria-label="${CONFIG.event.clientName} building entrance"
        ></div>

        <!-- Player character outside the door -->
        <div class="player-character" id="player-character" aria-hidden="true">
          <img class="player-sprite" src="/assets/Man.png" alt="" />
        </div>
      </div>

      <div class="landing-actions">
        <button type="button" class="btn btn-primary btn-xl" id="enter-club-btn">
          ${CONFIG.copy.startButton}
        </button>
        <p class="club-caption">${CONFIG.event.clientName}</p>
      </div>
    </section>
  `

  const enterBtn = container.querySelector('#enter-club-btn')
  const adminBtn = container.querySelector('#landing-admin-btn')
  const stage = container.querySelector('#entrance-stage')

  const handleEnterClick = () => {
    if (isEntering) return
    isEntering = true

    requestTiltPermissionNonBlocking()
    try {
      screen.orientation?.lock?.('portrait')?.catch?.(() => {})
    } catch {
      // Orientation lock not supported on all mobile browsers (CSS overlay handles fallback)
    }

    enterBtn.disabled = true
    enterBtn.textContent = 'Entering…'
    stage.classList.add('is-entering')

    walkTimer = window.setTimeout(() => {
      ctx.navigate('menu')
    }, WALK_IN_DURATION_MS)
  }

  const handleAdminClick = () => {
    if (isEntering) return
    ctx.navigate('admin')
  }

  enterBtn.addEventListener('click', handleEnterClick)
  adminBtn.addEventListener('click', handleAdminClick)

  return () => {
    if (walkTimer !== null) {
      window.clearTimeout(walkTimer)
      walkTimer = null
    }
    enterBtn.removeEventListener('click', handleEnterClick)
    adminBtn.removeEventListener('click', handleAdminClick)
  }
}
