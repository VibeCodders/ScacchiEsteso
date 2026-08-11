# Scacchi Esteso

[![CI](https://img.shields.io/github/actions/workflow/status/VibeCodders/ScacchiEsteso/ci.yml?branch=main&label=CI)](https://github.com/VibeCodders/ScacchiEsteso/actions/workflows/ci.yml)

Regole del gioco e della composizione degli eserciti. L'app (composizione team, schieramento, partita) è in [`team-composer/`](team-composer/).

## 1. Costi e limitazioni dell'esercito

- **Budget punti disponibili:** 230, come tetto massimo — è consentito spendere meno del budget
  disponibile: schierare un esercito più leggero è una scelta legittima, non un errore.
- **Pezzi per tipo:** massimo 5 pezzi identici.
- **Limite dinamico per tipo (regola aggiuntiva):** in aggiunta al tetto di 5, ogni tipo ammette
  al massimo `x = round((d / punti)²)` copie, dove `d` è il punteggio del pezzo più costoso del
  roster (oggi il Paladino, 51 punti) e `punti` è il costo del pezzo in questione. Il limite è
  dinamico: se entrasse nel roster un pezzo più costoso del Paladino, `d` salirebbe e tutti i
  limiti si restringerebbero. Le due regole coesistono — vale sempre il limite più restrittivo:
  la formula abbassa il tetto solo sui pezzi più cari (es. 1 Paladino, 1 Drago, 2 Regine,
  2 Berserker, 2 Colossi, 3 Grifoni, 4 Torri), mentre per tutti gli altri resta in vigore il
  tetto esistente (5, o il limite specifico del pezzo, es. 1 Miraggio).
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

## 10. Grifone, Manticora e Drago

Pezzi a movimento "a ginocchio" (prima tratta obbligatoria di 1 casella, poi scivolata illimitata verso l'esterno) e un composto. In entrambi i pezzi a ginocchio la prima tratta **deve essere vuota**: non è mai una casella di cattura e non può essere saltata.

### 10.1 Grifone (GR — 32 punti)

1. **Prima tratta:** una casella in **diagonale** (obbligatoriamente vuota).
2. **Seconda tratta:** scivolata illimitata in **orizzontale o verticale verso l'esterno** (nella direzione del passo diagonale): dopo un passo NE prosegue verso nord oppure verso est.
3. **Cattura:** solo sulla seconda tratta, in mischia, sulla casella di arrivo.

### 10.2 Manticora (MA — 26 punti)

Specchio del Grifone:

1. **Prima tratta:** una casella in **orizzontale o verticale** (obbligatoriamente vuota).
2. **Seconda tratta:** scivolata illimitata in **diagonale verso l'esterno**: dopo un passo verso est prosegue verso nord-est oppure sud-est; dopo un passo verso nord prosegue verso nord-est oppure nord-ovest.
3. **Cattura:** solo sulla seconda tratta, in mischia, sulla casella di arrivo.

### 10.3 Drago (DR — 45 punti)

1. **Movimento:** si muove come la **Torre** (scivolata illimitata in orizzontale o verticale, cattura in mischia) oppure come il **Cavallo** (salto a "L", ignorando le interposizioni).
2. **Cattura:** in mischia sulla scivolata, sulla casella di arrivo del salto.

## 11. Riferimento completo dei pezzi

Roster completo: **38 pezzi**. Per ciascuno: sigla, nome, costo in punti, tetto massimo di copie
per tipo e regole di movimento/abilità. I costi sono quelli validati dall'estimatore interno del
progetto; i limiti di composizione si applicano come descritto nel §1 (budget 230, tetto di 5 e
formula dinamica `x = round((d/punti)²)` con `d` = punteggio del pezzo più costoso, oggi il
Paladino con 51). Le sezioni §9 e §10 approfondiscono Miraggio e pezzi a ginocchio.

### 11.1 Tavola riassuntiva

| Sigla | Nome | Costo (pt) | Copie max | Movimento / abilità |
|---|---|---|---|---|
| PA | Paladino | 51 | 1 | Cavallo o passo Re · Egida |
| DR | Drago | 45 | 1 | Torre + Cavallo (→ §10.3) |
| CN | Coniglio | 41 | 2 | Re · catena di salti con cattura finale |
| BE | Berserker | 39 | 2 | ≤2 caselle · Furia bellica |
| MI | Mistico | 37 | 2 | 1–2 caselle · Scambio di posizione |
| RA | Regina | 37 | 2 | illimitato in ogni direzione |
| CO | Colosso | 36 | 2 | ≤2 caselle · Danno ad area |
| TI | Tigre | 36 | 2 | Torre + passo Re |
| IQ | Inquisitore | 35 | 2 | ≤3 ortogonale · Silenzio |
| AR | Arciere | 34 | 2 | 1–2 caselle · Scoccare |
| GE | Generale | 34 | 2 | Cavallo + passo Re |
| GL | Golem | 34 | 2 | 1–2 caselle · Armatura naturale |
| GR | Grifone | 32 | 3 | a ginocchio (→ §10.1) |
| CM | Camaleonte | 31 | 3 | Alfiere 4 (chiare) / Torre 3 (scure) / passo Re |
| RN | Rinoceronte | 30 | 3 | Alfiere + passo Re |
| RB | Rimbalzatore | 29 | 3 | Alfiere con rimbalzo unico |
| NE | Necromante | 28 | 3 | ≤3 diagonale · Rianimazione |
| ST | Stunner | 28 | 3 | passo Re · Congelamento |
| SW | Swapper | 28 | 3 | passo Re · Scambio di due alleati |
| MG | Miraggio | 27 | 1 | passo Re · Sdoppiamento/Riunione (→ §9) |
| TO | Torre | 27 | 4 | illimitato ortogonale |
| MA | Manticora | 26 | 4 | a ginocchio (→ §10.2) |
| OR | Orfano | 26 | 4 | Copia poteri |
| DM | Damone | 25 | 4 | diagonale 1 · cattura a salto (solo via promozione) |
| VZ | Vortice | 24 | 5 | passo Re · Attira |
| TT | Teletrasporto | 22 | 5 | passo Re · Teletrasporto |
| BO | Bomba | 21 | 6 | passo Re · Esplode se catturata |
| CV | Cavalletta | 20 | 5 | salto sopra un pezzo (Grasshopper) |
| AL | Alfiere | 19 | 5 | illimitato diagonale |
| CA | Cavallo | 15 | 5 | salto a "L" |
| RE | Re | 15 (gratis) | 1 (obbligatorio) | passo Re |
| SP | Spettro | 15 | 5 | ≤2 diagonale, ignora le interposizioni |
| CR | Corriere | 14 | 5 | ≤2 ortogonale |
| RI | Ricognitore | 12 | 5 | ≤2 diagonale |
| CT | Catapulta | 11 | 5 | 1–2 orizzontale, ignora le interposizioni |
| DA | Pedone di Dama | 11 | 5 | pedina di Dama · promuove a Damone |
| RP | Repulsore | 10 | 5 | passo Re · Respingere |
| PE | Pedone | 7 | 5 | avanti 1 (2 alla prima) · cattura diagonale · promozione (→ §5) |
| DU | Duca | 6 | 5 | diagonale 1 |
| PG | Paggio | 5 | 5 | avanti 1 (solo nord), non cattura |
| FG | Fante | 1 | 5 | avanti 1 (solo nord), cattura in avanti |

### 11.2 Re e Pedoni

- **RE — Re (15 pt, gratis nel budget, obbligatorio 1):** muove di una casella in qualsiasi
  direzione, cattura in mischia (§3). Catturabile solo in mischia; immune a Scoccare e danno ad
  area (§3.3). I suoi 15 punti contano nel punteggio materiale dell'anti-stallo (§8).
- **FG — Fante (1 pt):** avanti di una casella (solo nord); cattura in avanti.
- **PG — Paggio (5 pt):** avanti di una casella (solo nord); non cattura.
- **PE — Pedone (7 pt):** avanti di una casella (due alla prima mossa); cattura diagonalmente;
  promozione (§5) ed en passant (§6).
- **DA — Pedone di Dama (11 pt):** come una pedina di Dama: avanza di una casella e cattura
  saltando in diagonale (catena di salti); promuove a **Damone** all'ultima traversa.
- **DM — Damone (25 pt):** ottenibile solo per promozione del Pedone di Dama. Muove di una casella
  in diagonale (senza cattura) e cattura saltando un nemico adiacente in diagonale sulla casella
  libera successiva (catena di salti).

### 11.3 Pezzi classici e semplici

- **AL — Alfiere (19 pt):** diagonale illimitata.
- **CA — Cavallo (15 pt):** salto a "L", ignora le interposizioni.
- **TO — Torre (27 pt):** orizzontale/verticale illimitata.
- **RA — Regina (37 pt):** qualsiasi direzione, illimitata.
- **CR — Corriere (14 pt):** orizzontale/verticale fino a 2 caselle.
- **RI — Ricognitore (12 pt):** diagonale fino a 2 caselle.
- **SP — Spettro (15 pt):** diagonale fino a 2 caselle, ignora le interposizioni; cattura
  sulla casella di arrivo.
- **CT — Catapulta (11 pt):** orizzontale di 1–2 caselle, ignora le interposizioni; cattura
  sulla casella di arrivo.
- **CV — Cavalletta (20 pt):** come la Regina, ma deve saltare esattamente un pezzo (l'ostacolo,
  amico o nemico, non viene catturato) e atterrare sulla casella immediatamente oltre; cattura
  atterrando su un nemico (Grasshopper).
- **DU — Duca (6 pt):** una casella in diagonale, cattura in mischia.

### 11.4 Pezzi con abilità speciali

- **BE — Berserker (39 pt):** fino a 2 caselle in qualsiasi direzione. **Furia bellica:** dopo una
  cattura in mischia ottiene un secondo movimento extra immediato, senza possibilità di cattura (§4.2).
- **NE — Necromante (28 pt):** fino a 3 caselle in diagonale. **Rianimazione:** in alternativa al
  movimento, rianima un Pedone alleato eliminato su una casella vuota adiacente.
- **IQ — Inquisitore (35 pt):** fino a 3 caselle in orizzontale/verticale. **Silenzio:** i pezzi
  nemici nelle 8 caselle adiacenti perdono gli attacchi a distanza; prevale sull'Egida del
  Paladino (§7.3).
- **GL — Golem (34 pt):** 1–2 caselle in qualsiasi direzione. **Armatura naturale:** non può essere
  catturato da pezzi con costo pari o inferiore a 14 punti.
- **MI — Mistico (37 pt):** 1–2 caselle in qualsiasi direzione. **Scambio di posizione:** in
  alternativa al movimento, scambia istantaneamente la posizione con un alleato in linea di vista
  libera (stessa riga, colonna o diagonale, senza pezzi frapposti), escluso il Re.
- **AR — Arciere (34 pt):** 1–2 caselle in qualsiasi direzione. **Scoccare:** in alternativa al
  movimento, elimina un nemico a esattamente 3–4 caselle in linea retta con traiettoria libera,
  senza spostarsi.
- **PA — Paladino (51 pt):** Cavallo oppure 1 casella in qualsiasi direzione. **Egida:** gli
  alleati nelle 8 caselle adiacenti sono protetti dagli attacchi a distanza (restano catturabili
  solo in mischia).
- **CO — Colosso (36 pt):** fino a 2 caselle in qualsiasi direzione. **Danno ad area:** dopo una
  cattura in mischia distrugge tutti i pezzi (alleati e nemici) ortogonalmente adiacenti alla
  propria casella di arrivo (§7.2: l'innesco avviene solo catturando un nemico).
- **OR — Orfano (26 pt):** **Copia poteri:** ha, per quel turno, i poteri del pezzo che lo tiene in
  scacco; se nessuno lo tiene in scacco muove di 1 casella in qualsiasi direzione.
- **SW — Swapper (28 pt):** muove come il Re. **Scambio di due alleati:** in alternativa al
  movimento, scambia le posizioni di due alleati (se stesso incluso) che si trovano nelle 8 caselle
  adiacenti allo Swapper.
- **ST — Stunner (28 pt):** muove come il Re. **Congelamento:** ogni pezzo nemico adiacente (mai il
  Re avversario) è completamente congelato: nessuna mossa né azione, tranne l'unica mossa che
  catturerebbe lo Stunner.
- **MG — Miraggio (27 pt):** muove come il Re; **Sdoppiamento** e **Riunione** (§9). Massimo 1 per
  composizione.
- **RP — Repulsore (10 pt):** muove come il Re, cattura in mischia. **Respingere:** in alternativa
  al movimento, spinge un nemico adiacente (mai il Re) di una casella direttamente lontano da sé,
  purché la casella di arrivo sia vuota, senza catturarlo.
- **TT — Teletrasporto (22 pt):** muove come il Re, cattura in mischia. **Teletrasporto:** in
  alternativa al movimento, si sposta su una casella vuota a esattamente 3 caselle in linea retta,
  saltando sopra qualsiasi pezzo, senza catturare nulla all'arrivo.
- **VZ — Vortice (24 pt):** muove come il Re, cattura in mischia. **Attira:** in alternativa al
  movimento, trascina un nemico a esattamente 2 caselle in linea retta (mai il Re) sulla casella
  vuota in mezzo, avvicinandolo di 1 casella senza catturarlo.
- **BO — Bomba (21 pt):** muove come il Re, cattura in mischia. **Esplosione:** quando viene
  catturata (con qualsiasi cattura: mischia, salto, distanza o catena), esplode e distrugge anche
  il pezzo che l'ha catturata — il Re è sempre immune e l'esplosione non scatta mai se lascerebbe
  sotto scacco il Re di chi cattura.

### 11.5 Pezzi ibridi e movimenti speciali

- **GE — Generale (34 pt):** Cavallo oppure 1 casella in qualsiasi direzione.
- **TI — Tigre (36 pt):** Torre oppure 1 casella in qualsiasi direzione.
- **RN — Rinoceronte (30 pt):** Alfiere oppure 1 casella in qualsiasi direzione.
- **CM — Camaleonte (31 pt):** Alfiere fino a 4 caselle sulle caselle chiare e Torre fino a 3
  caselle sulle caselle scure; può anche muovere di 1 casella in qualsiasi direzione.
- **GR — Grifone (32 pt):** mossa a ginocchio (§10.1).
- **MA — Manticora (26 pt):** mossa a ginocchio (§10.2).
- **DR — Drago (45 pt):** Torre + Cavallo (§10.3).
- **CN — Coniglio (41 pt):** se non ha salti disponibili si muove come il Re (1 casella, cattura in
  mischia); se ha un nemico adiacente con la casella successiva libera può saltarlo e continuare a
  saltare (catena); quando si ferma cattura solo l'ultimo nemico saltato, gli altri restano in gioco.
- **RB — Rimbalzatore (29 pt):** si muove in diagonale come un Alfiere ma può rimbalzare una sola
  volta: contro il bordo riflette l'asse superato (in un angolo entrambi); contro un pezzo (mai
  catturato dal rimbalzo) prosegue in una delle due direzioni di riflessione possibili, a scelta
  del giocatore; dopo il rimbalzo prosegue come una normale scivolata.
