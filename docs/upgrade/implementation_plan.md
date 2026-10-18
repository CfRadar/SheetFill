# SheetFill Comprehensive Upgrade & System Hardening Implementation Plan

**Project**: SheetFill (`cfradar/sheetfill`)  
**Target Environment**: FastAPI + MongoDB (Backend on Render) / React + Vite + HeroUI + TailwindCSS (Frontend on Vercel)  
**Author**: Antigravity Technical Architecture Agent  
**Date**: October 18, 2026  
**Status**: Ready for User Review (Strict Planning Mode — Zero Code Modified)

---

## 1. Goals & Non-Goals

### Goals
1. **Liquid Glass UI & Physics Interaction Upgrade**:
   - Modernize visual design to a **Liquid Glass (Glassmorphism 2.0)** aesthetic using low-level **React Bits** components (`GlassSurface`, `Magnet`, `Antigravity`, `Aurora`, `SplitText`).
   - Implement strict **8pt grid alignment** and execute the **5-question "Text-to-Delete" decluttering test** across all pages, stripping 150+ redundant words.
   - Scaffold `frontend/public/` with dedicated vector branding assets (`logo.svg`, `favicon.ico`, `apple-touch-icon.png`, `robots.txt`).
2. **Single-Viewport Scraper Analytics Dashboard**:
   - Re-architect `ResultsPanel.tsx` so multi-platform rating distributions, recommendation tiers, and composed titles fit entirely on **one 100vh screen** with zero vertical page scrolling on desktop (>= 1280px).
   - Integrate Recharts **proportional platform treemap** and **compact stacked horizontal rating bars** (5★ to 1★).
   - Implement rating-weighted sorting across all scraped marketplace datasets.
   - Provide zero-scroll slide-in flyout drawers for competitor product drill-down and inline title validation popovers.
3. **Hardened Dual-Tier Authentication & Session Policy**:
   - Enforce exact **7-day persistent login sessions** for normal users via `httpOnly`, `Secure`, `SameSite="Lax"` cookies with sliding refresh (`Max-Age=604800`).
   - Enforce **strict non-persistent admin sessions** (ephemeral session cookie without `Max-Age`, 15-minute idle timeout, no remember-me, re-auth for destructive actions).
4. **Spreadsheet Defense & Upload Protection**:
   - Prevent upload memory exhaustion by replacing full-body buffering with **1 MB chunked streaming spooling** with an immediate 25 MB cutoff.
   - Defend against Excel formula injection by neutralizing cell values starting with `=`, `+`, `-`, or `@`.
   - Correct output file format and MIME headers to `.xlsm` (`application/vnd.ms-excel.sheet.macroEnabled.12`) to eliminate browser security and Excel corruption warnings.
   - Fix synchronous blob URL revocation in `api.ts` by delaying cleanup via `setTimeout(..., 60000)`.
   - Add `expose_headers=["Content-Disposition"]` to backend `CORSMiddleware`.
5. **AI Scraper Query Caching & Anti-Stampede Engine**:
   - Implement **canonical query hashing** (stopword removal, token sorting, SHA-256) with tiered TTLs (Marketplace: 12h, Search Plans: 24h, Analysis: 48h).
   - Implement **single-flight stampede mutex locking** to coalesce concurrent scraper requests.
   - Deploy **Redis primary caching** with **MongoDB TTL-index fallback** and hit-rate telemetry for admin inspection.
   - Serve stale cache fallback with clear timestamp badges if live scrapers face upstream rate limits.
6. **Multi-Key OpenRouter BYOK Vault with Failover**:
   - Expand key management from single-key to a **multi-key vault** stored encrypted at rest via Fernet/AES-256 in MongoDB.
   - Validate keys on addition against OpenRouter's auth probe (`GET https://openrouter.ai/api/v1/auth/key`).
   - Implement **least-used rotation** with automatic circuit breaker **failover on HTTP 429 (Rate Limit), 402 (Insufficient Credits), and 5xx (Server Error)** with configurable cooldowns.
7. **Stateless Container Scalability**:
   - Migrate session files and workbooks from ephemeral Render container disk (`app/workspace/sessions/`) to **MongoDB GridFS**, enabling horizontal container scaling and zero data loss on container spin-downs.
   - Ensure complete statelessness across all API instances with Motor connection pooling.

