import { router } from "expo-router";

/**
 * Land on the home tab no matter how the current screen was reached.
 * A plain dismissAll throws POP_TO_TOP when the screen is the only route
 * on the stack (deep link, page reload, or a replace from the setup modal).
 */
export function goHome(): void {
  if (router.canDismiss()) {
    router.dismissAll();
  } else {
    router.replace("/");
  }
}

/** Back when there is history, otherwise home — never an unhandled POP. */
export function goBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}
