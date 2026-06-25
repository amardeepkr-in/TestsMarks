/**
 * @deprecated This file is deprecated. Please import from specific modules:
 * - lib/actions/admin-auth.ts
 * - lib/actions/admin-management.ts
 * - lib/actions/submissions.ts
 * - lib/actions/settings.ts
 * - lib/actions/file-upload.ts
 * - lib/actions/password-reset.ts
 * - lib/actions/export-import.ts
 *
 * This file now re-exports from the modular action files for backward compatibility.
 */

// Re-export all actions from modular files for backward compatibility
export {
  loginAdminUser,
  logoutAdminUser,
  changeAdminPassword,
  getAdminUsers,
} from './admin-auth';

export { createAdminUser, deleteAdminUser } from './admin-management';

export {
  getSubmissions,
  getSubmissionsPaginated,
  searchSubmissions,
  getSubmissionCount,
  getSubmissionStats,
  createSubmission,
  updateSubmissionFull,
  updateSubmission,
  deleteSubmission,
} from './submissions';

export { getSettings, updateSetting } from './settings';

export { processFileUpload, deleteFile, cleanupAllUploadedFiles } from './file-upload';

export { requestPasswordReset, resetPassword } from './password-reset';

export { exportSubmissionsCSV, wipeDatabase } from './export-import';

// Also re-export student actions
export {
  generateAccessCode,
  studentLogin,
  studentLogout,
  getStudentSession,
  getStudentSubmissions,
  requestAccessCode,
  bulkGenerateAccessCodes,
  revokeStudentAccess,
  getStudentAccessStats,
} from './student';
