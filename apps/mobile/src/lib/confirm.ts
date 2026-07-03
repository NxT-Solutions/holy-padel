import { Alert, Platform } from "react-native";

/**
 * Cross-platform destructive confirmation: native alert on iOS/Android,
 * window.confirm on web (react-native-web's Alert is a no-op).
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
}): void {
  if (Platform.OS === "web") {
    // biome-ignore lint/suspicious/noAlert: react-native-web's Alert is a no-op; confirm is the web fallback
    if (globalThis.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
