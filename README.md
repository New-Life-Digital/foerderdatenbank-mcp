# Förderdatenbank MCP

Ein offener MCP-Server für die **Förderdatenbank des Bundes**. KI-Assistenten wie Claude oder ChatGPT finden damit passende Förderprogramme von Bund, Ländern und EU, mit Filtern für Bundesland, Förderart, Zielgruppe und Unternehmensgröße. Jedes Ergebnis verlinkt auf die Originalseite bei foerderdatenbank.de.

- rund 2.500 Programme aus dem offiziellen XML-Export, täglich abgeglichen
- Volltextsuche mit deutscher Wortstammerkennung („Förderungen“ findet „Förderung“)
- Details mit Voraussetzungen, Fristen, Ansprechpartnern und Förderrichtlinie
- nur lesend, ohne Anmeldung und ohne Nutzerkonto

## Nutzen

**Als Remote-Server** (nichts zu installieren):

```
https://foerder.newlifedigital.de/mcp
```

Diese Adresse in Claude, ChatGPT oder einem anderen MCP-fähigen Assistenten als eigenen Connector eintragen. In Claude Code:

```bash
claude mcp add --transport http foerderdatenbank https://foerder.newlifedigital.de/mcp
```

**Lokal** (Node.js 22 oder neuer):

```bash
git clone https://github.com/Gusdl/foerderdatenbank-mcp.git
cd foerderdatenbank-mcp
npm install
```

Dann in der MCP-Konfiguration des Clients:

```json
{
  "mcpServers": {
    "foerderdatenbank": {
      "command": "node",
      "args": ["/pfad/zu/foerderdatenbank-mcp/bin/stdio.mjs"]
    }
  }
}
```

## Werkzeuge

| Werkzeug | Zweck |
|---|---|
| `foerderprogramme_suchen` | Suche mit Freitext und Filtern (Bundesland, Förderart, Förderberechtigte, Förderbereich, Unternehmensgröße, Fördergeber, Branche). Bundesweite Programme kommen bei einem Bundesland automatisch mit. |
| `foerderprogramm_details` | Alle Angaben zu einem Programm, auf Wunsch mit der vollständigen Förderrichtlinie in Teilen |
| `foerderfilter_auflisten` | Alle Filterwerte mit Anzahl der Programme und Datenstand |

Beispielfrage an den Assistenten: *„Ich habe einen Handwerksbetrieb mit 12 Leuten in Mannheim und will unsere Angebotserstellung digitalisieren. Welche Förderungen kommen in Frage?“*

## JSON-Schnittstelle

Für Webseiten gibt es dieselbe Suche als einfache JSON-API:

```
GET /api/suche?q=Digitalisierung&bundesland=Baden-Württemberg&foerderart=Zuschuss&anzahl=10
GET /api/filter
```

## Daten und Lizenz

Die Daten stammen aus der Förderdatenbank des Bundes, Bundesministerium für Wirtschaft und Energie (BMWE), und stehen unter **CC BY 4.0**. Details, Änderungen und die Bestätigung der Redaktion stehen in [DATENLIZENZ.md](DATENLIZENZ.md). Jede Antwort des Servers enthält Quelle, Lizenz und Datenstand.

Der Code steht unter der MIT-Lizenz. Dies ist kein Angebot des BMWE. Verbindlich sind allein die Originalseiten und Förderrichtlinien; der Server ersetzt keine Förderberatung.

## Entwicklung

```bash
npm install
npm run import   # Export laden und daten/ neu schreiben
npm test         # Tests, auch Ende-zu-Ende über HTTP
npm run lokal    # HTTP-Server auf http://localhost:8787/mcp
```

Der Import prüft, ob sich der Inhalt geändert hat, und schreibt nur dann neu. Auf GitHub läuft er täglich als Action.

## Von

[New Life Digital](https://www.newlifedigital.de), Mannheim. Wir bauen KI-Lösungen für den Mittelstand und helfen auch dabei, geförderte Vorhaben umzusetzen.
