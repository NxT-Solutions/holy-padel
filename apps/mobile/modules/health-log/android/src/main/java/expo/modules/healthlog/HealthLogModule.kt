package expo.modules.healthlog

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.CompletableDeferred
import org.json.JSONObject

/**
 * Logs a finished padel match to Health Connect as an exercise session.
 * Write-only and best-effort: every failure path resolves `false` rather than
 * throwing into the app — logging a workout must never break the score tracker.
 *
 * Health Connect has no padel exercise type (checked through connect-client
 * 1.2.0-alpha), so matches are saved as EXERCISE_TYPE_TENNIS titled "Padel".
 */
class HealthLogModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  private val writePermissions = setOf(
    HealthPermission.getWritePermission(ExerciseSessionRecord::class),
    HealthPermission.getWritePermission(HeartRateRecord::class),
    HealthPermission.getWritePermission(TotalCaloriesBurnedRecord::class),
  )
  private val permissionContract = PermissionController.createRequestPermissionResultContract()
  private var pendingPermission: CompletableDeferred<Boolean>? = null

  private fun client(): HealthConnectClient? {
    val ctx = context ?: return null
    return runCatching {
      if (HealthConnectClient.getSdkStatus(ctx) == HealthConnectClient.SDK_AVAILABLE) {
        HealthConnectClient.getOrCreate(ctx)
      } else {
        null
      }
    }.getOrNull()
  }

  private suspend fun ensurePermission(client: HealthConnectClient): Boolean {
    val granted = runCatching {
      client.permissionController.getGrantedPermissions()
    }.getOrDefault(emptySet())
    if (granted.containsAll(writePermissions)) {
      return true
    }
    // Drive the permission contract manually — an Expo module has no
    // ActivityResultCaller, but the contract's createIntent/parseResult are public.
    val activity = appContext.currentActivity ?: return false
    val deferred = CompletableDeferred<Boolean>()
    pendingPermission = deferred
    runCatching {
      activity.startActivityForResult(
        permissionContract.createIntent(activity, writePermissions),
        PERMISSION_REQUEST_CODE,
      )
    }.onFailure {
      pendingPermission = null
      return false
    }
    deferred.await()
    // Don't trust the parsed result alone — re-check what's actually granted.
    return runCatching {
      client.permissionController.getGrantedPermissions().containsAll(writePermissions)
    }.getOrDefault(false)
  }

  override fun definition() = ModuleDefinition {
    Name("HealthLog")

    Function("isAvailable") {
      val ctx = context ?: return@Function false
      runCatching {
        HealthConnectClient.getSdkStatus(ctx) == HealthConnectClient.SDK_AVAILABLE
      }.getOrDefault(false)
    }

    AsyncFunction("logWorkout") Coroutine { startMs: Double, endMs: Double ->
      val client = client() ?: return@Coroutine false
      if (!ensurePermission(client)) {
        return@Coroutine false
      }
      val start = Instant.ofEpochMilli(startMs.toLong())
      val end = Instant.ofEpochMilli(endMs.toLong())
      val zone = ZoneId.systemDefault()
      runCatching {
        val session = ExerciseSessionRecord(
          startTime = start,
          startZoneOffset = zone.rules.getOffset(start),
          endTime = end,
          endZoneOffset = zone.rules.getOffset(end),
          // Deterministic id: re-logging the same match upserts, never duplicates.
          metadata = Metadata.manualEntry(clientRecordId = "holy-padel-${startMs.toLong()}"),
          exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_TENNIS,
          title = "Padel",
        )
        client.insertRecords(listOf(session))
        true
      }.getOrDefault(false)
    }

    // Rich variant fed by the watch's Health Services summary: session + heart
    // rate series + calories, marked as actively recorded on a watch. Shares the
    // deterministic clientRecordId with the manual path but a HIGHER version, so
    // watch data replaces a bare manual log and never duplicates it.
    AsyncFunction("logWatchWorkout") Coroutine { json: String ->
      val client = client() ?: return@Coroutine false
      if (!ensurePermission(client)) {
        return@Coroutine false
      }
      runCatching {
        val summary = JSONObject(json)
        val startMs = summary.getLong("startedAt")
        val endMs = summary.getLong("endedAt")
        if (endMs <= startMs) return@runCatching false
        val start = Instant.ofEpochMilli(startMs)
        val end = Instant.ofEpochMilli(endMs)
        val zone = ZoneId.systemDefault()
        val startOffset = zone.rules.getOffset(start)
        val endOffset = zone.rules.getOffset(end)
        val recordId = "holy-padel-$startMs"
        fun watchMetadata(suffix: String) = Metadata.activelyRecordedWithId(
          clientRecordId = "$recordId$suffix",
          clientRecordVersion = 1,
          device = Device(type = Device.TYPE_WATCH),
        )

        val records = mutableListOf<Record>(
          ExerciseSessionRecord(
            startTime = start,
            startZoneOffset = startOffset,
            endTime = end,
            endZoneOffset = endOffset,
            metadata = watchMetadata(""),
            exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_TENNIS,
            title = "Padel",
          ),
        )

        val samplesJson = summary.optJSONArray("samples")
        if (samplesJson != null && samplesJson.length() > 0) {
          val samples = (0 until samplesJson.length()).mapNotNull { index ->
            val sample = samplesJson.optJSONObject(index) ?: return@mapNotNull null
            val at = Instant.ofEpochMilli(sample.getLong("t"))
            if (at.isBefore(start) || at.isAfter(end)) return@mapNotNull null
            HeartRateRecord.Sample(time = at, beatsPerMinute = sample.getLong("bpm"))
          }
          if (samples.isNotEmpty()) {
            records.add(
              HeartRateRecord(
                startTime = start,
                startZoneOffset = startOffset,
                endTime = end,
                endZoneOffset = endOffset,
                samples = samples,
                metadata = watchMetadata("-hr"),
              ),
            )
          }
        }

        val kcal = summary.optDouble("kcal", 0.0)
        if (kcal > 0.0) {
          records.add(
            TotalCaloriesBurnedRecord(
              startTime = start,
              startZoneOffset = startOffset,
              endTime = end,
              endZoneOffset = endOffset,
              energy = Energy.kilocalories(kcal),
              metadata = watchMetadata("-kcal"),
            ),
          )
        }

        client.insertRecords(records)
        true
      }.getOrDefault(false)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == PERMISSION_REQUEST_CODE) {
        pendingPermission?.complete(payload.resultCode == android.app.Activity.RESULT_OK)
        pendingPermission = null
      }
    }
  }

  private companion object {
    const val PERMISSION_REQUEST_CODE = 53_281
  }
}
