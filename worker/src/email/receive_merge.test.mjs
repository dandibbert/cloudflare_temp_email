import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

const source = stripTypeScriptTypes(readFileSync(new URL('./index.ts', import.meta.url), 'utf8'))
    .replace(/^import .*;\s*$/gm, '').replace(/export \{ email \}/, '');

function harness({ rejectTarget = false, failTargetStore = false, failRules = false, blockContent = false } = {}) {
    const events = [], rejected = [];
    let nextId = 0;
    const names = ['normalizeAddressDomain', 'isBlocked', 'getEmailRuleSettingsForReceive',
        'check_if_junk_mail', 'commonParseMail', 'findBlockedContentKeyword', 'remove_attachment_if_need',
        'storeRawMail', 'forwardEmail', 'extractEmailInfo', 'sendMailToTelegram', 'triggerWebhook',
        'triggerAnotherWorker', 'auto_reply', 'deleteRawMail', 'console'];
    const values = [s => s, async () => false,
        async () => { if (failRules) throw new Error('settings unavailable'); return { blockReceiveUnknowAddressEmail: true, contentBlockList: blockContent ? ['blocked'] : [] }; },
        async () => false, async () => ({ text: 'hello' }), () => blockContent ? 'blocked' : null, async () => {},
        async (_env, _from, to) => { if (failTargetStore && to === 'b@example.com') throw new Error('storage unavailable'); const id = ++nextId; events.push(['store', to, id]); return { success: true, meta: { last_row_id: id } }; },
        async (_message, _env, _raw, deliver) => { events.push(['forward']); let stored = false; await deliver(message('b@example.com'), () => { stored = true; }); return { deleteOriginal: stored }; },
        async (_parsed, _env, id, to) => { events.push(['extract', to, id]); return {}; },
        async (_ctx, to, _parsed, id) => events.push(['telegram', to, id]),
        async () => {}, async () => {}, async (_message, _env, to) => events.push(['reply', to]),
        async (_env, id, to) => events.push(['delete', to, id]), { log() {}, error() {} }];
    const receive = new Function(...names, `${source}; return email;`)(...values);
    function message(to) { return { to, from: 'sender@example.net', raw: 'mail', rawSize: 4, headers: new Headers({ 'Message-ID': '<same-id>' }), setReject: reason => rejected.push([to, reason]) }; }
    const env = { DB: { prepare: () => ({ bind: to => ({ first: async () => rejectTarget && to === 'b@example.com' ? null : 1 }) }) } };
    return { run: () => receive(message('a@example.com'), env, {}), events, rejected };
}

test('merged receiver preserves independent row IDs and one-hop forwarding', async () => {
    const h = harness(); await h.run();
    assert.deepEqual(h.events.filter(e => e[0] === 'forward'), [['forward']]);
    assert.deepEqual(h.events.filter(e => e[0] === 'telegram'), [['telegram', 'b@example.com', 2], ['telegram', 'a@example.com', 1]]);
    assert.deepEqual(h.events.filter(e => e[0] === 'reply'), [['reply', 'a@example.com']]);
    assert.deepEqual(h.events.at(-1), ['delete', 'a@example.com', 1]);
});
for (const scenario of ['rejectTarget', 'failTargetStore']) test(`${scenario} preserves original and stops target processing`, async () => {
    const h = harness({ [scenario]: true }); await h.run();
    assert.equal(h.events.some(e => e[0] === 'delete'), false);
    assert.equal(h.events.some(e => e[0] === 'telegram' && e[1] === 'b@example.com'), false);
    assert.equal(h.rejected.length, 1);
});
for (const scenario of ['failRules', 'blockContent']) test(`${scenario} preserves fork fail-closed rejection`, async () => {
    const h = harness({ [scenario]: true }); await h.run();
    assert.deepEqual(h.events, []); assert.equal(h.rejected.length, 1);
});
