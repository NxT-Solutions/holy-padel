import Foundation
import WatchConnectivity

/// Bridges the watch to the phone over WatchConnectivity:
/// - Phone -> watch: match state via `updateApplicationContext` (latest-wins) or,
///   when reachable, `sendMessage`. Both carry `{ "state": "<json>" }`.
/// - Watch -> phone: score/undo/start intents via `sendMessage`, falling back to
///   `transferUserInfo` (queued, background-tolerant) when the phone is asleep.
///
/// Intent payloads use the same `{ path, body }` shape as the Wear OS Data Layer
/// paths (docs/watch-sync.md) so the phone can decode both transports the same way.
final class WatchConnectivityManager: NSObject, ObservableObject {
    @Published private(set) var state: MatchState = .idle

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    private func apply(_ payload: [String: Any]) {
        guard let json = payload["state"] as? String,
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(MatchState.self, from: data)
        else { return }
        DispatchQueue.main.async { self.state = decoded }
    }

    private func send(path: String, body: String) {
        let session = WCSession.default
        let payload: [String: Any] = ["path": path, "body": body]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { _ in
                session.transferUserInfo(payload)
            }
        } else {
            session.transferUserInfo(payload)
        }
    }

    func score(_ team: String) { send(path: "/holy-padel/score", body: team) }
    func undo() { send(path: "/holy-padel/undo", body: "") }
    func startLast() { send(path: "/holy-padel/start-last", body: "") }
}

extension WatchConnectivityManager: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        // Catch up on whatever state the phone last set while we were away.
        apply(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        apply(message)
    }
}
