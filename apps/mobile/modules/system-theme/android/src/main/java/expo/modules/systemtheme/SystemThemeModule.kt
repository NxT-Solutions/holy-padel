package expo.modules.systemtheme

import android.content.res.Configuration
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the CURRENT night mode from the activity's resources.
 *
 * RN's Appearance reads the application context, whose configuration Android
 * can leave pinned to light — while the activity's own resources follow the
 * system (MainActivity sets MODE_NIGHT_FOLLOW_SYSTEM). Reading here gives the
 * truth the JS side can't reach.
 */
class SystemThemeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SystemTheme")

    Function("isDarkMode") {
      val resources = appContext?.currentActivity?.resources
        ?: appContext?.reactContext?.resources
        ?: return@Function false
      val mask = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
      return@Function mask == Configuration.UI_MODE_NIGHT_YES
    }
  }
}
