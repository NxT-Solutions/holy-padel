import ExpoModulesCore
import WatchConnectivity

/// Phone side of the Apple Watch sync. Pushes the match-state JSON to the paired
/// watch via WatchConnectivity and forwards the watch's score/undo/start intents
/// back to JS as `onIntent` events. See docs/watch-sync.md.
public class WatchBridgeModule: Module {
  private let sync = PhoneWatchSync()

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events("onIntent")

    OnCreate {
      sync.onIntent = { [weak self] path, body in
        self?.sendEvent("onIntent", ["path": path, "body": body])
      }
      sync.activate()
    }

    Function("pushState") { (json: String) in
      sync.pushState(json)
    }
  }
}

/// The `WCSessionDelegate` lives here rather than on the Module so its lifetime
/// and threading stay independent of the Expo module instance.
private final class PhoneWatchSync: NSObject, WCSessionDelegate {
  var onIntent: ((String, String) -> Void)?

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func pushState(_ json: String) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    // Latest-wins, survives relaunch. Also nudge it live when the watch is up.
    try? session.updateApplicationContext(["state": json])
    if session.isReachable {
      session.sendMessage(["state": json], replyHandler: nil, errorHandler: nil)
    }
  }

  private func emit(_ payload: [String: Any]) {
    guard let path = payload["path"] as? String else { return }
    onIntent?(path, payload["body"] as? String ?? "")
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    emit(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    emit(userInfo)
  }

  // Required WCSessionDelegate methods on iOS.
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate for a newly-paired watch.
    WCSession.default.activate()
  }
}
