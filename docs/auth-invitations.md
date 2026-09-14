# Workspace invitations

`POST /api/auth/invitations` and `GET /api/auth/invitations` are restricted to an
active `ADMIN` membership in the requested workspace. Invitation tokens are
random, hashed with SHA-256, and only the hash is stored in Prisma; raw tokens
are never returned by the API.

## Acceptance

`POST /api/auth/invitations/accept` requires an authenticated Better Auth
session and accepts only a JSON body containing `{ "token": "..." }`. The
server hashes the token, requires a pending non-expired invitation, and matches
the invitation email against the signed-in user's normalized email. Client
fields such as `userId`, `email`, `role`, or `workspaceId` are not accepted as
authoritative values.

Acceptance creates a membership or reactivates an inactive membership with the
invitation's role, and marks the invitation accepted in one serializable Prisma
transaction. A used, expired, or unknown token returns `404`; malformed JSON or
token returns `400`; an unauthenticated request returns `401`; an email mismatch
returns `403`; and an already-active membership (or serialization conflict)
returns `409`. A successful response contains only the workspace `id`/`name`
and assigned `role`; it never contains the raw token or `tokenHash`.

The minimal `/invitations/accept?token=...` page submits the token once, removes
it from the browser URL immediately, and does not render the token. It also
explains the delivery limitation to recipients.

## Email-provider blocker

No email provider is configured yet. The invitation POST response therefore
includes `delivery: "not_configured"` and explains that invitation acceptance
delivery is blocked. The acceptance endpoint and page are implemented, but
recipients will not automatically receive links until an email delivery
provider is configured. Until then, an administrator must securely deliver the
link out of band.
