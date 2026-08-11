# Scacchi Esteso

[![CI](https://img.shields.io/github/actions/workflow/status/VibeCodders/ScacchiEsteso/ci.yml?branch=main&label=CI)](https://github.com/VibeCodders/ScacchiEsteso/actions/workflows/ci.yml)

Regole del gioco e della composizione degli eserciti. L'app (composizione team, schieramento, partita) è in [`team-composer/`](team-composer/).

## 1. Costi e limitazioni dell'esercito

- **Budget punti disponibili:** 154, come tetto massimo — è consentito spendere meno del budget
  disponibile: schierare un esercito più leggero è una scelta legittima, non un errore.
- **Pezzi per tipo:** massimo 5 pezzi identici.
- **Pedoni:** massimo 8.
- **Re:** obbligatoriamente 1 (costo gratuito, incluso nel conteggio dei pezzi ma non nel budget).
- **Totale pezzi:** massimo 16.

## 2. Schieramento

1. La zona di schieramento è limitata alle prime **2 traverse** del proprio lato della scacchiera.
2. Per decidere l'ordine si effettua una **tirata di moneta**: il vincitore schiera per primo.
3. I giocatori si alternano posizionando **un pezzo alla volta** fino a esaurimento dell'armata.
4. Lo schieramento non è segreto: le posizioni sono visibili a entrambi i giocatori.

## 3. Controllo del Re e vittoria

### 3.1 Scacco
- Il Re non può rimanere sotto attacco.
- Se il Re è sotto scacco, il giocatore deve uscirne tramite:
  - spostamento del Re,
  - cattura della fonte di attacco,
  - interposizione di un pezzo tra il Re e la fonte di attacco.

### 3.2 Mossa illegale
- È proibita qualsiasi mossa che esponga o lasci il proprio Re sotto scacco, sotto danno ambientale o sotto spostamento forzato verso una minaccia.
- È proibito usare abilità o pezzi per spingere il Re avversario in una condizione di scacco o verso un danno ambientale.

### 3.3 Eliminazione del Re
- Il Re può essere catturato solo tramite **cattura in mischia** (spostamento su casella adiacente).
- È immune a:
  - attacchi a distanza (es. Scoccare dell'Arciere),
  - danni collaterali (es. Colosso).

### 3.4 Vittoria
- Si vince catturando il Re avversario.
- Si vince per surclassamento dopo la risoluzione delle dinamiche anti-stallo.

## 4. Azioni nel turno

1. **Regola dell'azione unica:** ogni turno si può compiere una sola azione:
   - muovere un pezzo (con o senza cattura),
   - attivare l'abilità speciale di un pezzo.
2. **Berserker:** dopo una cattura in mischia riuscita, ottiene un secondo movimento extra immediato, senza possibilità di cattura durante quel movimento aggiuntivo.

## 5. Promozione dei Pedoni

1. Quando un Pedone raggiunge l'ultima traversa avversaria, la promozione avviene immediatamente.
2. Il Pedone può trasformarsi in:
   - un pezzo alleato precedentemente eliminato (recuperato dal "cimitero"), oppure
   - un pezzo base con costo non superiore a 20 punti (Pedone, Alfiere, Cavallo o Spettro).
3. Se nessuna opzione valida è disponibile, il Pedone rimane tale.

## 6. En Passant

1. È consentito solo tra Pedoni.

## 7. Linea di tiro e interposizione

1. **Interposizione:** gli attacchi a distanza e le abilità lineari non possono superare caselle occupate da altri pezzi, a meno che l'attaccante non possa ignorare le interposizioni (es. Spettro).
2. **Innesco amico:** è vietato colpire o catturare deliberatamente un pezzo alleato per innescare effetti ad area. L'innesco deve avvenire esclusivamente tramite la cattura di un nemico.
3. **Priorità del Silenzio:** l'aura dell'Inquisitore prevale sull'Egida del Paladino. Un pezzo nemico nell'aura perde tutte le abilità speciali e non può effettuare attacchi a distanza.

## 8. Dinamiche anti-stallo

1. **Limite:** se per **20 turni consecutivi** non avvengono catture e nessun Pedone viene mosso, la partita si chiude.
2. **Vincitore:** vince il giocatore con il maggior punteggio dei pezzi ancora presenti sulla scacchiera.
3. **Pareggio:** se i punteggi sono uguali, la partita è patta.

## 9. Miraggio (sdoppiamento e riunione)

1. **Movimento:** il Miraggio si muove come il Re (una casella in qualsiasi direzione, cattura in mischia).
2. **Sdoppiamento:** in alternativa al movimento, il Miraggio può materializzare un clone illusorio su una casella vuota adiacente, senza spostarsi. Il giocatore sceglie quale dei due pezzi è quello **vero** (quello originale o il clone). I due pezzi sono indistinguibili sulla scacchiera.
3. **Riunione:** finché il clone è vivo, in alternativa al movimento il Miraggio può ricostituire vero e clone in un **unico pezzo**, scegliendo la casella in cui ricompare (quella del vero o quella del clone); l'altra metà si dissolve. La riunione non è possibile se lascerebbe il proprio Re sotto scacco (il clone potrebbe star bloccando una linea).
4. **Limite:** massimo **1 Miraggio per composizione** (in gioco diventano 2 contando il clone). Un clone non può mai sdoppiarsi a sua volta e il Miraggio vero non può sdoppiarsi finché il suo clone è in gioco.
5. **Cattura del vero:** solo la cattura del Miraggio **vero** lo elimina definitivamente; il clone si dissolve insieme a esso. Né il clone catturato né il clone dissolto assegnano punti: l'avversario deve uccidere quello vero, altrimenti la cattura è sprecata.
