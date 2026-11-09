// Text-Helfer: Dateien richtig dekodieren und HTML aus der Förderdatenbank in
// lesbaren Klartext (leichtes Markdown) umwandeln.

const utf8 = new TextDecoder('utf-8', { fatal: true })
const cp1252 = new TextDecoder('windows-1252')

// Ein Teil der Export-Dateien ist als UTF-8 deklariert, enthält aber
// Windows-1252-Bytes (z. B. "F\xFCrderart"). Erst streng UTF-8 versuchen,
// sonst als Windows-1252 lesen.
export function dekodiere(bytes) {
  try {
    return utf8.decode(bytes)
  } catch {
    return cp1252.decode(bytes)
  }
}

const BENANNT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  euro: '€', ndash: '–', mdash: '—', bdquo: '„', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', sbquo: '‚', hellip: '…', sect: '§', shy: '', para: '¶',
  middot: '·', bull: '•', deg: '°', laquo: '«', raquo: '»', times: '×',
}

export function entitaeten(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (ganz, code) => {
    if (code[0] === '#') {
      const zahl = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      if (!Number.isFinite(zahl) || zahl === 0) return ''
      if (zahl === 0xa0) return ' '
      try { return String.fromCodePoint(zahl) } catch { return '' }
    }
    return code in BENANNT ? BENANNT[code] : ganz
  })
}

// HTML -> Klartext mit Überschriften (##), Listen (-) und Absätzen.
// Links auf Dokumente innerhalb der Datenbank ("target:/...") werden zu reinem
// Text, externe Links bleiben als Markdown-Link erhalten.
export function htmlZuText(html) {
  if (!html) return ''
  let t = html

  t = t.replace(/<!\[CDATA\[|\]\]>/g, '')
  t = t.replace(/<!--[\s\S]*?-->/g, '')
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')

  // Externe Links als Markdown, interne nur als Text
  t = t.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attr, inhalt) => {
    const href = /\bhref="([^"]*)"/i.exec(attr)?.[1] ?? ''
    const text = inhalt.replace(/<[^>]+>/g, '').trim()
    if (/^https?:\/\//i.test(href) && text && !text.includes(href)) return `[${text}](${entitaeten(href)})`
    if (/^https?:\/\//i.test(href) && !text) return entitaeten(href)
    return inhalt
  })

  t = t.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, __, inhalt) => `\n\n## ${inhalt.replace(/<[^>]+>/g, '').trim()}\n\n`)
  t = t.replace(/<li\b[^>]*>/gi, '\n- ')
  t = t.replace(/<\/li>/gi, '')
  t = t.replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n')
  t = t.replace(/<tr\b[^>]*>/gi, '\n')
  t = t.replace(/<\/t[dh]>\s*<t[dh]\b[^>]*>/gi, ' | ')
  t = t.replace(/<br\s*\/?>/gi, '\n')
  t = t.replace(/<\/?(p|div|table|thead|tbody|tfoot|blockquote|section)\b[^>]*>/gi, '\n\n')
  t = t.replace(/<[^>]+>/g, '')

  t = entitaeten(t)
  t = t.replace(/[\t\f\v  ]+/g, ' ')
  t = t
    .split('\n')
    .map((zeile) => zeile.trim())
    .join('\n')
  t = t.replace(/\n- \n/g, '\n')
  t = t.replace(/\n{3,}/g, '\n\n')
  return repariereZeichen(t.trim())
}

// In den Quelldaten sind viele Sonderzeichen bei einer früheren Umwandlung zu
// "?" geworden: Gedankenstriche ("2021?2027", "INVEST ? Zuschuss"),
// Anführungszeichen ("?Name?"), geschützte Bindestriche ("Plug?in") und
// zerlegte Umlaute ("Fo?rderung"). Echte Fragezeichen am Satzende bleiben.
// URLs werden nicht angefasst.
const UMLAUT = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' }
export function repariereZeichen(text) {
  if (!text || !text.includes('?')) return text
  return text
    .split(/((?:https?:\/\/|www\.)[^\s)\]]+)/)
    .map((teil, i) => {
      if (i % 2 === 1) return teil
      return teil
        .replace(/(\d)\?(?=\d)/g, '$1–')
        .replace(/ \? /g, ' – ')
        .replace(/([A-Za-z])\?s(?=[\s?.,;:)-]|$)/gm, "$1's")
        .replace(/([aouAOU])\?(?=[a-zß])/g, (_, v) => UMLAUT[v])
        .replace(/([A-Za-zÄÖÜäöüß0-9])\?(?=[A-Za-zÄÖÜäöüß])/g, '$1-')
        .replace(/(^|[\s(\/–])\?([^\s?][^?\n]{0,300}?[^\s?]|[^\s?])\?(?=$|[\s.,;:!)\/“–-])/gm, '$1„$2“')
    })
    .join('')
}

// Einzeiliger Klartext, z. B. für Titel.
export function einzeilig(html) {
  return htmlZuText(html).replace(/^## /gm, '').replace(/\s+/g, ' ').trim()
}

// Kürzt an einer Wortgrenze und hängt "…" an.
export function kuerze(text, max) {
  if (!text || text.length <= max) return text ?? ''
  const schnitt = text.lastIndexOf(' ', max - 1)
  return text.slice(0, schnitt > max * 0.6 ? schnitt : max - 1).trimEnd() + ' …'
}
