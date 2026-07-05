import ExpoModulesCore
import HealthKit

/// Logs a finished padel match to Apple Health as a workout. Write-only and
/// best-effort: every failure path resolves `false` rather than throwing into
/// the app — logging a workout must never break the score tracker.
///
/// HealthKit has no padel activity type (checked through iOS 26), so matches are
/// saved as `.tennis` — the community convention for padel — branded via
/// workout metadata.
public class HealthLogModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("HealthLog")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    // Coarse share-authorization state for the workout type, mapped to the
    // strings the Profile banner drives off. HealthKit deliberately never
    // reveals a denial for reads, but workouts are write-only here so the
    // sharing status is honest enough to decide whether to offer "Connect".
    Function("getAuthorizationStatus") { () -> String in
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      switch self.store.authorizationStatus(for: HKObjectType.workoutType()) {
      case .sharingAuthorized: return "granted"
      case .sharingDenied: return "denied"
      default: return "undetermined"
      }
    }

    // Prompt for the same share types `logWorkout` writes. Non-throwing to JS:
    // resolves true only when the request completed without error. A true here
    // means the sheet was handled, not necessarily that sharing was granted —
    // the caller re-reads getAuthorizationStatus afterwards.
    AsyncFunction("requestAuthorization") { () async -> Bool in
      guard HKHealthStore.isHealthDataAvailable() else { return false }
      do {
        try await self.store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
        return true
      } catch {
        return false
      }
    }

    AsyncFunction("logWorkout") { (startMs: Double, endMs: Double) async -> Bool in
      guard HKHealthStore.isHealthDataAvailable() else { return false }

      let workoutType = HKObjectType.workoutType()
      do {
        try await self.store.requestAuthorization(toShare: [workoutType], read: [])
      } catch {
        return false
      }
      guard self.store.authorizationStatus(for: workoutType) == .sharingAuthorized else {
        return false
      }

      let config = HKWorkoutConfiguration()
      config.activityType = .tennis

      let builder = HKWorkoutBuilder(healthStore: self.store, configuration: config, device: .local())
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)

      do {
        try await builder.beginCollection(at: start)
        try await builder.addMetadata([HKMetadataKeyWorkoutBrandName: "Holy Padel"])
        try await builder.endCollection(at: end)
        return try await builder.finishWorkout() != nil
      } catch {
        return false
      }
    }

    // On iOS the Apple Watch saves its own HKWorkoutSession directly to Health,
    // so there is nothing for the phone to write — the watch never sends a
    // summary here. Defined for interface parity with Android.
    AsyncFunction("logWatchWorkout") { (_: String) async -> Bool in
      false
    }
  }
}
