# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Read this before making changes.

## What this is
**Canonn Signals** — an Angular single-page app that displays Elite Dangerous star-system
data (bodies, signals, biology/geology, orbital mechanics, region map). It fetches from
external community APIs (Canonn, Spansh, EDAstro/GEC, SIMBAD) and renders a recursive
body tree. No backend in this repo.

## Stack (as of Angular 22)
- **Angular 22**, **module-based** (`AppModule`; components are `standalone: false`).
- **Zoneless** change detection (`provideZonelessChangeDetection()`, no zone.js). ← see rules below.
- **Signal inputs** (`input()` / `input.required()`), not `@Input()`.
- **Build/serve: esbuild** — `@angular/build:application` + `@angular/build:dev-server` (Vite).
- **Tests: Vitest** — `@angular/build:unit-test`, runs in **Node + jsdom (no browser)**.
- Angular Material (M2 theming), FontAwesome, `@ngneat/until-destroy`, RxJS.

## Commands
- `npm start` → `ng serve` (binds `0.0.0.0`, port 4200; reachable from the dev-container host).
- `npm run build` → `prebuild` (copies `readme.md` → `src/assets/readme.md` for the Credits panel) then `ng build`. **Output goes to `dist/browser/`** (not `dist/`).
- `npm test` → `ng test` (Vitest). For CI/one-shot: `ng test --watch=false`. No browser/Chrome needed.
- `npm run watch` → dev build in watch mode.

## Architecture
- `src/app/app.component.*` — shell (router outlet, background image via async pipe).
- `src/app/home/home.component.*` — search + system overview; **large** (~1700 lines), holds search/region-map/markers logic.
- `src/app/system-body/system-body.component.*` — recursive body renderer; **~3300-line "god component"** (orbital math, Roche/Hill limits, charts, dialogs, formatting). Treat with care; prefer extracting pure logic to `data/` or a service over adding to it.
- `src/app/app.service.ts` — shared state (BehaviorSubjects) + HTTP; use its `resilientGet()` (timeout + retry) for new API calls.
- `src/app/data/*.ts` — pure data/lookup tables + pure functions (e.g. `temperature-estimation.ts`, `body-images.ts`, `mining-resources.ts`). Put big literal maps and pure logic here, not in components.
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
4. **CSS tokens**: use the `var(--color-*)` palette defined in `src/styles.scss :root`. Don't add raw hex.
5. **Material theming** uses the **M2 API** (`mat.m2-define-dark-theme`, `mat.$m2-*-palette`) in `styles.scss`.
6. **Links**: external `target="_blank"` anchors need `rel="noopener noreferrer"`; `window.open(..., '_blank', 'noopener,noreferrer')`.
7. **Accessibility**: images need `alt`; icon-only controls need `aria-label` + keyboard handlers.

## Best practices for NEW code
The codebase still contains legacy patterns (see [TODO.md](./TODO.md)), but **write new code
with the modern Angular idioms below** — don't copy the old patterns just because they're nearby.
When you touch a legacy spot, prefer migrating it opportunistically (small, verified steps).

- **Built-in control flow**, not structural directives: use `@if` / `@else` / `@for` / `@switch`
  instead of `*ngIf` / `*ngFor` / `*ngSwitch`. `@for` **requires** a `track` expression
  (e.g. `@for (b of bodies; track b.bodyData.bodyId)`). Use `@let` for template-local variables.
- **Standalone components**, not NgModule declarations: new components are `standalone` (the v19+
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
- **RxJS teardown**: `takeUntilDestroyed(this.destroyRef)` (`inject(DestroyRef)`) instead of
  `@ngneat/until-destroy`; convert observables to signals with `toSignal()` where it simplifies the view.
- **OnPush** change detection on every new component (with signals it's effectively free).
- **Images**: use `NgOptimizedImage` (`ngSrc`) for static images where practical.
- **Styling**: bind `[class.x]`/`[style.x]` or `[class]`/`[style]` objects instead of `ngClass`/`ngStyle`;
  use the `var(--color-*)` tokens, never raw hex.
- **HTTP**: go through `AppService.resilientGet()` (timeout + retry) and always handle errors.
- **Control-flow & input migrations are automated** — see the `ng generate @angular/core:*` schematics
  listed in TODO.md before doing large rewrites by hand.

## Verifying changes
Build + test must stay green: `npm run build` (rc=0; only pre-existing budget warnings are acceptable)
and `ng test --watch=false` (currently 25/25). There is no browser in CI — Vitest/jsdom covers tests.

## Environment quirks (this sandbox)
- `pnpm-workspace.yaml` carries `minimumReleaseAge: 0` (overrides a sandbox supply-chain policy that
  otherwise blocks installing Angular's recent deps) plus `allowBuilds`/`onlyBuiltDependencies` for
  native build scripts. **Keep these** or `pnpm install` fails. Use `pnpm` (not npm) for installs.
- `ng update` is flaky here (its internal install can abort; the Material schematic can hang). Prefer
  `--migrate-only` for schematics, and `pnpm install` separately.

## Backlog
Legacy-modernization tasks (control-flow `@if`/`@for` migration, drop until-destroy, standalone
components, signal queries, `provideHttpClient`) are tracked in **[TODO.md](./TODO.md)**.
