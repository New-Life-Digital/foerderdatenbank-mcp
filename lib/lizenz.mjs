// Namensnennung nach CC BY 4.0. Die Redaktion der Förderdatenbank hat am
// 02.11.2026 bestätigt: Der Datenbestand des XML-Exports darf auch kommerziell
// genutzt, bearbeitet und weiterverbreitet werden, wenn die Lizenzbedingungen,
// insbesondere die Namensnennung, eingehalten werden. Die Webseite selbst ist
// nicht Gegenstand der Lizenz, deshalb arbeitet dieses Projekt nur mit dem Export.

export const QUELLE = {
  quelle: 'Förderdatenbank des Bundes',
  herausgeber: 'Bundesministerium für Wirtschaft und Energie (BMWE)',
  quelleUrl: 'https://www.foerderdatenbank.de',
  lizenz: 'CC BY 4.0',
  lizenzUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
  aenderungen: 'Texte aus dem XML-Export in Klartext umgewandelt, nach Abschnitten gegliedert und in Suchergebnissen gekürzt. Inhalte sonst unverändert.',
}

export function datumDeutsch(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

// Kurzer Hinweis unter jeder Antwort
export function quellenhinweis(datenstand) {
  const stand = datumDeutsch(datenstand)
  return [
    `Quelle: ${QUELLE.quelle}, ${QUELLE.herausgeber}, ${QUELLE.quelleUrl}`,
    `Lizenz: ${QUELLE.lizenz} (${QUELLE.lizenzUrl})`,
    `Änderungen: ${QUELLE.aenderungen}`,
    stand ? `Datenstand: ${stand}` : '',
    'Verbindlich sind allein die verlinkten Originalseiten und die Förderrichtlinien. Keine Rechts- oder Förderberatung.',
  ]
    .filter(Boolean)
    .join('\n')
}
