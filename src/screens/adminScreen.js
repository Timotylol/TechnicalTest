import { CONFIG } from '../config.js'
import { getAdminSummary, setClaimStatus, resetAdminData, saveRecord } from '../api.js'

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function mount(container, ctx) {
  const requiredPin = String(CONFIG.admin.pin || '')
  let unlocked = requiredPin.length === 0
  let destroyed = false
  let refreshTimer = null

  let summary = null
  let searchQuery = ''
  let confirmReset = false
  let errorMsg = ''

  function renderPinGate(pinError = '') {
    container.innerHTML = `
      <section class="screen admin-screen" aria-label="Admin Unlock">
        <div class="card-panel admin-pin-card">
          <span class="event-pill">${CONFIG.event.eventName}</span>
          <h1 class="placeholder-title">Admin Access</h1>
          <p class="placeholder-desc">Enter the staff PIN to view stats and verify prize claims.</p>
          <form class="admin-pin-form" id="admin-pin-form">
            <input
              type="password"
              inputmode="numeric"
              autocomplete="off"
              class="admin-input"
              id="admin-pin-input"
              placeholder="Enter PIN"
              aria-label="Admin PIN"
              required
            />
            ${pinError ? `<p class="admin-error">${escapeHtml(pinError)}</p>` : ''}
            <button type="submit" class="btn btn-primary btn-xl">Unlock</button>
            <button type="button" class="btn btn-secondary btn-xl" id="admin-pin-back">
              Back to Menu
            </button>
          </form>
        </div>
      </section>
    `

    const form = container.querySelector('#admin-pin-form')
    const input = container.querySelector('#admin-pin-input')
    const backBtn = container.querySelector('#admin-pin-back')

    input.focus()
    backBtn.addEventListener('click', () => ctx.navigate('menu'))
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      if (input.value.trim() === requiredPin) {
        unlocked = true
        renderDashboard()
        loadSummary()
      } else {
        renderPinGate('Incorrect PIN. Please try again.')
      }
    })
  }

  function formatPassRate(wins, losses) {
    const total = wins + losses
    if (total === 0) return '0% pass'
    return `${Math.round((wins / total) * 100)}% pass`
  }

  function renderDashboard() {
    const m = summary?.metrics || {
      appLaunches: 0,
      totalPlayers: 0,
      quizPicked: 0,
      miniGamePicked: 0,
      quizWins: 0,
      quizLosses: 0,
      miniGameWins: 0,
      miniGameLosses: 0,
      finalScreenViews: 0,
      rewardsClaimed: 0,
    }
    const allClaims = summary?.claims || []
    const q = searchQuery.trim().toLowerCase()
    const filteredClaims = q
      ? allClaims.filter(
          (c) =>
            String(c.claimId || '').toLowerCase().includes(q) ||
            String(c.sessionId || '').toLowerCase().includes(q)
        )
      : allClaims

    container.innerHTML = `
      <section class="screen admin-screen" aria-label="Admin Dashboard">
        <div class="admin-topbar">
          <button type="button" class="hud-btn" id="admin-back-btn">← Menu</button>
          <h1 class="admin-heading">Admin Stats</h1>
          <button type="button" class="hud-btn" id="admin-refresh-btn">Refresh</button>
        </div>

        ${errorMsg ? `<div class="admin-error-banner">${escapeHtml(errorMsg)}</div>` : ''}

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">App Launches</span>
            <strong class="metric-value">${m.appLaunches}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">Total Players</span>
            <strong class="metric-value">${m.totalPlayers}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">Quiz Picked</span>
            <strong class="metric-value">${m.quizPicked}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">MiniGame Picked</span>
            <strong class="metric-value">${m.miniGamePicked}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">Quiz Wins</span>
            <strong class="metric-value">${m.quizWins}</strong>
            <span class="metric-sub">${formatPassRate(m.quizWins, m.quizLosses)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Quiz Losses</span>
            <strong class="metric-value">${m.quizLosses}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">MiniGame Wins</span>
            <strong class="metric-value">${m.miniGameWins}</strong>
            <span class="metric-sub">${formatPassRate(m.miniGameWins, m.miniGameLosses)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">MiniGame Losses</span>
            <strong class="metric-value">${m.miniGameLosses}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">Final Views</span>
            <strong class="metric-value">${m.finalScreenViews}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">Rewards Claimed</span>
            <strong class="metric-value">${m.rewardsClaimed} / ${allClaims.length}</strong>
          </div>
        </div>

        <div class="card-panel admin-claims-panel">
          <div class="claims-header">
            <h2 class="claims-title">Prize Claim Verification</h2>
            <input
              type="search"
              class="admin-input admin-search"
              id="admin-claim-search"
              placeholder="Search Claim ID (e.g. 4829)…"
              value="${escapeHtml(searchQuery)}"
              aria-label="Search Claim ID"
            />
          </div>

          <div class="claims-list" id="admin-claims-list">
            ${
              !summary
                ? '<p class="claims-empty">Loading…</p>'
                : filteredClaims.length === 0
                  ? '<p class="claims-empty">No matching Claim IDs found.</p>'
                  : filteredClaims
                      .map(
                        (c) => `
                          <div class="claim-row">
                            <div class="claim-row-info">
                              <strong class="claim-row-id">${escapeHtml(c.claimId)}</strong>
                              <span class="claim-row-meta">
                                Issued ${escapeHtml(formatTime(c.issuedAt))}
                                ${c.claimed && c.claimedAt ? ` • Claimed ${escapeHtml(formatTime(c.claimedAt))}` : ''}
                              </span>
                            </div>
                            <div class="claim-row-actions">
                              <span class="claim-pill ${c.claimed ? 'is-claimed' : 'is-pending'}">
                                ${c.claimed ? 'Claimed' : 'Pending'}
                              </span>
                              <button
                                type="button"
                                class="hud-btn ${c.claimed ? '' : 'hud-btn-mode'}"
                                data-claim-id="${escapeHtml(c.claimId)}"
                                data-next-claimed="${c.claimed ? 'false' : 'true'}"
                              >
                                ${c.claimed ? 'Undo' : 'Mark Claimed'}
                              </button>
                            </div>
                          </div>
                        `
                      )
                      .join('')
            }
          </div>
        </div>

        <div class="admin-footer-actions">
          <button type="button" class="btn btn-primary" id="admin-new-player-btn" style="grid-column: 1 / -1;">
            Start as New Player
          </button>
          <button type="button" class="btn btn-secondary" id="admin-export-btn" ${!summary ? 'disabled' : ''}>
            Export JSON
          </button>
          <button type="button" class="btn btn-danger" id="admin-reset-btn">
            Reset Data
          </button>
        </div>

        ${
          confirmReset
            ? `
              <div class="admin-confirm-bar">
                <span>Clear all saved records and Claim IDs?</span>
                <div class="admin-confirm-btns">
                  <button type="button" class="hud-btn" id="admin-reset-cancel">Cancel</button>
                  <button type="button" class="btn btn-danger" id="admin-reset-confirm">Yes, Reset</button>
                </div>
              </div>
            `
            : ''
        }
      </section>
    `

    container.querySelector('#admin-back-btn').addEventListener('click', () => ctx.navigate('menu'))
    container.querySelector('#admin-refresh-btn').addEventListener('click', loadSummary)

    const searchInput = container.querySelector('#admin-claim-search')
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value
      const caret = e.target.selectionStart
      renderDashboard()
      const nextInput = container.querySelector('#admin-claim-search')
      nextInput?.focus()
      if (nextInput && typeof caret === 'number') {
        nextInput.setSelectionRange(caret, caret)
      }
    })

    container.querySelectorAll('[data-claim-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const claimId = btn.dataset.claimId
        const nextClaimed = btn.dataset.nextClaimed === 'true'
        btn.disabled = true
        errorMsg = ''
        try {
          const res = await setClaimStatus(claimId, nextClaimed)
          if (destroyed) return
          if (summary && res?.claim) {
            const idx = summary.claims.findIndex((c) => c.claimId === res.claim.claimId)
            if (idx !== -1) summary.claims[idx] = res.claim
            summary.metrics.rewardsClaimed = summary.claims.filter((c) => c.claimed).length
          }
          renderDashboard()
        } catch (err) {
          if (destroyed) return
          errorMsg = err.message || 'Failed to update claim status.'
          renderDashboard()
        }
      })
    })

    container.querySelector('#admin-new-player-btn').addEventListener('click', () => {
      const next = ctx.resetState()
      ctx.updateState({ appLaunchLogged: true })
      saveRecord({
        type: 'app_launch',
        sessionId: next.sessionId,
      })
      ctx.navigate('landing')
    })

    container.querySelector('#admin-export-btn').addEventListener('click', () => {
      if (!summary) return
      const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `play-and-win-summary-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    })

    container.querySelector('#admin-reset-btn').addEventListener('click', () => {
      confirmReset = true
      renderDashboard()
    })

    container.querySelector('#admin-reset-cancel')?.addEventListener('click', () => {
      confirmReset = false
      renderDashboard()
    })

    container.querySelector('#admin-reset-confirm')?.addEventListener('click', async () => {
      errorMsg = ''
      try {
        await resetAdminData()
        if (destroyed) return
        confirmReset = false
        await loadSummary()
      } catch (err) {
        if (destroyed) return
        confirmReset = false
        errorMsg = err.message || 'Failed to reset data.'
        renderDashboard()
      }
    })
  }

  async function loadSummary() {
    errorMsg = ''
    try {
      const data = await getAdminSummary()
      if (destroyed) return
      summary = data
      renderDashboard()
    } catch (err) {
      if (destroyed) return
      errorMsg = err.message || 'Could not load admin stats from server.'
      renderDashboard()
    }
  }

  if (!unlocked) {
    renderPinGate()
  } else {
    renderDashboard()
    loadSummary()
    if (CONFIG.admin.refreshIntervalMs > 0) {
      refreshTimer = window.setInterval(loadSummary, CONFIG.admin.refreshIntervalMs)
    }
  }

  return () => {
    destroyed = true
    if (refreshTimer !== null) {
      window.clearInterval(refreshTimer)
    }
  }
}
