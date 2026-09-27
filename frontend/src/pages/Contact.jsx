import { useEffect, useState } from 'react'
import { CONTACT } from '../lib/i18n.jsx'

// A mailto link does nothing on computers with no email app set up, so this page gives three ways to reach us:
// copy the address, open Gmail in the browser, or open the default email app.
const SUBJECT = 'Civic Navigator'
const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT)}&su=${encodeURIComponent(SUBJECT)}`

export default function Contact() {
  const [copied, setCopied] = useState(false)
  useEffect(() => { document.title = 'Contact · Civic Navigator' }, [])

  async function copy() {
    try { await navigator.clipboard.writeText(CONTACT); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked: the address is still shown */ }
  }

  return (
    <section className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="font-display text-3xl">Contact</h1>
      <p className="mt-3 text-muted">
        Found a wrong step, a changed fee, or a procedure we should add? Email us and include the procedure name and your city.
      </p>

      <div className="mt-8 border border-ink/80 bg-card p-5">
        <p className="text-sm text-muted">Email</p>
        <p className="mt-1 text-lg font-semibold break-all select-all">{CONTACT}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={copy} className="min-h-11 px-5 rounded-[3px] bg-ink text-paper font-semibold">
            {copied ? 'Copied' : 'Copy address'}
          </button>
          <a href={gmail} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center min-h-11 px-5 rounded-[3px] border-[1.5px] border-ink/70 font-semibold">Write in Gmail</a>
          <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(SUBJECT)}`}
            className="inline-flex items-center min-h-11 px-5 rounded-[3px] border-[1.5px] border-ink/70 font-semibold">Open email app</a>
        </div>
        <p role="status" className="sr-only">{copied ? 'Email address copied' : ''}</p>
      </div>

      <p className="mt-6 text-sm text-muted">
        This is a student project for the TSEC Internal Hackathon, not a government service. For your application itself,
        contact the office named on each step.
      </p>
    </section>
  )
}
