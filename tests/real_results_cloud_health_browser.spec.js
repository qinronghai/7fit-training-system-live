const { test, expect } = require('@playwright/test');

test('real results cloud backend is reachable', async ({ request }) => {
  const health = await request.get('https://ynsodlyanpmixbbxblqh.supabase.co/functions/v1/case-api?action=health');
  expect(health.ok()).toBeTruthy();
  const body = await health.json();
  expect(body.ok).toBe(true);
  expect(body.database).toBe('ok');

  const list = await request.get('https://ynsodlyanpmixbbxblqh.supabase.co/functions/v1/case-api?action=list');
  expect(list.ok()).toBeTruthy();
  const listBody = await list.json();
  expect(Array.isArray(listBody.cases)).toBe(true);
});
