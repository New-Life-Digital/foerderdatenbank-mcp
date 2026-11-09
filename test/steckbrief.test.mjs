import { test } from 'node:test'
import assert from 'node:assert/strict'
import { antragVorBeginn, fristKurz, hoeheAusText, kontaktKurz, saetze, steckbrief } from '../lib/steckbrief.mjs'

test('Sätze werden nicht an Abkürzungen getrennt', () => {
  const s = saetze('Gefördert werden z. B. Maschinen und Anlagen für die Produktion. Die Höhe des Zuschusses beträgt bis zu 40 Prozent.')
  assert.equal(s.length, 2)
  assert.match(s[0], /z\. B\. Maschinen/)
})

test('Höhe: der Satz mit Betrag und Förderwort, wörtlich', () => {
  const text = 'Das Programm unterstützt kleine Unternehmen. Antragsberechtigt sind Unternehmen mit weniger als 250 Beschäftigten und einem Jahresumsatz von höchstens 50 Mio. EUR. Die Höhe des Zuschusses beträgt bis zu 50 Prozent der förderfähigen Kosten, höchstens EUR 20.000.'
  assert.equal(hoeheAusText(text), 'Die Höhe des Zuschusses beträgt bis zu 50 Prozent der förderfähigen Kosten, höchstens EUR 20.000.')
})

test('Höhe: Größengrenzen zählen nicht als Förderhöhe', () => {
  assert.equal(hoeheAusText('Gefördert werden Unternehmen mit bis zu 50 Mitarbeitenden und einem Umsatz bis 10 Millionen Euro.'), null)
  assert.equal(hoeheAusText(''), null)
})

test('Höhe: Satz mit "Zusätzlich" bekommt den Satz davor', () => {
  const text = 'Sie erhalten einen Zuschuss in Höhe von 2.000 Euro für die Beratung. Zusätzlich übernimmt das Land bis zu 80 Prozent der Reisekosten.'
  assert.equal(hoeheAusText(text), 'Sie erhalten einen Zuschuss in Höhe von 2.000 Euro für die Beratung. Zusätzlich übernimmt das Land bis zu 80 Prozent der Reisekosten.')
})

test('Höhe: Listenstriche werden zu Kommas', () => {
  assert.equal(hoeheAusText('Der Zuschuss beträgt 50 Prozent, jedoch - beim Gutschein A höchstens EUR 7.500, - beim Gutschein B höchstens EUR 20.000.'), 'Der Zuschuss beträgt 50 Prozent, jedoch: beim Gutschein A höchstens EUR 7.500, beim Gutschein B höchstens EUR 20.000.')
})

test('Antrag vor Projektbeginn nur bei ausdrücklicher Angabe', () => {
  assert.equal(antragVorBeginn({ fristen: 'Sie müssen spätestens 6 Wochen vor Beginn des Vorhabens den Antrag einreichen.' }), true)
  assert.equal(antragVorBeginn({ verfahren: 'Antragstellung: vor Projektbeginn' }), true)
  assert.equal(antragVorBeginn({ volltext: 'Anträge können jederzeit gestellt werden.' }), false)
})

test('Frist kompakt und Kontakt ohne Zusätze', () => {
  assert.equal(fristKurz({ fristen: '- Antragstellung:\n\n- bis zum 30.9. für das Folgejahr' }), 'Antragstellung: bis zum 30.9. für das Folgejahr')
  assert.equal(fristKurz({}), null)
  assert.deepEqual(kontaktKurz({ kontakte: [{ name: 'KfW', telefon: '+49 800 539-9001 (Anrufzeiten: Montag bis Freitag)', web: 'https://www.kfw.de' }] }), { name: 'KfW', telefon: '+49 800 539-9001', web: 'https://www.kfw.de' })
  assert.deepEqual(kontaktKurz({ kontakte: [{ name: 'Amt', web: 'http://unsicher.example' }] }), { name: 'Amt' })
  assert.equal(kontaktKurz({}), null)
})

test('Steckbrief fasst alles zusammen', () => {
  const s = steckbrief({ volltext: 'Die Höhe des Darlehens beträgt zwischen EUR 10.000 und EUR 5 Millionen.', kontakte: [{ name: 'L-Bank', web: 'https://www.l-bank.de/' }] })
  assert.deepEqual(s, { hoehe: 'Die Höhe des Darlehens beträgt zwischen EUR 10.000 und EUR 5 Millionen.', vorBeginn: false, frist: null, kontakt: { name: 'L-Bank', web: 'https://www.l-bank.de/' } })
})
