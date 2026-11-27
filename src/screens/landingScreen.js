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
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
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
