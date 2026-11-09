// Volltextsuche über die Förderprogramme mit MiniSearch, einem leichten
// deutschen Stemmer und Filtern wie auf foerderdatenbank.de.

import MiniSearch from 'minisearch'
import { kuerze } from './text.mjs'

const STOPPWOERTER = new Set(
  ('aber als am an auch auf aus bei bin bis bzw da damit das dass dem den denen der des die dies diese diesem diesen dieser doch du durch ein eine einem einen einer eines es fuer für gibt habe haben hat ich ihr im in ist ja kann kein keine man mehr mit muss nach nicht noch nur ob oder ohne sein sich sie sind so sowie um und uns unser unsere vom von vor was welche welcher wenn werden wie wir wird wo zu zum zur über ueber unter ' +
    'foerderung förderung foerderprogramm förderprogramm foerderprogramme förderprogramme programm programme gibt suche suchen').split(' '),
)

// Umlaute und ihre Umschreibungen auf eine Form bringen, damit "Förderung",
// "Foerderung" und "Forderung" gleich behandelt werden.
export function falte(wort) {
  return wort
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä|ae/g, 'a')
    .replace(/ö|oe/g, 'o')
    .replace(/ü|ue/g, 'u')
}

// Leichter deutscher Stemmer nach dem Vorbild von Lucene (GermanLightStemmer)
const ST_ENDE = new Set('bdfghklmnt')
export function stamm(w) {
  let s = w
  if (s.length > 5 && s.endsWith('ern')) s = s.slice(0, -3)
  else if (s.length > 4 && /(em|en|er|es)$/.test(s)) s = s.slice(0, -2)
  else if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1)
  else if (s.length > 3 && s.endsWith('s') && ST_ENDE.has(s[s.length - 2])) s = s.slice(0, -1)
  if (s.length > 5 && s.endsWith('est')) s = s.slice(0, -3)
  else if (s.length > 4 && /(er|en)$/.test(s)) s = s.slice(0, -2)
  else if (s.length > 4 && s.endsWith('st') && ST_ENDE.has(s[s.length - 3])) s = s.slice(0, -2)
  return s
}

export function verarbeiteBegriff(begriff) {
  const roh = begriff.toLowerCase()
  if (roh.length < 2 || STOPPWOERTER.has(roh)) return null
  return stamm(falte(roh))
}

// Suchbegriffe, die in Förderrichtlinien anders heißen
const SYNONYME = {
  ki: ['künstliche intelligenz', 'digitalisierung'],
  ai: ['künstliche intelligenz', 'digitalisierung'],
  handwerksbetrieb: ['handwerk'],
  betrieb: ['unternehmen'],
  firma: ['unternehmen'],
  startup: ['start-up', 'gründung'],
  'start-up': ['gründung'],
  gruender: ['existenzgründung'],
  gründer: ['existenzgründung'],
  pv: ['photovoltaik'],
  solar: ['photovoltaik'],
  elektroauto: ['elektromobilität'],
  'e-auto': ['elektromobilität'],
  ladesäule: ['ladeinfrastruktur'],
  mitarbeiter: ['beschäftigte', 'personal'],
  software: ['digitalisierung'],
  it: ['digitalisierung'],
  kredit: ['darlehen'],
  zuschüsse: ['zuschuss'],
}

function erweitere(text) {
  const extra = []
  for (const wort of text.toLowerCase().split(/[\s,;]+/)) if (SYNONYME[wort]) extra.push(...SYNONYME[wort])
  return extra.length ? `${text} ${extra.join(' ')}` : text
}

const SUCHFELDER = ['titel', 'stichwoerter', 'kurztext', 'volltext', 'voraussetzungen', 'bereiche']
const GEWICHTE = { titel: 5, stichwoerter: 2.5, kurztext: 2, bereiche: 1.5, volltext: 1, voraussetzungen: 0.5 }
const GEWICHT_PRAEFIX = Number(process.env.FOERDER_PRAEFIX ?? 0.7)

export const BUNDESLAENDER = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern',
  'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
  'Schleswig-Holstein', 'Thüringen',
]

