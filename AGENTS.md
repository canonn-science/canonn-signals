# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Read this before making changes.

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
- `npm test` → `ng test` (Vitest). For CI/one-shot: `ng test --watch=false`. No browser/Chrome needed.
- `npm run watch` → dev build in watch mode.
- `npm run e2e` → `playwright test` (Playwright). End-to-end/functional + responsive + cross-browser checks in `e2e/` (desktop/tablet/mobile × Chromium/Firefox). It boots the dev server itself; deterministic specs stub the APIs with saved payloads in `e2e/fixtures/` (helpers in `e2e/support/`). **Playwright is for functional/UI correctness only — we do NOT use it for stress/load/performance testing.** This sandbox's single dev server can deadlock under heavy parallelism; cap workers (`npx playwright test --workers=6`) if needed.

## Architecture
- `src/app/app.component.*` — shell (router outlet, background image via async pipe).
- `src/app/home/home.component.*` — search + system overview; **large** (~1110 lines), holds search/region-map/markers logic.
- `src/app/system-body/system-body.component.*` — recursive body renderer; still **large (~1390 lines)** but the heavy pure logic (orbital relations, physics, neutron-star classification, canvas charts, temperature lookup) has been extracted into `data/` services. Still the most complex component — **treat with care; prefer extracting more pure logic into a `data/` service over adding to it.**
- `src/app/app.service.ts` — shared state (BehaviorSubjects) + HTTP; use its `resilientGet()` (timeout + retry) for new API calls.
- `src/app/data/*.ts` — pure data/lookup tables + pure functions (e.g. `temperature-estimation.ts` with `estimateTempRange`/`lookupTempDelta`, `body-images.ts`, `mining-resources.ts`) **and** the pure injectable services that back the body renderer:
  - `body-physics.service.ts` — densities, Roche limits, Hill spheres, ring-shepherding.
  - `stellar-physics.service.ts` — spin resonance, tangential velocity, jet-cone angle, neutron-star classification.
  - `orbital-relations.service.ts` — Trojan/Lagrange (L1–L5) and rosette detection from co-orbital siblings.
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

## Verifying changes
Build + test must stay green: `npm run build` (rc=0; only pre-existing budget warnings are acceptable)
and `ng test --watch=false` (currently 314/314 across 21 spec files). The **Vitest** suite needs no browser — jsdom
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
- **`home.component.ts` (~1110 lines)** mixes search, body-tree building and SIMBAD/PG-name
  formatting — extract the body-tree builder and name formatting into `data/` helpers/services.
- **`system-body.component.ts` (~1390 lines)** — its derived values are computed in `ngOnChanges`
  and pushed into writable signals (`getX.set(computeX())`); migrate these to true `computed()`
  signals where their inputs allow, and extract any further pure logic into `data/` services.
- Convert remaining BehaviorSubject state in `app.service.ts` to signals where it simplifies consumers.
