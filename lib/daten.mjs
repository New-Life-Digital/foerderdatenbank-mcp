// Lädt die aufbereiteten Daten aus daten/ einmal pro Prozess.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { erstelleSuche } from './suche.mjs'

const STANDARD_ORDNER = join(dirname(fileURLToPath(import.meta.url)), '..', 'daten')

export function ladeDaten(ordner = process.env.FOERDER_DATEN || STANDARD_ORDNER) {
  const datei = (name) => join(ordner, name)
  if (!existsSync(datei('programme.jsonl'))) {
    throw new Error(`Keine Daten in ${ordner}. Zuerst "npm run import" ausführen.`)
  }
  const programme = readFileSync(datei('programme.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((zeile) => JSON.parse(zeile))
  const kategorien = JSON.parse(readFileSync(datei('kategorien.json'), 'utf8'))
  const meta = JSON.parse(readFileSync(datei('meta.json'), 'utf8'))
  const suche = erstelleSuche(programme)

  // Richtlinien liegen als einzelne Dateien vor und werden erst bei Bedarf
  // gelesen. Nur bekannte IDs, damit niemand über "../" andere Dateien liest.
  function richtlinie(id) {
    const p = suche.programm(id)
    if (!p?.hatRichtlinie) return ''
    const pfad = join(ordner, 'richtlinien', ...p.id.split('/')) + '.md'
    return existsSync(pfad) ? readFileSync(pfad, 'utf8').trim() : ''
  }

  return { ...suche, kategorien, meta, richtlinie }
}

let zwischenspeicher = null
export function daten() {
  zwischenspeicher ??= ladeDaten()
  return zwischenspeicher
}
