# NFT Lending Agent – Code Review

Summary of review and improvements applied.

---

## Improvements applied

1. **Dependencies**
   - **`zod`** is used by all four tools but was not listed in `package.json`; it is now added as an explicit dependency.

2. **Workflow (`src/graph/workflow.ts`)**
   - Replaced duplicated state-channel reducers with a shared **`optionalStringReducer`** helper.
   - Initialized **`result`** in the tool loop so every path has a defined value before `ToolMessage` is created.
   - Replaced **`error: any`** and **`e: any`** with **`error: unknown`** and proper checks (`error instanceof Error`) in catch blocks.

3. **Entrypoint (`src/index.ts`)**
   - Catch block now uses **`error: unknown`** and safely derives a message for logging.

---

## Recommendations (not yet changed)

### 1. TypeScript strict mode

- **Current:** `tsconfig.json` has `"strict": false`.
- **Suggestion:** Enable `"strict": true` (or at least `strictNullChecks` and `noImplicitAny`) to catch more bugs at compile time. Do this gradually and fix reported issues file by file.

### 2. Unify floor price / pricing data

- **Current:**  
  - **`src/tools/nft-data.ts`** uses Moralis + a local **`COLLECTION_FLOORS`** map (hardcoded ETH floors).  
  - **`src/services/relayService.ts`** uses Relay API for floor + TWAP.  
  - **`src/utils/constants.ts`** has **`COLLECTION_TIERS`** (bluechip/established addresses) but no floor data.
- **Issue:** The LangGraph workflow uses only `nft-data.ts` (Moralis + static floors), while `RiskAgent` / `LendingAgent` use Relay. Floor and TWAP can differ by source.
- **Suggestion:** Prefer a single source for prices (e.g. Relay for floor/TWAP) and inject it into the tools or a shared service so the agent and risk/lending logic use the same numbers. Keep Moralis for metadata/traits if needed.

### 3. Constants alignment

- **Pudgy Penguins:** In `index.ts` and `nft-data.ts` the address is `0xbd3531da5cf5857e7cfaa92426877b022e612cf8`. In `constants.ts` → `COLLECTION_TIERS.ESTABLISHED` the listed address is `0x524cab2ec691245740bebc45cb7addb2fe7b177a`. Confirm which is correct and align `COLLECTION_TIERS` (and any other references) so bluechip/established logic matches the collections you care about.

### 4. Error handling in tools

- **Current:** Tools use `catch (error: any)` and `error.message`.
- **Suggestion:** Use `catch (error: unknown)` and `error instanceof Error ? error.message : String(error)` (or a small helper) in:
  - `src/tools/nft-data.ts`
  - `src/tools/rarity.ts`
  - `src/tools/ltv-calculator.ts`
  - `src/tools/report-generator.ts`

### 5. Logging

- **Current:** Many `console.error` calls for flow and debugging.
- **Suggestion:** Introduce a simple logger (e.g. with levels like `debug`/`info`/`warn`/`error`) and gate debug logs by env (e.g. `DEBUG=nft-lending-agent`). Keeps production logs cleaner and makes debugging configurable.

### 6. Workflow tool dispatch

- **Current:** One large `switch (toolCall.name)` in the tools node.
- **Suggestion:** Consider a **tool registry** (e.g. `Map<string, { invoke, enrichArgs? }>`) so adding or changing tools is a single registration and the loop stays small and stable.

### 7. Warning suppression in `index.ts`

- **Current:** All `warning` listeners are removed and only punycode deprecation is ignored.
- **Suggestion:** Keep the listener but only suppress the specific punycode case (as you do), and avoid removing other listeners so other deprecations and warnings are still visible.

### 8. Tests

- **Current:** `package.json` has `"test": "echo \"Error: no test specified\" && exit 1"`.
- **Suggestion:** Add unit tests for:
  - **`LendingAgent`**: `compareLoanTerms`, `simulateLiquidation`, `calculateOptimalLoan` (with mocked constants).
  - **`RiskAgent`**: `assessCollection` with mocked `RelayService`.
  - **Tools**: `ltvCalculatorTool`, `rarityAnalysisTool` with fixed inputs and snapshot or assertion on outputs.
  - **`relayService`**: getFloorPriceWithTWAP / getCollectionSummary with mocked axios and cache.

### 9. RelayService mock data

- **Current:** When `NODE_ENV === 'development'` and the API fails, mock data is returned. The mock in `getCollectionMetadata` always returns `name: 'BAYC (Mock)'` regardless of `collectionAddress`.
- **Suggestion:** Either document that dev mock is BAYC-only or key mocks by `collectionAddress` so different contracts get different mock metadata where useful.

### 10. Rarity tool scope

- **Current:** **`TRAIT_RARITY`** in `src/tools/rarity.ts` only has data for `"PudgyPenguins"`; other collections fall back to a default (e.g. 10% rarity).
- **Suggestion:** Extend trait rarity data for more collections, or integrate an external rarity API, so non-Pudgy collections get more accurate rarity and premium estimates.

---

## Summary

- **Done:** Added `zod`, shared state reducer and safer `result` handling in the workflow, and `unknown`-based error handling in `index.ts` and `workflow.ts`.
- **Next steps:** Consider enabling strict TypeScript, unifying pricing (e.g. Relay), aligning constants (e.g. Pudgy address), tightening error handling in tools, adding a logger and tests, and expanding rarity data or API usage.
