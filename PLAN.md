# TestMarks Full Audit & Enhancement Plan

## Phase 0: Critical Security Fixes (P0)

### 0.1 Unified Authentication System
- [ ] Replace plaintext PIN cookie with cryptographically random session tokens
- [ ] Create `sessions` table (id, user_id, role, created_at, expires_at)
- [ ] Update `loginAdminUser` to create DB session, set session ID cookie
- [ ] Create `lib/auth.ts` with `getSession()`, `requireAuth()`, `requireAdmin()` helpers
- [ ] Update `app/admin/layout.tsx` to use new session system
- [ ] Update `app/page.tsx` admin check to use session
- [ ] Add session expiry (24h) and rotation on sensitive actions
- [ ] Implement logout (clear session from DB + cookie)

### 0.2 Fix Migration Schema Conflict
- [ ] Fix `002_add_new_tables.sql`: rename `filter_data` → `config` in `saved_filters` CREATE TABLE
- [ ] Create `005_add_rbac_to_admin_users.sql`: ALTER TABLE admin_users ADD COLUMN role + updated_at (moved from 003, which can't ALTER after 002 runs)
- [ ] Verify all 4 migrations run clean: `npm run build` triggers `runMigrations()`

### 0.3 Migrate 10 API Routes to Session Auth
Replace old `admin_session` cookie presence-check with `validateSession()` from `lib/auth.ts`:

- [ ] `app/api/filters/route.ts` — CRITICAL: replace inline `getAdminUser()` + `admin_sessions` table query with `validateSession()`
- [ ] `app/api/backup/route.ts` — GET + POST handlers
- [ ] `app/api/backup/[id]/route.ts` — DELETE handler
- [ ] `app/api/backup/[id]/download/route.ts` — GET handler
- [ ] `app/api/backup/[id]/restore/route.ts` — POST handler
- [ ] `app/api/import/route.ts` — POST handler
- [ ] `app/api/analytics/route.ts` — GET handler
- [ ] `app/api/export/excel/route.ts` — GET handler
- [ ] `app/api/export/pdf/route.ts` — GET handler
- [ ] `app/api/export/json/route.ts` — GET handler

Pattern: Remove `cookies()` import, remove `admin_session` check, add `const user = await requireAuth();` at top of handler, return 401 if null.

### 0.4 Fix Stale `adminUserId` Cookie in lib/actions.ts
- [ ] `logoutAdminUser()` line 129: replace `cookieStore.get('adminUserId')` with `user.id` from `requireAuth()`
- [ ] `createAdminUser()` line 244: replace `cookieStore.get('adminUserId')` with `user.id` from `requireAuth()`
- [ ] `deleteAdminUser()` line 281: replace `cookieStore.get('adminUserId')` with `user.id` from `requireAuth()`
- [ ] `updateSetting()` line 339: replace `cookieStore.get('adminUserId')` with `user.id` from `requireAuth()`

### 0.5 Wire Rate Limiting Into API Routes
- [ ] Import `apiRateLimit` from `@/lib/middleware/ratelimit` into each migrated API route
- [ ] Apply rate limit check at top of each handler before auth
- Routes: filters, backup/*, import, analytics, export/*, email/process, monitoring/*

### 0.6 Add Session Cleanup
- [ ] Add cleanup call in `lib/db.ts` after `runMigrations()`: delete expired rows from `sessions` table
- [ ] Alternative: create `app/api/cron/cleanup/route.ts` for manual/triggered cleanup

### 0.7 CSRF Protection (Deferred)
- [ ] Assess: `sameSite: 'lax'` + server action origin checks may be sufficient for this app
- [ ] If needed later: wire `lib/utils/csrf.ts` into forms

---

## Phase 1: Code Quality (P1)

### 1.1 Enforce RBAC Server-Side
- [ ] Wire `requirePermission(Permission.X)` into `lib/actions.ts` for admin CRUD operations (createAdminUser, deleteAdminUser, updateSetting)
- [ ] Add role checks to admin-only API routes (backup, import, filters)
- [ ] Note: `createSubmission()` is intentionally public (student-facing), no RBAC needed

### 1.2 Zod Schema Enforcement
- [ ] Replace manual validation in `createSubmission()` with `submissionSchema.parse()`
- [ ] Replace manual validation in `updateSubmissionFull()` with schema
- [ ] Add Zod validation to all API route request bodies
- [ ] Create validation middleware wrapper

### 1.3 Remove Dead Code
- [ ] Delete `generateQRCode()` stub in `lib/services/export.ts`
- [ ] Delete unused `getPasswordResetEmail()` in `lib/services/email.ts`
- [ ] Remove duplicate `Submission` interface from `lib/services/export.ts`

### 1.4 Consolidate Redis Clients
- [ ] Choose one Redis client (ioredis or @upstash/redis)
- [ ] Migrate rate limiter to use chosen client
- [ ] Migrate cache service to use chosen client
- [ ] Remove unused Redis dependency

### 1.5 Fix Base64 Password Storage
- [ ] Hash default admin password with bcrypt at seed time
- [ ] Remove base64 encoding from `lib/db.ts`

### 1.6 Move Type Packages
- [ ] Move `@types/nodemailer` and `@types/pdfkit` to devDependencies

---

## Phase 2: Testing (P2)

### 2.1 Test Infrastructure
- [ ] Install Vitest + React Testing Library
- [ ] Create `vitest.config.ts`
- [ ] Add test scripts to `package.json`
- [ ] Create `__tests__/` directory structure

### 2.2 Unit Tests
- [ ] Auth helpers: `getSession()`, `requireAuth()`, `requireAdmin()`
- [ ] Validation schemas: edge cases, boundary values
- [ ] RBAC service: permission checking, role assignment
- [ ] Rate limiter: window behavior, overflow

### 2.3 Integration Tests
- [ ] Server actions: CRUD operations with mocked DB
- [ ] File upload: size limits, type validation
- [ ] CSV/Excel import: parsing, validation
- [ ] Export services: CSV, Excel, PDF, JSON generation

### 2.4 E2E Tests (Optional)
- [ ] Admin login flow
- [ ] Student access flow
- [ ] Submission CRUD lifecycle

---

## Phase 3: CI/CD + Infrastructure (P2)

### 3.1 GitHub Actions
- [ ] Create `.github/workflows/ci.yml`
- [ ] Steps: install → lint → typecheck → test → build
- [ ] Run on push to main and PRs

### 3.2 Security Headers
- [ ] Add `Content-Security-Policy` to `next.config.ts`
- [ ] Add CORS configuration to API routes
- [ ] Verify all existing security headers

### 3.3 Documentation Fixes
- [ ] Update README.md version numbers to match package.json
- [ ] Remove unimplemented features from ARCHITECTURE.md
- [ ] Remove already-implemented steps from IMPLEMENTATION_GUIDE.md

---

## Phase 4: Performance (P2)

### 4.1 SQL-Based Statistics
- [ ] Replace `computeStats()` with SQL aggregation queries
- [ ] Add database indexes for frequently queried columns

### 4.2 Server-Side Pagination
- [ ] Add LIMIT/OFFSET to `getSubmissions()`
- [ ] Create pagination component with total count
- [ ] Update DataGrid to support server-side pagination

### 4.3 File Upload Streaming
- [ ] Replace `file.arrayBuffer()` with streaming write
- [ ] Add file size validation before full read

### 4.4 Backup Optimization
- [ ] Stream backup data instead of loading all into memory
- [ ] Add compression for large backups

---

## Phase 5: Missing Features (P3)

### 5.1 Student Email Storage
- [ ] Add `email` column to submissions table
- [ ] Update submission form to collect email
- [ ] Enable marks-update email notifications

### 5.2 Notifications System
- [ ] Build notification UI component
- [ ] Implement notification service
- [ ] Add notification preferences

### 5.3 Password Reset
- [ ] Implement password reset flow using existing email template
- [ ] Add reset token generation and validation
- [ ] Create reset password page

### 5.4 Automated Backups
- [ ] Create cron endpoint or Railway cron job
- [ ] Add backup retention policy
- [ ] Add backup restore testing

### 5.5 Student Session Expiration
- [ ] Add expiry to student access codes
- [ ] Implement session rotation for student portal
- [ ] Add logout button to student dashboard

### 5.6 Dependency Audit
- [ ] Remove `@cline/sdk` if unused
- [ ] Consolidate Redis clients
- [ ] Run `npm audit` and fix vulnerabilities

---

## Execution Order

```
Phase 0 (Security)  → Phase 1 (Quality)  → Phase 2 (Tests)
       ↓                    ↓                    ↓
Phase 3 (CI/CD)     → Phase 4 (Perf)    → Phase 5 (Features)
```

Each phase should be committed separately for easy rollback.
