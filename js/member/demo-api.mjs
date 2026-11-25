import { createMemberApi } from './demo-runtime/service.mjs';
import { createDemoMembers, createDemoRepository } from './demo-repository.mjs';

const STORAGE_KEY = '7fit_member_demo_v1';

function readDemoState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(saved?.members) && Array.isArray(saved.sessions)) return saved;
  } catch (_) {
    // The preview remains usable when browser storage is unavailable.
  }
  return { members: createDemoMembers(), sessions: [] };
}

const { repository, snapshot } = createDemoRepository(readDemoState());
const handleDemoRequest = createMemberApi({ auth: { verify: () => ({ ok: true }) }, repository });

export async function requestDemo(url, options) {
  const request = new Request(url, options);
  const response = await handleDemoRequest(request);
  if (request.method === 'POST' && response.ok) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
    } catch (_) {
      // The changes remain available in this document.
    }
  }
  return response;
}
