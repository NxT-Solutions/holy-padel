const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

/**
 * Health Connect manifest wiring that app.json has no keys for:
 * - the permission-rationale intent filter on MainActivity (Android ≤ 13),
 * - the ViewPermissionUsageActivity alias (Android 14+),
 * - the <queries> entry for the Health Connect APK (Android ≤ 13).
 * The WRITE_EXERCISE permission itself is declared in app.json android.permissions.
 */
function withHealthConnect(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);

    // <queries><package android:name="com.google.android.apps.healthdata"/></queries>
    const queries = manifest.queries ?? [];
    queries.push({
      package: [{ $: { "android:name": "com.google.android.apps.healthdata" } }],
    });
    manifest.queries = queries;

    // Rationale intent filter (Health Connect APK, Android ≤ 13).
    const filters = mainActivity["intent-filter"] ?? [];
    filters.push({
      action: [{ $: { "android:name": "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" } }],
    });
    mainActivity["intent-filter"] = filters;

    // Permission-usage alias (platform Health Connect, Android 14+).
    const aliases = application["activity-alias"] ?? [];
    aliases.push({
      $: {
        "android:name": "ViewPermissionUsageActivity",
        "android:exported": "true",
        "android:targetActivity": ".MainActivity",
        "android:permission": "android.permission.START_VIEW_PERMISSION_USAGE",
      },
      "intent-filter": [
        {
          action: [{ $: { "android:name": "android.intent.action.VIEW_PERMISSION_USAGE" } }],
          category: [{ $: { "android:name": "android.intent.category.HEALTH_PERMISSIONS" } }],
        },
      ],
    });
    application["activity-alias"] = aliases;

    return mod;
  });
}

module.exports = withHealthConnect;
