import { sucheAnfrage } from '../lib/http.mjs'

export default function handler(req, res) {
  return sucheAnfrage(req, res)
}
