import { CONFIG } from '../config.js'
import { saveRecord } from '../api.js'

export function mount(container, ctx) {
  const state = ctx.getState()
  const completedCount =
    (state.quizPassed ? 1 : 0) + (state.miniGamePassed ? 1 : 0)
  const bothPassed = state.quizPassed && state.miniGamePassed

  container.innerHTML = `
    <section class="screen menu-screen" aria-label="Game Menu">
      <button
        type="button"
        class="corner-admin-btn"
        id="menu-admin-btn"
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
        <h1 class="menu-title">${CONFIG.copy.menuTitle}</h1>
        <p class="menu-subtitle">${CONFIG.copy.menuSubtitle}</p>
        <div
          class="progress-badge ${bothPassed ? 'is-complete' : ''}"
          aria-live="polite"
        >
          ${completedCount}/2 Challenges Complete
        </div>
      </header>

      <div class="menu-cards">
        <button
          type="button"
          class="game-card-btn game-card-quiz ${state.quizPassed ? 'is-passed' : ''}"
          id="pick-quiz-btn"
        >
          <span class="game-card-icon" aria-hidden="true">🎯</span>
          <span class="game-card-text">
            <span class="game-card-title">${CONFIG.copy.quizButton}</span>
            <span class="game-card-desc">Tilt the ball to answer fun facts</span>
          </span>
          ${
            state.quizPassed
              ? '<span class="passed-badge">Passed ✓</span>'
              : '<span class="play-arrow" aria-hidden="true">→</span>'
          }
        </button>

        <button
          type="button"
          class="game-card-btn game-card-maze ${state.miniGamePassed ? 'is-passed' : ''}"
          id="pick-minigame-btn"
        >
          <span class="game-card-icon" aria-hidden="true">🌀</span>
          <span class="game-card-text">
            <span class="game-card-title">${CONFIG.copy.miniGameButton}</span>
            <span class="game-card-desc">Roll to the goal in under ${CONFIG.miniGame.timeLimitSec}s</span>
          </span>
          ${
            state.miniGamePassed
              ? '<span class="passed-badge">Passed ✓</span>'
              : '<span class="play-arrow" aria-hidden="true">→</span>'
          }
        </button>
      </div>

      ${
        bothPassed
          ? `
        <div class="claim-cta-wrap">
          <button type="button" class="btn btn-prize btn-xl" id="view-claim-btn">
            View Prize Claim ID
          </button>
        </div>
      `
          : ''
      }
    </section>
  `

  const quizBtn = container.querySelector('#pick-quiz-btn')
  const miniGameBtn = container.querySelector('#pick-minigame-btn')
  const adminBtn = container.querySelector('#menu-admin-btn')
  const claimBtn = container.querySelector('#view-claim-btn')

  const handlePickQuiz = () => {
    saveRecord({
      type: 'game_picked',
      game: 'quiz',
      sessionId: ctx.getState().sessionId,
    }).catch(() => {})
    ctx.navigate('quiz')
  }

  const handlePickMiniGame = () => {
    saveRecord({
      type: 'game_picked',
      game: 'minigame',
      sessionId: ctx.getState().sessionId,
    }).catch(() => {})
    ctx.navigate('minigame')
  }

  const handleAdminClick = () => {
    ctx.navigate('admin')
  }

  const handleClaimClick = () => {
    ctx.navigate('final')
  }

  quizBtn.addEventListener('click', handlePickQuiz)
  miniGameBtn.addEventListener('click', handlePickMiniGame)
  adminBtn.addEventListener('click', handleAdminClick)
  if (claimBtn) {
    claimBtn.addEventListener('click', handleClaimClick)
  }

  return () => {
    quizBtn.removeEventListener('click', handlePickQuiz)
    miniGameBtn.removeEventListener('click', handlePickMiniGame)
    adminBtn.removeEventListener('click', handleAdminClick)
    if (claimBtn) {
      claimBtn.removeEventListener('click', handleClaimClick)
    }
  }
}
