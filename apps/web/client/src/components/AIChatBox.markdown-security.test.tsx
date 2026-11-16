import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { Streamdown } from 'streamdown'

// Exercise the patched KaTeX copy actually resolved by Streamdown's math plugin.
const localRequire = createRequire(import.meta.url)
const streamdownRequire = createRequire(localRequire.resolve('streamdown'))
const mathRequire = createRequire(streamdownRequire.resolve('rehype-katex'))
const katex = mathRequire('katex') as { renderToString: (source: string, options?: Record<string, unknown>) => string }
const renderMarkdown = (markdown: string) => renderToStaticMarkup(React.createElement(Streamdown, { children: markdown, mode: 'static' }))

describe('Chat Markdown dependency security', () => {
  it('preserves the math plugin render API for inline and display mathematics', () => {
    for (const displayMode of [false, true]) {
      const html = katex.renderToString('\\frac{a}{b} + x^2', { displayMode, throwOnError: true })
      expect(html).toContain('class="katex"')
      expect(html).toContain('<math')
      expect(html).not.toContain('katex-error')
      if (displayMode) expect(html).toContain('katex-display')
    }
  })

  it('keeps Markdown formatting and links functional', () => {
    const html = renderMarkdown('**Bold** [link](https://example.com)')
    expect(html).toContain('data-streamdown="strong">Bold')
    expect(html).toContain('href="https://example.com')
  })

  it('does not enable raw scripts or event handlers in untrusted Markdown', () => {
    const html = renderMarkdown('safe content\n\n<img src="x" onerror="alert(1)">\n\n<script>alert(1)</script>')
    expect(html).toContain('safe content')
    expect(html).not.toMatch(/<script\b/i)
    expect(html).not.toMatch(/\sonerror=/i)
  })

  it('keeps trusted HTML disabled for TeX commands by default', () => {
    const html = katex.renderToString('\\href{javascript:alert(1)}{click}', { throwOnError: false })
    expect(html).not.toMatch(/href=["']javascript:/i)
  })
})
