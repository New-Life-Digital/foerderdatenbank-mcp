// Macht aus den gelesenen GSB-Dokumenten des Exports schlanke Datensätze für
// Förderprogramme. Reine Funktion ohne Datei- oder Netzzugriff.

import { htmlZuText, einzeilig } from './text.mjs'

export const FDB_BASIS = 'https://www.foerderdatenbank.de'
const PROGRAMM_PFAD = '/BMWI/FDB/Content/DE/Foerderprogramm'
const LABEL_PFADE = [
  '/BMWI/_config/ResourceBundleEntries/Labels/FDB',
  '/BMWI/_config/ResourceBundleEntries/Labels/FDB/UntergeordneteFoerderbereiche',
]

// Klassen aus cl2Processes, die als Filter taugen
const KLASSEN = {
  Foerderart: 'foerderart',
  Foerdergebiet: 'foerdergebiet',
  Foerdergeber: 'foerdergeber',
  Foerderberechtigte: 'foerderberechtigte',
  Foerderbereich: 'foerderbereich',
  BranchenUnternehmen: 'branchen',
  BranchenExistenzgruenderin: 'branchen',
  Unternehmensgroesse: 'unternehmensgroesse',
  Unternehmensalter: 'unternehmensalter',
}

// Feldnamen so, wie die Förderdatenbank sie auf der Programmseite beschriftet
const TEXTFELDER = {
  kurztext: 'teaserText',
  volltext: 'summary',
  voraussetzungen: 'regulatoryFWork',
  fristen: 'procInfluence',
  verfahren: 'procMethod',
  bearbeitungsdauer: 'progress',
  weitereInfos: 'competenceDescr',
  hinweis: 'remark',
  rechtsgrundlage: 'procDescription',
}

const letzterTeil = (pfad) => pfad.slice(pfad.lastIndexOf('/') + 1)