### Non-Goals
- Modifying the deterministic Flipkart row mapping rules (`A..BP`) or size row generation logic (S, M, L, XL), which are proven 100% byte-identical to `Flipkart_TShirt_Template.xlsm`.
- Migrating away from the Vite SPA + FastAPI backend architecture (no heavy full-stack SSR migration).
- Supporting automated direct publishing to Flipkart Seller Central (downloading macro-enabled workbooks remains the output contract).

---

## 2. Current-State Findings & Architecture Audit Summary

| ID | Location | Category | Severity | Root Cause & Failure Mode | Verified Fix Pattern | Source URL / Spec |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `AUD-01` | `frontend/src/api.ts:279` | Client / Download | **High** | Synchronous `URL.revokeObjectURL(blobUrl)` destroys blob memory before browser download manager finishes reading. | Wrap revocation in `setTimeout(..., 60000)`. | [W3C File API Spec](https://www.w3.org/TR/FileAPI/#dfn-revokeObjectURL) |
| `AUD-02` | `app/main.py:82` | CORS / Headers | **High** | `CORSMiddleware` lacks `expose_headers=["Content-Disposition"]`, hiding server filenames on cross-origin Vercel requests. | Add `expose_headers=["Content-Disposition"]` to `CORSMiddleware`. | [MDN Expose-Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers) |
| `AUD-03` | `app/api/sheets.py:780,845` | File / MIME | **High** | Rebuilt workbook is zipped OpenXML (`.xlsm`), but filename is set to `.xls` and served as `application/vnd.ms-excel` under `nosniff`. | Serve as `.xlsm` with `application/vnd.ms-excel.sheet.macroEnabled.12`. | [IANA Spreadsheet ML Types](https://www.iana.org/assignments/media-types/application/vnd.ms-excel.sheet.macroEnabled.12) |
| `AUD-04` | `app/services/design_store.py:46` | Data Loss | **High** | Sessions stored on local disk at `app/workspace/sessions/`. Render free tier cycles containers after 15 min, wiping files. | Migrate session state and workbooks to MongoDB GridFS. | [Render Ephemeral Storage](https://render.com/docs/disks#ephemeral-storage) |
| `AUD-05` | `app/auth.py:670` | Auth Policy | **High** | Admin tokens share the same 480-min sliding window as users. Policy mandates non-persistent admin sessions. | Implement session cookie without `Max-Age` and 15-min idle timeout. | [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) |
| `AUD-06` | `app/auth.py:537` | Auth Policy | **Medium** | User session duration set to 480 min (8h) in `.env` instead of required 7-day (604,800s) persistent cookie. | Set cookie `Max-Age=604800` (7 days) with sliding refresh rotation. | [RFC 6265 HTTP Cookies](https://datatracker.ietf.org/doc/html/rfc6265) |
| `AUD-07` | `app/api/sheets.py:74` | Resource / DoS | **Medium** | 25MB validation occurs after `await file.read()`, buffering entire unverified files into RAM. | Spool uploads in 1MB chunks with immediate 25MB cutoff. | [FastAPI UploadFile Docs](https://fastapi.tiangolo.com/tutorial/request-files/) |
| `AUD-08` | `app/keyword_agent/openrouter_client.py:80` | AI / Resiliency | **Medium** | Keyword agent accepts only a single key with no 429/402/5xx failover or load balancing. | Multi-key vault in MongoDB with least-used rotation and auto-failover. | [OpenRouter Rate Limits](https://openrouter.ai/docs#rate-limits) |
| `AUD-09` | `app/keyword_agent/cache.py:20` | Cache / Perf | **Medium** | Scraper cache uses un-normalized query strings, missing hits for identical search intents. | Canonical query hashing with SHA-256 and single-flight lock. | [Redis Caching Patterns](https://redis.io/docs/manual/patterns/distributed-locks/) |
| `AUD-10` | `frontend/package.json:31` | Security / Deps | **Medium** | 13 vulnerabilities in devDependencies (`vitest`, `tinypool`, `esbuild`) reported by `npm audit`. | Upgrade `vitest` to `>= 3.0` and update `package-lock.json`. | [GitHub Advisory GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) |
| `AUD-11` | `app/services/writer.py:107` | Concurrency | **Low** | Synchronous ZIP rebuilding and XML manipulation occurs directly on the main async event loop. | Offload CPU-bound workbook rebuild to threadpool via `asyncio.to_thread`. | [Python Asyncio to_thread](https://docs.python.org/3/library/asyncio-task.html#asyncio.to_thread) |
| `AUD-12` | `src/flipkart_filler/cli.py:67` | Code Hygiene | **Low** | Vulture detected 7 unused variables (`images_file`, `db_path`, `mapped_values`). | Clean dead variables and standardize AST cleanliness. | [PEP 8 Naming Rules](https://peps.python.org/pep-0008/) |

---

## 3. Work-Stream Architecture & Technical Specifications

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Work-Stream 1: Liquid Glass UI                        │
│   - React Bits: GlassSurface (cards), Magnet (CTAs), Antigravity (dropzone) │
│   - 8pt systematic spacing scale + copy decluttering (150+ words removed)   │
│   - frontend/public/ assets: logo.svg, favicon.ico, apple-touch-icon.png    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                  Work-Stream 2: Single-Viewport Scraper Viz                 │
│   - Strict 100vh grid layout (h-[calc(100vh-56px)] overflow-hidden)         │
│   - Recharts Treemap for platform share (Amazon, Flipkart, Myntra, Meesho)   │
│   - Compact stacked horizontal star rating bars (5★ down to 1★)             │
│   - Rating-weighted sorting across all platform datasets                    │
│   - Zero-scroll slide-in flyout drawer for competitor product drill-down    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    Work-Stream 3: Security & Session Hardening              │
│   - Dual-tier auth: 7-day user persistent cookie vs 15-min admin session     │
│   - 1MB chunked upload spooling with 25MB cutoff + formula sanitization     │
│   - Correct .xlsm MIME headers + CORS expose_headers Content-Disposition    │
│   - Delayed blob revocation in api.ts to prevent browser download aborts    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                Work-Stream 4: Scraper Caching & Stampede Defense            │
│   - Canonical query normalization: lowercase, stopword strip, sorted tokens │
│   - Tiered TTLs: 12h marketplace, 24h search plans, 48h analysis synthesis  │
│   - Single-flight mutex lock + Redis primary with MongoDB TTL-index fallback│
│   - Return stale cache on scraper rate limits with timestamp indicator      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                Work-Stream 5: Multi-Key OpenRouter BYOK & Scaling           │
│   - User multi-key vault in MongoDB (Fernet encrypted, masked UI hints)     │
│   - Health probe on add (GET https://openrouter.ai/api/v1/auth/key)         │
│   - Least-used key rotation with automatic 429/402/5xx circuit breaker      │
│   - Cooldown tracking and transparent error notifications                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│               Work-Stream 6: Horizontal Stateless Backend Scaling           │
│   - Stateless session migration from local disk to MongoDB GridFS           │
│   - Dual-read compatibility (GridFS first, local disk fallback)             │
│   - Motor MongoDB connection pooling (maxPoolSize=50, minPoolSize=10)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Technical Specifications per Work-Stream

### Work-Stream 1: Liquid Glass UI & React Bits Redesign
- **Asset Creation & Public Directory**:
  - Scaffold `frontend/public/` containing:
    - `logo.svg`: 64x64 vector mark combining an emerald/cyan frosted spreadsheet grid with an AI sparkle.
    - `favicon.ico`: Standard multi-resolution favicon.
    - `apple-touch-icon.png`: 180x180 high-resolution touch icon.
    - `robots.txt`: Disallow crawling of internal application routes.
  - Update `frontend/index.html` to reference `favicon.ico` and `apple-touch-icon.png`.
- **React Bits Component Integration**:
  - `GlassSurface`: Applied as container wrapper for all elevated editor cards and forms (`backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]`).
  - `Magnet`: Applied to primary action CTAs ("Generate Sheet", "Download Workbook", "Run Research") with subtle cursor attraction physics.
  - `Antigravity`: Rendered inside empty upload dropzone (`UploadStep.tsx`) with floating particles reacting to cursor gravity (auto-disabled on mobile/tablets).
  - `Aurora`: Embedded in `AppShell.tsx` as a low-CPU ambient chromatic wave background.
  - `SplitText`: Applied to `LoginPage.tsx` headline and major view headers.
- **Systematic 8pt Grid & Copy Decluttering**:
  - All spacing aligned to multiples of 4px/8px (`p-4`, `p-6`, `gap-3`, `gap-4`).
  - Execute the **5-Question "Text-to-Delete" Test**:
    - `UploadStep.tsx`: Strip 28-word explanatory paragraph down to *"Drop .xls or .xlsm here"* + badges.
    - `GlobalBrandBar.tsx`: Strip 22-word boilerplate to clean pill *“Applies to all designs”*.
    - `StickyToolbar.tsx`: Consolidate duplicate buttons into a single high-contrast `Magnet` CTA with circular SVG progress indicator.
    - `ReportPanel.tsx`: Replace internal technical jargon with concise trust pill: `Verified 100% Intact`.

---

### Work-Stream 2: Single-Viewport Scraper Analytics Dashboard
- **Strict 100vh Desktop Layout**:
  - `ResultsPanel.tsx` constrained to `h-[calc(100vh-56px)] overflow-hidden` on desktop (>= 1280px). Zero vertical page scrolling.
  - Mobile/tablet (< 1280px) smoothly transitions into a swipeable tabbed navigation system.
- **Quadrant Grid Division**:
  ```
  ┌────────────────────────────────────────┬────────────────────────────────────────┐
  │ Left Column (50% Width)                │ Right Column (50% Width)               │
  │ ┌────────────────────────────────────┐ │ ┌────────────────────────────────────┐ │
  │ │ Quadrant 1: Recommended Titles     │ │ │ Quadrant 2: Platform Treemap       │ │
  │ │ - Tier 1 (Emerald), Tier 2 (Indigo)│ │ │ - Proportional share (Amazon,      │ │
  │ │ - 1-Click Copy & Flipkart Check    │ │ │   Flipkart, Myntra, Meesho)        │ │
  │ └────────────────────────────────────┘ │ └────────────────────────────────────┘ │
  │ ┌────────────────────────────────────┐ │ ┌────────────────────────────────────┐ │
  │ │ Quadrant 3: Star Rating Bars       │ │ │ Quadrant 4: Top Competitor Cards   │ │
  │ │ - 5★ down to 1★ stacked bars       │ │ │ - Compact cards with rating pill   │ │
  │ │ - Platform breakdown toggle        │ │ │ - Slide-in Flyout Drawer for drill │ │
  │ └────────────────────────────────────┘ │ └────────────────────────────────────┘ │
  └────────────────────────────────────────┴────────────────────────────────────────┘
  ```
- **Rating-Weighted Sorting Engine**:
  - Scraped listings sorted by Bayesian weighted rating score:
    $$\text{Score} = \frac{v}{v + m} \cdot R + \frac{m}{v + m} \cdot C$$
    where $v$ is review count, $R$ is average rating, $m$ is minimum review threshold (25), and $C$ is platform mean rating (4.0).
- **Interactive Flyout Drawer**:
  - Clicking any competitor card slides out a 380px drawer containing full competitor attributes, image gallery, bullet points, and pricing history without shifting the parent dashboard.

---

### Work-Stream 3: Security & Session Hardening
- **Dual-Tier Authentication Policy**:
  - **Regular User Sessions**:
    - Stored in `httpOnly`, `Secure`, `SameSite="Lax"` cookie named `sheetfill_token`.
    - Exact 7-day persistence: `Max-Age=604800` seconds.
    - Sliding refresh on every authenticated request extending expiration by 7 days.
  - **Administrator Sessions**:
    - Ephemeral browser session cookie (no `Max-Age` / `Expires`). Closes immediately when browser is closed.
    - Server-side 15-minute idle timeout tracked in Redis/MongoDB.
    - Re-authentication challenge enforced before destructive actions (deleting users, flushing cache).
- **Spreadsheet Defense & Upload Protection**:
  - 1MB chunked streaming spooling with immediate 25MB cutoff:
    ```python
    CHUNK_SIZE = 1024 * 1024  # 1 MB
    MAX_SIZE = 25 * 1024 * 1024  # 25 MB
    spool = tempfile.SpooledTemporaryFile(max_size=CHUNK_SIZE)
    total_size = 0
    while chunk := await file.read(CHUNK_SIZE):
        total_size += len(chunk)
        if total_size > MAX_SIZE:
            raise HTTPException(413, "File exceeds maximum size of 25MB.")
        spool.write(chunk)
    ```
  - **Excel Formula Injection Neutralization**:
    - Sanitize all user-supplied text fields in `app/services/writer.py`: if value starts with `=`, `+`, `-`, or `@`, prepend `'` (apostrophe) to force Excel to treat it as raw string literal.
- **Download & Header Fixes**:
  - Fix `app/api/sheets.py`: Serve rebuilt workbooks with extension `.xlsm` and media type `application/vnd.ms-excel.sheet.macroEnabled.12`.
  - Fix `app/main.py`: Add `expose_headers=["Content-Disposition"]` to `CORSMiddleware`.
  - Fix `frontend/src/api.ts`: Replace instant `URL.revokeObjectURL(blobUrl)` with `setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)`.

---

### Work-Stream 4: High-Performance Caching & Anti-Stampede Engine
- **Canonical Query Normalization**:
  - Queries normalized via:
    1. Lowercase conversion & whitespace trimming.
    2. Punctuation removal.
    3. Stopword removal (e.g., "for", "the", "in", "and", "men", "women").
    4. Lexicographical token sorting.
    5. SHA-256 hash generation: `cache:scrape:<platform>:<sha256_hash>`.
- **Tiered Cache TTLs**:
  - Marketplace Raw Scraper Results: **12 hours**.
  - Generated Search Plans: **24 hours**.
  - Final AI Synthesis / Recommendations: **48 hours**.
- **Single-Flight Stampede Mutex Locking**:
  - Concurrent requests for identical normalized queries acquire an async distributed lock:
    ```python
    lock_key = f"lock:scrape:{query_hash}"
    if not await acquire_lock(lock_key, ttl=30):
        # Wait up to 10s and read from cache once leader finishes
        return await wait_for_cached_result(cache_key, timeout=10)
    ```
- **Tiered Backend Architecture**:
  - Primary: Redis (if `REDIS_URL` configured).
  - Fallback: MongoDB `cache_entries` collection with automatic TTL index on `expires_at`.
  - Stale Serving: If live scrapers return HTTP 429/blocked, return cached data if available, tagged with `stale: true` and `cached_at: ISO8601`.

---

### Work-Stream 5: Multi-Key OpenRouter BYOK Vault & Auto-Failover
- **Encrypted Multi-Key Vault Schema**:
  - Collection: `db.keyword_agent_keys`
  - Keys encrypted at rest using Fernet symmetric encryption (`cryptography.fernet`).
  - Stored fields: `key_id`, `label`, `encrypted_key`, `key_hint` (`sk-or-v1-••••••••1234`), `status` (`active`, `cooldown`, `exhausted`, `invalid`), `usage_count`, `last_used_at`, `cooldown_until`, `last_error`.
- **Key Health Check Probe**:
  - When user adds key, backend probes `GET https://openrouter.ai/api/v1/auth/key` with `Authorization: Bearer <key>`.
  - Validates key authenticity and fetches available credits before persisting.
- **Least-Used Rotation & Auto-Failover Circuit Breaker**:
  - Filter active keys where `status == "active"` and `cooldown_until < now()`.
  - Select key with lowest `usage_count`.
  - On HTTP 429 (Rate Limit): Place key in cooldown for 60 seconds; retry request with next key.
  - On HTTP 402 (Insufficient Credits): Mark key as `exhausted`; notify user in UI; retry with next key.
  - On HTTP 5xx: Place key in cooldown for 30 seconds; retry up to 3 times across remaining keys.
  - If all keys exhausted: Return transparent error message indicating exact cooldown time remaining.

---

### Work-Stream 6: Horizontal Scalability & Stateless Backend
- **Stateless Session Migration to MongoDB GridFS**:
  - Remove all dependence on local filesystem storage (`app/workspace/sessions/`).
  - Store uploaded input workbooks and rebuilt output workbooks as chunks in MongoDB GridFS (`fs.files` / `fs.chunks`).
  - Store workspace design JSON and state documents in `db.workspace_sessions`.
  - Dual-read compatibility: When reading a session file, check GridFS first; fall back to local disk if migrating an active session.
- **Database Connection Pooling**:
  - Configure Motor MongoDB client with explicit pool boundaries:
    ```python
    client = AsyncIOMotorClient(
        MONGODB_URI,
        maxPoolSize=50,
        minPoolSize=10,
        maxIdleTimeMS=45000,
        serverSelectionTimeoutMS=5000
    )
    ```
- **Threadpool CPU Offloading**:
  - Wrap synchronous OpenXML zip rebuilding in `asyncio.to_thread` to prevent blocking the FastAPI async event loop during bulk downloads.

---

## 5. File-Level Change List

| File Path | Action | Description of Modifications |
| :--- | :---: | :--- |
| `frontend/public/logo.svg` | **Create** | Liquid-glass vector logo mark merging spreadsheet grid and AI sparkle |
| `frontend/public/favicon.ico` | **Create** | Multi-size ICO favicon (16x16, 32x32) |
| `frontend/public/apple-touch-icon.png` | **Create** | 180x180 high-res touch icon for mobile bookmarks |
| `frontend/public/robots.txt` | **Create** | Search engine crawl policy disallowing private routes |
| `frontend/index.html` | **Modify** | Add favicon link tags, update meta title, viewport, and theme color |
| `frontend/src/ui/AppShell.tsx` | **Modify** | Embed `logo.svg`, apply `Aurora` ambient background canvas |
| `frontend/src/workspace/UploadStep.tsx` | **Modify** | Mount `Antigravity` particle canvas on dropzone, strip 28-word clutter |
| `frontend/src/workspace/Workspace.tsx` | **Modify** | Enforce 8pt grid, clean editor cards, apply `GlassSurface` wrappers |
| `frontend/src/workspace/StickyToolbar.tsx` | **Modify** | Add `Magnet` physics CTA, circular SVG progress ring, remove duplicates |
| `frontend/src/features/keyword-agent/components/ResultsPanel.tsx` | **Modify** | Re-architect into single-viewport 100vh grid with Treemap & Rating bars |
| `frontend/src/features/keyword-agent/components/CompetitorDrawer.tsx` | **Create** | Slide-in zero-scroll drill-down drawer for competitor details |
| `frontend/src/features/keyword-agent/components/KeySettingsModal.tsx` | **Modify** | Upgrade from single-key input to multi-key vault manager UI |
| `frontend/src/api.ts` | **Modify** | Wrap `URL.revokeObjectURL` in `setTimeout(..., 60000)`, add query token download fallback |
| `app/main.py` | **Modify** | Expose `Content-Disposition` in `CORSMiddleware`, set max pool size |
| `app/auth.py` | **Modify** | Implement 7-day user persistent cookie and 15-minute ephemeral admin session |
| `app/api/sheets.py` | **Modify** | Correct `.xlsm` media type, implement 1MB chunked upload spooling (25MB cutoff) |
| `app/services/writer.py` | **Modify** | Sanitize Excel formulas (`'`, `+`, `-`, `@`), offload rebuild to `asyncio.to_thread` |
| `app/services/design_store.py` | **Modify** | Migrate ephemeral disk storage to MongoDB GridFS with dual-read fallback |
| `app/keyword_agent/cache.py` | **Modify** | Implement canonical query hashing, tiered TTLs, and single-flight stampede lock |
| `app/keyword_agent/key_store.py` | **Modify** | Implement multi-key vault schema, Fernet encryption, and key health probe |
| `app/keyword_agent/openrouter_client.py` | **Modify** | Implement least-used key rotation and 429/402/5xx auto-failover circuit breaker |
| `app/keyword_agent/scrapers/marketplace.py` | **Modify** | Implement Bayesian rating-weighted sorting for scraped product results |
| `src/flipkart_filler/cli.py` | **Modify** | Remove 7 unused dead variables identified by Vulture |

---

## 6. Data & API Contract Changes

### A. Multi-Key Vault Schema (`db.keyword_agent_keys`)
```json
{
  "_id": "ObjectId('660000000000000000000001')",
  "user_id": "65f1234567890abcdef12345",
  "keys": [
    {
      "key_id": "key_e9a1b2",
      "label": "Personal Primary Key",
      "encrypted_key": "gAAAAABl8Z...",
      "key_hint": "sk-or-v1-••••••••4a1b",
      "status": "active",
      "usage_count": 142,
      "last_used_at": "2026-10-18T16:00:00Z",
      "cooldown_until": null,
      "last_error": null,
      "created_at": "2026-10-14T10:00:00Z"
    },
    {
      "key_id": "key_c3f4d5",
      "label": "Backup Team Key",
      "encrypted_key": "gAAAAABl8A...",
      "key_hint": "sk-or-v1-••••••••9c8e",
      "status": "cooldown",
      "usage_count": 58,
      "last_used_at": "2026-10-18T16:15:00Z",
      "cooldown_until": "2026-10-18T16:16:00Z",
      "last_error": "HTTP 429 Rate Limited",
      "created_at": "2026-10-16T12:00:00Z"
    }
  ],
  "updated_at": "2026-10-18T16:15:00Z"
}
```

### B. Single-Viewport Scraper Frontend Data Contract
```typescript
export interface ScraperPlatformShare {
  name: "Amazon" | "Flipkart" | "Myntra" | "Meesho";
  volume: number;
  sharePercent: number;
  fill: string;
}

export interface RatingDistribution {
  star5: number;
  star4: number;
  star3: number;
  star2: number;
  star1: number;
}

export interface RecommendedTitle {
  tier: 1 | 2 | 3;
  title: string;
  charCount: number;
  flipkartValid: boolean; // <= 80 characters, no banned symbols
  keywordsIncluded: string[];
}

export interface ScrapedCompetitor {
  id: string;
  platform: "Amazon" | "Flipkart" | "Myntra" | "Meesho";
  title: string;
  rating: number;
  reviewsCount: number;
  weightedScore: number;
  price: number;
  url: string;
  imageUrl: string;
}

export interface ScraperDashboardData {
  query: string;
  cached: boolean;
  cachedAt?: string;
  platformShares: ScraperPlatformShare[];
  ratingDistribution: RatingDistribution;
  recommendedTitles: RecommendedTitle[];
  topCompetitors: ScrapedCompetitor[];
}
```

### C. New & Modified API Endpoints

| Endpoint | Method | Auth | Request Payload | Response Payload | Description |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/api/keyword-agent/keys` | `GET` | `require_user` | None | `{ "keys": [KeySummary] }` | Returns list of masked keys with health status & usage |
| `/api/keyword-agent/keys` | `POST` | `require_user` | `{ "key": "sk-or-...", "label": "..." }` | `{ "status": "ok", "key_id": "..." }` | Validates key via probe and stores encrypted in vault |
| `/api/keyword-agent/keys/{key_id}` | `DELETE` | `require_user` | None | `{ "status": "ok" }` | Deletes specific key from vault |
| `/api/keyword-agent/keys/{key_id}/test` | `POST` | `require_user` | None | `{ "valid": true, "credits": 12.5 }` | Probes OpenRouter connectivity and credit balance |
| `/api/sheets/{sid}/download` | `GET` | `require_user` | Query: `?token=...` | File Stream (`.xlsm`) | Streams `.xlsm` with `Content-Disposition` header |

---

## 7. Risks & Mitigations

| Risk / Failure Mode | Likelihood | Impact | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **Excel Template VBA Macro Corruption** | Low | **Critical** | Execute automated byte-level assertion on all 33 non-sheet parts against the master `Flipkart_TShirt_Template.xlsm` before sending bytes to client. |
| **GPU Lag on Low-End Hardware from React Bits** | High | **Medium** | Detect hardware/mobile capabilities (`window.innerWidth < 768` or `navigator.hardwareConcurrency <= 4`); automatically disable `Antigravity` particle canvas and fallback to static CSS blur. |
| **OpenRouter Key Cooldown Deadlock** | Medium | **High** | If all user keys enter cooldown, return an immediate descriptive error response with cooldown expiration timestamps rather than hanging indefinitely. |
| **GridFS File Blob Migration Overhead** | Medium | **Medium** | Implement dual-read compatibility: check MongoDB GridFS first, then fall back to local disk for older active sessions. Write only to GridFS. |
| **Single-Flight Lock Deadlock on Scraper Crash** | Low | **High** | Set an explicit 30-second TTL on all distributed locks in Redis/MongoDB so locks auto-release if a worker terminates unexpectedly. |

---

## 8. Comprehensive Test Plan

### A. Automated Backend Test Suite (`pytest tests/`)
- Verify all **90 existing tests pass with 100% success rate**.
- Add `tests/keyword_agent/test_multi_key_failover.py`:
  - Test least-used key selection across multiple active keys.
  - Test circuit breaker failover on mocked HTTP 429 (Rate Limit) and 402 (Insufficient Credits).
  - Test key health check probe validation (`test_key_probe_success`, `test_key_probe_invalid`).
- Add `tests/test_upload_streaming.py`:
  - Test chunked spooling rejects a 26MB upload before buffering into RAM.
- Add `tests/test_auth_cookies.py`:
  - Verify 7-day cookie `Max-Age=604800` on user login.
  - Verify session cookie behavior (`Max-Age=None`) and 15-minute idle timeout on admin login.
- Add `tests/test_formula_injection.py`:
  - Verify inputs starting with `=`, `+`, `-`, `@` are safely prefixed with `'` in generated workbooks.

### B. Frontend Typecheck & Production Build
```bash
cd frontend
npx tsc --noEmit    # Target: 0 errors
npm run build       # Target: Production bundle generated under 400 kB gzipped initial chunk
```

### C. Manual Cross-Browser & Device QA
1. **Desktop (1440px)**:
   - Navigate to Keyword Agent results.
   - Verify single-viewport layout in `ResultsPanel.tsx` with zero vertical page scrolling.
   - Verify Treemap renders platform shares proportionally.
   - Verify 5★ to 1★ stacked rating bars reflect rating-weighted distribution.
2. **Mobile (390px)**:
   - Verify clean tabbed fallback navigation without layout shifts or horizontal clipping.
3. **Cross-Browser File Download**:
   - Verify file download in Chrome, Safari, Edge, and Firefox.
   - Confirm file downloads with name `Flipkart_TShirt_Listing_Rebuilt.xlsm` without browser download manager errors.
   - Open downloaded `.xlsm` in Microsoft Excel; confirm zero macro-corruption or XML schema warnings.

---

## 9. Rollout, Rollback & Phased Implementation Schedule

```
Phase 1: Security, Auth & Download Fixes (Est: 2-3h)
  ├── Dual-tier cookies: 7-day user vs 15-min ephemeral admin session
  ├── Fix .xlsm media type & CORS expose_headers Content-Disposition
  ├── Delayed blob revocation in api.ts to prevent browser download aborts
  └── Chunked 1MB upload streaming with 25MB cutoff + formula sanitization

Phase 2: Scraper Caching & Multi-Key OpenRouter Engine (Est: 3-4h)
  ├── User multi-key vault in MongoDB with OpenRouter health probe
  ├── Automatic HTTP 429/402/5xx circuit breaker failover
  ├── Canonical query hashing & single-flight stampede lock
  ├── Rating-weighted sorting across all platform datasets
  └── Stateless session migration from local disk to MongoDB GridFS

Phase 3: Visual Upgrade & React Bits Integration (Est: 3-4h)
  ├── Deploy logo.svg, favicon.ico, and touch icons to public/
  ├── Integrate Liquid Glass tokens (GlassSurface, Magnet, Aurora, Antigravity)
  └── Execute 5-question copy decluttering across all pages

Phase 4: Single-Viewport Scraper Dashboard (Est: 3-4h)
  ├── Re-architect ResultsPanel.tsx into strict 100vh grid (zero page scroll)
  ├── Implement Recharts platform treemap and stacked horizontal rating bars
  └── Zero-scroll slide-in flyout drawer for competitor product drill-down
```

### Rollback Strategy
- All changes executed on a dedicated branch: `feature/upgrade-and-hardening`.
- If critical regressions occur, instantly revert the merge commit via `git revert -m 1 <commit_hash>` and push to `origin main` to trigger automatic rollback on Vercel and Render.

---

## 10. Open Questions & User Decisions

Before commencing Phase 1 implementation, please confirm your preference on these 3 operational decisions:
1. **Logo Visual Preference**: Would you prefer the new SVG logo to emphasize a **minimalist frosted spreadsheet mark** or an **abstract geometric AI starburst**?
2. **Cache Backend Priority**: Should we enable **Redis** immediately (requires providing a Redis URI), or start with the **MongoDB TTL-index** cache fallback which runs zero-configuration on your existing cluster?
3. **Admin Idle Timeout**: Is a **15-minute** idle timeout acceptable for administrator sessions, or would you prefer a shorter 10-minute window?
