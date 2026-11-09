import { filterAnfrage } from '../lib/http.mjs'

export default function handler(req, res) {
  return filterAnfrage(req, res)
}
