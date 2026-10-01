# Effect adoption assessment

Date: 2026-10-01

## Recommendation

Rekonime can use Effect. A whole-app migration is not justified by the current architecture. Consider a bounded experiment in score-refresh tooling when that workflow next needs more complex failure handling or cancellation. Keep Effect behind an existing module interface, with ordinary data and Promises for callers.

This is an architectural recommendation based on source inspection and current official documentation. No Effect prototype, installation, runtime test, or bundle comparison was performed.

## Compatibility and current release

Effect 4.0 became stable on September 30, 2026. The npm registry returned `latest: 4.0.0` when checked on October 1. Older material recommending v3 because v4 is in beta is now stale. The release retains stability exceptions for modules marked unstable or experimental. A pilot should use version-matched v4 documentation and stable APIs. [Effect 4.0 announcement](https://effect.website/blog/releases/effect/40), [npm package metadata](https://registry.npmjs.org/effect/latest).

The v4 installation guide supports Bun, requires TypeScript 5.9 or newer, recommends TypeScript 7, and includes a Vite browser example. Rekonime's ESM/Vite setup and TypeScript 7 satisfy the documented prerequisites. Effect is a library, so adopting it does not require replacing the DOM UI with React or changing the rendering architecture. Compatibility here is documented, not proven by running Effect inside Rekonime. [Effect installation](https://effect.website/docs/v4/getting-started/installation), [Welcome to Effect](https://effect.website/docs/v4/onboarding), [package.json](../package.json).

Incremental adoption has a concrete boundary. `Effect.tryPromise` wraps existing asynchronous operations and maps failures into the error channel; `Effect.runPromise` returns a Promise for existing callers. Plain Promise callers do not retain a typed rejection channel. Handle expected failures inside the module or return an explicit result union when callers need to distinguish them. [Creating effects](https://effect.website/docs/v4/getting-started/creating-effects), [Running effects](https://effect.website/docs/v4/getting-started/running-effects).

## What it would add

| Capability | Potential value in Rekonime | Condition |
| --- | --- | --- |
| Typed expected errors | Distinguish network, HTTP, validation, and missing-data outcomes before choosing fallback behavior | Use checked TypeScript and meaningful error types |
| Retry schedules | Compose attempt limits, backoff, and retry predicates in refresh or review workflows | Preserve provider pacing and distinguish permanent failures |
| Bounded concurrency | Coordinate independent refresh jobs with explicit limits | Preserve partial success and periodic saves |
| Interruption and resource cleanup | Stop obsolete detail requests and release timers or other resources | Connect interruption to the underlying fetch signal or cleanup handler |
| Schema | Validate external JSON and derive corresponding types | Preserve existing normalization and acceptance rules |

These capabilities come from Effect's [error model](https://effect.website/docs/v4/error-management/two-error-types), [retry operators](https://effect.website/docs/v4/error-management/retrying), [concurrency operators](https://effect.website/docs/v4/concurrency/basic-concurrency), [callback interruption support](https://effect.website/docs/v4/getting-started/creating-effects), and [Schema](https://effect.website/docs/v4/schema/introduction). The mapping to Rekonime is an inference from the local modules below. Effect does not supply the application's retry policy, provider limits, stale-response rules, or storage transaction semantics automatically.

## Fit with the current app

Rekonime currently declares only development dependencies. Its app runs in the browser through Vite, while JavaScript/Bun tooling and Python handle data work. Effect would introduce a new programming model and, if imported by browser code, a runtime dependency. [package.json](../package.json).

The app already has explicit owners for Catalog Runtime, Airing Schedule, Detail Experience, Watchlist Lifecycle, and Personal Data Restore. Their public interfaces provide places to contain an experiment without spreading Effect types through the app shell. [Module contracts](module-contracts.md), [product language](../CONTEXT.md).

Several likely candidates use `@ts-nocheck`, including [Catalog Runtime](../src/features/catalog/catalog-loader.ts), [Airing Schedule](../src/features/airing/airing-schedule.ts), and [Detail Experience](../src/features/detail/detail-experience.ts). [Reviews](../src/features/detail/reviews.js) is JavaScript; [tsconfig.json](../tsconfig.json) enables `allowJs` without `checkJs`. A checked TypeScript pilot is necessary to assess the typed-error benefit. Adding Effect to unchecked code would still supply runtime operators, but would not deliver the same compiler feedback.

| Area | Assessment |
| --- | --- |
| Score-refresh orchestration | Best optional first experiment. It already coordinates workers, independent outcomes, and periodic saves. Tooling use avoids adding browser bytes. |
| Score-refresh request helper | Preserve its small public interface. Its injected fetch, clock, and sleep already make it testable; replacing it alone is weak justification. |
| Reviews | Possible later browser experiment because it has Jikan pacing/retries and AniList fallback, and is loaded on demand. Measure the emitted bundle and preserve stale-title protection. |
| Catalog startup | Has relevant asynchronous complexity, but boot and offline fallback make it a riskier first experiment. |
| Pure filtering, scoring, DOM rendering, and simple storage transitions | Keep ordinary functions. No demonstrated need for an Effect runtime here. |
| Personal Data Restore | Already expresses outcomes through a plain discriminated union. Keep its all-or-nothing behavior; Effect is not necessary just to model failures. |

Local evidence: [refresh orchestration](../tools/refresh-scores.js), [request helper](../tools/lib/score-refresh-request.js), [request tests](../test/unit/score-refresh-request.test.js), [reviews](../src/features/detail/reviews.js), [Catalog Runtime](../src/features/catalog/catalog-loader.ts), [Personal Data Restore](../src/features/preferences/personal-data-restore.ts).

## Costs and a useful experiment

Effect adds concepts that contributors must learn, including lazy effects, expected failures versus defects, interruption, and runtime execution boundaries. The benefit must be clearer maintenance of an actual workflow. Merely wrapping every Promise adds another layer without establishing that benefit.

The v4 release reports smaller tree-shaken bundles than v3 and no runtime dependencies in its core package. Those are upstream facts, not a measurement of Rekonime. Actual cost depends on the selected modules and Vite output. A tooling-only experiment avoids browser bundle cost as long as browser modules do not import it. [Effect 4.0 announcement](https://effect.website/blog/releases/effect/40), [npm package metadata](https://registry.npmjs.org/effect/latest).

A useful future experiment would:

1. Pick one bounded score-refresh workflow when extending its reliability behavior. Write it in checked TypeScript, preserving the existing interface.
2. Preserve per-host pacing on every attempt, retry counts and classification, independent partial outcomes, and periodic persistence. Verify cancellation reaches the underlying request. Do not assume a concurrency limit also enforces requests per second.
3. Compare failure-path clarity and testability with the existing implementation. Keep the simpler implementation if Effect does not improve them.
4. Consider a browser pilot only after that result. Measure production chunks and startup behavior, run the existing size checks, and verify fallback, interruption, offline, and stale-response behavior for the affected flow.

No dependency or runtime change is part of this assessment. A fresh stable major release is not itself a reason to migrate; the decision should follow a concrete maintenance benefit in Rekonime.
