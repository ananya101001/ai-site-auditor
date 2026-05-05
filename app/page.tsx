'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Download,
  AlertTriangle,
  Globe,
  Search,
  Zap,
  Layout,
  FileText,
  RotateCcw,
} from 'lucide-react'
import { generatePDF } from '../lib/generatePDF'

// ── Types ──────────────────────────────────────────────────────────────────

interface SectionAudit {
  score: number
  issues: string[]
  recommendations: string[]
}

interface AuditResult {
  overview: { score: number; summary: string }
  seo: SectionAudit
  performance: SectionAudit
  ux: SectionAudit
  content: SectionAudit
  quickWins: string[]
}

type AppState = 'idle' | 'loading' | 'results' | 'error'
type SectionKey = 'seo' | 'performance' | 'ux' | 'content'

// ── Constants ──────────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Fetching site data…',
  'Parsing HTML structure…',
  'Analysing SEO signals…',
  'Running AI analysis…',
  'Evaluating performance…',
  'Generating your report…',
]

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'seo', label: 'SEO' },
  { key: 'performance', label: 'Performance' },
  { key: 'ux', label: 'User Experience' },
  { key: 'content', label: 'Content' },
]

const SECTION_ICONS: Record<SectionKey, React.ReactNode> = {
  seo: <Search size={17} className="text-blue-500" />,
  performance: <Zap size={17} className="text-violet-500" />,
  ux: <Layout size={17} className="text-cyan-500" />,
  content: <FileText size={17} className="text-emerald-500" />,
}

const SECTION_LABELS: Record<SectionKey, string> = {
  seo: 'SEO',
  performance: 'Performance',
  ux: 'User Experience',
  content: 'Content',
}

// ── Score helpers ──────────────────────────────────────────────────────────

function scoreRingColor(score: number) {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#eab308'
  return '#ef4444'
}

function scoreTextClass(score: number) {
  if (score >= 75) return 'text-green-500'
  if (score >= 50) return 'text-yellow-500'
  return 'text-red-500'
}

