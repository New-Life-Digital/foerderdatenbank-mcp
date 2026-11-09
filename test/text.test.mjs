import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dekodiere, einzeilig, htmlZuText, kuerze, repariereZeichen } from '../lib/text.mjs'

test('HTML wird zu Klartext mit Überschriften und Listen', () => {
  const html =
    '<div xmlns:xlink="http://www.w3.org/1999/xlink"><h2>1. Ziel</h2><p>Gefördert werden <abbr class="logic--abbr">KMU</abbr>.</p><ul><li>eins</li><li>zwei</li></ul><p>F&amp;E&#xa0;und&nbsp;mehr</p></div>'
  assert.equal(htmlZuText(html), '## 1. Ziel\n\nGefördert werden KMU.\n\n- eins\n- zwei\n\nF&E und mehr')
})

test('wörtlich stehender CDATA-Block wird entfernt', () => {
  assert.equal(einzeilig('<![CDATA[<div><p>Gründungszuschuss</p></div>]]>'), 'Gründungszuschuss')
})

test('externe Links bleiben als Markdown, interne werden zu Text', () => {
  const html = '<p><a href="https://www.l-bank.de/x">L-Bank</a> und <a xlink:href="target:/BMWI/FDB/x">intern</a></p>'
  assert.equal(htmlZuText(html), '[L-Bank](https://www.l-bank.de/x) und intern')
})

test('kaputte Sonderzeichen aus der Quelle werden repariert', () => {
  assert.equal(repariereZeichen('Digitales Europa (2021?2027)'), 'Digitales Europa (2021–2027)')
  assert.equal(repariereZeichen('INVEST ? Zuschuss für Wagniskapital'), 'INVEST – Zuschuss für Wagniskapital')
  assert.equal(repariereZeichen('Sonderprogramm ?Energieeffizienz in Unternehmen?'), 'Sonderprogramm „Energieeffizienz in Unternehmen“')
  assert.equal(repariereZeichen('Fo?rderphase, mu?ssen u?ber'), 'Förderphase, müssen über')
  assert.equal(repariereZeichen('ein Plug?in?Hybridfahrzeug'), 'ein Plug-in-Hybridfahrzeug')
  assert.equal(repariereZeichen('Wer wird gefördert? Unternehmen.'), 'Wer wird gefördert? Unternehmen.')
  assert.equal(repariereZeichen('siehe https://x.de/a.php?id=1 und www.y.de/b?c=d'), 'siehe https://x.de/a.php?id=1 und www.y.de/b?c=d')
})

test('Dateien mit Windows-1252 werden trotzdem richtig gelesen', () => {
  assert.equal(dekodiere(Buffer.from([0x46, 0xfc, 0x72])), 'Für')
  assert.equal(dekodiere(Buffer.from('Für', 'utf8')), 'Für')
})

test('kuerze schneidet an einer Wortgrenze', () => {
  assert.equal(kuerze('eins zwei drei vier', 12), 'eins zwei …')
  assert.equal(kuerze('kurz', 12), 'kurz')
})