const gleich = (a, b) => falte(a).replace(/[^a-z0-9]/g, '') === falte(b).replace(/[^a-z0-9]/g, '')

function passtAuf(werte, gesucht, { praefix = false } = {}) {
  if (!gesucht?.length) return true
  if (!werte?.length) return false
  return gesucht.some((g) =>
    werte.some((w) => gleich(w, g) || (praefix && falte(w).startsWith(falte(g)))),
  )
}

export function erstelleSuche(programme) {
  const nachId = new Map(programme.map((p) => [p.id, p]))
  const index = new MiniSearch({
    idField: 'id',
    fields: SUCHFELDER,
    extractField: (p, feld) => {
      if (feld === 'bereiche') return [...(p.foerderbereich ?? []), ...(p.unterbereiche ?? [])].join(' ')
      return p[feld] ?? ''
    },
    processTerm: verarbeiteBegriff,
    searchOptions: { processTerm: verarbeiteBegriff },
  })
  index.addAll(programme)

  function filtere(p, f) {
    if (f.bundesland) {
      const gebiete = p.foerdergebiet ?? []
      const imLand = gebiete.some((g) => gleich(g, f.bundesland))
      const bundesweit = f.bundesweitEinschliessen !== false && gebiete.some((g) => gleich(g, 'bundesweit'))
      if (!imLand && !bundesweit) return false
    }
    return (
      passtAuf(p.foerderart, f.foerderart) &&
      passtAuf(p.foerderberechtigte, f.foerderberechtigte) &&
      passtAuf(p.foerderbereich, f.foerderbereich, { praefix: true }) &&
      passtAuf(p.unternehmensgroesse, f.unternehmensgroesse) &&
      passtAuf(p.foerdergeber, f.foerdergeber) &&
      passtAuf(p.branchen, f.branchen)
    )
  }

  // ODER-Suche: BM25 belohnt Programme, die mehr Begriffe enthalten. Präfixe
  // zählen stark, weil deutsche Komposita ("Digitalisierungsprämie") sonst
  // hinter kurzen Titeltreffern verschwinden.
  function suche({ suchbegriffe = '', anzahl = 10, versatz = 0, ...filter } = {}) {
    const text = String(suchbegriffe).trim().slice(0, 300)
    let ids
    if (text) {
      // Programme des gewählten Landes leicht vor bundesweite ziehen
      const imLand = (id) => filter.bundesland && (nachId.get(id).foerdergebiet ?? []).some((g) => gleich(g, filter.bundesland))
      const optionen = {
        boost: GEWICHTE,
        boostDocument: (id) => (imLand(id) ? 1.3 : 1),
        prefix: (t) => t.length >= 4,
        fuzzy: (t) => (t.length >= 7 ? 0.15 : false),
        weights: { prefix: GEWICHT_PRAEFIX, fuzzy: 0.3 },
        filter: (treffer) => filtere(nachId.get(treffer.id), filter),
      }
      ids = index.search(erweitere(text), { ...optionen, combineWith: 'OR' }).map((t) => t.id)
    } else {
      ids = programme
        .filter((p) => filtere(p, filter))
        .sort((a, b) => (b.veroeffentlicht ?? '').localeCompare(a.veroeffentlicht ?? '') || a.titel.localeCompare(b.titel, 'de'))
        .map((p) => p.id)
    }
    const von = Math.max(0, versatz)
    return {
      gesamt: ids.length,
      treffer: ids.slice(von, von + anzahl).map((id) => kurzfassung(nachId.get(id))),
    }
  }

  return { suche, programm: (id) => nachId.get(id) ?? null, anzahl: programme.length }
}

export function kurzfassung(p) {
  return {
    id: p.id,
    titel: p.titel,
    url: p.url,
    ebene: p.ebene,
    foerderart: p.foerderart ?? [],
    foerdergebiet: p.foerdergebiet ?? [],
    foerderberechtigte: p.foerderberechtigte ?? [],
    foerderbereich: p.foerderbereich ?? [],
    kurztext: kuerze(p.kurztext || p.volltext || '', 320),
  }
}
