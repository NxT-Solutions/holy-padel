import XCTest
@testable import HolyPadelEngine

// MARK: - Serialized shapes (mirror packages/scoring/src/vectors.ts SerializedSnapshot)

private struct IntPair: Codable, Equatable {
    let A: Int
    let B: Int
}

private struct SerializedGame: Codable, Equatable {
    let kind: String
    // standard
    let calls: SerializedCalls?
    // both
    let points: IntPair?
    // tieBreak
    let tieBreakKind: String?
    let target: Int?
}

private struct SerializedCalls: Codable, Equatable {
    let A: String
    let B: String
}

private struct SerializedSet: Codable, Equatable {
    let games: IntPair
    let tieBreak: IntPair?
    let winner: String
    let kind: String
}

// `moment` is an arbitrary { kind, team?/winner?/setNumber? } object. Decode into a
// normalized comparable value so key order and absent-vs-null don't matter.
private struct SerializedMoment: Codable, Equatable {
    let kind: String
    let team: String?
    let winner: String?
    let setNumber: Int?
}

private struct SerializedSnapshot: Codable, Equatable {
    let finished: Bool
    let winner: String?
    let setNumber: Int
    let currentSetGames: IntPair
    let currentGame: SerializedGame?
    let servingTeam: String
    let moment: SerializedMoment
    let totalGames: IntPair
    let totalPoints: IntPair
    let completedSets: [SerializedSet]
}

private struct SerializedConfig: Codable, Equatable {
    let bestOf: Int
    let deuceMode: String
    let thirdSet: String
    let firstServe: String
}

private struct GoldenVector: Codable {
    let config: SerializedConfig
    let winners: String
    let snapshot: SerializedSnapshot
}

// MARK: - Bridging engine values -> serialized shapes

private func serialize(_ pair: TeamValues<Int>) -> IntPair {
    IntPair(A: pair.A, B: pair.B)
}

private func serialize(_ game: CurrentGame?) -> SerializedGame? {
    guard let game else { return nil }
    switch game {
    case let .standard(points, calls):
        return SerializedGame(
            kind: "standard",
            calls: SerializedCalls(A: calls.A.rawValue, B: calls.B.rawValue),
            points: serialize(points),
            tieBreakKind: nil,
            target: nil
        )
    case let .tieBreak(tieBreakKind, target, points):
        return SerializedGame(
            kind: "tieBreak",
            calls: nil,
            points: serialize(points),
            tieBreakKind: tieBreakKind.rawValue,
            target: target
        )
    }
}

private func serialize(_ moment: Moment) -> SerializedMoment {
    switch moment {
    case .normal:
        return SerializedMoment(kind: "normal", team: nil, winner: nil, setNumber: nil)
    case let .gamePoint(team):
        return SerializedMoment(kind: "gamePoint", team: team.rawValue, winner: nil, setNumber: nil)
    case let .setPoint(team):
        return SerializedMoment(kind: "setPoint", team: team.rawValue, winner: nil, setNumber: nil)
    case let .matchPoint(team):
        return SerializedMoment(kind: "matchPoint", team: team.rawValue, winner: nil, setNumber: nil)
    case .deuce:
        return SerializedMoment(kind: "deuce", team: nil, winner: nil, setNumber: nil)
    case let .advantage(team):
        return SerializedMoment(kind: "advantage", team: team.rawValue, winner: nil, setNumber: nil)
    case .goldenPoint:
        return SerializedMoment(kind: "goldenPoint", team: nil, winner: nil, setNumber: nil)
    case .starPoint:
        return SerializedMoment(kind: "starPoint", team: nil, winner: nil, setNumber: nil)
    case let .tieBreak(setNumber):
        return SerializedMoment(kind: "tieBreak", team: nil, winner: nil, setNumber: setNumber)
    case .superTieBreak:
        return SerializedMoment(kind: "superTieBreak", team: nil, winner: nil, setNumber: nil)
    case let .finished(winner):
        return SerializedMoment(kind: "finished", team: nil, winner: winner.rawValue, setNumber: nil)
    }
}

