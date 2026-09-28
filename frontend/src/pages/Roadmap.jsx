import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { getTask, loadProgress, saveProgress, requestVerification } from '../api/client.js'
import RoadmapGraph from '../components/RoadmapGraph.jsx'
import StepList from '../components/StepList.jsx'
import StepPanel from '../components/StepPanel.jsx'
import { stepState } from '../lib/graph.js'
import { useLang, tr, fmtDate } from '../lib/i18n.jsx'

export default function Roadmap() {
  const { taskId } = useParams()
  const [params] = useSearchParams()
  const place = { state: params.get('state') || 'Maharashtra', city: params.get('city') || 'Mumbai' }
  const progressKey = `${taskId}:${place.state}:${place.city}`
  const { lang, t } = useLang()
  const [task, setTask] = useState(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(() => loadProgress(progressKey))
  const [selected, setSelected] = useState(null)
  const [fresh, setFresh] = useState(new Set())
  const freshTimer = useRef()
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState('list')

  useEffect(() => {
    getTask(taskId, place.state, place.city)
      .then((x) => { setTask(x); setSelected(x.steps.find((s) => s.depends_on.length === 0)?.id) })
      .catch(() => setError('load'))
  }, [taskId, place.state, place.city])

  useEffect(() => { if (task) document.title = `${tr(task, 'title', lang)} · Civic Navigator` }, [task, lang])

  function toggle(id) {
    const next = new Set(done)
    if (next.has(id)) {
      // Un-ticking a step also un-ticks everything that depended on it.
      const drop = [id]
      while (drop.length) {
        const cur = drop.pop()
        next.delete(cur)
        task.steps.filter((s) => s.depends_on.includes(cur) && next.has(s.id)).forEach((s) => drop.push(s.id))
      }
    } else {
      next.add(id)
      // Highlight steps this action just unlocked, and move the user to the first one.
      const unlocked = task.steps.filter((s) => stepState(s, done) === 'locked' && stepState(s, next) === 'available').map((s) => s.id)
      if (unlocked.length) {
        setFresh(new Set(unlocked)); setSelected(unlocked[0])
        clearTimeout(freshTimer.current); freshTimer.current = setTimeout(() => setFresh(new Set()), 1600)
      }
    }
    setDone(next); saveProgress(progressKey, next)
  }

  if (error) return <p className="max-w-6xl mx-auto px-4 py-12">{t.loadError} <Link to="/" className="text-accent underline">{t.goBack}</Link></p>
  if (!task) return (
    <section aria-busy="true" aria-label="Loading roadmap" className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-4 w-24 rounded bg-line" />
      <div className="mt-4 h-8 w-72 max-w-full rounded bg-line" />
      <div className="mt-6 h-2 rounded bg-line" />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[420px] rounded-xl bg-line/60" />
        <div className="h-56 rounded-xl bg-line/60" />
      </div>
    </section>
  )

  const pct = Math.round((done.size / task.steps.length) * 100)
  const step = task.steps.find((s) => s.id === selected)

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center min-h-11 text-sm text-muted hover:text-ink">{t.newSearch}</Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">{tr(task, 'title', lang)}</h1>
          <p className="text-sm text-muted mt-1">
            <span>{task.city}, {task.state}</span>
            <span aria-hidden> · </span>
            <Link to="/" className="underline underline-offset-2 hover:text-ink no-print">{t.changePlace}</Link>
            {task.last_verified && <><span aria-hidden> · </span><span>{t.verifiedLabel} {fmtDate(task.last_verified, lang)}</span></>}
            {task.sample_data && <><span aria-hidden> · </span><span>{t.sampleData}</span></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm no-print">
          <button onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ } }}
            className="min-h-11 underline underline-offset-4 decoration-line hover:decoration-ink">{copied ? t.copied : t.copyLink}</button>
          <button onClick={() => { setView('list'); setTimeout(() => window.print(), 100) }}
            className="min-h-11 underline underline-offset-4 decoration-line hover:decoration-ink">{t.print}</button>
          {/* List / Graph switch for every procedure (linear ones included). */}
          <div role="tablist" className="flex border border-ink/80 rounded-[3px]">
            {['list', 'graph'].map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`min-h-10 px-3 ${view === v ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}>{t[v]}</button>
            ))}
          </div>
        </div>
      </div>

      {task.is_verified === false && <DraftBanner task={task} />}

      {task.coverage !== 'full' && (
        <p role="note" className="mt-4 border-l-2 border-warn pl-4 py-1 text-sm max-w-3xl">
          {task.coverage === 'state' ? t.covState(task.city, task.state) : t.covNational(task.state)}
        </p>
      )}

      <div className="mt-5 max-w-md">
        <p className="text-xs text-muted mb-1.5 tabular-nums">{t.stepsDone(done.size, task.steps.length)}</p>
        <div aria-hidden className="h-1 bg-line"><div className="h-full bg-done transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {view === 'graph'
          ? <RoadmapGraph steps={task.steps} done={done} selectedId={selected} onSelect={setSelected} fresh={fresh} />
          : <StepList steps={task.steps} done={done} selectedId={selected} onSelect={setSelected} fresh={fresh} />}
        <aside className="border-t border-ink/80 pt-6 lg:border-t-0 lg:pt-0 lg:border-l lg:border-line lg:pl-8 h-fit lg:sticky lg:top-6 no-print">
          <StepPanel step={step} steps={task.steps} done={done} onToggle={toggle} taskTitle={task.title} rights={task.rights} />
        </aside>
      </div>
    </section>
  )
}

// Shown on procedures drafted by AI that no person has checked yet. The button records a real request on the server;
// admins see these counts as a queue and verify the most-requested procedures first.
function DraftBanner({ task }) {
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [msg, setMsg] = useState('')
  async function send() {
    if (state === 'sending' || state === 'done') return
    setState('sending'); setMsg('')
    try {
      const r = await requestVerification(task.task_id, task.title)
      setState('done')
      setMsg(`Request sent. ${r.request_count} ${r.request_count === 1 ? 'person has' : 'people have'} asked for this to be verified.`)
    } catch (e) {
      setState('error')
      setMsg(e.status === 429 ? 'Too many requests from your network. Please try again in a minute.' : e.message || 'Could not send the request. Please try again.')
    }
  }
  return (
    <div role="note" className="mt-4 max-w-3xl rounded-[3px] border-[1.5px] border-amber-500 bg-amber-100 px-4 py-3 text-amber-950 no-print">
      <p className="font-semibold">AI-Generated Draft: Pending Verification.</p>
      <p className="mt-1 text-sm">
        These steps were drafted from official pages by AI and have not been checked by a person yet. Confirm each step on the linked official website.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={send} disabled={state === 'sending' || state === 'done'}
          className="min-h-11 px-5 rounded-[3px] bg-amber-950 text-amber-50 font-semibold disabled:opacity-60">
          {state === 'sending' ? 'Sending…' : state === 'done' ? 'Requested' : 'Request Fast-Track Verification'}
        </button>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </div>
    </div>
  )
}
