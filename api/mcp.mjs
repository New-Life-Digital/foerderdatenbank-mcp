import { mcpAnfrage } from '../lib/http.mjs'

export default function handler(req, res) {
  return mcpAnfrage(req, res, req.body)
}
