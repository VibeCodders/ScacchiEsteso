/** Human-readable name for every alternative-action type in pieces.json (sdoppiamento/riunione
 *  included), shared by the piece encyclopedia's "Azioni speciali" section and the team-composition
 *  cards' badges so both surfaces always agree. Unknown types fall back to the raw key at the
 *  call site. */
export const ACTION_LABELS: Record<string, string> = {
  furia_bellica: 'Furia bellica',
  fulmine: 'Fulmine',
  rianimazione_pedone: 'Rianimazione',
  silenzio_aura: 'Silenzio',
  scambio_posizione: 'Scambio di posizione',
  scocca: 'Scoccare',
  egida: 'Egida',
  danno_ad_area: 'Danno ad area',
  copia_poteri: 'Copia poteri',
  congelamento: 'Congelamento',
  respingi: 'Respingere',
  teletrasporto: 'Teletrasporto',
  attira: 'Attira',
  esplosione: 'Esplosione',
  scambio_due_alleati: 'Scambio di due alleati',
  sostituzione: 'Sostituzione',
  sguardo_pietrificante: 'Sguardo pietrificante',
  sdoppiamento: 'Sdoppiamento',
  riunione: 'Riunione',
};
