# @holypadel/scoring-kotlin

Pure Kotlin (JVM) port of the canonical TypeScript scoring engine at
`packages/scoring`. No Android / platform dependencies — plain data & sealed
classes so the Wear OS app can import it and the FIP rules can be verified
off-device.

The single source of truth is the TS engine (`packages/scoring/src/engine.ts`).
This module reproduces it exactly: `VectorTest` loads the committed
`packages/scoring/vectors/golden.json` (972 cases) and asserts every serialised
snapshot matches.

## Layout

- `src/main/kotlin/com/holypadel/engine/`
  - `Types.kt` — data / sealed classes (`MatchConfig`, `MatchSnapshot`, `Moment`, …)
  - `Rules.kt` — FIP Rule 1 predicates (port of `rules.ts`)
  - `Engine.kt` — the fold: `computeMatch(config, events)` (port of `engine.ts`)
  - `Vectors.kt` — `serializeSnapshot` → the language-neutral JSON shape
- `src/test/kotlin/com/holypadel/engine/VectorTest.kt` — golden-vector conformance

Standalone Gradle (`settings.gradle.kts` names only this project) so it never
touches the Wear app's build.

## Run the vectors

```sh
cd packages/scoring-kotlin
./gradlew test        # requires a JDK 17–23 (Gradle 8.11.1, Kotlin 2.1.0)
```

Expected: `scoring-kotlin: 972/972 golden vectors passed`.
