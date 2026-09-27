import { useEffect, useState } from 'react'
import { listTasks, getTaskAdmin, updateStep, extractSteps, setAdminToken, isLive, listVerificationRequests } from '../api/client.js'
import { authConfigured, currentSession, signIn, signOut } from '../lib/auth.js'

// Admin review. On the live site this needs a Supabase sign-in, and the backend also checks the email is an admin.
// Without a backend (built-in data) it runs as a local demo and changes are not saved anywhere.
export default function Admin() {
  const [session, setSession] = useState(() => currentSession())
  useEffect(() => { document.title = 'Admin review · Civic Navigator' }, [])
  // Set the token during render, not in an effect: child components' effects run before this component's,
  // so the queue's first request would otherwise go out without the token, get a 401, and sign the admin out.
  setAdminToken(session?.access_token)

  const needsLogin = isLive && authConfigured && !session
  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl sm:text-3xl">Admin review</h1>
        {session && (
          <p className="text-sm text-muted">Signed in as {session.email}{' · '}
            <button type="button" onClick={() => { signOut(); setSession(null) }} className="underline underline-offset-4 hover:text-ink min-h-11">Sign out</button>
          </p>
        )}
      </div>
      {!isLive && <p className="mt-2 text-sm text-muted border-l-2 border-warn pl-3">Demo mode: this site is using its built-in data, so changes here are not saved.</p>}
      {needsLogin ? <SignIn onDone={setSession} /> : <Review live={isLive && !!session} onExpired={() => { signOut(); setSession(null) }} />}
    </section>
  )
}

