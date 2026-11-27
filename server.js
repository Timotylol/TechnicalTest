import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DB_PATH = path.join(DATA_DIR, 'db.json')
const DB_TMP_PATH = path.join(DATA_DIR, 'db.json.tmp')

const app = express()
app.use(express.json())

let writeQueue = Promise.resolve()

async function readDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const raw = await fs.readFile(DB_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      records: Array.isArray(parsed?.records) ? parsed.records : [],
      claims: Array.isArray(parsed?.claims) ? parsed.claims : [],
    }
  } catch (err) {
    if (err.code === 'ENOENT' || err instanceof SyntaxError) {
      return { records: [], claims: [] }
    }
    throw err
  }
}

async function writeDbAtomic(db) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(DB_TMP_PATH, JSON.stringify(db, null, 2), 'utf-8')
  await fs.rename(DB_TMP_PATH, DB_PATH)
}

function enqueueWrite(mutator) {
  const next = writeQueue.then(async () => {
    const db = await readDb()
    const result = await mutator(db)
    await writeDbAtomic(db)
    return result
  })
  // Prevent one failed operation from poisoning future writes
  writeQueue = next.catch(() => {})
  return next
}

function generateUniqueClaimId(prefix, existingClaims) {
  const taken = new Set(existingClaims.map((c) => String(c.claimId || '').toUpperCase()))
  for (let i = 0; i < 50; i += 1) {
    const code = crypto.randomInt(1000, 10000)
    const candidate = `${prefix}-${code}`
    if (!taken.has(candidate.toUpperCase())) {
      return candidate
    }
  }
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

app.get('/api/ping', (req, res) => {
  res.json({ ok: true })
})

app.post('/api/records', async (req, res) => {
  try {
    const payload = req.body
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ ok: false, error: 'Invalid record payload' })
    }

    const record = {
      ...payload,
      id: payload.id || `rec_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      timestamp: payload.timestamp || new Date().toISOString(),
    }

    await enqueueWrite((db) => {
      db.records.push(record)
    })

    return res.status(201).json({ ok: true, record })
  } catch (err) {
    console.error('Failed to save record:', err)
    return res.status(500).json({ ok: false, error: 'Failed to save record' })
  }
})

app.get('/api/records', async (req, res) => {
  try {
    const db = await readDb()
    return res.json(db.records)
  } catch (err) {
    console.error('Failed to read records:', err)
    return res.status(500).json([])
  }
})

app.post('/api/claims', async (req, res) => {
  try {
    const rawSessionId = req.body?.sessionId
    if (typeof rawSessionId !== 'string' || rawSessionId.trim().length === 0) {
      return res.status(400).json({ error: 'sessionId is required' })
    }

    const sessionId = rawSessionId.trim()
    const rawPrefix = req.body?.prefix
    const cleanPrefix =
      (typeof rawPrefix === 'string'
        ? rawPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
        : '') || 'HPCC'

    const outcome = await enqueueWrite((db) => {
      const existing = db.claims.find((c) => c.sessionId === sessionId)
      if (existing) {
        return { existing: true, claim: existing }
      }

      const claim = {
        claimId: generateUniqueClaimId(cleanPrefix, db.claims),
        sessionId,
        issuedAt: new Date().toISOString(),
        claimed: false,
        claimedAt: null,
      }
      db.claims.push(claim)
      return { existing: false, claim }
    })

    const status = outcome.existing ? 200 : 201
    return res.status(status).json(outcome.claim)
  } catch (err) {
    console.error('Failed to issue claim:', err)
    return res.status(500).json({ error: 'Failed to issue claim' })
  }
})

app.patch('/api/claims/:claimId', async (req, res) => {
  try {
    const claimed = req.body?.claimed
    if (typeof claimed !== 'boolean') {
      return res.status(400).json({ error: 'claimed boolean is required' })
    }

    const target = String(req.params.claimId || '').trim().toUpperCase()
    if (!target) {
      return res.status(400).json({ error: 'claimId is required' })
    }

    const outcome = await enqueueWrite((db) => {
      const claim = db.claims.find((c) => String(c.claimId || '').toUpperCase() === target)
      if (!claim) return { notFound: true }

      claim.claimed = claimed
      claim.claimedAt = claimed ? new Date().toISOString() : null
      return { notFound: false, claim }
    })

    if (outcome.notFound) {
      return res.status(404).json({ error: 'Claim ID not found' })
    }
    return res.json({ ok: true, claim: outcome.claim })
  } catch (err) {
    console.error('Failed to update claim:', err)
    return res.status(500).json({ error: 'Failed to update claim' })
  }
})

app.get('/api/admin/summary', async (req, res) => {
  try {
    const db = await readDb()
    const { records, claims } = db

    const playerIds = new Set(
      [...records.map((r) => r.sessionId), ...claims.map((c) => c.sessionId)].filter(Boolean)
    )

    const metrics = {
      appLaunches: records.filter((r) => r.type === 'app_launch').length,
      totalPlayers: playerIds.size,
      quizPicked: records.filter((r) => r.type === 'game_picked' && r.game === 'quiz').length,
      miniGamePicked: records.filter((r) => r.type === 'game_picked' && r.game === 'minigame')
        .length,
      quizWins: records.filter(
        (r) => r.type === 'game_result' && r.game === 'quiz' && r.passed === true
      ).length,
      quizLosses: records.filter(
        (r) => r.type === 'game_result' && r.game === 'quiz' && r.passed === false
      ).length,
      miniGameWins: records.filter(
        (r) => r.type === 'game_result' && r.game === 'minigame' && r.passed === true
      ).length,
      miniGameLosses: records.filter(
        (r) => r.type === 'game_result' && r.game === 'minigame' && r.passed === false
      ).length,
      finalScreenViews: records.filter((r) => r.type === 'final_screen_view').length,
      rewardsClaimed: claims.filter((c) => c.claimed === true).length,
    }

    const sortedClaims = [...claims].sort((a, b) =>
      String(b.issuedAt || '').localeCompare(String(a.issuedAt || ''))
    )

    return res.json({ metrics, claims: sortedClaims })
  } catch (err) {
    console.error('Failed to build admin summary:', err)
    return res.status(500).json({ error: 'Failed to load admin summary' })
  }
})

app.delete('/api/admin/reset', async (req, res) => {
  try {
    await enqueueWrite((db) => {
      db.records = []
      db.claims = []
    })
    return res.json({ ok: true })
  } catch (err) {
    console.error('Failed to reset data:', err)
    return res.status(500).json({ error: 'Failed to reset data' })
  }
})

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(3001, () => console.log('Server running on http://localhost:3001'))
