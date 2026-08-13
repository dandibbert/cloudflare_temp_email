import { test, expect, type APIRequestContext } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };
const DEFAULT_SETTINGS = {
  blockList: [],
  sendBlockList: [],
  verifiedAddressList: [],
  fromBlockList: [],
  noLimitSendAddressList: [],
  emailRuleSettings: {},
  addressCreationSettings: {},
};

const saveSettings = async (request: APIRequestContext, overrides = {}) => {
  const response = await request.post(`${WORKER_URL}/admin/account_settings`, {
    headers: ADMIN_HEADERS,
    data: { ...DEFAULT_SETTINGS, ...overrides },
  });
  expect(response.ok()).toBe(true);
};

const receiveMail = async (
  request: APIRequestContext,
  to: string,
  { from = 'sender@test.example.com', subject = 'Hello', text = 'Normal body', html = '' } = {},
) => {
  const boundary = `reject-${Date.now()}-${Math.random()}`;
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: <${boundary}@test>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html || `<p>${text}</p>`,
    `--${boundary}--`,
  ].join('\r\n');
  const response = await request.post(`${WORKER_URL}/admin/test/receive_mail`, {
    data: { from, to, raw },
  });
  expect(response.ok()).toBe(true);
  return response.json();
};

test.describe('Inbound mail rejection rules', () => {
  test.afterEach(async ({ request }) => saveSettings(request));

  test('rejects subject, plain-text, and visible HTML keyword matches', async ({ request }) => {
    const address = await createTestAddress(request, 'content-block');
    try {
      await saveSettings(request, {
        emailRuleSettings: { contentBlockList: ['casino', '限时优惠', 'crypto giveaway'] },
      });

      expect((await receiveMail(request, address.address, { subject: 'CASINO promotion' })).rejected)
        .toBe('Blocked mail content');
      expect((await receiveMail(request, address.address, { text: '领取限时优惠' })).rejected)
        .toBe('Blocked mail content');
      expect((await receiveMail(request, address.address, {
        html: '<p>Crypto&nbsp;<strong>giveaway</strong></p>',
      })).rejected).toBe('Blocked mail content');
      expect((await receiveMail(request, address.address, { text: 'A normal receipt' })).success)
        .toBe(true);
    } finally {
      await deleteAddress(request, address.jwt);
    }
  });

  test('normalizes sender rules and clears the persisted KV list', async ({ request }) => {
    const address = await createTestAddress(request, 'sender-block');
    try {
      await saveSettings(request, { fromBlockList: [' Example.COM ', '', 'example.com'] });
      expect((await receiveMail(request, address.address, { from: 'User@NEWS.EXAMPLE.COM' })).rejected)
        .toBe('Sender blocked');

      await saveSettings(request, { fromBlockList: [] });
      const readBack = await request.get(`${WORKER_URL}/admin/account_settings`, { headers: ADMIN_HEADERS });
      expect((await readBack.json()).fromBlockList).toEqual([]);
      expect((await receiveMail(request, address.address, { from: 'User@NEWS.EXAMPLE.COM' })).success)
        .toBe(true);
    } finally {
      await deleteAddress(request, address.jwt);
    }
  });

  test('rejects an unknown recipient when strict address checking is enabled', async ({ request }) => {
    await saveSettings(request, {
      emailRuleSettings: { blockReceiveUnknowAddressEmail: true },
    });
    const body = await receiveMail(request, `missing-${Date.now()}@test.example.com`);
    expect(body.rejected).toBe('Unknown address');
    expect(body.forwardedTo).toEqual([]);
    expect(body.replyCalled).toBe(false);
  });

  test('rejects invalid content rule payloads', async ({ request }) => {
    const response = await request.post(`${WORKER_URL}/admin/account_settings`, {
      headers: ADMIN_HEADERS,
      data: {
        ...DEFAULT_SETTINGS,
        emailRuleSettings: { contentBlockList: [''] },
      },
    });
    expect(response.status()).toBe(400);
  });
});
