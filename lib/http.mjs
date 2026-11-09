// HTTP-Schicht: MCP über Streamable HTTP (zustandslos) und eine kleine
// JSON-Schnittstelle für Webseiten. Wird von den Vercel-Funktionen in api/
// und vom lokalen Testserver genutzt.

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { daten } from './daten.mjs'
import { erstelleServer } from './server.mjs'
import { BUNDESLAENDER } from './suche.mjs'
import { QUELLE } from './lizenz.mjs'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
  'access-control-max-age': '86400',
}

function cors(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v)
}

function json(res, status, inhalt, cache = 'no-store') {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', cache)
  res.end(JSON.stringify(inhalt))
}

export async function mcpAnfrage(req, res, body) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST, OPTIONS')
    return json(res, 405, {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Dieser MCP-Server arbeitet zustandslos: bitte POST an diese Adresse (Streamable HTTP).' },
      id: null,
    })
  }
  const server = erstelleServer(daten())
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => {
    transport.close()
    server.close()
  })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  } catch (e) {
    console.error('MCP-Anfrage fehlgeschlagen', e)
    if (!res.headersSent) json(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Interner Fehler' }, id: null })
  }
}

const ganzzahl = (wert, standard, min, max) => {
  const n = Number.parseInt(wert ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : standard
}

const ZWISCHENSPEICHER = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'

export function sucheAnfrage(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'GET') return json(res, 405, { fehler: 'Nur GET' })
  const q = new URL(req.url, 'http://localhost').searchParams
  const viele = (k) =>
    q
      .getAll(k)
      .flatMap((v) => v.split(','))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)
  const bundesland = q.get('bundesland')
  const d = daten()
  const ergebnis = d.suche({
    suchbegriffe: (q.get('q') ?? '').slice(0, 300),
    bundesland: BUNDESLAENDER.includes(bundesland) ? bundesland : undefined,
    bundesweitEinschliessen: q.get('bundesweit') !== 'nein',
    foerderart: viele('foerderart'),
    foerderberechtigte: viele('foerderberechtigte'),
    foerderbereich: viele('foerderbereich'),
    unternehmensgroesse: viele('unternehmensgroesse'),
    foerdergeber: viele('foerdergeber'),
    branchen: viele('branchen'),
    anzahl: ganzzahl(q.get('anzahl'), 10, 1, 50),
    versatz: ganzzahl(q.get('versatz'), 0, 0, 2500),
  })
  json(res, 200, { ...ergebnis, datenstand: d.meta.datenstand, quelle: QUELLE }, ZWISCHENSPEICHER)
}

export function filterAnfrage(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  const d = daten()
  json(
    res,
    200,
    { bundeslaender: BUNDESLAENDER, kategorien: d.kategorien, anzahlProgramme: d.anzahl, datenstand: d.meta.datenstand, quelle: QUELLE },
    ZWISCHENSPEICHER,
  )
}
