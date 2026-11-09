// MCP-Server mit drei Werkzeugen: suchen, Details abrufen, Filter auflisten.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { daten as standardDaten } from './daten.mjs'
import { BUNDESLAENDER } from './suche.mjs'
import { datumDeutsch, quellenhinweis } from './lizenz.mjs'
import { kuerze } from './text.mjs'

export const NAME = 'foerderdatenbank-mcp'
export const VERSION = '1.0.0'
const TEIL_LAENGE = 15000

const ANLEITUNG = `Dieser Server durchsucht die Förderdatenbank des Bundes (foerderdatenbank.de, Bundesministerium für Wirtschaft und Energie): rund 2.500 Förderprogramme von Bund, Ländern und EU.

So gehst du vor:
1. foerderprogramme_suchen mit deutschen Suchbegriffen und passenden Filtern aufrufen. Wenn der Standort bekannt ist, immer das Bundesland setzen; bundesweite Programme kommen dann automatisch mit.
2. Für die besten Treffer foerderprogramm_details abrufen, bevor du Aussagen zu Höhe, Voraussetzungen oder Fristen machst.
3. Nenne bei jedem Programm den Link zur Originalseite und den Datenstand.

Wichtig: Förderbedingungen ändern sich. Verbindlich ist allein die Originalseite bzw. die Förderrichtlinie. Sage nicht zu, dass jemand gefördert wird; empfiehl bei konkreten Vorhaben die genannte Ansprechstelle.

Quelle der Daten: Förderdatenbank des Bundes, BMWE, Lizenz CC BY 4.0. Betrieben von New Life Digital, Mannheim (newlifedigital.de). Quellcode offen (MIT).`

function textAntwort(text, d) {
  return { content: [{ type: 'text', text: `${text}\n\n---\n${quellenhinweis(d.meta.datenstand)}` }] }
}

function fehler(text) {
  return { content: [{ type: 'text', text }], isError: true }
}

function zeile(label, werte) {
  const liste = Array.isArray(werte) ? werte.filter(Boolean) : werte ? [werte] : []
  return liste.length ? `${label}: ${liste.join(', ')}` : ''
}

function filterBeschreibung(f) {
  const teile = []
  if (f.bundesland) teile.push(`in ${f.bundesland}${f.bundesweitEinschliessen === false ? '' : ' (inkl. bundesweit)'}`)
  for (const [label, werte] of [
    ['Förderart', f.foerderart],
    ['für', f.foerderberechtigte],
    ['Bereich', f.foerderbereich],
    ['Größe', f.unternehmensgroesse],
    ['Fördergeber', f.foerdergeber],
    ['Branche', f.branchen],
  ]) {
    if (werte?.length) teile.push(`${label}: ${werte.join(' oder ')}`)
  }
  return teile.join(' · ')
}

function trefferText(ergebnis, eingabe) {
  const { gesamt, treffer } = ergebnis
  const was = eingabe.suchbegriffe ? `„${eingabe.suchbegriffe}“` : 'alle Programme'
  const filter = filterBeschreibung(eingabe)
  if (!gesamt) {
    return `Keine Treffer für ${was}${filter ? ` (${filter})` : ''}. Tipp: weniger oder allgemeinere Suchbegriffe verwenden (z. B. „Digitalisierung“ statt eines Produktnamens) oder Filter lockern.`
  }
  const von = (eingabe.versatz ?? 0) + 1
  const bis = von + treffer.length - 1
  const kopf = `${gesamt} Treffer für ${was}${filter ? ` (${filter})` : ''}, angezeigt ${von}–${bis}:`
  const eintraege = treffer.map((t, i) =>
    [
      `${von + i}. **${t.titel}**`,
      `   ID: ${t.id}`,
      `   ${[zeile('Ebene', t.ebene), zeile('Gebiet', t.foerdergebiet), zeile('Förderart', t.foerderart)].filter(Boolean).join(' · ')}`,
      t.foerderberechtigte.length ? `   ${zeile('Förderberechtigt', t.foerderberechtigte)}` : '',
      t.kurztext ? `   ${t.kurztext.replace(/\n+/g, ' ')}` : '',
      `   Link: ${t.url}`,
    ]
      .filter(Boolean)
      .join('\n'),
  )
  const mehr = gesamt > bis ? `\n\nWeitere Treffer mit versatz=${bis} abrufen.` : ''
  return `${kopf}\n\n${eintraege.join('\n\n')}${mehr}\n\nDetails zu einem Programm: foerderprogramm_details mit der ID.`
}

