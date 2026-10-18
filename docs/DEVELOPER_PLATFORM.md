# WA-WORLD Developer Platform v1.0.0

## What ships
Read-only localhost HTTP API; scope-based keys; revocation without server restart;
60 requests/minute per key (in-memory bucket, resets on restart);
JSON-only extension command registry (no user-supplied executable code).

**Not yet implemented:** third-party JavaScript plugins, marketplace, third-party wallet
payments, outbound webhooks, client chat SDK, remote HTTPS hosting, dynamic grants,
or ML developer API. Never assume they are ready.

## Start locally
1. Install Node.js >=22.16 and run `start-dashboard.bat` or `npm run start`.
2. From the project directory, run `DEV-KEYS.bat` or:
   `node scripts/dev-keys.mjs create "My Game Dashboard" read:catalog`.
3. The token is displayed **once**; stored at rest only as SHA-256 digest under `data/dev-keys.json`.
   Protect this file and never upload it. This application does not accept a key via URL query.
4. Windows PowerShell example (replace with your OWN token):

   `$headers = @{ Authorization = 'Bearer wwd_YOUR_PRIVATE_KEY' }`
   `Invoke-RestMethod -Uri http://127.0.0.1:3000/api/dev/v1/games -Headers $headers`

Do not paste your actual key into ChatGPT, a screenshot, or a code repository.

## Endpoints
| GET route | Required scope | Notes |
| --- | --- | --- |
| `/api/dev/v1/me` | any valid key | Shows current key name and granted scopes |
| `/api/dev/v1/games` | `read:catalog` | Playable game catalog only |
| `/api/dev/v1/metrics` | `read:metrics` | Aggregate counts only, no usernames/phone numbers |
| `/api/dev/v1/extensions` | `read:extensions` | Metadata, no executable code |

Status codes: `401` no/invalid key, `403` missing scope, `405` write method,
`429` rate limit, `503` damaged key store/extension registry.
No JSON API write operations are exposed in this release.

### Key lifecycle
- `node scripts/dev-keys.mjs list` lists keys without secrets.
- `node scripts/dev-keys.mjs revoke <id>` immediately revokes a key.
- Scope grants are fixed on key creation: revoke and create again to change permissions.
- Default `DEV-KEYS.bat` creation grants **only read:catalog**, not every scope.

### Security limitations
- Dashboard binds to 127.0.0.1 by default. Do NOT bind publicly or port-forward
  without a separately secured HTTPS reverse proxy, firewall, monitoring, and rate controls.
- No CORS or remote TLS is configured. Browser JavaScript on other origins cannot
  automatically read the API.
- Rate limit is per running process and does not protect multiple workers or DDoS.
- Key compromise allows any scope originally granted; revoke immediately.
- API key storage is file-based rather than a scalable shared key service.
- Never use V-Currency as a real-money token or expose wallet modifications here.

## JSON extensions
Files are placed in `extensions/<id>.json`. No Node.js eval/import of third-party
scripts occurs; the only supported plugin action is to return static text.
The bundled sample is `extensions/hello-world.json`, supporting:
- `.ext list`
- `.ext hello-world hello`
- `.ext hello-world about`

Manifest fields: `id`, `name`, `description`, `enabled`, `commands`. Each command
has `command` and `response`, with a response limit of 650 characters.
Use `"enabled": false` to disable an extension. Restart is not required, but
file syntax must remain valid. Extensions cannot debit wallets, call AI, send unsolicited
messages, or access the operating system.

## Mandatory QA for this module
AUTO: bearer/scope, unauthorized, GET-only, rate limiting, revocation, JSON
manifest validation, core duplicate event safety, existing game regression.
LIVE WhatsApp: only `.ext list` / `.ext hello-world hello` are optional spot-checks;
normal `.menu`, pairing and button roundtrip remain mandatory before declaring
end-to-end release verification.
