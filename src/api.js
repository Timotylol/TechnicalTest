import { CONFIG } from './config.js'

async function requestJson(url, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, { ...options, headers })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

export async function saveRecord(record) {
  try {
    return await requestJson('/api/records', {
      method: 'POST',
      body: JSON.stringify(record),
    })
  } catch (err) {
    console.warn('saveRecord failed:', err)
    return null
  }
}

export async function getRecords() {
  try {
    const data = await requestJson('/api/records')
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.warn('getRecords failed:', err)
    return []
  }
}

export async function issueClaim(sessionId, prefix = CONFIG.event.claimPrefix) {
  return requestJson('/api/claims', {
    method: 'POST',
    body: JSON.stringify({ sessionId, prefix }),
  })
}

export async function getAdminSummary() {
  return requestJson('/api/admin/summary')
}

export async function setClaimStatus(claimId, claimed) {
  return requestJson(`/api/claims/${encodeURIComponent(claimId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ claimed }),
  })
}

export async function resetAdminData() {
  return requestJson('/api/admin/reset', {
    method: 'DELETE',
  })
}
