# TODO — legacy modernization backlog

The app was upgraded to Angular 22 (signal inputs, zoneless, esbuild build, Vitest).
A few legacy patterns remain. None are broken — these are modernization tasks to do
incrementally, each independently verifiable with `npm run build` + `npm test`.

Ordered roughly by value / ease.

## 1. Built-in control flow (`*ngIf` / `*ngFor` / `*ngSwitch` → `@if` / `@for` / `@switch`)
- Scope: **165 `*ngIf`, 14 `*ngFor`, 3 `*ngSwitch`** across the templates.
- Why: the structural directives are legacy; built-in control flow is the current
  default, is faster, and needs no `CommonModule` import.
- How: official automated migration —
  `ng generate @angular/core:control-flow`
  Review the diff (it rewrites templates), then build + test. Note `@for` requires a
  `track` expression; the migration infers one but verify it (we already have
  `trackBy` fns like `trackByBody`/`trackByBiologySignal` to reuse).

## 2. Drop `@ngneat/until-destroy` → `takeUntilDestroyed`
- Scope: `home.component.ts`, `system-body.component.ts` (`@UntilDestroy()` + `untilDestroyed(this)`).
- Why: removes a third-party dependency in favor of the built-in
  `takeUntilDestroyed(this.destroyRef)` (`@angular/core/rxjs-interop`) / `DestroyRef`.
- How: inject `DestroyRef`, replace `.pipe(untilDestroyed(this))` with
  `.pipe(takeUntilDestroyed(this.destroyRef))`, remove the decorator and the dep.

## 3. `HttpClientModule` → `provideHttpClient()`
- Scope: `app.module.ts` (`HttpClientModule` import + module list).
- Why: `HttpClientModule` is deprecated; `provideHttpClient(withInterceptorsFromDi())`
  is the current API.
- How: remove the module import, add `provideHttpClient(withInterceptorsFromDi())` to
  the module `providers` (alongside `provideZonelessChangeDetection()`).

## 4. Standalone components (remove NgModule)
- Scope: 3 components currently `standalone: false`, declared in `AppModule`.
- Why: standalone is the default in modern Angular; enables `bootstrapApplication`,
  lazy `loadComponent`, and removes `AppModule`/`AppRoutingModule` boilerplate.
- How: official migration `ng generate @angular/core:standalone` (run its 3 steps),
  then convert `main.ts` to `bootstrapApplication(AppComponent, appConfig)` with
  `provideRouter`, `provideHttpClient`, `provideZonelessChangeDetection`,
  `provideAnimations`. Bigger change — do it after 1–3.

## 5. Signal queries (`@ViewChild`/`@ViewChildren` → `viewChild()`/`viewChildren()`)
- Scope: ~13 decorator queries (`home`: 3, `system-body`: 10).
- Why: aligns with the signal-inputs migration already done.
- How: official migration `ng generate @angular/core:signal-queries-migration`.
  Verify the `QueryList` iteration in `toggleChildren()` still works (becomes a signal).

## 6. `inject()` over constructor DI (optional, low priority)
- Scope: 4 constructors. Cosmetic; `ng generate @angular/core:inject-migration` exists.

## 7. Misc
- 1 `[ngClass]` → plain `[class.x]` / `[class]` binding.
- `document.execCommand('copy')` fallbacks could be removed once the async Clipboard
  API is assumed available (already the primary path).
- Consider migrating the deprecated extended-diagnostic-prone patterns as they surface.
