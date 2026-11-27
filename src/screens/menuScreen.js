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
        <img src="/assets/gear.png" width="22" height="22" alt="" />
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
          <span class="game-card-icon" aria-hidden="true">
            <img class="game-card-img" src="/assets/Quiz_Icon.png" alt="" />
          </span>
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
          <span class="game-card-icon" aria-hidden="true">
            <img class="game-card-img" src="/assets/Maze_Icon.png" alt="" />
          </span>
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
