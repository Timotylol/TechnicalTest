import { CONFIG } from '../config.js'
import { issueClaim, saveRecord } from '../api.js'

export function mount(container, ctx) {
  const initialState = ctx.getState()
  if (!(initialState.quizPassed && initialState.miniGamePassed)) {
    ctx.navigate('menu')
    return () => {}
  }

  let destroyed = false
  let viewLogged = false

  function renderLoading() {
    container.innerHTML = `
      <section class="screen final-screen" aria-label="Prize Claim">
        <div class="card-panel final-card">
          <span class="event-pill">${CONFIG.event.eventName}</span>
          <h1 class="final-title">${CONFIG.copy.finalWinTitle}</h1>
          <p class="final-subtitle">Generating your unique Claim ID…</p>
        </div>
      </section>
    `
  }

  function renderError(cachedClaimId) {
    container.innerHTML = `
      <section class="screen final-screen" aria-label="Prize Claim">
        <div class="card-panel final-card">
          <span class="event-pill">${CONFIG.event.eventName}</span>
          <h1 class="final-title">${CONFIG.copy.finalWinTitle}</h1>
          ${
            cachedClaimId
              ? `
                <p class="final-subtitle">${CONFIG.copy.finalWinBody}</p>
                <div class="claim-id-box">
                  <span class="claim-id-label">Your Claim ID</span>
                  <strong class="claim-id-code">${cachedClaimId}</strong>
                  <span class="claim-status-badge is-offline">Unverified (Offline)</span>
                </div>
              `
              : '<p class="final-subtitle">Could not reach the server to issue your Claim ID.</p>'
          }
          <div class="final-actions">
            <button type="button" class="btn btn-primary btn-xl" id="final-retry-btn">
              Retry Connection
            </button>
            <button type="button" class="btn btn-secondary btn-xl" id="final-menu-btn">
              Back to Menu
            </button>
          </div>
        </div>
      </section>
    `
    container.querySelector('#final-retry-btn').addEventListener('click', loadClaim)
    container.querySelector('#final-menu-btn').addEventListener('click', () => ctx.navigate('menu'))
  }

  function renderReady(claim) {
    const isClaimed = Boolean(claim.claimed)
    container.innerHTML = `
      <section class="screen final-screen" aria-label="Prize Claim">
        <button
          type="button"
          class="corner-admin-btn"
          id="final-admin-btn"
          aria-label="Open Admin Dashboard"
          title="Admin"
        >
          <img src="/assets/gear.png" width="22" height="22" alt="" />
        </button>

        <div class="card-panel final-card">
          <span class="event-pill">${CONFIG.event.eventName}</span>
          <h1 class="final-title">${CONFIG.copy.finalWinTitle}</h1>
          <p class="final-subtitle">${CONFIG.copy.finalWinBody}</p>

          <div class="claim-id-box">
            <span class="claim-id-label">Show at Prize Booth</span>
            <strong class="claim-id-code">${claim.claimId}</strong>
            <span class="claim-status-badge ${isClaimed ? 'is-claimed' : 'is-unclaimed'}">
              ${isClaimed ? 'Claimed ✓' : 'Unclaimed'}
            </span>
          </div>

          <div class="final-actions">
            <button type="button" class="btn btn-secondary btn-xl" id="final-refresh-btn">
              Refresh Status
            </button>
            <button type="button" class="btn btn-primary btn-xl" id="final-menu-btn">
              Back to Menu
            </button>
          </div>
        </div>
      </section>
    `

    container.querySelector('#final-admin-btn').addEventListener('click', () => ctx.navigate('admin'))
    container.querySelector('#final-refresh-btn').addEventListener('click', loadClaim)
    container.querySelector('#final-menu-btn').addEventListener('click', () => ctx.navigate('menu'))
  }

  async function loadClaim() {
    renderLoading()
    const state = ctx.getState()
    try {
      const claim = await issueClaim(state.sessionId, CONFIG.event.claimPrefix)
      if (destroyed) return

      if (!state.claimId && claim?.claimId) {
        ctx.updateState({ claimId: claim.claimId })
      }
      if (!viewLogged && claim?.claimId) {
        viewLogged = true
        saveRecord({
          type: 'final_screen_view',
          sessionId: state.sessionId,
          claimId: claim.claimId,
        })
      }
      renderReady(claim)
    } catch {
      if (destroyed) return
      renderError(state.claimId)
    }
  }

  loadClaim()

  return () => {
    destroyed = true
  }
}
