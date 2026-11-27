import './style.css'
import { CONFIG } from './config.js'
import { getState, updateState, resetState } from './state.js'
import { saveRecord } from './api.js'
import { mount as mountLanding } from './screens/landingScreen.js'
import { mount as mountMenu } from './screens/menuScreen.js'
import { mount as mountQuiz } from './screens/quizScreen.js'
import { mount as mountMaze } from './screens/mazeScreen.js'
import { mount as mountFinal } from './screens/finalScreen.js'
import { mount as mountAdmin } from './screens/adminScreen.js'

const appEl = document.querySelector('#app')

function createPlaceholderScreen(title, description) {
  return function mountPlaceholder(container, ctx) {
    container.innerHTML = `
      <section class="screen placeholder-screen" aria-label="${title}">
        <div class="card-panel">
          <span class="event-pill">${CONFIG.event.eventName}</span>
          <h1 class="placeholder-title">${title}</h1>
          <p class="placeholder-desc">${description}</p>
          <button type="button" class="btn btn-primary btn-xl" id="back-to-menu-btn">
            Back to Menu
          </button>
        </div>
      </section>
    `

    const backBtn = container.querySelector('#back-to-menu-btn')
    const handleBack = () => ctx.navigate('menu')
    backBtn.addEventListener('click', handleBack)

    return () => {
      backBtn.removeEventListener('click', handleBack)
    }
  }
}

const SCREENS = {
  landing: mountLanding,
  menu: mountMenu,
  quiz: mountQuiz,
  minigame: mountMaze,
  final: mountFinal,
  admin: mountAdmin,
}

let activeCleanup = null

function navigate(screenName) {
  const state = getState()
  let target = SCREENS[screenName] ? screenName : 'landing'

  if (target === 'final' && !(state.quizPassed && state.miniGamePassed)) {
    target = 'menu'
  }

  if (typeof activeCleanup === 'function') {
    activeCleanup()
    activeCleanup = null
  }

  appEl.innerHTML = ''
  const mountScreen = SCREENS[target]
  const maybeCleanup = mountScreen(appEl, {
    navigate,
    getState,
    updateState,
    resetState,
  })

  activeCleanup = typeof maybeCleanup === 'function' ? maybeCleanup : null
}

function bootApp() {
  const state = getState()
  if (!state.appLaunchLogged) {
    updateState({ appLaunchLogged: true })
    saveRecord({
      type: 'app_launch',
      sessionId: state.sessionId,
    }).catch(() => {})
  }

  navigate('landing')
}

bootApp()
