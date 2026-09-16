const { defineConfig } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Explicit registry keeps each spec discoverable by name; the directory read
// keeps new *_browser.spec.js files from silently falling out of CI. Written as
// a computed union so that adding a spec is a one-line change that does not
// collide with concurrent work on the same config.
const explicitBrowserSpecs = ['browser_smoke.spec.js', 'conflict_browser.spec.js', 'router_browser.spec.js', 'body_coach_browser.spec.js', 'body_recovery_browser.spec.js', 'body_equipment_station_browser.spec.js', 'conditioning_coach_browser.spec.js', 'conditioning_blueprint_browser.spec.js', 'saved_sessions_browser.spec.js', 'v15_release_gate_browser.spec.js', 'template_search_browser.spec.js', 'recent_actions_browser.spec.js', 'prep_grade_visibility_browser.spec.js', 'issue71_live_audit_browser.spec.js', 'issue73_prep_responsive_browser.spec.js', 'issue79_auxiliary_browser.spec.js', 'issue80_recovery_browser.spec.js', 'favorites_browser.spec.js', 'content_review_browser.spec.js'];

module.exports = defineConfig({
  testDir: './tests',
  testMatch: [...new Set([...explicitBrowserSpecs, ...fs.readdirSync(path.join(__dirname, 'tests')).filter(f => f.endsWith('_browser.spec.js'))])].sort(),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory _site',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
