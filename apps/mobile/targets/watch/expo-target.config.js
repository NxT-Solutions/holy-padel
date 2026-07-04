/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: "watch",
  name: "HolyPadelWatch",
  displayName: "Holy Padel",
  // Leading dot appends to the phone app's bundle id -> com.holypadel.app.watchkitapp,
  // the nesting Apple expects for a paired watch app.
  bundleIdentifier: ".watchkitapp",
  deploymentTarget: "11.0",
  icon: "../../assets/images/icon.png",
  // WatchConnectivity carries the phone<->watch match sync (see docs/watch-sync.md).
  frameworks: ["WatchConnectivity"],
  // $accent drives the system tint; matches the design's lime.
  colors: { $accent: "#C6F135" },
});
