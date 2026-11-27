const STORAGE_KEY = 'play_and_win_state'

function generateSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sess_${crypto.randomUUID().slice(0, 8)}`
  }
  return `sess_${Math.random().toString(36).slice(2, 10)}`
}

function createInitialState() {
  return {
    sessionId: generateSessionId(),
    quizPassed: false,
    quizBestScore: 0,
    miniGamePassed: false,
    miniGameBestTime: null,
    claimId: null,
    appLaunchLogged: false,
  }
}

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.sessionId === 'string') {
        return { ...createInitialState(), ...parsed }
      }
    }
  } catch {
    // Ignore storage errors (e.g., private mode restrictions)
  }
  const initial = createInitialState()
  persistState(initial)
  return initial
}

function persistState(nextState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  } catch {
    // Ignore storage errors
  }
}

let state = loadState()

export function getState() {
  return { ...state }
}

export function updateState(patch) {
  state = { ...state, ...patch }
  persistState(state)
  return getState()
}

export function resetState() {
  state = createInitialState()
  persistState(state)
  return getState()
}
