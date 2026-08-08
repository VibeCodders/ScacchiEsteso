# Piano: Campi strutturati per pezzi in `pieces.json`

## Obiettivo
Arricchire `pieces.json` con campi strutturati (numerici e booleani) che descrivono movimenti e regole speciali, per alimentare la UI del team composer. Mantenere `regole` come stringa libera per backward compatibility e casi non codificabili.

## Decisioni confermate
- Solo UI: nessun motore di gioco/validazione mosse.
- Movimento: array di oggetti `Move` con `directions[]`, `maxSteps`, `capture`, `jump?`, `primaMossaDoppia?`, `note?`.
- Regole speciali: flag booleani specifici + `noteCondizionali` per casi eccezionali.
- Aggiornare `Piece` in `types.ts` coerentemente.

## Interfacce TypeScript
Aggiungere in `types.ts`:

```typescript
export type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface Move {
  directions: Direction[];
  maxSteps: number;
  capture: boolean;
  jump?: boolean;
  primaMossaDoppia?: boolean;
  note?: string;
}

export interface Piece {
  sigla: string;
  descrizione: string;
  punti: number;
  classico: boolean;
  regole: string;
  moves: Move[];
  saltaInterposizioni?: boolean;
  catturaSoloInMischia?: boolean;
  catturaADistanza?: boolean;
  secondoMovimentoPostCattura?: boolean;
  dannoAdArea?: boolean;
  rianimaPedoni?: boolean;
  silenzioAttacchiADistanza?: boolean;
  armatura?: boolean;
  scambiaPosizioneConAlleato?: boolean;
  scocca?: boolean;
  egida?: boolean;
  noteCondizionali?: string;
}
```

## Aggiornamento `pieces.json`
Aggiungere a ogni pezzo `moves` e i flag pertinenti. Strategia:

- **Movimenti standard**: usare `directions[]` + `maxSteps` + `capture`.
- **Salti speciali** (Cavallo, Spettro, Catapulta): `maxSteps: 0`, `jump: true`, `note` con descrizione pattern.
- **Casi non rappresentabili** (Camaleonte, Orfano, Pedone di Dama): popolare `moves` con un insieme approssimativo + `noteCondizionali`.
- **Regole speciali**: mappare ogni effetto speciale al flag booleano corrispondente.

### Mapping consigliato per pezzi non banali
- **PG**: `directions: [n,s]`, `maxSteps: 1`, `capture: false`
- **FG**: `directions: [n]`, `maxSteps: 1`, `capture: false` + note per cattura avanti
- **PE**: tre Move: avanti 2 (prima mossa), avanti 1, diagonali 1 (cattura). `primaMossaDoppia: true` sul primo.
- **CA** (Cavallo): `directions: [n,s,e,w,ne,nw,se,sw]`, `maxSteps: 0`, `jump: true`, `note: "Salto a L"`
- **SP**: `directions: [ne,nw,se,sw]`, `maxSteps: 2`, `capture: true`, `jump: true`
- **CA** (Catapulta): `directions: [e,w]`, `maxSteps: 2`, `capture: true`, `jump: true`
- **CM**: `moves` parziale + `noteCondizionali`
- **BE**: `directions: [n,s,e,w,ne,nw,se,sw]`, `maxSteps: 2`, `capture: true`, `secondoMovimentoPostCattura: true`
- **NE**: `directions: [ne,nw,se,sw]`, `maxSteps: 3`, `capture: true`, `rianimaPedoni: true`
- **IQ**: `directions: [n,s,e,w]`, `maxSteps: 3`, `capture: true`, `silenzioAttacchiADistanza: true`
- **MI**: `directions: [n,s,e,w,ne,nw,se,sw]`, `maxSteps: 2`, `capture: true`, `scambiaPosizioneConAlleato: true`
- **AR**: `directions: [n,s,e,w,ne,nw,se,sw]`, `maxSteps: 2`, `capture: true`, `scocca: true`
- **PA**: `moves` con due elementi: salto L e 1 qualsiasi, `egida: true`
- **CO**: `directions: [n,s,e,w,ne,nw,se,sw]`, `maxSteps: 2`, `capture: true`, `dannoAdArea: true`
- **DA**: `noteCondizionali: "Come pedina di Dama"` (o specificare se noto)
- **CV**: `noteCondizionali` con riferimento Wikipedia
- **OR**: `noteCondizionali`

## Modifiche UI (`App.tsx`)
Aggiungere rendering dei nuovi campi nella card del pezzo:
- Mostrare le direzioni come abbreviazioni compatte (es. `n,s,e,w` o `+` per tutte).
- Mostrare `maxSteps` e `capture`.
- Mostrare icone/etichette per i flag booleani attivi.
- Mostrare `noteCondizionali` se presente.

Non modificare logica di validazione, ottimizzazione o gestione team: esse usano solo `sigla`, `punti`, `classico`, che rimangono invariati.

## Validazione
- `types.ts`: compila senza errori.
- `App.tsx`: compila e mostra i nuovi campi senza rompere il layout.
- Verificare che tutti i 21 pezzi abbiano `moves` popolato e che il JSON rimanga valido.

## Rischi
- Movimenti complessi (Camaleonte, Orfano) rimangono solo testuali: è accettabile per scope UI-only.
- Il flag `jump` con `maxSteps: 0` è una convenzione interna da documentare nel codice UI.
