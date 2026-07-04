# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Read this before making changes.

## Repository & contributions
- **The canonical repo is [`canonn-science/canonn-signals`](https://github.com/canonn-science/canonn-signals).**
  All commits, branches and pull requests **must** target `canonn-science/canonn-signals` — **never** any
  fork or other remote. In particular, this clone also has an `upstream` remote pointing at
  `Elfener99/canonn-signals` (the original author's fork); **do not** push or open PRs against it, or any
  other repo. When in doubt, `git remote -v` and confirm you're targeting `origin` (`canonn-science`).
- **Branch + PR, don't push to `main`.** Cut a feature branch and open a PR against
  `canonn-science/canonn-signals`'s `main`. Push to `main` only when explicitly asked.
- **Deployment is automatic:** merging to `main` triggers `.github/workflows/main.yml`, which runs
  `pnpm test` + `pnpm run build` and deploys `dist/` to GitHub Pages at **signals.canonn.tech**. A red
  build blocks the deploy, so keep test + build green (see *Verifying changes*).

## What this is
**Canonn Signals** — an Angular single-page app that displays Elite Dangerous star-system
data (bodies, signals, biology/geology, orbital mechanics, region map). It fetches from
external community APIs (Canonn, Spansh, EDAstro/GEC, SIMBAD) and renders a recursive
body tree. No backend in this repo.

## Stack (as of Angular 22)
- **Angular 22**, **standalone components** (no `AppModule`): bootstrapped via
  `bootstrapApplication(AppComponent, appConfig)` in `main.ts`, providers in `app/app.config.ts`.
  Components declare their deps in `imports: [...]`.
- **Zoneless** change detection (`provideZonelessChangeDetection()`, no zone.js). ← see rules below.
- **Signal inputs** (`input()` / `input.required()`), not `@Input()`; `inject()` over constructor DI.
- **Build/serve: esbuild** — `@angular/build:application` + `@angular/build:dev-server` (Vite).
- **Tests: Vitest** — `@angular/build:unit-test`, runs in **Node + jsdom (no browser)**.
- Angular Material (M2 theming), FontAwesome, RxJS. RxJS teardown via `takeUntilDestroyed(inject(DestroyRef))`.

## Commands
- `npm start` → `prestart` (runs `generate-credits`, see below) then `ng serve` (binds `0.0.0.0`, port 4200; reachable from the dev-container host).
- `npm run build` → `prebuild` (runs `generate-credits`) then `ng build`. **Output goes to `dist/`** (the builder's `outputPath.browser` is `""`, so there's no `dist/browser/` subdir).
- `npm run generate-credits` → `scripts/generate-credits.js` parses the `# Credits` section of `readme.md` and writes `src/app/data/credits.generated.ts` (an HTML snippet imported by the Credits panel). Runs automatically before `start`/`build`.
- `npm run generate-nebulae` → `scripts/generate-nebulae.js` regenerates `src/assets/nebulae.json` (the catalogue behind the "Nearest Nebulae" panel). **Not** wired into `start`/`build` — run it by hand when the source data changes.
- `npm test` → `ng test` (Vitest). For CI/one-shot: `ng test --watch=false`. No browser/Chrome needed. **Do NOT pass `--browsers=…` (or any Karma-era browser flag)** — the Vitest builder rejects it (`The "browsers" option requires @vitest/browser-*`). Run `ng test --watch=false` plain; jsdom is the runtime.
- `npm run watch` → dev build in watch mode.
- `npm run e2e` → `playwright test` (Playwright). End-to-end/functional + responsive + cross-browser checks in `e2e/` (desktop/tablet/mobile × Chromium/Firefox). It boots the dev server itself; deterministic specs stub the APIs with saved payloads in `e2e/fixtures/` (helpers in `e2e/support/`). **Playwright is for functional/UI correctness only — we do NOT use it for stress/load/performance testing.** This sandbox's single dev server can deadlock under heavy parallelism; cap workers (`npx playwright test --workers=6`) if needed.

## Architecture
- `src/app/app.component.*` — shell (router outlet, background image via async pipe).
- `src/app/home/home.component.*` — search + system overview; **large** (~1150 lines), holds search/region-map/markers logic and the Nearest-Nebulae panel.
- `src/app/system-body/system-body.component.*` — recursive body renderer; still **large (~1430 lines)** but the heavy pure logic (orbital relations, physics, neutron-star classification, canvas charts, temperature lookup) has been extracted into `data/` services. Still the most complex component — **treat with care; prefer extracting more pure logic into a `data/` service over adding to it.**
- `src/app/region-map/region-map.component.*` — interactive SVG galaxy region map: highlights the current system's region and overlays system / known-system / DSSA / Gnosis markers.
- `src/app/dialogs/*` — the standalone dialog components (each in its own folder): `roche-limit`, `hill-limit`, `apo-peri`, `orbital-diagram`, `hr-diagram`, `white-dwarf-types`, `on-foot-safety`, `tidal-lock`, `invisible-ring`, `json` (raw-data viewer + copy), plus the shared `dialog-shell`. Open them via `MatDialog` — each opener `await import()`s its dialog so it ships as a lazy chunk, not in the initial bundle.
- `src/app/app.service.ts` — shared state (BehaviorSubjects) + HTTP; use its `resilientGet()` (timeout + retry) for new API calls.
- `src/app/data/*.ts` — pure data/lookup tables + pure functions (e.g. `temperature-estimation.ts` with `estimateTempRange`/`lookupTempDelta`, `body-images.ts`, `mining-resources.ts`, `materials.ts`, `body-types.ts`, `genus.ts`, `nebulae.ts`, `white-dwarf.ts`, `stellar-reference.ts`, `hr-diagram.ts`, `orbital-diagrams.ts`, `html-entities.ts`, `json-bigint.ts`) **and** the pure injectable services that back the body renderer:
  - `body-physics.service.ts` — densities, Roche limits, Hill spheres, ring-shepherding.
  - `stellar-physics.service.ts` — spin resonance, tangential velocity, jet-cone angle, neutron-star classification.
  - `orbital-relations.core.ts` / `orbital-relations.service.ts` — the orbital engine: Trojan/Lagrange (L1–L5) and rosette detection **and** collision prediction (3D orbit-proximity + contact-window search) from co-orbital siblings. The maths lives in the framework-free `OrbitalRelationsCore` (no `@angular/core`); `OrbitalRelationsService extends OrbitalRelationsCore {}` is only the `@Injectable` wrapper and re-exports the core's types (so `import { CollisionWindow, … } from './orbital-relations.service'` still resolves). The **heavy collision methods run off the main thread** — see *Heavy computation* below.
  - `orbital-worker.service.ts` + `collision.worker.ts` / `collision-worker-api.ts` / `collision-request.ts` — the Comlink web-worker offload for the heavy collision search. Light methods (Trojan/rosette/anomaly/Lagrange) stay synchronous on the main thread via `OrbitalRelationsService`.
  - `chart-rendering.service.ts` — Roche/Hill/jet canvas charts (takes a canvas + typed data; no DOM lookups of its own).

  - `data/pgnames/*.ts` — procedural-name (boxel) codec: `PGSystem`/`PGRegion`/`PGSectors` convert between id64 system addresses and PG names (`PGSystem.fromSystemAddress`, `isPGSystemName`). Pure logic with its own `pgnames.spec.ts`. (Moved here from `assets/`, which had been shipping the raw `.ts` as static files.)

  Put big literal maps and pure logic here, not in components. Each of these has a `*.spec.ts` — add cases there when you extract more logic.
- `*.spec.ts` — Vitest specs (globals via `tsconfig.spec.json` `types: ["vitest/globals"]`).

## Critical conventions (don't regress these)
1. **Zoneless CD**: there is no zone.js. Any mutation of **template-bound** state from an
   async context (HTTP `.subscribe`, Promise `.then`, `setTimeout`, rxjs subscription) **must**
   call `this.cdr.markForCheck()` afterward, or use the `async` pipe. Event handlers and signal
   writes trigger CD automatically; raw async callbacks do **not**. This is the #1 source of
   "the view didn't update" bugs here.
2. **Signal inputs**: read inputs as calls — `this.body()`, `this.isRoot()`, etc. (never `this.body`).
   In templates: `body().bodyData…`. `body` is `input.required<SystemBody>()`.
3. **Network resilience**: route new HTTP GETs through `AppService.resilientGet()`; handle errors
   (the constructor calls use `catchError` fallbacks). Don't add bare `.subscribe()` that silently fails.
4. **CSS tokens**: use the `var(--color-*)` palette defined in `src/styles.scss :root` (surfaces, text, badges, safety, callout boxes, etc.). Don't add raw hex — `system-body.component.scss` is fully tokenized; keep it that way. (Canvas charts in `chart-rendering.service.ts` hard-code colours because a 2D context can't read CSS vars — that's the one accepted exception.)
5. **Material theming** uses the **M2 API** (`mat.m2-define-dark-theme`, `mat.$m2-*-palette`) in `styles.scss`.
6. **Links**: external `target="_blank"` anchors need `rel="noopener noreferrer"`; `window.open(..., '_blank', 'noopener,noreferrer')`.
7. **Accessibility**: images need `alt`; icon-only controls need `aria-label` + keyboard handlers
   (the `clickable.directive.ts` adds `role="button"`/`tabindex`/Enter-Space to `.clickable` elements);
   `<canvas>` charts need `role="img"` + a descriptive `aria-label` since their content is invisible to AT.
8. **Physical accuracy**: physics and astronomical values must be *correct*. Use accepted constants
   (G, c, AU, solar/earth masses & radii, etc.) at full precision in the maths, and derive results
   honestly — don't fudge a formula to make a number look right. When **displaying** a value, round to a
   reasonable, physically meaningful number of significant digits for its scale (e.g. a few sig-figs for
   a radius or temperature; don't print 15 floating-point digits). Keep the *computation* precise and the
   *presentation* readable — never the reverse. When you touch any physics/astro maths, double-check the
   formula and units; if a test or source value looks wrong, flag it rather than tweaking the maths to match.

## Best practices for NEW code
The big legacy migrations are **done** — the codebase is fully standalone, uses built-in control
flow, signal inputs, `takeUntilDestroyed`, and `inject()` throughout. Match these established
idioms; don't reintroduce the older patterns.

- **Built-in control flow**, not structural directives: use `@if` / `@else` / `@for` / `@switch`
  instead of `*ngIf` / `*ngFor` / `*ngSwitch`. `@for` **requires** a `track` expression
  (e.g. `@for (b of bodies; track b.bodyData.bodyId)`). Use `@let` for template-local variables.
  When typing a previously-`any` field that the template reads, guard the whole dialog/section with
  `@if (data) { … }` (or a combined `@if (a !== null && b !== null)`) so strict templates can narrow it.
- **Standalone components**, not NgModule declarations: components are `standalone` (the v19+
  default — don't set `standalone: false`); list their deps in the component `imports: [...]`.
  Bootstrap via `bootstrapApplication` + `ApplicationConfig` providers, lazy-load via `loadComponent`.
- **Signals for state**: prefer `signal()` / `computed()` / `effect()` over mutable fields +
  manual `markForCheck()`. Reading a signal in the template auto-tracks CD (this also sidesteps the
  zoneless `markForCheck` footgun). Use `linkedSignal`/`resource` where they fit.
- **Signal-based component API**: `input()` / `input.required()` (already used), `output()` instead
  of `@Output()/EventEmitter`, `model()` for two-way, `viewChild()` / `viewChildren()` instead of
  `@ViewChild`/`@ViewChildren`.
- **`inject()` over constructor DI**: `private readonly svc = inject(AppService);` — cleaner with
  signals and required in functional guards/resolvers/interceptors.
- **Providers, not modules**: `provideHttpClient(withInterceptorsFromDi())`, `provideRouter(routes)`,
  `provideAnimationsAsync()` — avoid `HttpClientModule`/`RouterModule.forRoot`/`BrowserAnimationsModule`.
- **RxJS teardown**: `takeUntilDestroyed(inject(DestroyRef))`; convert observables to signals with
  `toSignal()` where it simplifies the view.
- **OnPush** change detection on every new component (with signals it's effectively free). Until a
  component is fully signal-based, expensive values read from the template (lookups, allocations)
  should be computed once in `ngOnChanges` and stored in a writable signal — see the `compute*()`
  methods feeding `getX.set(...)` in `system-body.component.ts` — rather than recomputed on every CD pass.
- **No type-loose `any`** for component state (e.g. dialog payloads); declare an interface.
- **Images**: use `NgOptimizedImage` (`ngSrc`) for static images where practical.
- **Styling**: bind `[class.x]`/`[style.x]` or `[class]`/`[style]` objects instead of `ngClass`/`ngStyle`;
  use the `var(--color-*)` tokens, never raw hex (don't add inline `style="…"` colours either).
- **HTTP**: go through `AppService.resilientGet()` (timeout + retry) and always handle errors.
- **Big maps / pure logic** go in `src/app/data/` (a data module or an injectable service) with a
  `*.spec.ts`, not inline in a component.

## Heavy computation (off the main thread)
The UI is **zoneless** and must stay responsive, so CPU-heavy synchronous maths runs in a shared
**web worker** (via [Comlink](https://github.com/GoogleChromeLabs/comlink)), not on the main thread.
The first (and currently only) consumer is the orbital/collision engine; the pattern is built to absorb more.
- **Shape**: the engine is a **framework-free** class/module under `data/` (no `@angular/core`, so no
  Angular runtime enters the worker bundle). A single shared worker (`collision.worker.ts`)
  `Comlink.expose`s an API (`collision-worker-api.ts`); the main-thread facade `OrbitalWorkerService`
  lazily `Comlink.wrap`s it and exposes `async` methods. It has an **inline fallback** (runs the engine
  on the main thread) for when `Worker` is unavailable — jsdom unit tests, SSR, or a worker that fails to
  construct — so callers get one uniform async API and tests exercise the real maths without a thread.
- **Serialization**: never post a live `SystemBody` — its `parent`/`subBodies` back-refs form a cycle
  that would drag the whole system tree across the wire. Extract the minimal data into a flat,
  structured-clone-safe DTO (`collision-request.ts`) and rehydrate it worker-side. `bigint`/`Date`
  survive structured clone; no `Comlink.transfer`/`proxy` needed for plain data.
- **Consuming results under zoneless**: land the async result in a `signal` (a plain field won't
  re-render), and drop stale/out-of-order responses with a per-request **generation token** — see
  `collisionStatus` / `collisionPending` / `collisionRequestId` / `requestCollisionStatus` in
  `system-body.component.ts`. Bump the token in `DestroyRef.onDestroy` so a late response isn't written
  to a destroyed component.
- **To offload another calc**: add a method to a framework-free core → wrap it in
  `collision-worker-api.ts` (rehydrate a DTO if it needs tree context, else pass flat args) → add an
  `async` passthrough on `OrbitalWorkerService`. The single worker + Comlink wiring are reused.
  - **DTO scope caveat**: `serializeCollisionFamily`'s DTO carries only the *immediate* family — the
    shared parent plus its direct `subBodies` — and prunes everything else (grandparents, each
    sibling's own sub-tree, the rest of the system; rehydration sets `parent.parent = null` and gives
    siblings empty `subBodies`). A method that reads wider context must **not** reuse this DTO — e.g. a
    whole-system walk like `systemAnomalyEpoch` (via `systemRoot`/`flattenSystem`) would silently
    return wrong results. Build a DTO that carries exactly what the method reads. This is easy to miss
    because the **inline fallback runs against the live full tree**, so jsdom unit tests (which take
    the inline path) stay green while the worker path diverges — cover any new offload with an e2e
    test that exercises the real worker, or assert worker-vs-inline parity.
- **Bundling**: `@angular/build` auto-bundles the worker from
  `new Worker(new URL('./x.worker', import.meta.url), { type: 'module' })` — **keep that URL a static
  literal** (esbuild detects it syntactically); there is no `tsconfig.worker.json`. `comlink` is a runtime
  dependency in `package.json` (the `pnpm-lock.yaml` is gitignored; CI resolves it from `package.json`).

## Verifying changes
Build + test must stay green: `npm run build` (rc=0; only pre-existing budget warnings are acceptable)
and `ng test --watch=false` (currently 742/742 across 51 spec files). The **Vitest** suite needs no browser — jsdom
covers it (note: jsdom has no real `<canvas>`, so chart-rendering tests assert "doesn't throw" rather than pixels).
The **Playwright** e2e suite (`npm run e2e`) is browser-based (Chromium/Firefox) and run separately from the unit-test lane.

## Environment quirks (this sandbox)
- `pnpm-workspace.yaml` carries `minimumReleaseAge: 10080` (7 days, in **minutes**) — a supply-chain delay
  that refuses package versions published more recently than that, enforced by this sandbox's pnpm even under
  `--frozen-lockfile`. The lockfile was re-resolved under this value, so too-fresh transitive deps were
  pinned to older versions; raising it requires re-resolving again, lowering it is always safe.
  It also carries an `allowBuilds`
  allowlist of native packages permitted to run install scripts (`@parcel/watcher`, `esbuild`, `lmdb`,
  `msgpackr-extract`, `nice-napi`). This sandbox's pnpm gates build scripts on `allowBuilds`, **not** the
  standard pnpm `onlyBuiltDependencies` key (which is inert here) — list every native dep in `allowBuilds`
  or `pnpm install` aborts. **Keep these** or `pnpm install` fails. Use `pnpm` (not npm) for installs.
- `ng update` is flaky here (its internal install can abort; the Material schematic can hang). Prefer
  `--migrate-only` for schematics, and `pnpm install` separately.

## Backlog
Remaining opportunities:
- **`home.component.ts` (~1150 lines)** mixes search, body-tree building and SIMBAD/PG-name
  formatting — extract the body-tree builder and name formatting into `data/` helpers/services.
- **`system-body.component.ts` (~1430 lines)** — its derived values are computed in `ngOnChanges`
  and pushed into writable signals (`getX.set(computeX())`); migrate these to true `computed()`
  signals where their inputs allow, and extract any further pure logic into `data/` services.
- Convert remaining BehaviorSubject state in `app.service.ts` to signals where it simplifies consumers.
