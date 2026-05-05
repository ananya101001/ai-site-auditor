import type { NextRequest } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Stable system prompt — cached via cache_control so repeated audits
// avoid re-sending this large prefix at full token cost.
const SYSTEM_PROMPT = `You are an expert website auditor. You will receive structured data extracted from a website and must return a comprehensive JSON audit report.

Your response must be valid JSON with exactly this structure:
{
  "overview": {
    "score": <number 0-100>,
    "summary": "<2-3 sentence overview of the site's overall health>"
  },
  "seo": {
    "score": <number 0-100>,
    "issues": ["<specific issue found>", ...],
    "recommendations": ["<actionable recommendation>", ...]
  },
  "performance": {
    "score": <number 0-100>,
    "issues": ["<specific issue found>", ...],
    "recommendations": ["<actionable recommendation>", ...]
  },
  "ux": {
    "score": <number 0-100>,
    "issues": ["<specific issue found>", ...],
    "recommendations": ["<actionable recommendation>", ...]
  },
  "content": {
    "score": <number 0-100>,
    "issues": ["<specific issue found>", ...],
    "recommendations": ["<actionable recommendation>", ...]
  },
  "quickWins": ["<highest impact fix 1>", "<highest impact fix 2>", "<highest impact fix 3>"]
}

Scoring guidelines:
- 90-100: Excellent — meets best practices
- 70-89: Good — minor improvements needed
- 50-69: Fair — several issues to address
- 0-49: Poor — significant problems present

The overview score must be a weighted average of all section scores (SEO 30%, Performance 25%, UX 25%, Content 20%).
quickWins must contain exactly 3 items — the highest-impact, lowest-effort fixes.

SEO evaluation criteria: title tag presence and length (50-60 chars ideal), meta description presence and length (150-160 chars ideal), H1 tag usage (exactly one), heading hierarchy, image alt text coverage.

Performance evaluation criteria: large inline scripts (>5KB each is a red flag), large inline styles (>3KB), total number of images, absence of resource hints.

UX evaluation criteria: viewport meta tag presence (critical for mobile), link density (internal vs external balance), navigation structure inferred from heading hierarchy.

Content evaluation criteria: heading structure quality, content depth inferred from heading count, title and description quality and relevance.

Return ONLY the JSON object. No markdown code fences, no explanation, no preamble.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body as { url?: unknown }

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'Missing or invalid "url" field' }, { status: 400 })
    }

    // Validate URL format before fetching
    try {
      new URL(url)
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Fetch the page HTML
    let html: string
    try {
      const fetchResponse = await axios.get<string>(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SiteAuditor/1.0; Chrome/120.0 Safari/537.36)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 15000,
        maxRedirects: 5,
        responseType: 'text',
      })
      html = fetchResponse.data
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Request failed'
      return Response.json({ error: `Could not fetch URL: ${msg}` }, { status: 422 })
    }

    // Extract page data with cheerio
    const $ = cheerio.load(html)

    const title = $('title').first().text().trim()
    const metaDescription = $('meta[name="description"]').attr('content') ?? ''
    const hasViewport = $('meta[name="viewport"]').length > 0

    const h1s: string[] = []
    $('h1').each((_, el) => { h1s.push($(el).text().trim()) })

    const h2s: string[] = []
    $('h2').each((_, el) => { h2s.push($(el).text().trim()) })

    const h3s: string[] = []
    $('h3').each((_, el) => { h3s.push($(el).text().trim()) })

    const totalImages = $('img').length
    const missingAltSrcs: string[] = []
    $('img').each((_, el) => {
      const alt = $(el).attr('alt')
      if (alt === undefined || alt.trim() === '') {
        missingAltSrcs.push($(el).attr('src') ?? '[no src]')
      }
    })

    let internalLinks = 0
    let externalLinks = 0
    const urlHost = new URL(url).hostname
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      if (href.startsWith('http') || href.startsWith('//')) {
        try {
          const normalized = href.startsWith('//') ? `https:${href}` : href
          const linkHost = new URL(normalized).hostname
          if (linkHost === urlHost) internalLinks++
          else externalLinks++
        } catch {
          internalLinks++
        }
      } else if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        internalLinks++
      }
    })

    const largeInlineScriptSizes: number[] = []
    $('script:not([src])').each((_, el) => {
      const len = ($(el).html() ?? '').length
      if (len > 5000) largeInlineScriptSizes.push(len)
    })

    const largeInlineStyleSizes: number[] = []
    $('style').each((_, el) => {
      const len = ($(el).html() ?? '').length
      if (len > 3000) largeInlineStyleSizes.push(len)
    })

    const pageData = {
      url,
      title: title || null,
      titleLength: title.length,
      metaDescription: metaDescription || null,
      metaDescriptionLength: metaDescription.length,
      hasViewport,
      headings: {
        h1Count: h1s.length,
        h1Texts: h1s.slice(0, 3),
        h2Count: h2s.length,
        h2Texts: h2s.slice(0, 5),
        h3Count: h3s.length,
      },
      images: {
        total: totalImages,
        missingAltCount: missingAltSrcs.length,
        missingAltSamples: missingAltSrcs.slice(0, 5),
      },
      links: {
        internal: internalLinks,
        external: externalLinks,
      },
      performance: {
        largeInlineScriptCount: largeInlineScriptSizes.length,
        largeInlineScriptSizes,
        largeInlineStyleCount: largeInlineStyleSizes.length,
        largeInlineStyleSizes,
      },
    }

    // Call Claude with prompt caching on the stable system prompt
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // Cache the system prompt — it never changes between requests,
          // so subsequent audits pay ~0.1x cost for this prefix.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Audit this website and return the JSON report:\n\n${JSON.stringify(pageData, null, 2)}`,
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json({ error: 'No text content in Claude response' }, { status: 500 })
    }

    // Strip markdown fences if Claude included them despite instructions
    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()

    let audit: unknown
    try {
      audit = JSON.parse(raw)
    } catch {
      return Response.json(
        { error: 'Claude returned malformed JSON', raw: textBlock.text.slice(0, 500) },
        { status: 500 },
      )
    }

    return Response.json(audit)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
