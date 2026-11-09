// Ende-zu-Ende mit den echten Daten aus daten/: einmal über einen
// MCP-Client im Speicher, einmal über HTTP wie auf Vercel.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { erstelleServer } from '../lib/server.mjs'
import { daten } from '../lib/daten.mjs'
import { mcpAnfrage, sucheAnfrage } from '../lib/http.mjs'

let client
before(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair()
  await erstelleServer().connect(a)
  client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(b)
})
after(() => client?.close())

const text = (r) => r.content.map((c) => c.text).join('\n')

test('Daten sind vollständig', () => {
  const d = daten()
  assert.ok(d.anzahl > 2000, `nur ${d.anzahl} Programme`)
  assert.match(d.meta.datenstand, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(d.richtlinie('../meta'), '', 'keine Pfade außerhalb der Daten')
})

test('drei Werkzeuge, alle nur lesend', async () => {
  const { tools } = await client.listTools()
  assert.deepEqual(tools.map((t) => t.name).sort(), ['foerderfilter_auflisten', 'foerderprogramm_details', 'foerderprogramme_suchen'])
  for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true)
  const suche = tools.find((t) => t.name === 'foerderprogramme_suchen')
  assert.ok(suche.inputSchema.properties.bundesland.enum.includes('Baden-Württemberg'))
  assert.ok(suche.inputSchema.properties.foerderart.items.enum.includes('Zuschuss'))
})

test('Suche liefert Links und Quellenhinweis', async () => {
  const r = await client.callTool({ name: 'foerderprogramme_suchen', arguments: { suchbegriffe: 'Innovationsgutschein', bundesland: 'Baden-Württemberg' } })
  const t = text(r)
  assert.match(t, /Innovationsgutscheine für kleine und mittlere Unternehmen/)
  assert.match(t, /https:\/\/www\.foerderdatenbank\.de\/FDB\/Content\/DE\/Foerderprogramm\//)
  assert.match(t, /Lizenz: CC BY 4\.0/)
  assert.match(t, /Datenstand: \d{2}\.\d{2}\.\d{4}/)
})

test('Details und Richtlinie in Teilen', async () => {
  const id = 'Land/Baden-Wuerttemberg/bw-innovationsgutscheine-fuer-kleine-und-mittlere'
  const d = text(await client.callTool({ name: 'foerderprogramm_details', arguments: { id } }))
  assert.match(d, /## Ansprechpartner/)
  assert.match(d, /L-Bank/)
  assert.match(d, /Richtlinie \(Auszug\)/)
  const r = text(await client.callTool({ name: 'foerderprogramm_details', arguments: { id, abschnitt: 'richtlinie' } }))
  assert.match(r, /# Richtlinie: Innovationsgutscheine/)
  assert.match(r, /Teil 1 von 2/)
})

test('Details akzeptieren auch den Originallink', async () => {
  const url = 'https://www.foerderdatenbank.de/FDB/Content/DE/Foerderprogramm/Land/Baden-Wuerttemberg/bw-innovationsgutscheine-fuer-kleine-und-mittlere.html'
  const r = await client.callTool({ name: 'foerderprogramm_details', arguments: { id: url } })
  assert.ok(!r.isError)
})

test('unbekannte ID ist ein Werkzeugfehler, kein Absturz', async () => {
  const r = await client.callTool({ name: 'foerderprogramm_details', arguments: { id: 'gibt/es/nicht' } })
  assert.equal(r.isError, true)
})

test('über HTTP wie auf Vercel', async () => {
  const http = createServer(async (req, res) => {
    const pfad = new URL(req.url, 'http://x').pathname
    if (pfad === '/api/suche') return sucheAnfrage(req, res)
    const teile = []
    for await (const t of req) teile.push(t)
    const body = teile.length ? JSON.parse(Buffer.concat(teile).toString('utf8')) : undefined
    return mcpAnfrage(req, res, body)
  })
  await new Promise((ok) => http.listen(0, ok))
  const basis = `http://127.0.0.1:${http.address().port}`
  try {
    const c = new Client({ name: 'http-test', version: '1.0.0' })
    await c.connect(new StreamableHTTPClientTransport(new URL(`${basis}/mcp`)))
    const r = await c.callTool({ name: 'foerderprogramme_suchen', arguments: { suchbegriffe: 'Gründungszuschuss', anzahl: 3 } })
    assert.match(text(r), /Gründungszuschuss/)
    await c.close()

    const antwort = await fetch(`${basis}/api/suche?q=Digitalisierung&bundesland=Bayern&foerderart=Zuschuss&anzahl=5`)
    assert.equal(antwort.headers.get('access-control-allow-origin'), '*')
    const json = await antwort.json()
    assert.ok(json.gesamt > 0)
    assert.ok(json.treffer.length <= 5)
    assert.equal(json.quelle.lizenz, 'CC BY 4.0')
  } finally {
    http.close()
  }
})
