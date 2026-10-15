import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Height of the on-screen keyboard while it's open, else 0. Android 15+ draws
 * apps edge to edge, so the window no longer shrinks for the keyboard — a
 * bottom sheet holding a text field must lift itself by this much or its
 * input and buttons sit hidden underneath the keyboard.
 */
export function useKeyboardInset(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    // iOS fires the "will" events in step with the keyboard animation;
    // Android only reliably fires the "did" pair.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const shown = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hidden = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });
    return (): void => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}
