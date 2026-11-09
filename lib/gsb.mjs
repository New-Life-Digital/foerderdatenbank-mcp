// Liest ein Dokument im "GSB Repository Importer/Exporter"-Format, so wie es
// im XML-Export der Förderdatenbank steckt (siehe Schnittstellenbeschreibung).

import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'property' || name === 'classifiedLinkList' || name === 'link',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
  htmlEntities: false,
})

// Im Export ist der CDATA-Block selbst noch einmal als Text maskiert
// ("&lt;![CDATA[...]]&gt;"). Nach dem XML-Parsen steht er deshalb wörtlich im
// Wert und wird hier abgeschält.
function text(knoten) {
  let wert = ''
  if (typeof knoten === 'string') wert = knoten
  else if (knoten && typeof knoten === 'object' && '#text' in knoten) wert = String(knoten['#text'])
  const t = wert.trim()
  if (t.startsWith('<![CDATA[') && t.endsWith(']]>')) return t.slice(9, -3)
  return wert
}

function ziele(knoten) {
  const links = knoten && typeof knoten === 'object' ? knoten.link ?? [] : []
  return links
    .map((l) => l['@_xlink:href'] ?? '')
    .filter(Boolean)
    .map((href) => href.replace(/^target:/, ''))
}

const letzterTeil = (pfad) => pfad.slice(pfad.lastIndexOf('/') + 1)

// Liefert { schluessel, name, pfad, typ, felder } oder null, wenn die Datei
// kein Dokument enthält. "schluessel" ist der Repository-Pfad, auf den
// Verweise in anderen Dokumenten zeigen ("/BMWI/FDB/.../name").
export function leseDokument(xml) {
  const doc = parser.parse(xml)?.document
  if (!doc) return null
  const name = doc['@_name'] ?? ''
  const pfad = doc['@_path'] ?? ''
  const felder = {}
  for (const p of doc.property ?? []) {
    const feld = String(p['@_name'] ?? '').replace(/^gsb:/, '')
    switch (p['@_type']) {
      case 'RichText':
        felder[feld] = text(p.text)
        break
      case 'String':
      case 'Date':
      case 'Long':
        felder[feld] = text(p.value)
        break
      case 'LinkList':
        felder[feld] = ziele(p.links)
        break
      case 'ClassifiedLinkLists':
        felder[feld] = (p.classifiedLinkLists?.classifiedLinkList ?? []).map((liste) => ({
          klasse: letzterTeil(ziele(liste.classifierLinks)[0] ?? ''),
          ziele: ziele(liste.links),
        }))
        break
      default:
        break
    }
  }
  return { schluessel: `${pfad}/${name}`, name, pfad, typ: doc['@_type'] ?? '', felder }
}

export { letzterTeil }
