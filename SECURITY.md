# Security, Deployment & Operations Guide

## 1. Environment & Secret Management

All sensitive secrets are passed strictly via environment variables. Never commit `.env` or production credentials to source control.

| Variable | Description | Production Requirement |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | Mandatory. Connection must use TLS (`+srv` protocol or `tls=true`). |
| `MONGODB_DB` | MongoDB database name | Default: `sheetfill`. |
| `JWT_SECRET` | Cryptographic secret for signing tokens | Mandatory. Min 32 random characters. Generate with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ADMIN_USERNAME` | Master administrator username | Unique string (e.g. `owner_admin`). |
| `ADMIN_PASSWORD_HASH` | Argon2id hash of admin password | Mandatory. Generate with: `python scripts/make_admin_hash.py` |
| `FRONTEND_ORIGIN` | Allowed CORS origin | Mandatory. Set to your exact production URL (e.g. `https://your-app.onrender.com`). Wildcards (`*`) are rejected. |
| `ACCESS_TOKEN_MINUTES` | Token lifetime in minutes | Default: `480` (8 hours). Session automatically expires at `min(ACCESS_TOKEN_MINUTES, access_expires_at)`. |
| `SESSION_POLICY` | Single active device policy | `replace` (default) automatically terminates older sessions when user logs in elsewhere. `block` rejects concurrent logins. |
| `ENV` | Deployment mode | `production` turns off Swagger/OpenAPI documentation (`/docs`, `/redoc`) and validates mandatory secrets at startup. |
| `MAX_UPLOAD_MB` | Maximum spreadsheet upload size | Default: `10` (or up to 25 MB). |

---

## 2. Password Hashing & Secret Rotation

- Passwords are encrypted using **Argon2id** (configured with memory cost $65,536\text{ KB}$, $3$ iterations, $4$ parallel threads).
- To rotate the admin password:
  1. Run `python scripts/make_admin_hash.py` locally and input the new password.
  2. Update `ADMIN_PASSWORD_HASH` in your Render service environment settings.
  3. Existing admin tokens will expire naturally or can be invalidated by restarting the service.
- To rotate `JWT_SECRET`:
  1. Update `JWT_SECRET` in Render.
  2. All currently active JWT tokens are immediately invalidated, requiring users to log in again.

---

## 3. MongoDB Atlas Configuration

1. **Database Access**: Create a dedicated database user with `readWrite` permissions on database `sheetfill`.
2. **Network Access**:
   - Because Render outbound IP addresses are dynamic, configure Network Access in MongoDB Atlas to `0.0.0.0/0` (Allow Access from Anywhere) protected by strong SCRAM password authentication.
   - For dedicated/VPC environments, configure Atlas VPC Peering or Private Service Connect.
3. **Database Indexes**:
   Indexes are automatically verified and built asynchronously at service startup:
   - `users.username` (unique)
   - `sessions.session_id` (unique)
   - `sessions.expires_at` (TTL auto-cleanup)
   - `activity_logs.ts` (TTL auto-cleanup after 90 days)
   - `login_attempts.key` (unique rate limit tracking)

---

## 4. Single Active Device Guarantee

- Each subscriber account can only have **one active session at any given time**.
- On login with `SESSION_POLICY=replace`, any existing active sessions belonging to that user ID are marked revoked and their cached keys purged.
- If another device attempts to make an API request with an old token, it receives `401 Unauthorized` with error code `SESSION_REPLACED`, and the frontend gracefully redirects to the login screen with an explanatory notice.

---

## 5. Render Free Tier & Cold-Start Keep-Alive

- The backend container on Render free tier spins down after 15 minutes of inactivity. Cold start takes approximately 45–55 seconds.
- The frontend includes a built-in **Server Wake Screen** that polls `GET /api/health` with animated progress and status messages until the backend is fully awake.
- **Optional Free Ping**: To keep the service perpetually warm without paying, configure a free monitor (e.g. UptimeRobot or cron-job.org) to ping `https://<your-service>.onrender.com/api/health` every 12 minutes.

---

## 6. Audit Logging & Compliance

- Sensitive keys (`password`, `password_hash`, `token`, `jwt`, `secret`, `file_bytes`, `contents`, `raw_sheet`) are strictly redacted prior to persistence in `activity_logs`.
- Logs record timestamps, IP addresses (origin extracted from `X-Forwarded-For`), User-Agents, and actor identities.
- Activity logs expire automatically after 90 days via MongoDB TTL index.
