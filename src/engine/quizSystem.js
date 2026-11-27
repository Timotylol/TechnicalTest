import { CONFIG } from '../config.js'
import questionsData from '../data/questions.json'

function shuffleArray(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Pure quiz state machine handling question selection, scoring, and pass/fail evaluation.
 */
export function createQuizSystem(sourceQuestions = questionsData, quizConfig = CONFIG.quiz) {
  let questions = []
  let currentIndex = 0
  let score = 0
  let isFinished = false

  function prepareQuestions() {
    const pool = quizConfig.shuffleQuestions ? shuffleArray(sourceQuestions) : [...sourceQuestions]
    const count = Math.min(quizConfig.questionCount, pool.length)
    return pool.slice(0, count)
  }

  function reset() {
    questions = prepareQuestions()
    currentIndex = 0
    score = 0
    isFinished = false
  }

  reset()

  return {
    reset,
    getCurrentQuestion() {
      return questions[currentIndex] || null
    },
    getProgress() {
      return {
        current: currentIndex + 1,
        total: questions.length,
        score,
        passThreshold: Math.ceil(questions.length * quizConfig.passMark),
        isFinished,
      }
    },
    submitAnswer(selectedIndex) {
      const q = questions[currentIndex]
      if (!q || isFinished) return null
      const isCorrect = selectedIndex === q.answerIndex
      if (isCorrect) {
        score += 1
      }
      return {
        selectedIndex,
        correctIndex: q.answerIndex,
        isCorrect,
        score,
      }
    },
    advance() {
      if (isFinished) return true
      currentIndex += 1
      if (currentIndex >= questions.length) {
        isFinished = true
      }
      return isFinished
    },
    getResult() {
      const total = questions.length
      const passThreshold = Math.ceil(total * quizConfig.passMark)
      return {
        score,
        total,
        passThreshold,
        passed: score >= passThreshold,
      }
    },
    isFinished: () => isFinished,
  }
}