// Label-Dokumente enthalten eine kleine Tabelle: erste Zeile "de | en",
// zweite Zeile die Beschriftungen.
export function labelAusTabelle(html) {
  const zeilen = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((z) =>
    [...z[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((zelle) => einzeilig(zelle[1])),
  )
  return zeilen[1]?.[0] || ''
}

function bauLabels(dokumente) {
  const labels = new Map()
  for (const basis of LABEL_PFADE) {
    for (const doc of dokumente.values()) {
      if (doc.pfad !== basis || doc.typ !== 'gsb:ConfigResLabel') continue
      const label = labelAusTabelle(doc.felder.value)
      if (label && !labels.has(doc.name)) labels.set(doc.name, label)
    }
  }
  return labels
}

// Ein paar Kategorien haben im Export kein brauchbares Label
const LABEL_KORREKTUR = {
  _bundesweit: 'bundesweit',
  bundesweit: 'bundesweit',
  de_ni: 'Niedersachsen',
  de_st: 'Sachsen-Anhalt',
  schlesig_holstein: 'Schleswig-Holstein',
  schleswig_holstein: 'Schleswig-Holstein',
  nicht_relevant: 'nicht relevant',
  kleiner_als_eins: 'jünger als 1 Jahr',
  groesser_als_zwanzig: 'älter als 20 Jahre',
}

function labelFuer(labels, slug) {
  if (slug in LABEL_KORREKTUR) return LABEL_KORREKTUR[slug]
  if (/^\d{2}$/.test(slug)) return `${Number(slug)} ${slug === '01' ? 'Jahr' : 'Jahre'}`
  return labels.get(slug) || slug.replace(/_/g, ' ')
}

function textFeld(doc, feld) {
  return htmlZuText(doc?.felder?.[feld] ?? '')
}

function adresse(doc) {
  if (!doc) return ''
  const f = doc.felder
  const strasse = [f.road, f.houseId].filter(Boolean).join(' ').trim()
  const ort = [f.zipCode, f.city].filter(Boolean).join(' ').trim()
  return [einzeilig(f.title ?? ''), einzeilig(f.building ?? ''), strasse, f.postBox ? `Postfach ${f.postBox.trim()}` : '', ort]
    .filter(Boolean)
    .join(', ')
}

function externerLink(dokumente, schluessel) {
  const doc = dokumente.get(schluessel)
  const url = doc?.felder?.url?.trim()
  if (!url) return null
  return { titel: einzeilig(doc.felder.title ?? '') || url, url }
}

function kontakt(dokumente, schluessel) {
  const doc = dokumente.get(schluessel)
  if (!doc) return null
  const f = doc.felder
  const adr = (f.cl2Addresses ?? []).flatMap((l) => l.ziele).map((z) => adresse(dokumente.get(z))).find(Boolean)
  const web = (f.website ?? []).map((z) => externerLink(dokumente, z)?.url).find(Boolean)
  const k = {
    name: einzeilig(f.title ?? ''),
    abteilung: einzeilig(f.header ?? ''),
    telefon: (f.phone ?? '').trim(),
    email: (f.email ?? '').trim(),
    web: web ?? '',
    adresse: adr ?? '',
  }
  for (const [schl, wert] of Object.entries(k)) if (!wert) delete k[schl]
  return k.name ? k : null
}

const nurDatum = (wert) => (/^\d{4}-\d{2}-\d{2}/.test(wert ?? '') ? wert.slice(0, 10) : '')
const eindeutig = (liste) => [...new Set(liste.filter(Boolean))]

// Liefert { programme: [...], richtlinien: Map(id -> text), kategorien }
export function bereiteAuf(dokumente) {
  const labels = bauLabels(dokumente)
  const programme = []
  const richtlinien = new Map()

  for (const doc of dokumente.values()) {
    if (doc.typ !== 'gsb:ServiceOffer' || doc.felder.subType !== 'ServiceOffer-FundingProgram') continue
    if (!doc.pfad.startsWith(PROGRAMM_PFAD + '/') && doc.pfad !== PROGRAMM_PFAD) continue

    const relativ = doc.pfad.slice(PROGRAMM_PFAD.length + 1)
    const id = relativ ? `${relativ}/${doc.name}` : doc.name
    const titel = einzeilig(doc.felder.title ?? '')
    if (!titel) continue

    const p = {
      id,
      titel,
      url: `${FDB_BASIS}/FDB/Content/DE/Foerderprogramm/${id}.html`,
      ebene: id.split('/')[0],
      veroeffentlicht: nurDatum(doc.felder.dateOfIssue),
    }

    const kategorien = {}
    for (const liste of doc.felder.cl2Processes ?? []) {
      const ziel = KLASSEN[liste.klasse]
      if (ziel) {
        kategorien[ziel] = eindeutig([...(kategorien[ziel] ?? []), ...liste.ziele.map((z) => labelFuer(labels, letzterTeil(z)))])
      } else if (liste.klasse === 'Foerderorganisation') {
        kategorien.foerderorganisation = eindeutig(liste.ziele.map((z) => einzeilig(dokumente.get(z)?.felder?.title ?? '')))
      }
    }
    kategorien.unterbereiche = eindeutig(
      (doc.felder.cl2Satisfaction ?? []).flatMap((l) => l.ziele.map((z) => labelFuer(labels, letzterTeil(z)))),
    )
    for (const [k, v] of Object.entries(kategorien)) if (v.length) p[k] = v

    for (const [feld, quelle] of Object.entries(TEXTFELDER)) {
      const t = textFeld(doc, quelle)
      if (t) p[feld] = t
    }
    const stichwoerter = (doc.felder.keywords ?? '').trim()
    if (stichwoerter) p.stichwoerter = stichwoerter

    const kontakte = (doc.felder.cl2Contacts ?? []).flatMap((l) => l.ziele).map((z) => kontakt(dokumente, z)).filter(Boolean)
    if (kontakte.length) p.kontakte = kontakte
    const links = (doc.felder.cl2CustServices ?? [])
      .flatMap((l) => l.ziele)
      .map((z) => externerLink(dokumente, z))
      .filter(Boolean)
    if (links.length) p.links = links.filter((l, i) => links.findIndex((x) => x.url === l.url) === i)

    const richtlinie = textFeld(doc, 'bodyText')
    if (richtlinie) {
      p.hatRichtlinie = true
      richtlinien.set(id, richtlinie)
    }
    programme.push(p)
  }

  programme.sort((a, b) => a.id.localeCompare(b.id, 'de'))
  return { programme, richtlinien, kategorien: zaehleKategorien(programme) }
}

export const FACETTEN = ['foerderart', 'foerdergebiet', 'foerdergeber', 'foerderberechtigte', 'foerderbereich', 'unternehmensgroesse', 'branchen', 'unterbereiche']

export function zaehleKategorien(programme) {
  const ergebnis = {}
  for (const facette of FACETTEN) {
    const zaehler = new Map()
    for (const p of programme) for (const w of p[facette] ?? []) zaehler.set(w, (zaehler.get(w) ?? 0) + 1)
    ergebnis[facette] = [...zaehler.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
      .map(([wert, anzahl]) => ({ wert, anzahl }))
  }
  return ergebnis
}
