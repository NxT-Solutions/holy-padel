package expo.modules.watchbridge

import android.content.Context
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Phone side of the Wear OS sync. Publishes the match-state JSON as a Data Layer
 * item at /holy-padel/state and forwards the watch's score/undo/start intents
 * back to JS as `onIntent` events. See docs/watch-sync.md.
 */
class WatchBridgeModule : Module(), MessageClient.OnMessageReceivedListener {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val dataClient by lazy { Wearable.getDataClient(context) }
  private val messageClient by lazy { Wearable.getMessageClient(context) }

  override fun definition() = ModuleDefinition {
    Name("WatchBridge")

    Events("onIntent")

    OnCreate {
      messageClient.addListener(this@WatchBridgeModule)
    }

    OnDestroy {
      messageClient.removeListener(this@WatchBridgeModule)
    }

    Function("pushState") { json: String ->
      val request = PutDataMapRequest.create(STATE_PATH).apply {
        dataMap.putString(STATE_KEY, json)
        // Bump so an identical-looking payload still propagates as a change.
        dataMap.putLong("ts", System.currentTimeMillis())
      }
      dataClient.putDataItem(request.asPutDataRequest().setUrgent())
    }
  }

  override fun onMessageReceived(event: MessageEvent) {
    sendEvent(
      "onIntent",
      mapOf(
        "path" to event.path,
        "body" to String(event.data, Charsets.UTF_8),
      ),
    )
  }

  private companion object {
    const val STATE_PATH = "/holy-padel/state"
    const val STATE_KEY = "json"
  }
}
