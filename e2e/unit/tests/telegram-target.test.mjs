import assert from "node:assert/strict";
import test from "node:test";

import {
  isTelegramButtonTypeInvalidError,
  supportsTelegramWebAppButton,
} from "../../../worker/src/telegram_api/target.ts";

test("web_app buttons are only enabled for positive private chat IDs", () => {
  assert.equal(supportsTelegramWebAppButton("256560990"), true);
  assert.equal(supportsTelegramWebAppButton(" 256560990 "), true);
  assert.equal(supportsTelegramWebAppButton("-1003771119521"), false);
  assert.equal(supportsTelegramWebAppButton("-123456"), false);
  assert.equal(supportsTelegramWebAppButton("@examplechannel"), false);
  assert.equal(supportsTelegramWebAppButton("0"), false);
});

test("detects Telegram BUTTON_TYPE_INVALID errors for safe fallback", () => {
  assert.equal(isTelegramButtonTypeInvalidError(new Error("400: Bad Request: BUTTON_TYPE_INVALID")), true);
  assert.equal(isTelegramButtonTypeInvalidError({ response: { description: "Bad Request: BUTTON_TYPE_INVALID" } }), true);
  assert.equal(isTelegramButtonTypeInvalidError(new Error("Forbidden: bot was blocked by the user")), false);
});
