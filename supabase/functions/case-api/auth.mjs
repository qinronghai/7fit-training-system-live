// Compatibility surface for existing Case Admin imports and auth contract tests.
export {
  sha256Hex,
  constantTimeEqual,
  createOpaqueToken,
  hashSessionToken,
  extractBearerToken,
  pinMatches,
  createSessionRecord,
  isSessionActive,
  createStaffAuthService,
  createAdminAuthService,
} from '../_shared/staff-auth.mjs';
