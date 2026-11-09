// Steckbrief je Programm: die wichtigsten Angaben auf einen Blick, wörtlich
// aus den Texten der Förderdatenbank gezogen und nicht umformuliert.
// Höhe: der Satz mit Prozent- oder Euroangabe, der die Förderung beschreibt.
// Antrag vor Projektstart: nur wenn der Text das ausdrücklich sagt.

import { kuerze } from './text.mjs'

const ABKUERZUNGEN = ['z. B.', 'z.B.', 'd. h.', 'u. a.', 'i. d. R.', 'u. U.', 'bzw.', 'ca.', 'max.', 'mind.', 'Nr.', 'Abs.', 'inkl.', 'zzgl.', 'ggf.', 'sog.', 'Mio.', 'Mrd.', 'Tsd.', 'v. a.', 'gem.', 'lt.', 'S.', 'vgl.']
const PLATZHALTER = '\u0000'

const BETRAG = /\d[\d.,]*\s*(?:%|Prozent|Euro|EUR|Mio\.?|Millionen|Mrd\.?)|(?:EUR|Euro)\s*\d/
const FOERDERWORT = /Zuschuss|Zuschüsse|Darlehen|Kredit|Förder|förderfähig|Zuwendung|Bürgschaft|Beteiligung|Tilgungszuschuss|Fördersatz|Ausgaben|Kosten|Höhe|beträgt|erhalten|finanzier|übernimmt|Pauschale/i
const STARK = /bis zu|höchstens|maximal|beträgt|in Höhe von|Höhe der|Fördersatz|Förderquote|Pauschale/i
// Sätze mit Größengrenzen beschreiben, wer antragsberechtigt ist, nicht wie viel es gibt
const SCHWELLE = /Beschäftigte|Mitarbeitende|Mitarbeiter|Arbeitnehmer|Jahresumsatz|Umsatz|Bilanzsumme|Einwohner/i

export function saetze(text) {
  let t = (text ?? '').replace(/\s+/g, ' ').replace(/^[-*]\s*/, '')
  for (const a of ABKUERZUNGEN) t = t.split(a).join(a.replace(/\./g, PLATZHALTER))
  return t
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9„"])|\s+-\s+(?=[A-ZÄÖÜ])/)
    .map((s) => s.split(PLATZHALTER).join('.').replace(/^[-*]\s*/, '').trim())
    .filter((s) => s.length >= 20)
}

/** Satz, der die Höhe der Förderung nennt, oder null. */
export function hoeheAusText(text, max = 260) {
  const alle = saetze(text)
  const kandidaten = alle
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => BETRAG.test(s) && FOERDERWORT.test(s) && !SCHWELLE.test(s))
    .map((k) => ({ ...k, punkte: (STARK.test(k.s) ? 2 : 0) + (k.s.match(new RegExp(BETRAG.source, 'g'))?.length ?? 0) - k.s.length / 400 }))
    .sort((a, b) => b.punkte - a.punkte || a.i - b.i)
  if (!kandidaten.length) return null
  const { s, i } = kandidaten[0]
  // Ein Satz wie "Zusätzlich gibt es ..." braucht den Satz davor
  const davor = i > 0 && /^(?:Zusätzlich|Außerdem|Darüber hinaus|Anschließend|Dabei|Hierbei|Diese[rs]?|Dafür|Davon)\b/.test(s) ? `${alle[i - 1]} ` : ''
  // Listenstriche aus dem Quelltext: der erste nach einem Wort wird zum Doppelpunkt, die übrigen zu Kommas
  const satz = (davor.length + s.length <= max ? davor + s : s)
    .replace(/,\s+-\s+/g, ', ')
    .replace(/([\p{L}\d])\s+-\s+/u, '$1: ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/:\s*,\s*/g, ': ')
  return kuerze(satz, max)
}

const VOR_BEGINN = /vor (?:dem )?(?:Beginn|Start)(?: des| der)? (?:Vorhabens|Projekts|Projektes|Maßnahme|Investition)|vor (?:Vorhaben|Projekt|Maßnahme|Investitions)beginn|vorzeitige[nr]? (?:Maßnahme|Vorhaben)beginn|bevor (?:Sie )?(?:mit dem|mit der|das|die) (?:Vorhaben|Projekt|Maßnahme|Investition)/i

export function antragVorBeginn(p) {
  return VOR_BEGINN.test([p.volltext, p.voraussetzungen, p.fristen, p.verfahren, p.kurztext].filter(Boolean).join(' '))
}

export function fristKurz(p, max = 150) {
  const t = (p.fristen ?? '').replace(/\s*\n+\s*-?\s*/g, ' ').replace(/^[-*]\s*/, '').replace(/\s+/g, ' ').trim()
  return t ? kuerze(t, max) : null
}

export function kontaktKurz(p) {
  const k = (p.kontakte ?? [])[0]
  if (!k?.name) return null
  // Nur die Nummer, ohne Zusätze wie "(Anrufzeiten: ...)"
  const telefon = (k.telefon ?? '').split('(')[0].replace(/[^\d+ /-]/g, '').trim()
  return {
    name: k.name,
    ...(/\d{4}/.test(telefon) ? { telefon } : {}),
    ...(/^https:\/\//.test(k.web ?? '') ? { web: k.web } : {}),
  }
}

const ablage = new WeakMap()

export function steckbrief(p) {
  if (ablage.has(p)) return ablage.get(p)
  const s = {
    hoehe: hoeheAusText([p.volltext, p.kurztext].filter(Boolean).join(' ')),
    vorBeginn: antragVorBeginn(p),
    frist: fristKurz(p),
    kontakt: kontaktKurz(p),
  }
  ablage.set(p, s)
  return s
}
