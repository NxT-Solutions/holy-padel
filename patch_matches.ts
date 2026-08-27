import { readFileSync, writeFileSync } from 'fs';

const file = 'packages/db/src/matches.ts';
let content = readFileSync(file, 'utf8');

// 1. Fix SUMMARY_SELECT
content = content.replace(
  /JOIN players pa2 ON pa2\.id = m\.team_a_player_2\s+JOIN players pb1 ON pb1\.id = m\.team_b_player_1\s+JOIN players pb2 ON pb2\.id = m\.team_b_player_2/,
  `LEFT JOIN players pa2 ON pa2.id = m.team_a_player_2
  JOIN players pb1 ON pb1.id = m.team_b_player_1
  LEFT JOIN players pb2 ON pb2.id = m.team_b_player_2`
);

// 2. Fix parseConfig
content = content.replace(
  /function parseConfig\(row: SqlRow\): MatchConfig \{([\s\S]*?)function toStoredMatch/m,
  `function parseConfig(row: SqlRow): MatchConfig {
  const sport = optionalString(row, "sport") ?? "padel";

  if (sport === "pickleball") {
    return {
      sport: "pickleball",
      bestOf: expectNumber(row, "pb_best_of") as 1 | 3 | 5,
      deuceMode: "advantage",
      thirdSet: "superTieBreak",
      firstServe: parseTeam(expectString(row, "first_serve")),
      firstServePending: expectNumber(row, "first_serve_pending") === 1,
      firstServeOriginallyUndecided: expectNumber(row, "first_serve_originally_undecided") === 1,
      pbType: expectString(row, "pb_type") as "singles" | "doubles",
      pbTarget: expectNumber(row, "pb_target"),
      pbTiebreak: expectString(row, "pb_tiebreak") as "winByTwo" | "winByOne",
    };
  }

  if (sport === "squash") {
    return {
      sport: "squash",
      bestOf: expectNumber(row, "squash_best_of") as 1 | 3 | 5,
      deuceMode: "advantage",
      thirdSet: "fullSet",
      firstServe: parseTeam(expectString(row, "first_serve")),
      firstServePending: expectNumber(row, "first_serve_pending") === 1,
      firstServeOriginallyUndecided: expectNumber(row, "first_serve_originally_undecided") === 1,
      squashMode: expectString(row, "squash_mode") as "par" | "hiho",
      squashTarget: expectNumber(row, "squash_target"),
      squashTiebreak: expectString(row, "squash_tiebreak") as "winByTwo" | "setOne" | "setTwo",
    };
  }

  const rawBestOf = expectNumber(row, "best_of");
  const padelBestOf = optionalNumber(row, "padel_best_of");
  const bestOf = padelBestOf ?? rawBestOf;
  if (bestOf !== 1 && bestOf !== 3 && bestOf !== 5) {
    throw new Error(\`invalid best_of for padel: \${String(bestOf)}\`);
  }

  const deuceMode = expectString(row, "deuce_mode");
  if (deuceMode !== "advantage" && deuceMode !== "starPoint" && deuceMode !== "goldenPoint") {
    throw new Error(\`invalid deuce_mode: \${deuceMode}\`);
  }
  const thirdSet = expectString(row, "third_set");
  if (thirdSet !== "fullSet" && thirdSet !== "advantageSet" && thirdSet !== "superTieBreak") {
    throw new Error(\`invalid third_set: \${thirdSet}\`);
  }

  return {
    sport: "padel",
    bestOf: bestOf as 1 | 3 | 5,
    deuceMode,
    thirdSet,
    firstServe: parseTeam(expectString(row, "first_serve")),
    firstServePending: expectNumber(row, "first_serve_pending") === 1,
    firstServeOriginallyUndecided: expectNumber(row, "first_serve_originally_undecided") === 1,
  };
}

function toStoredMatch`
);

// 3. Fix toStoredMatch
content = content.replace(
  /A: \[expectString\(row, "team_a_player_1"\), expectString\(row, "team_a_player_2"\)\],/g,
  `A: [expectString(row, "team_a_player_1"), optionalString(row, "team_a_player_2")],`
);
content = content.replace(
  /B: \[expectString\(row, "team_b_player_1"\), expectString\(row, "team_b_player_2"\)\],/g,
  `B: [expectString(row, "team_b_player_1"), optionalString(row, "team_b_player_2")],`
);

// 4. Fix toSummary names
content = content.replace(
  /A: \[expectString\(row, "name_a_1"\), expectString\(row, "name_a_2"\)\],/g,
  `A: [expectString(row, "name_a_1"), optionalString(row, "name_a_2")],`
);
content = content.replace(
  /B: \[expectString\(row, "name_b_1"\), expectString\(row, "name_b_2"\)\],/g,
  `B: [expectString(row, "name_b_1"), optionalString(row, "name_b_2")],`
);

// 5. Fix createMatch
content = content.replace(
  /export function createMatch\(driver: SqlDriver, match: NewMatch\): void \{([\s\S]*?)export function getMatch/m,
  `export function createMatch(driver: SqlDriver, match: NewMatch): void {
  const { config, players } = match;

  if (config.sport === "pickleball") {
    driver.execute(
      \`INSERT INTO matches (
         id, status, sport, best_of, deuce_mode, third_set, first_serve, first_serve_pending, first_serve_originally_undecided,
         pb_type, pb_target, pb_tiebreak, pb_best_of,
         team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
         court, location, started_at
       ) VALUES (?, 'live', ?, ?, 'advantage', 'superTieBreak', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
      [
        match.id,
        "pickleball",
        config.bestOf,
        config.firstServePending ? "A" : config.firstServe,
        config.firstServePending ? 1 : 0,
        config.firstServeOriginallyUndecided ? 1 : 0,
        config.pbType,
        config.pbTarget,
        config.pbTiebreak,
        config.bestOf,
        players.A[0],
        players.A[1] ?? null,
        players.B[0],
        players.B[1] ?? null,
        match.court ?? null,
        match.location ?? null,
        match.startedAt,
      ],
    );
    return;
  }

  if (config.sport === "squash") {
    driver.execute(
      \`INSERT INTO matches (
         id, status, sport, best_of, deuce_mode, third_set, first_serve, first_serve_pending, first_serve_originally_undecided,
         squash_mode, squash_target, squash_tiebreak, squash_best_of, padel_best_of,
         team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
         court, location, started_at
       ) VALUES (?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
      [
        match.id,
        "squash",
        config.bestOf === 5 ? 1 : config.bestOf, // dummy padel value
        "advantage",
        "fullSet",
        config.firstServePending ? "A" : config.firstServe,
        config.firstServePending ? 1 : 0,
        config.firstServeOriginallyUndecided ? 1 : 0,
        config.squashMode,
        config.squashTarget,
        config.squashTiebreak,
        config.bestOf,
        null, // padel_best_of
        players.A[0],
        players.A[1] ?? null,
        players.B[0],
        players.B[1] ?? null,
        match.court ?? null,
        match.location ?? null,
        match.startedAt,
      ],
    );
    return;
  }

  driver.execute(
    \`INSERT INTO matches (
       id, status, sport, best_of, deuce_mode, third_set, first_serve, first_serve_pending, first_serve_originally_undecided,
       padel_best_of,
       team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
       court, location, started_at
     ) VALUES (?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
    [
      match.id,
      "padel",
      config.bestOf,
      config.deuceMode,
      config.thirdSet,
      config.firstServePending ? "A" : config.firstServe,
      config.firstServePending ? 1 : 0,
      config.firstServeOriginallyUndecided ? 1 : 0,
      config.bestOf,
      players.A[0],
      players.A[1] ?? null,
      players.B[0],
      players.B[1] ?? null,
      match.court ?? null,
      match.location ?? null,
      match.startedAt,
    ],
  );
}

export function getMatch`
);

writeFileSync(file, content);
