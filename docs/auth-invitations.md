# Workspace invitations

`POST /api/auth/invitations` and `GET /api/auth/invitations` are restricted to an
active `ADMIN` membership in the requested workspace. Invitation tokens are
random, hashed with SHA-256, and only the hash is stored in Prisma; raw tokens
are never returned by the API.

No email provider is configured yet. The POST response therefore includes
`delivery: "not_configured"` and explains that invitation acceptance delivery
is blocked. An email delivery and acceptance flow must be configured before
these pending invitations can be used by recipients.
