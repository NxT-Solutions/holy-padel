package expo.modules.livenotification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

/**
 * Receives the notification's buttons (+ team, undo, resume) and hands them to
 * JS, which applies them exactly like a watch intent. With no live module the
 * app's JS is gone, so the notification is stale — clear it rather than leave
 * buttons that do nothing; opening the app brings it back.
 */
class LiveNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.getStringExtra(LiveNotificationModule.EXTRA_ACTION) ?: return
    val module = LiveNotificationModule.active
    if (module == null) {
      NotificationManagerCompat.from(context).cancel(LiveNotificationModule.NOTIFICATION_ID)
      return
    }
    module.emitAction(action)
  }
}
