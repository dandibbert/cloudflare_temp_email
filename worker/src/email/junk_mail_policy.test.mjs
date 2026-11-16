import assert from "node:assert/strict";
import test from "node:test";

import { isJunkMailByHeaders } from "./junk_mail_policy.ts";

const authenticationResultsHeader = (results) => [{
    key: "Authentication-Results",
    value: `mx.cloudflare.net; ${results}`,
}];

test("issue #1084: dmarc=none does not reject an otherwise passing message", () => {
    const headers = authenticationResultsHeader(
        "spf=pass smtp.mailfrom=sender.example; " +
        "dkim=pass header.d=sender.example; " +
        "dmarc=none; arc=pass"
    );

    assert.equal(
        isJunkMailByHeaders(
            headers,
            ["spf", "dkim", "dmarc"],
            ["spf"],
        ),
        false,
    );
});

for (const [method, result] of [
    ["spf", "none"],
    ["spf", "neutral"],
    ["dkim", "none"],
    ["dkim", "neutral"],
    ["dmarc", "none"],
    ["dmarc", "neutral"],
]) {
    test(`${method}=${result} is absent for JUNK_MAIL_CHECK_LIST`, () => {
        assert.equal(
            isJunkMailByHeaders(
                authenticationResultsHeader(`${method}=${result}`),
                [method],
                [],
            ),
            false,
        );
    });
}

for (const method of ["spf", "dkim", "dmarc"]) {
    test(`${method}=fail is junk when the method is checked`, () => {
        assert.equal(
            isJunkMailByHeaders(
                authenticationResultsHeader(`${method}=fail`),
                [method],
                [],
            ),
            true,
        );
    });
}

test("JUNK_MAIL_FORCE_PASS_LIST requires an explicit pass result", () => {
    for (const result of ["none", "neutral", "fail"]) {
        assert.equal(
            isJunkMailByHeaders(
                authenticationResultsHeader(`spf=${result}`),
                [],
                ["spf"],
            ),
            true,
        );
    }

    assert.equal(
        isJunkMailByHeaders(
            authenticationResultsHeader("spf=pass"),
            [],
            ["spf"],
        ),
        false,
    );
});

test("ignores forged authentication results from an untrusted authserv-id", () => {
    const headers = [
        ...authenticationResultsHeader("spf=fail smtp.mailfrom=sender.example"),
        {
            key: "Authentication-Results",
            value: "attacker.example; spf=pass smtp.mailfrom=sender.example",
        },
    ];

    assert.equal(
        isJunkMailByHeaders(headers, ["spf"], ["spf"]),
        true,
    );
});

test("only uses the first trusted authentication-results header", () => {
    const headers = [
        ...authenticationResultsHeader("spf=fail smtp.mailfrom=sender.example"),
        ...authenticationResultsHeader("spf=pass smtp.mailfrom=sender.example"),
    ];

    assert.equal(
        isJunkMailByHeaders(headers, ["spf"], []),
        true,
    );
});

test("does not let received-spf override trusted authentication-results", () => {
    const headers = [
        {
            key: "Received-SPF",
            value: "pass receiver=mx.cloudflare.net; client-ip=192.0.2.1",
        },
        ...authenticationResultsHeader("spf=fail smtp.mailfrom=sender.example"),
    ];

    assert.equal(
        isJunkMailByHeaders(headers, ["spf"], []),
        true,
    );
});

test("falls back to a trusted received-spf when authentication-results is absent", () => {
    const headers = [{
        key: "Received-SPF",
        value: "pass receiver=mx.cloudflare.net; client-ip=192.0.2.1",
    }];

    assert.equal(
        isJunkMailByHeaders(headers, [], ["spf"]),
        false,
    );
});

test("supports an explicitly configured trusted authserv-id", () => {
    const headers = [{
        key: "Authentication-Results",
        value: "mail-gateway.example; spf=pass smtp.mailfrom=sender.example",
    }];

    assert.equal(
        isJunkMailByHeaders(headers, [], ["spf"], ["mail-gateway.example"]),
        false,
    );
});
