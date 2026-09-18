import assert from "node:assert/strict";
import test from "node:test";

import {
    findBlockedContentKeyword,
    normalizeContentBlockList,
} from "./content_block.ts";

test("normalizes content keywords and removes empty duplicates", () => {
    assert.deepEqual(
        normalizeContentBlockList(["  Casino ", "", "CASINO", "限时 优惠"]),
        ["casino", "限时 优惠"],
    );
});

test("matches a keyword in the decoded subject case-insensitively", () => {
    assert.equal(
        findBlockedContentKeyword({ subject: "LIMITED Casino offer", text: "", html: "" }, ["casino"]),
        "casino",
    );
});

test("matches a keyword in plain text content", () => {
    assert.equal(
        findBlockedContentKeyword({ subject: "Hello", text: "领取限时优惠", html: "" }, ["限时优惠"]),
        "限时优惠",
    );
});

test("matches visible HTML text across tags and decoded entities", () => {
    assert.equal(
        findBlockedContentKeyword({
            subject: "Hello",
            text: "",
            html: "<p>Crypto&nbsp;<strong>giveaway</strong></p>",
        }, ["crypto giveaway"]),
        "crypto giveaway",
    );
});

test("matches visible text split by inline HTML tags", () => {
    assert.equal(
        findBlockedContentKeyword({
            subject: "Hello",
            text: "",
            html: "<p>限时<strong>优惠</strong></p>",
        }, ["限时优惠"]),
        "限时优惠",
    );
});

test("does not create a match across separate subject and body fields", () => {
    assert.equal(
        findBlockedContentKeyword({
            subject: "crypto",
            text: "giveaway",
            html: "",
        }, ["crypto giveaway"]),
        null,
    );
});

test("does not match script or style contents", () => {
    assert.equal(
        findBlockedContentKeyword({
            subject: "Hello",
            text: "normal message",
            html: "<style>.casino{color:red}</style><script>casino()</script><p>Welcome</p>",
        }, ["casino"]),
        null,
    );
});

test("returns null when no content keyword matches", () => {
    assert.equal(
        findBlockedContentKeyword({ subject: "Receipt", text: "Thanks", html: "" }, ["casino"]),
        null,
    );
});
