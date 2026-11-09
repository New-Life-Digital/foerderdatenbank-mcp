import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leseDokument } from '../lib/gsb.mjs'
import { bereiteAuf, labelAusTabelle } from '../lib/aufbereiten.mjs'

// Nachbau des Exportformats: der CDATA-Block ist selbst noch einmal maskiert
const rich = (html) => `<text>&lt;![CDATA[${html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}]]&gt;</text>`
const link = (ziel) => `<link xlink:href="target:${ziel}"/>`
const liste = (klasse, ziele) =>
  `<classifiedLinkList><classifierText></classifierText><classifierLinks>${link('/BMWI/SiteGlobals/Classifications/Classifier/Common/' + klasse)}</classifierLinks><links>${ziele.map(link).join('')}</links></classifiedLinkList>`
const dok = (pfad, name, typ, felder) =>
  `<?xml version="1.0" encoding="UTF-8"?><document xmlns:xlink="http://www.w3.org/1999/xlink" name="${name}" path="${pfad}" type="${typ}">${felder}</document>`

const programm = dok(
  '/BMWI/FDB/Content/DE/Foerderprogramm/Land/Baden-Wuerttemberg',
  'testprogramm',
  'gsb:ServiceOffer',
  `<property name="gsb:title" type="RichText">${rich('<div><p>Test ?Programm?</p></div>')}</property>
   <property name="gsb:teaserText" type="RichText">${rich('<div><p>Kurz &amp; knapp</p></div>')}</property>
   <property name="gsb:bodyText" type="RichText">${rich('<div><h2>1. Ziel</h2><p>Richtlinientext</p></div>')}</property>
   <property name="gsb:subType" type="String"><value>ServiceOffer-FundingProgram</value></property>
   <property name="gsb:dateOfIssue" type="Date"><value>2024-03-01T10:00:00.000+01:00</value></property>
   <property name="gsb:cl2Processes" type="ClassifiedLinkLists"><classifiedLinkLists>
     ${liste('Foerderart', ['/BMWI/SiteGlobals/Categories/FDB/Foerderart/zuschuss'])}
     ${liste('Foerdergebiet', ['/BMWI/SiteGlobals/Categories/FDB/Foerdergebiet/baden_wuerttemberg'])}
   </classifiedLinkLists></property>
   <property name="gsb:cl2Contacts" type="ClassifiedLinkLists"><classifiedLinkLists>${liste('Kontakt', ['/BMWI/FDB/Content/DE/Kontakt/L/l-bank'])}</classifiedLinkLists></property>`,
)
const kontakt = dok(
  '/BMWI/FDB/Content/DE/Kontakt/L',
  'l-bank',
  'gsb:ContactData',
  `<property name="gsb:title" type="RichText">${rich('<div><p>L-Bank</p></div>')}</property>
   <property name="gsb:phone" type="String"><value>0721 1501680</value></property>`,
)
const label = (slug, text) =>
  dok(
    '/BMWI/_config/ResourceBundleEntries/Labels/FDB',
    slug,
    'gsb:ConfigResLabel',
    `<property name="gsb:value" type="RichText">${rich(`<div><table><tbody><tr><td>de</td><td>en</td></tr><tr><td>${text}</td><td>[EN] x</td></tr></tbody></table></div>`)}</property>`,
  )

test('Label-Tabelle liefert die deutsche Beschriftung', () => {
  assert.equal(labelAusTabelle('<table><tr><td>de</td><td>en</td></tr><tr><td>Zuschuss</td><td>[EN]</td></tr></table>'), 'Zuschuss')
})

test('Export-Dokumente werden zu einem Programm-Datensatz', () => {
  const dokumente = new Map(
    [programm, kontakt, label('zuschuss', 'Zuschuss'), label('baden_wuerttemberg', 'Baden-Württemberg')].map((x) => {
      const d = leseDokument(x)
      return [d.schluessel, d]
    }),
  )
  const { programme, richtlinien, kategorien } = bereiteAuf(dokumente)
  assert.equal(programme.length, 1)
  const p = programme[0]
  assert.equal(p.id, 'Land/Baden-Wuerttemberg/testprogramm')
  assert.equal(p.titel, 'Test „Programm“')
  assert.equal(p.url, 'https://www.foerderdatenbank.de/FDB/Content/DE/Foerderprogramm/Land/Baden-Wuerttemberg/testprogramm.html')
  assert.equal(p.kurztext, 'Kurz & knapp')
  assert.deepEqual(p.foerderart, ['Zuschuss'])
  assert.deepEqual(p.foerdergebiet, ['Baden-Württemberg'])
  assert.deepEqual(p.kontakte, [{ name: 'L-Bank', telefon: '0721 1501680' }])
  assert.equal(p.veroeffentlicht, '2024-03-01')
  assert.equal(richtlinien.get(p.id), '## 1. Ziel\n\nRichtlinientext')
  assert.deepEqual(kategorien.foerderart, [{ wert: 'Zuschuss', anzahl: 1 }])
})
