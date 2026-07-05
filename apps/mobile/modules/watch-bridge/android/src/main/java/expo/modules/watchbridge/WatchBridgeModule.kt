package expo.modules.watchbridge

import android.content.Context
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Phone side of the Wear OS sync. Publishes the match-state JSON as a Data Layer
 * item at /holy-padel/state and forwards the watch's score/undo/start intents
 * back to JS as `onIntent` events. See docs/watch-sync.md.
 *
 * Every Wearable interaction is best-effort: on a device without Wear OS / Google
 * Play services (e.g. a bare emulator) the calls simply no-op. The watch bridge
 * must never crash the phone app — the phone is the source of truth.
 */
class WatchBridgeModule : Module(), MessageClient.OnMessageReceivedListener {
  private val context: Context?
    get() = appContext.reactContext

  private fun messageClient(): MessageClient? =
    context?.let { runCatching { Wearable.getMessageClient(it) }.getOrNull() }

  override fun definition() = ModuleDefinition {
    Name("WatchBridge")

    Events("onIntent")

    OnCreate {
      runCatching { messageClient()?.addListener(this@WatchBridgeModule) }
    }

    OnDestroy {
      runCatching { messageClient()?.removeListener(this@WatchBridgeModule) }
    }

    Function("pushState") { json: String ->
      val ctx = context ?: return@Function
      runCatching {
        val request = PutDataMapRequest.create(STATE_PATH).apply {
          dataMap.putString(STATE_KEY, json)
          // Bump so an identical-looking payload still propagates as a change.
          dataMap.putLong("ts", System.currentTimeMillis())
        }
        Wearable.getDataClient(ctx).putDataItem(request.asPutDataRequest().setUrgent())
      }
    }
  }

  override fun onMessageReceived(event: MessageEvent) {
    runCatching {
      sendEvent(
        "onIntent",
        mapOf(
          "path" to event.path,
          "body" to String(event.data, Charsets.UTF_8),
        ),
      )
    }
  }

  private companion object {
    const val STATE_PATH = "/holy-padel/state"
    const val STATE_KEY = "json"
  }
}
