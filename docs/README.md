# Holy Padel Docs

These docs are written for people first. Some pages are technical, some are not,
and the generated GitNexus wiki is there when you want a map of the code.

## Start Here

| Document | Audience | What it answers |
| --- | --- | --- |
| [Project guide](project-guide.md) | Curious readers, players, open-source visitors | What the app is, why it exists, and how it behaves |
| [Technical overview](technical-overview.md) | Developers and maintainers | How the app is built, where data flows, and how pieces fit |
| [FIP scoring spec](fip-scoring-spec.md) | Rule-focused contributors | Which padel scoring rules the engine implements |
| [Watch sync contract](watch-sync.md) | Watch/mobile contributors | Exact JSON payloads and intent paths between phone and watches |
| [GitNexus wiki](gitnexus-wiki/README.md) | Code explorers | Generated module-level documentation from the indexed graph |

## Mental Model

Holy Padel is a local-first app:

```text
Point events on the phone -> computed score -> mirrored display on watches
```

The phone owns the match. Watches help you interact with the match, but they do
not decide the score. That one rule keeps sync simple and keeps the scoring engine
honest.

## What To Read For Common Tasks

| Task | Read |
| --- | --- |
| Understand the product | [Project guide](project-guide.md) |
| Understand the architecture | [Technical overview](technical-overview.md) |
| Change scoring behavior | [FIP scoring spec](fip-scoring-spec.md), then `packages/scoring` |
| Change watch sync | [Watch sync contract](watch-sync.md), then `apps/mobile/src/watch` |
| Find the right code area | [GitNexus wiki](gitnexus-wiki/README.md) |
| Update generated docs | `pnpm gitnexus:wiki` from the repo root |