function scoreBgClass(score: number) {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function scoreLabel(score: number) {
  if (score >= 75) return 'Good'
  if (score >= 50) return 'Needs Improvement'
  return 'Poor'
}

function scorePillClass(score: number) {
  if (score >= 75) return 'bg-green-500/10 text-green-400 border-green-500/20'
  if (score >= 50) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

function scoreDotClass(score: number) {
  if (score >= 75) return 'bg-green-400'
  if (score >= 50) return 'bg-yellow-400'
  return 'bg-red-400'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className="relative flex-shrink-0 w-36 h-36">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#334155" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={scoreRingColor(score)}
          strokeWidth="9"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold leading-none ${scoreTextClass(score)}`}>
          {score}
        </span>
        <span className="text-xs text-slate-400 mt-1 tracking-wider">/ 100</span>
      </div>
    </div>
  )
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${scoreBgClass(score)}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

function SectionCard({ sectionKey, section }: { sectionKey: SectionKey; section: SectionAudit }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Icon */}
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
          {SECTION_ICONS[sectionKey]}
        </div>

        {/* Label + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-800 text-sm">
              {SECTION_LABELS[sectionKey]}
            </span>
            <span className={`text-sm font-bold ${scoreTextClass(section.score)}`}>
              {section.score}
              <span className="text-gray-400 font-normal text-xs ml-0.5">/100</span>
            </span>
          </div>
          <ScoreBar score={section.score} />
        </div>

        {/* Chevron */}
        <span className="flex-shrink-0 text-gray-400 ml-1">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {section.issues.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Issues
              </p>
              <ul className="space-y-2.5">
                {section.issues.map((issue, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-gray-600 leading-snug">
                    <XCircle
                      size={15}
                      className="flex-shrink-0 text-red-400 mt-0.5"
                    />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {section.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Recommendations
              </p>
              <ul className="space-y-2.5">
                {section.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-gray-600 leading-snug">
                    <CheckCircle
                      size={15}
                      className="flex-shrink-0 text-green-500 mt-0.5"
                    />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── URL validation ─────────────────────────────────────────────────────────

function validateUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.includes('://') && !/^https?:\/\//i.test(trimmed)) {
    return 'URL must start with http:// or https://'
  }
  return ''
}

// ── Skeleton card ──────────────────────────────────────────────────────────

function SectionCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl skeleton-shimmer" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 skeleton-shimmer rounded" />
            <div className="h-3 w-12 skeleton-shimmer rounded" />
          </div>
          <div className="h-1.5 w-full skeleton-shimmer rounded-full" />
        </div>
        <div className="flex-shrink-0 w-4 h-4 skeleton-shimmer rounded ml-1" />
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [inputUrl, setInputUrl] = useState('')
  const [auditedUrl, setAuditedUrl] = useState('')
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [msgIdx, setMsgIdx] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [cardsReady, setCardsReady] = useState(false)

  // Cycle loading messages
  useEffect(() => {
    if (appState !== 'loading') return
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1800)
    return () => clearInterval(id)
  }, [appState])

  // Brief skeleton phase when results first appear
  useEffect(() => {
    if (appState !== 'results') return
    setCardsReady(false)
    const id = setTimeout(() => setCardsReady(true), 500)
    return () => clearTimeout(id)
  }, [appState])

  const runAudit = useCallback(async () => {
    const trimmed = inputUrl.trim()
    if (!trimmed) return

    const err = validateUrl(trimmed)
    if (err) { setUrlError(err); return }
    setUrlError('')

    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    setAuditedUrl(normalized)
    setAppState('loading')
    setMsgIdx(0)
    setErrorMsg('')
    setAudit(null)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `Status ${res.status}`)
      setAudit(data as AuditResult)
      setAppState('results')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.')
      setAppState('error')
    }
  }, [inputUrl])

  const reset = () => {
    setAppState('idle')
    setInputUrl('')
    setAudit(null)
    setAuditedUrl('')
    setErrorMsg('')
    setUrlError('')
  }

  const handlePDF = async () => {
    if (!audit || pdfLoading) return
    setPdfLoading(true)
    try {
      await generatePDF(audit, auditedUrl)
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Idle ────────────────────────────────────────────────────────────────

  if (appState === 'idle') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        <header className="px-6 py-4 border-b border-white/[0.07] flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Globe size={14} className="text-white" />
          </div>
          <span className="text-white font-semibold tracking-tight text-sm">SiteAuditor</span>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
          <div className="max-w-xl w-full text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
                AI-Powered Analysis
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl font-bold text-white mb-5 leading-[1.1] tracking-tight">
              Audit any website<br />
              <span className="text-blue-400">in seconds</span>
            </h1>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              Get an instant AI audit of SEO, performance, UX, and content quality —
              with actionable recommendations.
            </p>

            {/* Input */}
            <div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value)
                    if (urlError) setUrlError(validateUrl(e.target.value))
                  }}
                  onBlur={(e) => setUrlError(validateUrl(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && runAudit()}
                  placeholder="https://example.com"
                  autoFocus
                  className={`flex-1 px-5 py-3.5 rounded-xl bg-white/[0.07] border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition-all ${
                    urlError
                      ? 'border-red-500/50 focus:ring-red-500/40 focus:border-red-500/40'
                      : 'border-white/[0.12] focus:ring-blue-500/60 focus:border-blue-500/40'
                  }`}
                />
                <button
                  onClick={runAudit}
                  disabled={!inputUrl.trim()}
                  className="px-7 py-3.5 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm whitespace-nowrap shadow-lg shadow-blue-500/25"
                >
                  Analyze Site
                </button>
              </div>
              {urlError && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2.5">
                  <AlertTriangle size={12} className="flex-shrink-0" />
                  {urlError}
                </p>
              )}
            </div>

            {/* Feature pills */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-slate-500 text-xs">
              {['SEO', 'Performance', 'User Experience', 'Content'].map((label) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center gap-8 px-4">
        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-[3px] border-slate-700" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-500 animate-spin" />
          <div
            className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-blue-400/40 animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '0.65s' }}
          />
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-white text-lg font-semibold mb-1.5 min-h-[1.75rem]">
            {LOADING_MESSAGES[msgIdx]}
          </p>
          <p className="text-slate-500 text-xs font-mono truncate max-w-xs">{auditedUrl}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {LOADING_MESSAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === msgIdx ? 'w-5 bg-blue-400' : 'w-1 bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (appState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-white text-xl font-bold mb-2">Audit failed</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{errorMsg}</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.07] hover:bg-white/[0.12] text-white font-medium rounded-xl transition-colors border border-white/[0.12] text-sm"
        >
          <RotateCcw size={14} />
          Try again
        </button>
      </div>
    )
  }

  // ── Results ──────────────────────────────────────────────────────────────

  if (!audit) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dark header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-black/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-7">
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center shadow shadow-blue-500/30">
              <Globe size={12} className="text-white" />
            </div>
            <span className="text-slate-400 text-xs font-semibold tracking-widest uppercase">
              SiteAuditor
            </span>
          </div>

          {/* Score + meta */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <ScoreCircle score={audit.overview.score} />

            <div className="flex-1 min-w-0">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5">
                Audit Complete
              </p>
              <h1 className="text-white text-lg sm:text-xl font-bold truncate leading-tight">
                {auditedUrl}
              </h1>
              {/* Rating pill */}
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border mt-2 ${scorePillClass(audit.overview.score)}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${scoreDotClass(audit.overview.score)}`} />
                {scoreLabel(audit.overview.score)}
              </div>
              {/* Summary */}
              <p className="text-slate-300 text-sm leading-relaxed mt-3 max-w-xl">
                {audit.overview.summary}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Section cards */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Section Scores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SECTIONS.map(({ key }) =>
              cardsReady ? (
                <SectionCard key={key} sectionKey={key} section={audit[key]} />
              ) : (
                <SectionCardSkeleton key={key} />
              )
            )}
          </div>
        </section>

        {/* Quick wins */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Wins
          </h2>
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl overflow-hidden">
            {audit.quickWins.map((win, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 px-5 py-4 ${
                  i < audit.quickWins.length - 1 ? 'border-b border-amber-200/60' : ''
                }`}
              >
                {/* Number badge */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-sm shadow-amber-300/50 mt-0.5">
                  <span className="text-white text-xs font-bold leading-none">{i + 1}</span>
                </div>
                <p className="text-amber-900 text-sm leading-relaxed">{win}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="flex flex-col sm:flex-row gap-3 pb-10">
          <button
            onClick={handlePDF}
            disabled={pdfLoading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:opacity-60 text-white font-medium rounded-xl transition-colors text-sm shadow-sm"
          >
            {pdfLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download size={15} />
                Download PDF Report
              </>
            )}
          </button>

          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors border border-gray-200 text-sm shadow-sm"
          >
            <RotateCcw size={15} />
            Audit another site
          </button>
        </section>
      </div>
    </div>
  )
}
