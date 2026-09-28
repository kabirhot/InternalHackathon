// All data access lives here. When VITE_API_BASE is set (e.g. the Render URL), data comes from the FastAPI backend;
// otherwise the bundled JSON is used, so the site always works. Response shapes are identical either way.
import tasks from '../mock/tasks.json'
import jurisdictions from '../mock/jurisdictions.json'

export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const LIVE = !!API_BASE
let adminToken = null
/** Set by the admin sign-in (Supabase Auth). Admin calls go to the API only when a token is present. */
export function setAdminToken(t) { adminToken = t || null }

async function api(path, { method = 'GET', body, admin = false, timeout = 25000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(API_BASE + path, {
      method, signal: ctrl.signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(admin && adminToken ? { Authorization: `Bearer ${adminToken}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      let detail = ''
      try { detail = (await res.json()).detail } catch { /* not JSON */ }
      const err = new Error(detail || `HTTP ${res.status}`); err.status = res.status; throw err
    }
    return res.json()
  } finally { clearTimeout(timer) }
}

// The free backend sleeps when idle and takes ~50 s to wake. Nudge it as soon as the site opens,
// and if a public request still fails or times out, quietly use the built-in data instead of showing an error.
if (LIVE && typeof window !== 'undefined') fetch(API_BASE + '/health').catch(() => {})
async function live(path, fallback, opts = {}) {
  try { return await api(path, { timeout: 6000, ...opts }) } catch (e) {
    if (e.status === 404) throw e
    console.warn('[api] using built-in data:', e.message)
    return fallback()
  }
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString()
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const clone = (x) => structuredClone(x)
let db = clone(tasks) // in-memory stand-in for the backend

/** GET /jurisdictions → [{state, covered, cities:[{city, covered}], rights?}] */
export async function listJurisdictions() {
  if (LIVE) return live('/jurisdictions', () => clone(jurisdictions))
  await delay(100)
  return clone(jurisdictions)
}

/** GET /tasks → [{task_id, title, ...}] */
export async function listTasks() {
  if (LIVE) return live('/tasks', mockList)
  return mockList()
}
async function mockList() {
  await delay()
  return db
    .map(({ steps, last_verified, sample_data, ...rest }) => rest)
    .sort((a, b) => (a.popular ?? 99) - (b.popular ?? 99))
}

/** POST /query {text, state, city} → {task_id} | {task_id: null}  (backend: keywords, then an LLM that can only pick from our list) */
export async function searchTask(text, state, city) {
  if (LIVE) return live('/query', () => mockSearch(text), { method: 'POST', body: { text: text.slice(0, 300), state, city } })
  return mockSearch(text)
}
async function mockSearch(text) {
  await delay()
  const q = text.toLowerCase()
  // Same rule as backend/app/search.py: most hits wins, then the more specific (longer) matched words.
  const scored = db
    .map((t) => {
      const hits = t.keywords.filter((k) => q.includes(k.toLowerCase()))
      return { id: t.task_id, score: hits.length, len: hits.reduce((n, k) => n + k.length, 0) }
    })
    .sort((a, b) => b.score - a.score || b.len - a.len)
  return { task_id: scored[0]?.score > 0 ? scored[0].id : null }
}

/**
 * GET /tasks/{id}?state=&city= → task assembled for that place:
 * national steps + steps for that state + steps for that city, approved only.
 * coverage: 'full' (state and city covered), 'state' (city not covered), 'national' (state not covered).
 */
export async function getTask(id, state = 'Maharashtra', city = 'Mumbai') {
  if (LIVE) return live(`/tasks/${encodeURIComponent(id)}?${qs({ state, city })}`, () => mockTask(id, state, city))
  return mockTask(id, state, city)
}
async function mockTask(id, state, city) {
  await delay()
  const t = db.find((x) => x.task_id === id)
  if (!t) throw new Error('Task not found')
  const j = jurisdictions.find((x) => x.state === state)
  const stateOk = !!j?.covered
  const cityOk = stateOk && !!j.cities.find((c) => c.city === city)?.covered
  const applies = (s) =>
    s.status === 'approved' &&
    (s.scope === 'national' || (s.scope === 'state' && stateOk && s.state === state) || (s.scope === 'local' && cityOk && s.city === city))
  const keep = new Set(t.steps.filter(applies).map((s) => s.id))
  return clone({
    ...t,
    state, city,
    coverage: cityOk ? 'full' : stateOk ? 'state' : 'national',
    rights: j?.rights || null,
    steps: t.steps.filter((s) => keep.has(s.id)).map((s) => ({ ...s, depends_on: s.depends_on.filter((d) => keep.has(d)) })),
  })
}

/** GET /admin/tasks/{id} → task with all steps (every place, incl. pending) */
export const isLive = LIVE

export async function getTaskAdmin(id) {
  if (LIVE && adminToken) return api(`/admin/tasks/${encodeURIComponent(id)}`, { admin: true })
  await delay()
  return clone(db.find((x) => x.task_id === id))
}

/** PATCH /admin/steps/{id} {fields} */
export async function updateStep(taskId, stepId, fields) {
  if (LIVE && adminToken) return api(`/admin/tasks/${encodeURIComponent(taskId)}/steps/${encodeURIComponent(stepId)}`, { method: 'PATCH', body: { fields }, admin: true })
  await delay(150)
  const s = db.find((t) => t.task_id === taskId).steps.find((x) => x.id === stepId)
  Object.assign(s, fields)
  return clone(s)
}

// Progress: GET/PUT /progress/{task_id}. For now it lives in the browser, per task and place.
const key = (id) => `progress:${id}`
export function loadProgress(id) {
  try { return new Set(JSON.parse(localStorage.getItem(key(id)) || '[]')) } catch { return new Set() }
}
export function saveProgress(id, done) {
  try { localStorage.setItem(key(id), JSON.stringify([...done])) } catch { /* private mode */ }
}

/**
 * POST /api/request-verification {task_id, procedure_name} → {procedure_name, request_count}
 * A citizen asks for an AI-drafted (unverified) procedure to be checked sooner. Always a real server call:
 * a click that is never recorded would be a fake button.
 */
export async function requestVerification(taskId, procedureName) {
  if (!LIVE) throw new Error('Connect the backend (set VITE_API_BASE) to send requests.')
  return api('/api/request-verification', { method: 'POST', body: { task_id: taskId, procedure_name: procedureName }, timeout: 30000 })
}

/** GET /api/admin/requests → [{id, procedure_name, request_count}], most requested first. */
export async function listVerificationRequests() {
  if (!LIVE) return null // no backend: the admin page says so instead of showing made-up numbers
  return api('/api/admin/requests', { admin: true, timeout: 30000 })
}

/** POST /admin/extract: import draft steps from an official page. They arrive as "pending" for review. */
export async function extractSteps(body) {
  if (!(LIVE && adminToken)) throw new Error('Sign in as admin on the live API to import pages.')
  return api('/admin/extract', { method: 'POST', body, admin: true, timeout: 90000 })
}