function SignIn({ onDone }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { onDone(await signIn(email.trim(), password)) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mt-8 max-w-sm space-y-4">
      <p className="text-muted">Only approved admins can review and publish steps.</p>
      <label className="block text-sm font-semibold" htmlFor="ad-email">Email
        <input id="ad-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full min-h-11 rounded-[3px] border-[1.5px] border-ink/70 bg-card px-3 font-normal" />
      </label>
      <label className="block text-sm font-semibold" htmlFor="ad-pw">Password
        <input id="ad-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full min-h-11 rounded-[3px] border-[1.5px] border-ink/70 bg-card px-3 font-normal" />
      </label>
      {error && <p role="alert" className="text-sm text-warn">{error}</p>}
      <button disabled={busy} className="min-h-12 px-7 rounded-[3px] bg-ink text-paper font-semibold disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

function Review({ live, onExpired }) {
  const [tasks, setTasks] = useState([])
  const [taskId, setTaskId] = useState('')
  const [task, setTask] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fail = (e) => { if (e.status === 401) onExpired(); setError(e.message || 'Something went wrong.') }
  const reload = (id = taskId) => getTaskAdmin(id).then(setTask).catch(fail)
  useEffect(() => { listTasks().then((t) => { setTasks(t); setTaskId(t[0]?.task_id) }).catch(fail) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (taskId) { setError(''); reload(taskId) } }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(stepId, fields) {
    if (busy) return
    setBusy(true); setError('')
    try { await updateStep(taskId, stepId, fields); await reload(); setEditing(null) } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const pending = task?.steps.filter((s) => s.status === 'pending').length ?? 0

  return (
    <>
      <RequestQueue onExpired={onExpired} />
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <label htmlFor="task" className="text-sm text-muted">Procedure</label>
        <select id="task" value={taskId} onChange={(e) => setTaskId(e.target.value)} className="max-w-full min-w-0 min-h-11 rounded-[3px] border border-line bg-card px-3 text-sm">
          {tasks.map((t) => <option key={t.task_id} value={t.task_id}>{t.title}</option>)}
        </select>
        {pending > 0 && <span className="text-sm text-warn font-semibold">{pending} waiting for review</span>}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-warn border-l-2 border-warn pl-3">{error}</p>}

      <div className="mt-4 overflow-x-auto border border-ink/80 bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted border-b border-line">
            <tr><th className="p-3">Step</th><th className="p-3">Applies to</th><th className="p-3">Office</th><th className="p-3">Fee</th><th className="p-3">Evidence from source</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {task?.steps.map((s) => editing === s.id
              ? <EditRow key={s.id} step={s} busy={busy} onSave={(f) => save(s.id, f)} onCancel={() => setEditing(null)} />
              : (
                <tr key={s.id} className={`border-b border-line last:border-0 align-top ${s.status === 'pending' ? 'bg-warn/5' : ''}`}>
                  <td className="p-3 font-medium">{s.name}{s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="block text-xs text-accent underline underline-offset-2 font-normal mt-1 break-all">{s.link}</a>}</td>
                  <td className="p-3 text-muted whitespace-nowrap">{s.scope === 'local' ? s.city : s.scope === 'state' ? s.state : 'All India'}</td>
                  <td className="p-3">{s.office || '—'}</td>
                  <td className="p-3">{s.fee || '—'}</td>
                  <td className="p-3 text-muted max-w-xs">{s.evidence ? `“${s.evidence}”` : '—'}</td>
                  <td className="p-3 whitespace-nowrap"><span className={s.status === 'approved' ? 'text-done font-semibold' : s.status === 'rejected' ? 'text-muted' : 'text-warn font-semibold'}>{s.status}</span></td>
                  <td className="p-3 whitespace-nowrap text-right space-x-3">
                    <button disabled={busy} onClick={() => setEditing(s.id)} className="text-accent min-h-11">Edit</button>
                    {s.status !== 'approved'
                      ? <button disabled={busy} onClick={() => save(s.id, { status: 'approved' })} className="text-done font-semibold min-h-11">Approve</button>
                      : <button disabled={busy} onClick={() => save(s.id, { status: 'pending' })} className="text-muted min-h-11">Unpublish</button>}
                    {s.status === 'pending' && <button disabled={busy} onClick={() => save(s.id, { status: 'rejected' })} className="text-muted min-h-11">Reject</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Import live={live} taskId={taskId} taskTitle={tasks.find((t) => t.task_id === taskId)?.title} onAdded={() => reload()} onError={fail} />
    </>
  )
}

// Demand-driven queue: real counts from the backend's SQLite table, most requested first.
// Refreshes every 10 seconds so a click on a citizen's page shows up here during a demo.
function RequestQueue({ onExpired }) {
  const [rows, setRows] = useState(undefined) // undefined = loading, null = no backend
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(null)

  async function load() {
    try {
      const r = await listVerificationRequests()
      setRows(r); setError(''); setUpdated(new Date())
    } catch (e) {
      if (e.status === 401) onExpired()
      setError(e.message || 'Could not load the queue.')
    }
  }
  useEffect(() => {
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const top = rows?.[0]?.request_count || 1
  return (
    <section aria-labelledby="queue" className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="queue" className="text-xl">Verification requests</h2>
        <p className="text-sm text-muted">
          {updated && <>Updated {updated.toLocaleTimeString()} · </>}
          <button type="button" onClick={load} className="underline underline-offset-4 hover:text-ink min-h-11">Refresh</button>
        </p>
      </div>
      <p className="text-sm text-muted mt-1">Citizens asked for these AI-drafted procedures to be checked. Verify the top of the list first.</p>
      {error && <p role="alert" className="mt-3 text-sm text-warn border-l-2 border-warn pl-3">{error}</p>}
      {rows === undefined && !error && <div aria-busy="true" className="mt-4 h-24 rounded bg-line/60 animate-pulse" />}
      {rows === null && <p className="mt-4 text-sm text-muted">Connect the backend (set VITE_API_BASE) to see real requests.</p>}
      {rows?.length === 0 && <p className="mt-4 text-sm text-muted">No requests yet. They appear here when someone presses “Request Fast-Track Verification” on a draft procedure.</p>}
      {rows?.length > 0 && (
        <ol className="mt-4 border border-ink/80 bg-card divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 p-3">
              <span className="text-muted tabular-nums">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-medium">{r.procedure_name}</p>
                <div aria-hidden className="mt-1.5 h-1 bg-line"><div className="h-full bg-warn" style={{ width: `${(r.request_count / top) * 100}%` }} /></div>
              </div>
              <span className="tabular-nums font-semibold whitespace-nowrap">{r.request_count} {r.request_count === 1 ? 'request' : 'requests'}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Import({ live, taskId, taskTitle, onAdded, onError }) {
  const [url, setUrl] = useState('')
  const [scope, setScope] = useState('national')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setResult('')
    try {
      const r = await extractSteps({ task_id: taskId, url: url.trim(), scope, state: scope !== 'national' ? state.trim() : null, city: scope === 'local' ? city.trim() : null })
      setResult(r.added ? `Added ${r.added} draft step${r.added === 1 ? '' : 's'}. Check each one against the source, then approve.` : 'No new steps: this page was already imported.')
      onAdded()
    } catch (err) { onError(err) } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="imp" className="mt-10 border-t border-ink/80 pt-6 max-w-2xl">
      <h2 id="imp" className="text-xl">Import from an official page</h2>
      <p className="text-sm text-muted mt-1">
        Paste a gov.in or nic.in page about <b className="text-ink">{taskTitle || 'this procedure'}</b>. The AI drafts steps using only what the page says,
        with a quote for each one. They stay hidden from citizens until you approve them above.
      </p>
      {!live ? (
        <p className="mt-4 text-sm text-muted">Available on the live site once the backend is connected and you are signed in.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label htmlFor="imp-url" className="block text-sm font-semibold">Official page link</label>
          <input id="imp-url" type="url" required placeholder="https://www.passportindia.gov.in/…" value={url} onChange={(e) => setUrl(e.target.value)}
            className="block w-full min-h-11 rounded-[3px] border-[1.5px] border-ink/70 bg-card px-3" />
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <legend className="font-semibold mb-1">These steps apply to</legend>
            {[['national', 'All India'], ['state', 'One state'], ['local', 'One city']].map(([v, l]) => (
              <label key={v} className="inline-flex items-center gap-2 min-h-11"><input type="radio" name="scope" value={v} checked={scope === v} onChange={() => setScope(v)} />{l}</label>
            ))}
          </fieldset>
          {scope !== 'national' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">State<input required value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" className="mt-1 block w-full min-h-11 rounded-[3px] border border-line bg-card px-3" /></label>
              {scope === 'local' && <label className="text-sm">City<input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" className="mt-1 block w-full min-h-11 rounded-[3px] border border-line bg-card px-3" /></label>}
            </div>
          )}
          <button disabled={busy || !taskId} className="min-h-12 px-7 rounded-[3px] bg-ink text-paper font-semibold disabled:opacity-60">{busy ? 'Reading the page… (up to a minute)' : 'Draft steps from this page'}</button>
          {result && <p role="status" className="text-sm text-done">{result}</p>}
        </form>
      )}
    </section>
  )
}

function EditRow({ step, busy, onSave, onCancel }) {
  const [f, setF] = useState({ name: step.name || '', office: step.office || '', fee: step.fee || '', link: step.link || '' })
  const input = (k) => (
    <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-label={k}
      className="w-full min-h-10 rounded-[3px] border border-line bg-paper px-2" />
  )
  return (
    <tr className="border-b border-line bg-accent-soft/40 align-top">
      <td className="p-3">{input('name')}</td>
      <td className="p-3" />
      <td className="p-3">{input('office')}</td>
      <td className="p-3">{input('fee')}</td>
      <td className="p-3" colSpan={2}>{input('link')}</td>
      <td className="p-3 whitespace-nowrap text-right space-x-3">
        <button disabled={busy} onClick={() => { const { link, ...rest } = f; onSave({ ...rest, fee: f.fee || null, office: f.office || null, ...(link ? { link } : {}) }) }} className="text-done font-semibold min-h-11">Save</button>
        <button onClick={onCancel} className="text-muted min-h-11">Cancel</button>
      </td>
    </tr>
  )
}
