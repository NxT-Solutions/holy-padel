# Phone ↔ watch sync contract

The phone is the **single source of truth**: it owns the SQLite ledger and the
`@holy-padel/scoring` engine. The watch is a thin mirror — it renders the match
state the phone pushes, and sends back score/undo *intents*. The watch never
runs the scoring engine, so there is exactly one implementation of the rules.

This is transport-agnostic: on Apple Watch it rides **WatchConnectivity**
(`updateApplicationContext` for state, `sendMessage` for intents); on Wear OS it
rides the **Wearable Data Layer** (`DataClient` for state, `MessageClient` for
intents). Both carry the same JSON payloads defined here.

## Phone → watch: match state

Sent whenever the live match changes (point scored, undo, match finished) and on
conn+resume. Latest-wins (application context / a single Data Layer item at path
`/holy-padel/state`).

```jsonc
{
  "v": 1,                         // schema version
  "phase": "idle" | "live" | "won",
  "clock": "0:47",                // elapsed, mm or h:mm — empty when idle
  "court": "COURT 4",             // may be absent
  "setLabel": "SET 2",            // current set, e.g. "SET 2" / "SUPER TB"
  "teamA": { "short": "N&J", "serving": true },
  "teamB": { "short": "M&L", "serving": false },
  "pointA": "40",                 // display call: 0/15/30/40/AD or tie-break number
  "pointB": "30",
  "games": "6-4 · 4-3",           // completed sets + current, the live score line
  "status": "GAME PT",            // watchStatusLabel(), may be empty
  "won": {                        // present only when phase = "won"
    "winnerShort": "N&J",
    "scoreLine": "6-4 · 7-5",
    "duration": "1:23"
  },
  "last": {                       // present when phase = "idle" (quick-start hint)
    "line": "6-3 7-6 vs M&L",
    "won": true
  }
}
```

## Watch → phone: intents

Fire-and-forget messages; the phone applies them to the engine, persists, and
pushes fresh state back.

| Path                     | Body        | Effect on the phone                          |
| ------------------------ | ----------- | -------------------------------------------- |
| `/holy-padel/score`      | `"A"`\|`"B"`| Append a point event for that team           |
| `/holy-padel/undo`       | `""`        | Remove the last point event                   |
| `/holy-padel/start-last` | `""`        | From idle: start a rematch of the last lineup |

## Notes

- The watch UI derives entirely from `phase`: `idle` → quick-start card,
  `live` → the scoreboard (square + round variants), `won` → the celebration.
- Serving dots, status pill and point calls come straight from the fields above —
  the watch does no scoring math.
- Because the payload is tiny and latest-wins, a missed update self-heals on the
  next point; there is no event replay on the watch.
