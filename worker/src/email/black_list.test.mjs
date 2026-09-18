import assert from "node:assert/strict";
import test from "node:test";

import {
    isSenderBlockedByRules,
    normalizeBlockList,
} from "./sender_block_policy.ts";

test("normalizes sender block rules and removes empty duplicates", () => {
    assert.deepEqual(
        normalizeBlockList([" Example.COM ", "", "example.com", "  SPAM  "]),
        ["example.com", "spam"],
    );
});

test("matches sender rules case-insensitively", () => {
    assert.equal(
        isSenderBlockedByRules("User@NEWS.Example.COM", ["example.com"]),
        true,
    );
});

test("matches exact mailbox rules without suffix false positives", () => {
    assert.equal(isSenderBlockedByRules("user@example.com", ["user@example.com"]), true);
    assert.equal(isSenderBlockedByRules("otheruser@example.com", ["user@example.com"]), false);
});

test("matches domain rules at label boundaries", () => {
    assert.equal(isSenderBlockedByRules("user@example.com", ["example.com"]), true);
    assert.equal(isSenderBlockedByRules("user@news.example.com", ["example.com"]), true);
    assert.equal(isSenderBlockedByRules("user@evilexample.com", ["example.com"]), false);
});

test("ignores empty rules instead of rejecting every sender", () => {
    assert.equal(isSenderBlockedByRules("innocent@example.net", ["", "   "]), false);
});

test("keeps ordinary non-domain values as sender keywords", () => {
    assert.equal(isSenderBlockedByRules("promo-spam@example.net", ["SPAM"]), true);
});
