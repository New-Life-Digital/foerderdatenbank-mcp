#!/usr/bin/env node
// Holt den XML-Export der Förderdatenbank und schreibt die aufbereiteten Daten
// nach daten/. Aufruf:
//   node werkzeug/import.mjs              lädt den Export direkt herunter
//   node werkzeug/import.mjs --zip x.zip  nimmt eine bereits geladene Datei

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { leseDokument } from '../lib/gsb.mjs'
import { dekodiere } from '../lib/text.mjs'
import { bereiteAuf } from '../lib/aufbereiten.mjs'
import { QUELLE } from '../lib/lizenz.mjs'

const EXPORT_URL = 'https://www.foerderdatenbank.de/FDB/WS/export'
const DATEN = join(dirname(fileURLToPath(import.meta.url)), '..', 'daten')
const MINDESTENS = 1000

function abbruch(text) {
  console.error(`\nAbbruch: ${text}`)
  process.exit(1)
}

async function ladeExport() {
  const i = process.argv.indexOf('--zip')
  if (i > 0) {
    const datei = process.argv[i + 1]
    if (!datei || !existsSync(datei)) abbruch(`Datei nicht gefunden: ${datei}`)
    console.log(`Lese ${datei}`)
    return readFileSync(datei)
  }
  console.log(`Lade ${EXPORT_URL}`)
  const res = await fetch(EXPORT_URL, { headers: { accept: 'application/zip', 'user-agent': 'foerderdatenbank-mcp' } })
  const typ = res.headers.get('content-type') ?? ''
  if (!res.ok) abbruch(`Export antwortet mit HTTP ${res.status}.`)
  if (!typ.includes('zip')) {
    abbruch(`Statt einer ZIP-Datei kam "${typ}". Vermutlich hat die Bot-Abwehr der Förderdatenbank den Abruf blockiert. Später erneut versuchen oder die Datei im Browser laden und mit --zip übergeben.`)
  }
  return Buffer.from(await res.arrayBuffer())
}

function schreibe(datei, inhalt) {
  mkdirSync(dirname(datei), { recursive: true })
  writeFileSync(datei, inhalt)
}

const zip = await ladeExport()
console.log(`ZIP: ${(zip.length / 1e6).toFixed(1)} MB`)

const eintraege = unzipSync(new Uint8Array(zip), { filter: (f) => f.name.endsWith('.xml') })
const dokumente = new Map()
let fehler = 0
for (const [name, bytes] of Object.entries(eintraege)) {
  try {
    const doc = leseDokument(dekodiere(bytes))
    if (doc) dokumente.set(doc.schluessel, doc)
  } catch (e) {
    fehler++
    if (fehler <= 5) console.warn(`  Nicht lesbar: ${name} (${e.message})`)
  }
}
console.log(`Dokumente gelesen: ${dokumente.size}${fehler ? `, nicht lesbar: ${fehler}` : ''}`)

const { programme, richtlinien, kategorien } = bereiteAuf(dokumente)
if (programme.length < MINDESTENS) abbruch(`Nur ${programme.length} Programme gefunden, erwartet mindestens ${MINDESTENS}. Nichts geschrieben.`)

const programmeJsonl = programme.map((p) => JSON.stringify(p)).join('\n') + '\n'
const hash = createHash('sha256').update(programmeJsonl)
for (const id of [...richtlinien.keys()].sort()) hash.update(id).update(richtlinien.get(id))
const inhaltHash = hash.digest('hex').slice(0, 16)

const metaDatei = join(DATEN, 'meta.json')
const alt = existsSync(metaDatei) ? JSON.parse(readFileSync(metaDatei, 'utf8')) : null
if (alt?.inhaltHash === inhaltHash) {
  console.log(`Keine Änderungen seit ${alt.datenstand}. Nichts geschrieben.`)
  process.exit(0)
}

rmSync(join(DATEN, 'richtlinien'), { recursive: true, force: true })
for (const [id, text] of richtlinien) schreibe(join(DATEN, 'richtlinien', `${id}.md`), text + '\n')
schreibe(join(DATEN, 'programme.jsonl'), programmeJsonl)
schreibe(join(DATEN, 'kategorien.json'), JSON.stringify(kategorien, null, 2) + '\n')
const meta = {
  ...QUELLE,
  export: EXPORT_URL,
  datenstand: new Date().toISOString().slice(0, 10),
  anzahlProgramme: programme.length,
  anzahlRichtlinien: richtlinien.size,
  inhaltHash,
}
schreibe(metaDatei, JSON.stringify(meta, null, 2) + '\n')

const groesse = (Buffer.byteLength(programmeJsonl) / 1e6).toFixed(1)
console.log(`Geschrieben: ${programme.length} Programme (${groesse} MB), ${richtlinien.size} Richtlinien, Datenstand ${meta.datenstand}`)