private func serialize(_ set: SetSummary) -> SerializedSet {
    SerializedSet(
        games: serialize(set.games),
        tieBreak: set.tieBreak.map(serialize),
        winner: set.winner.rawValue,
        kind: set.kind.rawValue
    )
}

private func serialize(_ snap: MatchSnapshot) -> SerializedSnapshot {
    SerializedSnapshot(
        finished: snap.finished,
        winner: snap.winner?.rawValue,
        setNumber: snap.setNumber,
        currentSetGames: serialize(snap.currentSetGames),
        currentGame: serialize(snap.currentGame),
        servingTeam: snap.servingTeam.rawValue,
        moment: serialize(snap.moment),
        totalGames: serialize(snap.totalGames),
        totalPoints: serialize(snap.totalPoints),
        completedSets: snap.completedSets.map(serialize)
    )
}

// MARK: - Config / events from the vector

private func decodeConfig(_ c: SerializedConfig) -> MatchConfig {
    MatchConfig(
        bestOf: c.bestOf == 1 ? .one : .three,
        deuceMode: DeuceMode(rawValue: c.deuceMode)!,
        thirdSet: ThirdSetMode(rawValue: c.thirdSet)!,
        firstServe: TeamId(rawValue: c.firstServe)!
    )
}

private func eventsFromWinners(_ winners: String) -> [PointEvent] {
    winners.enumerated().map { index, ch in
        PointEvent(winner: ch == "A" ? .A : .B, at: index)
    }
}

// MARK: - Locate golden.json

private func goldenVectorsURL() -> URL {
    // #filePath = .../packages/scoring-swift/Tests/HolyPadelEngineTests/VectorTests.swift
    let thisFile = URL(fileURLWithPath: #filePath)
    // up 3: HolyPadelEngineTests -> Tests -> scoring-swift -> packages
    let packages = thisFile
        .deletingLastPathComponent() // HolyPadelEngineTests
        .deletingLastPathComponent() // Tests
        .deletingLastPathComponent() // scoring-swift
        .deletingLastPathComponent() // packages
    return packages
        .appendingPathComponent("scoring")
        .appendingPathComponent("vectors")
        .appendingPathComponent("golden.json")
}

final class VectorTests: XCTestCase {
    func testAllGoldenVectorsMatch() throws {
        let url = goldenVectorsURL()
        let data = try Data(contentsOf: url)
        let vectors = try JSONDecoder().decode([GoldenVector].self, from: data)

        XCTAssertEqual(vectors.count, 972, "expected 972 golden vectors")

        var passed = 0
        var failures: [String] = []

        for (index, vector) in vectors.enumerated() {
            let config = decodeConfig(vector.config)
            let events = eventsFromWinners(vector.winners)
            let snapshot = computeMatch(config: config, events: events)
            let actual = serialize(snapshot)
            let expected = vector.snapshot

            if actual == expected {
                passed += 1
            } else {
                failures.append("index \(index): config=\(vector.config) winners.len=\(vector.winners.count)")
                if failures.count <= 10 {
                    // Emit a JSON diff for the first handful to speed debugging.
                    let enc = JSONEncoder()
                    enc.outputFormatting = [.prettyPrinted, .sortedKeys]
                    let a = (try? enc.encode(actual)).flatMap { String(data: $0, encoding: .utf8) } ?? "?"
                    let e = (try? enc.encode(expected)).flatMap { String(data: $0, encoding: .utf8) } ?? "?"
                    print("MISMATCH index \(index)\nACTUAL:\n\(a)\nEXPECTED:\n\(e)\n")
                }
            }
        }

        print("GOLDEN VECTORS PASSED: \(passed)/\(vectors.count)")
        XCTAssertTrue(failures.isEmpty, "Mismatched vectors:\n\(failures.joined(separator: "\n"))")
    }
}