function abschnitt(titel, text) {
  return text ? `## ${titel}\n\n${text.replace(/^## /gm, '### ')}` : ''
}

function detailText(p, richtlinie) {
  const kontakte = (p.kontakte ?? []).map((k) =>
    ['- ' + k.name, k.abteilung && `  ${k.abteilung}`, k.adresse && `  ${k.adresse}`, k.telefon && `  Telefon: ${k.telefon}`, k.email && `  E-Mail: ${k.email}`, k.web && `  Web: ${k.web}`]
      .filter(Boolean)
      .join('\n'),
  )
  const links = (p.links ?? []).map((l) => `- [${l.titel}](${l.url})`)
  const auszug = richtlinie
    ? `${kuerze(richtlinie, 2500)}\n\n(Richtlinie gekürzt, ${richtlinie.length.toLocaleString('de-DE')} Zeichen. Volltext: foerderprogramm_details mit abschnitt="richtlinie".)`
    : ''
  return [
    `# ${p.titel}`,
    [
      `Link zur Originalseite: ${p.url}`,
      zeile('ID', p.id),
      zeile('Ebene', p.ebene),
      zeile('Fördergebiet', p.foerdergebiet),
      zeile('Förderart', p.foerderart),
      zeile('Fördergeber', p.foerdergeber),
      zeile('Förderorganisation', p.foerderorganisation),
      zeile('Förderberechtigte', p.foerderberechtigte),
      zeile('Unternehmensgröße', p.unternehmensgroesse),
      zeile('Unternehmensalter', p.unternehmensalter),
      zeile('Branchen', p.branchen),
      zeile('Förderbereich', p.foerderbereich),
      zeile('Unterbereiche', p.unterbereiche),
      p.veroeffentlicht ? `Erstmals veröffentlicht: ${datumDeutsch(p.veroeffentlicht)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    abschnitt('Kurztext', p.kurztext),
    abschnitt('Zusammenfassung', p.volltext),
    abschnitt('Rechtliche Voraussetzungen', p.voraussetzungen),
    abschnitt('Fristen', p.fristen),
    abschnitt('Verfahrensablauf', p.verfahren),
    abschnitt('Bearbeitungsdauer', p.bearbeitungsdauer),
    abschnitt('Weitere Informationen', p.weitereInfos),
    abschnitt('Hinweis', p.hinweis),
    abschnitt('Rechtsgrundlage', p.rechtsgrundlage),
    kontakte.length ? `## Ansprechpartner\n\n${kontakte.join('\n')}` : '',
    links.length ? `## Weiterführende Links\n\n${links.join('\n')}` : '',
    abschnitt('Richtlinie (Auszug)', auszug),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function erstelleServer(d = standardDaten()) {
  const werte = (facette) => d.kategorien[facette]?.map((k) => k.wert) ?? []
  const liste = (facette, beschreibung) => {
    const w = werte(facette)
    return z.array(w.length ? z.enum(w) : z.string()).max(10).optional().describe(beschreibung)
  }

  const server = new McpServer(
    { name: NAME, version: VERSION, title: 'Förderdatenbank des Bundes' },
    { instructions: ANLEITUNG },
  )

  server.registerTool(
    'foerderprogramme_suchen',
    {
      title: 'Förderprogramme suchen',
      description:
        'Durchsucht die Förderdatenbank des Bundes nach passenden Förderprogrammen von Bund, Ländern und EU. Liefert Treffer mit ID, Kurzbeschreibung, Förderart, Gebiet und Link zur Originalseite. Suchbegriffe auf Deutsch, am besten so, wie sie in Förderrichtlinien stehen (z. B. „Digitalisierung“, „Energieeffizienz“, „Existenzgründung“, „Innovationsgutschein“, „Weiterbildung“). Mit Filtern eingrenzen, vor allem mit dem Bundesland des Standorts. Ohne Suchbegriffe werden alle Programme zu den Filtern geliefert, neueste zuerst.',
      inputSchema: {
        suchbegriffe: z.string().max(300).optional().describe('Freitext auf Deutsch, z. B. "Digitalisierung Handwerk" oder "Photovoltaik Landwirtschaft"'),
        bundesland: z.enum(BUNDESLAENDER).optional().describe('Bundesland des Unternehmenssitzes oder Vorhabens. Bundesweite Programme werden mitgeliefert.'),
        bundesweitEinschliessen: z.boolean().optional().describe('Standard true. false liefert nur Programme dieses Bundeslandes.'),
        foerderart: liste('foerderart', 'z. B. Zuschuss oder Darlehen'),
        foerderberechtigte: liste('foerderberechtigte', 'Wer antragsberechtigt ist, z. B. Unternehmen oder Existenzgründer/in'),
        foerderbereich: liste('foerderbereich', 'Thematischer Förderbereich'),
        unternehmensgroesse: liste('unternehmensgroesse', 'Größe des antragstellenden Unternehmens'),
        foerdergeber: liste('foerdergeber', 'Bund, Land oder EU'),
        branchen: liste('branchen', 'Branche des Unternehmens'),
        anzahl: z.number().int().min(1).max(25).optional().describe('Anzahl Treffer, Standard 10, höchstens 25'),
        versatz: z.number().int().min(0).max(2500).optional().describe('Für weitere Seiten: Anzahl zu überspringender Treffer'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (eingabe) => {
      const e = { ...eingabe, anzahl: eingabe.anzahl ?? 10, versatz: eingabe.versatz ?? 0 }
      return textAntwort(trefferText(d.suche(e), e), d)
    },
  )

  server.registerTool(
    'foerderprogramm_details',
    {
      title: 'Details zu einem Förderprogramm',
      description:
        'Liefert alle Angaben zu einem Förderprogramm aus der Förderdatenbank: Zusammenfassung, rechtliche Voraussetzungen, Fristen, Verfahren, Ansprechpartner, Links und einen Auszug der Richtlinie. Mit abschnitt="richtlinie" kommt der Volltext der Förderrichtlinie, lange Richtlinien in Teilen.',
      inputSchema: {
        id: z.string().min(1).max(300).describe('ID aus den Suchergebnissen, z. B. "Land/Baden-Wuerttemberg/bw-innovationsgutscheine-fuer-kleine-und-mittlere"'),
        abschnitt: z.enum(['uebersicht', 'richtlinie']).optional().describe('Standard "uebersicht"'),
        teil: z.number().int().min(1).max(50).optional().describe('Bei abschnitt="richtlinie": welcher Teil, Standard 1'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, abschnitt: welcher = 'uebersicht', teil = 1 }) => {
      const p = d.programm(id.trim().replace(/\.html$/, '').replace(/^.*\/Foerderprogramm\//, ''))
      if (!p) return fehler(`Kein Programm mit der ID "${id}". IDs stehen in den Ergebnissen von foerderprogramme_suchen.`)
      const richtlinie = d.richtlinie(p.id)
      if (welcher === 'richtlinie') {
        if (!richtlinie) return textAntwort(`# ${p.titel}\n\nZu diesem Programm ist keine Richtlinie hinterlegt. Originalseite: ${p.url}`, d)
        const teile = Math.ceil(richtlinie.length / TEIL_LAENGE)
        if (teil > teile) return fehler(`Die Richtlinie hat nur ${teile} Teil(e).`)
        const stueck = richtlinie.slice((teil - 1) * TEIL_LAENGE, teil * TEIL_LAENGE)
        const weiter =
          teil < teile ? `\n\n(Teil ${teil} von ${teile}. Weiter mit teil=${teil + 1}.)` : teile > 1 ? `\n\n(Letzter Teil von ${teile}.)` : ''
        return textAntwort(`# Richtlinie: ${p.titel}\n\nOriginalseite: ${p.url}\n\n${stueck}${weiter}`, d)
      }
      return textAntwort(detailText(p, richtlinie), d)
    },
  )

  server.registerTool(
    'foerderfilter_auflisten',
    {
      title: 'Filterwerte der Förderdatenbank',
      description:
        'Listet alle Werte für die Filter von foerderprogramme_suchen mit der Anzahl der Programme sowie den Datenstand. Nützlich, um einen Überblick zu geben, welche Förderarten oder Bereiche es gibt.',
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const bloecke = Object.entries(d.kategorien).map(
        ([facette, eintraege]) => `## ${facette}\n${eintraege.map((k) => `- ${k.wert} (${k.anzahl})`).join('\n')}`,
      )
      return textAntwort(
        `Förderdatenbank des Bundes: ${d.anzahl.toLocaleString('de-DE')} Programme, Datenstand ${datumDeutsch(d.meta.datenstand)}.\n\n${bloecke.join('\n\n')}`,
        d,
      )
    },
  )

  return server
}
