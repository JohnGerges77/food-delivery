# Platform Admin API

All responses are JSON with `Cache-Control: no-store`. Browser credentials require an exact `AUTH_TRUSTED_ORIGINS` match. Admin authorization is database backed and never accepts a client-supplied Admin or restaurant scope.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | Email/password login; `Origin` and `X-Savora-CSRF: 1` required. Returns `{admin:{id,email}}` and separate session/CSRF cookies. |
| GET | `/api/admin/auth/me` | Restore current Admin identity. |
| GET | `/api/admin/auth/csrf` | Trusted-Origin bootstrap for the Admin CSRF header. |
| POST | `/api/admin/auth/logout` | Invalidate current session. Requires trusted Origin and session CSRF. |
| GET | `/api/admin/overview` | `{total,active,suspended}` Restaurant counts. |
| GET | `/api/admin/restaurants?page=1&limit=20&search=` | Bounded deterministic list, newest first with `_id` tiebreaker. Search is a literal case-insensitive name or slug substring. Maximum page 1000, limit 50. |
| GET | `/api/admin/restaurants/:id` | Restaurant and initial Owner summary. |
| POST | `/api/admin/restaurants` | Atomic Restaurant, Owner and audit creation. Requires trusted Origin and session CSRF. |
| PATCH | `/api/admin/restaurants/:id/status` | `{status:"active"|"suspended"}` conditional transition and audit. Requires trusted Origin and session CSRF. |

Creation body:

```json
{
  "restaurant": { "name": "Example Cafe", "slug": "example-cafe", "currency": "EGP", "description": "Optional" },
  "owner": { "name": "Owner Name", "email": "owner@example.test", "password": "operator-supplied-initial-password" }
}
```

The example password is illustrative and must never be used as a real credential. Required fields are name, slug, currency, Owner name/email/password. Slug and email normalize to lowercase; currency normalizes to uppercase. Password must meet the existing 12–128 character policy. Optional description has a 1000-character limit. Responses expose the Owner email and active state, but never a hash or password. Currency must appear in Node 24's `Intl.supportedValuesOf('currency')`; the form offers EGP, USD, EUR, SAR and AED. A narrower business currency allowlist can be agreed before production.

`400` means invalid input or query, `401` missing/expired/revoked Admin session or invalid credentials, `403` trusted-Origin/CSRF failure, `404` missing Restaurant, `409` duplicate slug/email or an already-set status, `429` login rate limit, and `503` unavailable service. The UI never receives a raw database error. Owner cookies cannot authorize these endpoints.
