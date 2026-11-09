// Volltextsuche über die Förderprogramme mit MiniSearch, einem leichten
// deutschen Stemmer und Filtern wie auf foerderdatenbank.de.

import MiniSearch from 'minisearch'
import { kuerze } from './text.mjs'
import { steckbrief } from './steckbrief.mjs'

const STOPPWOERTER = new Set(
  ('aber als am an auch auf aus bei bin bis bzw da damit das dass dem den denen der des die dies diese diesem diesen dieser doch du durch ein eine einem einen einer eines es fuer für gibt habe haben hat ich ihr im in ist ja kann kein keine man mehr mit muss nach nicht noch nur ob oder ohne sein sich sie sind so sowie um und uns unser unsere vom von vor was welche welcher wenn werden wie wir wird wo zu zum zur über ueber unter ' +
    'foerderung förderung foerderprogramm förderprogramm foerderprogramme förderprogramme programm programme gibt suche suchen ' +
    // Alltagssprache, die in fast jedem Programmtext steht oder nichts unterscheidet
    'hab will wollen möchte möchten mochte mein meine meinen meinem meiner unserem unseren unserer brauche brauchen gern gerne neu neue neuen neues ' +
    'dafür dazu etwas einige viele bitte betrieb betriebe firma unternehmen unternehmer').split(' '),
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

// Einfache Zerlegung deutscher Komposita über bekannte Grundwörter:
// "Unternehmensnachfolge" findet so auch "Gründung und Nachfolge",
// "Investitionszuschuss" auch "Zuschuss für Investitionen".
const GRUNDWOERTER = [
  'nachfolge', 'gründung', 'übernahme', 'investition', 'beratung', 'weiterbildung', 'qualifizierung', 'ausbildung',
  'kredit', 'darlehen', 'zuschuss', 'bürgschaft', 'beteiligung', 'energie', 'effizienz', 'innovation', 'digitalisierung',
  'beschäftigung', 'patent', 'forschung', 'entwicklung', 'software', 'maschine', 'anlage', 'gutschein', 'prämie', 'bonus',
  'finanzierung', 'sanierung', 'modernisierung', 'infrastruktur', 'mobilität', 'technologie', 'produktion', 'gebäude',
  'klimaschutz', 'export', 'handwerk', 'tourismus', 'kapital', 'fonds', 'landwirtschaft', 'fahrzeug',
]
  .map((w) => stamm(falte(w)))
  .sort((a, b) => b.length - a.length)
const STOPP_GEFALTET = new Set([...STOPPWOERTER].map((w) => stamm(falte(w))))

export function zerlege(gestemmt) {
  for (const kopf of GRUNDWOERTER) {
    if (gestemmt.length >= kopf.length + 5 && gestemmt.endsWith(kopf)) {
      const vorne = stamm(gestemmt.slice(0, -kopf.length).replace(/s$/, ''))
      return [kopf, ...(vorne.length >= 5 && !STOPP_GEFALTET.has(vorne) ? [vorne] : [])]
    }
  }
  return []
}

export function verarbeiteBegriff(begriff) {
  const roh = begriff.toLowerCase()
  if (roh.length < 2 || STOPPWOERTER.has(roh)) return null
  const haupt = stamm(falte(roh))
  const teile = zerlege(haupt)
  return teile.length ? [haupt, ...teile] : haupt
}

// Alltagswörter auf die Begriffe abbilden, die in Förderrichtlinien stehen.
// Schlüssel werden gefaltet und gestemmt verglichen ("Maschinen" = "Maschine").
const INVESTITION = ['investition', 'betriebliche investitionen']
const DIGITAL = ['digitalisierung']
const WEITERBILDUNG = ['weiterbildung', 'qualifizierung']
const PERSONAL = ['beschäftigung', 'eingliederung', 'fachkräfte']
const GRUENDUNG = ['existenzgründung', 'gründung']
const SYNONYME = {
  ki: ['künstliche intelligenz', 'digitalisierung'],
  ai: ['künstliche intelligenz', 'digitalisierung'],
  handwerksbetrieb: ['handwerk'],
  startup: ['start-up', ...GRUENDUNG],
  'start-up': GRUENDUNG,
  gründer: GRUENDUNG,
  gründen: GRUENDUNG,
  selbstständig: GRUENDUNG,
  selbständig: GRUENDUNG,
  pv: ['photovoltaik'],
  solar: ['photovoltaik'],
  dach: ['photovoltaik'],
  heizung: ['heizungsförderung', 'effiziente gebäude'],
  energie: ['energieeffizienz'],
  strom: ['energieeffizienz', 'erneuerbare energien'],
  elektroauto: ['elektromobilität'],
  'e-auto': ['elektromobilität'],
  ladesäule: ['ladeinfrastruktur'],
  mitarbeiter: ['beschäftigte', 'personal'],
  einstellen: PERSONAL,
  personal: PERSONAL,
  azubi: ['ausbildung'],
  weiterbilden: WEITERBILDUNG,
  schulung: WEITERBILDUNG,
  schulen: WEITERBILDUNG,
  fortbildung: WEITERBILDUNG,
  maschine: INVESTITION,
  anlage: INVESTITION,
  gerät: INVESTITION,
  kaufen: INVESTITION,
  anschaffen: INVESTITION,
  anschaffung: INVESTITION,
  investieren: INVESTITION,
  digitalisieren: DIGITAL,
  digital: DIGITAL,
  software: DIGITAL,
  app: DIGITAL,
  website: DIGITAL,
  onlineshop: DIGITAL,
  automatisieren: DIGITAL,
  it: DIGITAL,
  export: ['außenwirtschaft', 'markterschließung'],
  ausland: ['außenwirtschaft', 'markterschließung'],
  nachfolge: ['unternehmensnachfolge'],
  übernahme: ['unternehmensnachfolge'],
  übernehmen: ['unternehmensnachfolge'],
  sanieren: ['modernisierung', 'sanierung'],
  umbau: ['modernisierung', 'sanierung'],
  kredit: ['darlehen'],
  zuschüsse: ['zuschuss'],
}
const SYNONYM_STAEMME = new Map(Object.entries(SYNONYME).map(([wort, ziel]) => [stamm(falte(wort)), ziel]))

function erweitere(text) {
  const extra = new Set()
  for (const wort of text.toLowerCase().split(/[\s,;.!?]+/)) {
    for (const ziel of SYNONYM_STAEMME.get(stamm(falte(wort))) ?? []) extra.add(ziel)
  }
  return extra.size ? `${text} ${[...extra].join(' ')}` : text
}

// Große Forschungsverbünde nennen oft auch Unternehmen als Antragsberechtigte,
// passen für einen normalen Betrieb aber selten. Sie rutschen nach hinten,
// solange niemand ausdrücklich nach Forschung fragt.
const FORSCHUNG_GEFRAGT = /forsch|hochschul|wissenschaft|universit|institut/i
function istForschungsverbund(p) {
  const fuerForschung = (p.foerderberechtigte ?? []).some((w) => /Hochschule|Forschungseinrichtung/.test(w))
  const themenspezifisch =
    (p.foerderbereich ?? []).some((b) => /themenspezifisch/.test(b)) || (p.unterbereiche ?? []).includes('Grundlagenforschung')
  return fuerForschung && themenspezifisch
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
      const imLand = (p) => filter.bundesland && (p.foerdergebiet ?? []).some((g) => gleich(g, filter.bundesland))
      const forschungGefragt = FORSCHUNG_GEFRAGT.test(text)
      const optionen = {
        boost: GEWICHTE,
        boostDocument: (id) => {
          const p = nachId.get(id)
          return (imLand(p) ? 1.3 : 1) * (!forschungGefragt && istForschungsverbund(p) ? 0.45 : 1)
        },
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
    steckbrief: steckbrief(p),
  }
}
