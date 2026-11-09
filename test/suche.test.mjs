import { test } from 'node:test'
import assert from 'node:assert/strict'
import { erstelleSuche, falte, stamm } from '../lib/suche.mjs'

const programme = [
  { id: 'Land/BW/a', titel: 'Digitalisierungsprämie Plus', ebene: 'Land', foerdergebiet: ['Baden-Württemberg'], foerderart: ['Zuschuss', 'Darlehen'], foerderberechtigte: ['Unternehmen'], kurztext: 'Zuschuss für Digitalisierungsprojekte im Mittelstand', veroeffentlicht: '2023-01-01' },
  { id: 'Land/BY/b', titel: 'Digitalbonus', ebene: 'Land', foerdergebiet: ['Bayern'], foerderart: ['Zuschuss'], foerderberechtigte: ['Unternehmen'], kurztext: 'Förderung der Digitalisierung in Bayern', veroeffentlicht: '2024-01-01' },
  { id: 'Bund/c', titel: 'Gründungszuschuss', ebene: 'Bund', foerdergebiet: ['bundesweit'], foerderart: ['Zuschuss'], foerderberechtigte: ['Existenzgründer/in'], kurztext: 'Unterstützung bei der Existenzgründung aus der Arbeitslosigkeit', veroeffentlicht: '2020-01-01' },
  { id: 'Bund/d', titel: 'ERP-Förderkredit Digitalisierung', ebene: 'Bund', foerdergebiet: ['bundesweit'], foerderart: ['Darlehen'], foerderberechtigte: ['Unternehmen'], kurztext: 'Kredit für Vorhaben der Digitalisierung und Innovation', veroeffentlicht: '2022-01-01' },
]
const { suche, programm } = erstelleSuche(programme)
const ids = (r) => r.treffer.map((t) => t.id)

test('Umlaute und Umschreibungen werden gleich behandelt', () => {
  assert.equal(falte('Förderung'), falte('Foerderung'))
  assert.equal(stamm(falte('Förderungen')), stamm(falte('Förderung')))
})

test('Bundesland filtert und lässt bundesweite Programme drin', () => {
  const r = suche({ suchbegriffe: 'Digitalisierung', bundesland: 'Baden-Württemberg' })
  assert.deepEqual(ids(r).sort(), ['Bund/d', 'Land/BW/a'])
})

test('bei gleicher Relevanz steht das Landesprogramm vorn', () => {
  const gleich = { titel: 'Beratungsförderung', kurztext: 'Zuschuss für Beratung', foerderart: ['Zuschuss'] }
  const s = erstelleSuche([
    { id: 'Bund/x', ebene: 'Bund', foerdergebiet: ['bundesweit'], ...gleich },
    { id: 'Land/HE/y', ebene: 'Land', foerdergebiet: ['Hessen'], ...gleich },
  ])
  assert.deepEqual(ids(s.suche({ suchbegriffe: 'Beratung', bundesland: 'Hessen' })), ['Land/HE/y', 'Bund/x'])
})

test('nur Landesprogramme, wenn gewünscht', () => {
  const r = suche({ suchbegriffe: 'Digitalisierung', bundesland: 'Baden-Württemberg', bundesweitEinschliessen: false })
  assert.deepEqual(ids(r), ['Land/BW/a'])
})

test('Förderart-Filter', () => {
  assert.deepEqual(ids(suche({ suchbegriffe: 'Digitalisierung', foerderart: ['Darlehen'] })).sort(), ['Bund/d', 'Land/BW/a'])
})

test('Synonyme: Kredit findet Darlehen-Texte, Gründer findet Existenzgründung', () => {
  assert.ok(ids(suche({ suchbegriffe: 'Kredit' })).includes('Bund/d'))
  assert.ok(ids(suche({ suchbegriffe: 'Gründer' })).includes('Bund/c'))
})

test('ohne Suchbegriff: Filterliste, neueste zuerst', () => {
  assert.deepEqual(ids(suche({ foerderart: ['Zuschuss'] })), ['Land/BY/b', 'Land/BW/a', 'Bund/c'])
})

test('Blättern und Gesamtzahl', () => {
  const r = suche({ foerderart: ['Zuschuss'], anzahl: 1, versatz: 1 })
  assert.equal(r.gesamt, 3)
  assert.deepEqual(ids(r), ['Land/BW/a'])
})

test('unbekannte ID liefert null', () => {
  assert.equal(programm('gibt/es/nicht'), null)
})
