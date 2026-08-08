# Enrich pieces.json with Structured Numeric Fields & JSON Schema

## Goal
Migrate `team-composer/src/data/pieces.json` from ad-hoc boolean flags to a fully structured, numeric, schema-validated data model covering movement mechanics, special abilities, immunities, promotions, and conditional actions. Add a matching `pieces.schema.json` and update all TypeScript consumers.

## Scope
- Files: `pieces.json`, `pieces.schema.json` (new), `types.ts`, `pieces.ts`, `App.tsx`
- All 20 pieces must be migrated.
- Backward-compatible boolean flags remain in JSON until UI is migrated; deprecated in TS.

## Key Decisions
- `maxSteps: 0` = leap/jump; `maxSteps: 99` = unlimited (preserve existing convention).
- 8×8 board: `promotionRank: 8` (UI applies color-specific orientation).
- Pawn promotion defaults: `["RA", "TO", "AL", "CA"]`.
- Golem immunity code: `immunityTypes: ["costo<=14"]` with explicit `armaturaMaxCosto: 14`.
- `alternativeActions` uses `modalita`: `alternativa`, `aggiuntiva`, `passiva`, `sul_cattura`.
- Old boolean flags retained in JSON as deprecated fields; removed from TS interface once UI migrates.

## New Piece Fields
| Field | Type | Required |
|---|---|---|
| `punti` | number | yes |
| `costoMinimo` | number | no |
| `costoMassimo` | number | no |
| `classico` | boolean | yes |
| `movimentoTipo` | `"step" \| "slide" \| "leap" \| "speciale"` | no |
| `promotable` | boolean | yes |
| `promotionTypes` | string[] | yes |
| `promotionRank` | number | yes |
| `resistance` | number | yes |
| `immunityTypes` | string[] | yes |
| `alternativeActions` | `AlternativeAction[]` | yes |

## New Move Fields
| Field | Type | Required |
|---|---|---|
| `directions` | `Direction[]` | yes |
| `minSteps` | number | yes |
| `maxSteps` | number | yes |
| `capture` | boolean | yes |
| `captureMode` | `"melee" \| "leap" \| "ranged" \| "none" \| "area"` | yes |
| `movementType` | `"step" \| "slide" \| "leap" \| "speciale"` | yes |
| `jump` | boolean | no |
| `colorRestriction` | `"chiare" \| "scure" \| "nessuna" \| "forward" \| "backward"` | no |
| `leapPattern` | `"L" \| "grasshopper" \| "custom"` | no |
| `jumpOver` | boolean | no |
| `jumpOverCount` | number | no |
| `landBeyond` | boolean | no |
| `multiJump` | boolean | no |
| `primaMossaDoppia` | boolean | no |
| `note` | string | no |

## AlternativeAction Shape
```json
{ "type": "string", "modalita": "alternativa|aggiuntiva|passiva|sul_cattura", "params": { "target": "...", "raggio": 1, "distanze": [3,4], "effetto": "...", "condizioni": ["..."], "esclusi": ["re"], "senzaCattura": true, "includeAlleati": true, "senzaSpostamento": true, "direzioni": [...], "traiettoriaLibera": true } }
```

## Piece-by-Piece Migration Notes
- RE: step 1/1 all-dir melee.
- PG: step 1/1 vertical no-capture.
- FG: step 1/1 forward move + melee capture.
- PE: step 1/2 forward (double first), step 1/1 forward, step 1/1 diagonal capture. promotable=true, promotionTypes=["RA","TO","AL","CA"].
- CR: step 1/2 orthogonal melee.
- RI: step 1/2 diagonal melee.
- AL: slide 1/99 diagonal melee.
- CA: leap 0/0 L-pattern all-dir melee, jump=true, leapPattern="L".
- TO: slide 1/99 orthogonal melee.
- SP: leap 1/2 diagonal melee, jump=true.
- CT: leap 1/2 horizontal melee, jump=true.
- CM: slide 1/4 diagonal chiare + slide 1/3 orthogonal scure + step 1/1 any nessuna.
- BE: step 1/2 all-dir melee + alternativeAction furia_bellica (sul_cattura, senzaCattura=true).
- NE: slide 1/3 diagonal melee + alternativeAction rianimazione_pedone (alternativa, raggio=1).
- IQ: slide 1/3 orthogonal melee + alternativeAction silenzio_aura (passiva, raggio=1, direzioni=[n,s,e,w]).
- GL: step 1/2 all-dir melee, immunityTypes=["costo<=14"], armaturaMaxCosto=14.
- MI: step 1/2 all-dir melee + alternativeAction scambio_posizione (alternativa, target=alleato_adiacente, esclusi=["re"]).
- AR: step 1/2 all-dir melee + alternativeAction scocca (alternativa, distanze=[3,4], direzioni=all, traiettoriaLibera=true, senzaSpostamento=true).
- PA: step 1/1 all-dir melee + leap L-pattern melee + alternativeAction egida (passiva, raggio=1, target=alleati_adiacenti).
- CO: step 1/2 all-dir melee + alternativeAction danno_ad_area (sul_cattura, raggio=1, target=caselle_ortogonali_adiacenti, includeAlleati=true).
- RA: slide 1/99 all-dir melee.
- DA: step forward 1/1 no-capture + leap diagonal capture with multiJump, promotable=true, promotionTypes=["RA"].
- CV: leap grasshopper pattern all-dir, jump=true, jumpOver=true, jumpOverCount=1, landBeyond=true, leapPattern="grasshopper".
- OR: step 1/1 fallback + alternativeAction copia_poteri (passiva, condizioni=["in_scacco"], fallback="muovi_1_cella").

## JSON Schema
Create `team-composer/src/data/pieces.schema.json` enforcing required fields, enums, and nested structures described above.

## TypeScript Updates
1. **types.ts**: Define `Direction`, `MovementType`, `CaptureMode`, `ColorRestriction`, `LeapPattern`, `ActionModalita` types. Replace `Move`, `Piece`, and add `AlternativeAction`. Retain deprecated boolean flags in `Piece` until UI migration.
2. **pieces.ts**: Ensure `import piecesRaw from './pieces.json'` cast to `Piece[]` still compiles.
3. **App.tsx**: Update `flagLabels` to include any new deprecated booleans; new fields are consumed by engine later.

## Validation
- `npm run build` must pass after changes.
- `npm run lint` must pass.
- No runtime behavior change expected in team composer (fields are additive or deprecated).

## Rollout
1. Write `pieces.schema.json`.
2. Update `types.ts`.
3. Migrate `pieces.json` entries in a single replace.
4. Run `npm run build` and `npm run lint`.
5. If pass, done. If fail, fix types or schema.
