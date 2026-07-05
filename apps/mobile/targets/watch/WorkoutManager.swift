import Foundation
import HealthKit

/// Tracks the live match as a real HealthKit workout session: workout-grade
/// heart rate on the scoreboard, active calories, and a workout saved straight
/// to Health when the match ends — the Apple Watch is its own writer (unlike
/// Wear OS, no phone round-trip is needed).
///
/// Best-effort throughout: no HealthKit, denied permission, or a failed session
/// must never affect the scoreboard.
final class WorkoutManager: NSObject, ObservableObject {
    @Published private(set) var heartRate: Int = 0
    @Published private(set) var isTracking = false

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    /// Start a session for the live match. Safe to call repeatedly.
    func start(startedAtMs: Double?) {
        guard !isTracking, HKHealthStore.isHealthDataAvailable() else { return }
        isTracking = true

        let share: Set<HKSampleType> = [HKObjectType.workoutType()]
        let read: Set<HKObjectType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
        ]
        store.requestAuthorization(toShare: share, read: read) { [weak self] granted, _ in
            guard granted, let self else {
                self?.finishTracking()
                return
            }
            DispatchQueue.main.async {
                self.beginSession(startedAtMs: startedAtMs)
            }
        }
    }

    /// End the session; HealthKit finalises and saves the workout.
    func end() {
        guard isTracking else { return }
        // stop → end lets the builder finalise its statistics window.
        session?.stopActivity(with: Date())
        session?.end()
        // The delegate's .ended transition completes the save; if the session
        // never started (e.g. denied mid-flight), just reset.
        if session == nil {
            finishTracking()
        }
    }

    private func beginSession(startedAtMs: Double?) {
        let config = HKWorkoutConfiguration()
        config.activityType = .tennis
        config.locationType = .outdoor

        do {
            let session = try HKWorkoutSession(healthStore: store, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
            session.delegate = self
            builder.delegate = self
            self.session = session
            self.builder = builder

            // The session records from now; the padel ledger keeps the true
            // match start — HealthKit needs sensing to be live, so "now" it is.
            let start = Date()
            session.startActivity(with: start)
            builder.beginCollection(withStart: start) { _, _ in }
            _ = startedAtMs // reserved: shown in metadata below
            builder.addMetadata([HKMetadataKeyWorkoutBrandName: "Holy Padel"]) { _, _ in }
        } catch {
            finishTracking()
        }
    }

    private func finishTracking() {
        DispatchQueue.main.async {
            self.session = nil
            self.builder = nil
            self.isTracking = false
            self.heartRate = 0
        }
    }
}

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        guard toState == .ended else { return }
        builder?.endCollection(withEnd: date) { [weak self] _, _ in
            self?.builder?.finishWorkout { _, _ in
                self?.finishTracking()
            }
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        finishTracking()
    }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let hrType = HKQuantityType(.heartRate)
        guard collectedTypes.contains(hrType),
              let stats = workoutBuilder.statistics(for: hrType),
              let bpm = stats.mostRecentQuantity()?.doubleValue(
                for: HKUnit.count().unitDivided(by: .minute())
              )
        else { return }
        DispatchQueue.main.async {
            self.heartRate = Int(bpm.rounded())
        }
    }

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
