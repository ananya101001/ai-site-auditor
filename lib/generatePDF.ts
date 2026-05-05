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

type SectionKey = 'seo' | 'performance' | 'ux' | 'content'

const SECTION_LABELS: Record<SectionKey, string> = {
  seo: 'SEO',
  performance: 'Performance',
  ux: 'User Experience',
  content: 'Content',
}

function colorForScore(score: number): [number, number, number] {
  if (score >= 75) return [34, 197, 94]
  if (score >= 50) return [234, 179, 8]
  return [239, 68, 68]
}

function statusLabel(score: number): string {
  if (score >= 75) return 'Good'
  if (score >= 50) return 'Needs Work'
  return 'Critical'
}

function addFooter(doc: InstanceType<typeof import('jspdf')['jsPDF']>, pageNum: number) {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(14, ph - 16, pw - 14, ph - 16)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('AI Site Auditor — Powered by Claude', 14, ph - 10)
  doc.text(`Page ${pageNum}`, pw - 14, ph - 10, { align: 'right' })
}

export async function generatePDF(auditData: AuditResult, url: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  type DocWithAutoTable = InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as DocWithAutoTable
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  // ── Page 1: Cover ─────────────────────────────────────────────────────────

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pw, 55, 'F')

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(96, 165, 250)
  doc.text('AI Site Auditor', 14, 18)

  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Website Audit Report', 14, 38)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(url, 14, 47)
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.text(`Generated: ${date}`, 14, 53)

  // Large overall score
  const overallScore = auditData.overview.score
  const [sr, sg, sb] = colorForScore(overallScore)

  doc.setFontSize(80)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(sr, sg, sb)
  doc.text(`${overallScore}`, pw / 2, 130, { align: 'center' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('/ 100  Overall Score', pw / 2, 144, { align: 'center' })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(sr, sg, sb)
  doc.text(statusLabel(overallScore), pw / 2, 158, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)
  const summaryLines = doc.splitTextToSize(auditData.overview.summary, pw - 28)
  doc.text(summaryLines, 14, 180)

  addFooter(doc, 1)

  // ── Page 2: Scores Overview ────────────────────────────────────────────────

  doc.addPage()

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pw, 20, 'F')
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Scores Overview', 14, 13)

  autoTable(doc, {
    startY: 30,
    head: [['Category', 'Score', 'Status']],
    body: (Object.keys(SECTION_LABELS) as SectionKey[]).map((k) => [
      SECTION_LABELS[k],
      `${auditData[k].score} / 100`,
      statusLabel(auditData[k].score),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const val = String(data.cell.raw)
        const color: [number, number, number] =
          val === 'Critical' ? [239, 68, 68] : val === 'Needs Work' ? [202, 138, 4] : [22, 163, 74]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(data.cell.styles as unknown as Record<string, unknown>).textColor = color
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(data.cell.styles as unknown as Record<string, unknown>).fontStyle = 'bold'
      }
    },
    margin: { left: 14, right: 14 },
  })

  addFooter(doc, 2)

  // ── Pages 3–6: Per-category ────────────────────────────────────────────────

  const sections: SectionKey[] = ['seo', 'performance', 'ux', 'content']

  sections.forEach((k, idx) => {
    doc.addPage()

    const pageNum = idx + 3
    const section = auditData[k]
    const [cr, cg, cb] = colorForScore(section.score)

    // Header band
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, pw, 20, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(SECTION_LABELS[k], 14, 13)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(cr, cg, cb)
    doc.text(`Score: ${section.score} / 100  —  ${statusLabel(section.score)}`, pw - 14, 13, {
      align: 'right',
    })

    // Issues table
    let nextY = 30
    if (section.issues.length > 0) {
      autoTable(doc, {
        startY: nextY,
        head: [['Issues Found']],
        body: section.issues.map((s) => [s]),
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: 14, right: 14 },
      })
      nextY = doc.lastAutoTable.finalY + 8
    }

    // Recommendations table
    if (section.recommendations.length > 0) {
      autoTable(doc, {
        startY: nextY,
        head: [['Recommendations']],
        body: section.recommendations.map((s) => [s]),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 14, right: 14 },
      })
    }

    addFooter(doc, pageNum)
  })

  // ── Final page: Quick Wins ────────────────────────────────────────────────

  doc.addPage()

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pw, 20, 'F')
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Top 3 Quick Wins', 14, 13)

  let y = 36
  auditData.quickWins.forEach((win, i) => {
    // Amber circle with number
    doc.setFillColor(251, 191, 36)
    doc.circle(20, y - 2.5, 4.5, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(`${i + 1}`, 20, y - 0.5, { align: 'center' })

    // Win text
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    const lines = doc.splitTextToSize(win, pw - 42)
    doc.text(lines, 30, y)
    y += lines.length * 6 + 14
  })

  addFooter(doc, 7)

  let hostname = 'site'
  try { hostname = new URL(url).hostname } catch { /* noop */ }
  doc.save(`audit-${hostname}.pdf`)
}
