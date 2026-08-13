import assert from "node:assert/strict";
import test from "node:test";

import {
    normalizeEmailRuleSettings,
} from "./content_block.ts";

test("normalizes legacy empty settings to receive-rule defaults", () => {
    assert.deepEqual(normalizeEmailRuleSettings({}), {
        blockReceiveUnknowAddressEmail: false,
        contentBlockList: [],
        emailForwardingList: [],
    });
});

test("preserves existing forwarding rules while adding content keywords", () => {
    const forwardingRule = {
        domains: ["example.com"],
        forward: "archive@example.net",
        sourcePatterns: ["billing"],
        sourceMatchMode: "any",
    };
    assert.deepEqual(normalizeEmailRuleSettings({
        blockReceiveUnknowAddressEmail: true,
        contentBlockList: [" Casino ", "CASINO"],
        emailForwardingList: [forwardingRule],
    }), {
        blockReceiveUnknowAddressEmail: true,
        contentBlockList: ["casino"],
        emailForwardingList: [forwardingRule],
    });
});

test("rejects malformed or oversized content rule settings", () => {
    assert.equal(normalizeEmailRuleSettings({ contentBlockList: "casino" }), null);
    assert.equal(normalizeEmailRuleSettings({ contentBlockList: [""] }), null);
    assert.equal(normalizeEmailRuleSettings({ contentBlockList: ["x".repeat(201)] }), null);
    assert.equal(normalizeEmailRuleSettings({ contentBlockList: Array(201).fill("x") }), null);
});
