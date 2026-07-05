# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 3 - Find Jobs Page
**Last completed:** 10 Adzuna Job Discovery (Build verified ✅)
**Next:** 11 Filter + Sort + Pagination

---

## Progress

### Phase 1 - Foundation

- [ ] 01 Homepage
- [ ] 02 Auth
- [ ] 03 PostHog Initialization
- [ ] 04 Database Schema

### Phase 2 - Profile Page

- [x] 05 Profile Page - Full UI
- [x] 06 Profile Save Logic
- [x] 07 AI Profile Extraction from Resume
- [ ] 08 Resume PDF Generation from Profile

### Phase 3 - Find Jobs Page

- [x] 09 Find Jobs Page - Full UI
- [x] 10 Adzuna Job Discovery
- [x] 11 Filter + Sort + Pagination

### Phase 4 - Job Details Page

- [x] 12 Job Details Page - Full UI
- [ ] 13 Company Research Agent

### Phase 5 - Dashboard

- [ ] 14 Dashboard Page - Full UI
- [ ] 15 Stats Bar - Real Data
- [ ] 16 Recent Activity - Real Data
- [ ] 17 Analytics Charts - PostHog Data

---

## Recent Work - Feature 10 Build Completion

**Session Goal:** Fix TypeScript build errors blocking Feature 10 testing

**Issues Resolved:**
1. ✅ Fixed `createInsforgeServer` → `createInsforgeServerClient` import error
2. ✅ Fixed `auth.getUser()` → helper function `getCurrentServerUserId()` for server-side auth
3. ✅ Fixed database pattern `.from()` → `.database.from()` (4 calls in API route)
4. ✅ Fixed Find Jobs page null guard for nullable insforge client
5. ✅ Fixed auth method `.getSession()` → `.getCurrentUser()` on client
6. ✅ Fixed database pattern on client `.from()` → `.database.from()`

**Build Result:** ✅ SUCCESSFUL
- All TypeScript errors resolved
- Production build generated (9.1s compile + 5.1s page collection + 2.6s generation)
- Ready for Feature 10 testing

**Next Steps for Feature 10:**
1. Populate real `GOOGLE_API_KEY` from https://aistudio.google.com/apikey (currently placeholder)
2. Test complete job search flow end-to-end
3. Verify Gemini scoring displays match scores and reasons correctly
4. Check job results persist in database

**Architecture Patterns Verified:**
- Admin client: `insforgeServer.database.from(table)`
- Client: `insforge.database.from(table)` and `insforge.auth.getCurrentUser()`
- API route: User retrieval → Profile lookup → Agent tracking → Processing → Database insert → Response


## Decisions Made During Build

- Feature 06 uses a Server Action in `actions/profile.ts` as the single profile save path.
- Profile completion percentage and missing fields are calculated from saved profile data instead of adding new database columns.
- Resume uploads use the `resumes/{user_id}/resume.pdf` storage key and save the returned URL to `profiles.resume_pdf_url`.
- Feature 07 uses `app/api/resume/extract/route.ts` as a thin FormData route and `agent/extractor.ts` for PDF text extraction plus OpenAI structured profile JSON.

---

## Notes

_Add notes here as the build progresses - workarounds, patterns, anything that differs from the context files._
- Feature 07 can extract from either the currently selected PDF file or the saved InsForge Storage object at `resumes/{user_id}/resume.pdf`; extracted values populate the form but are not saved until the user clicks Save Profile.
- Feature 10 implementation:
  - Adzuna search endpoint: `POST /api/jobs/search` accepts `{ jobTitle, location }` and returns matched jobs
  - Scoring: Google Gemini API (via @google/generative-ai) scores each job against user profile with `match_score`, `match_reason`, `matched_skills`, `missing_skills`
  - Storage: Jobs saved to `jobs` table with `source='search'`, scoped by `user_id`, linked to `agent_runs` record
  - Frontend: Find Jobs page now has live search, state management for results, loading/error handling, and formats dates intelligently
