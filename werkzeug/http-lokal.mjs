#!/usr/bin/env node
// Lokaler HTTP-Server mit denselben Endpunkten wie auf Vercel:
//   POST /mcp          MCP (Streamable HTTP, zustandslos)
//   GET  /api/suche    JSON-Suche für Webseiten
//   GET  /api/filter   Filterwerte und Datenstand

import { createServer } from 'node:http'
import { filterAnfrage, mcpAnfrage, sucheAnfrage } from '../lib/http.mjs'
import { daten } from '../lib/daten.mjs'

const PORT = Number(process.env.PORT ?? 8787)

async function koerper(req) {
  const teile = []
  for await (const teil of req) teile.push(teil)
  const text = Buffer.concat(teile).toString('utf8')
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const t0 = performance.now()
daten()
console.log(`Daten geladen in ${Math.round(performance.now() - t0)} ms`)

createServer(async (req, res) => {
  const pfad = new URL(req.url, 'http://localhost').pathname
  if (pfad === '/mcp' || pfad === '/api/mcp') return mcpAnfrage(req, res, req.method === 'POST' ? await koerper(req) : undefined)
  if (pfad === '/api/suche') return sucheAnfrage(req, res)
  if (pfad === '/api/filter') return filterAnfrage(req, res)
  res.statusCode = 404
  res.end('Nicht gefunden')
}).listen(PORT, () => console.log(`Förderdatenbank-MCP lokal: http://localhost:${PORT}/mcp`))
