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

## 초대 받은 사용자 로그인 순서

초대 이메일을 받은 사용자는 다음 순서로 참여한다.

1. 초대 이메일의 **초대 수락** 링크를 클릭한다.
2. 로그인되지 않은 경우 FlowDesk 로그인 화면으로 자동 이동한다.
3. 초대 이메일을 받은 주소와 **동일한 이메일 주소**로 로그인한다.
   - 계정이 없으면 같은 주소로 먼저 회원가입한다.
   - 초대 링크에서 회원가입으로 이동한 경우에는 workspace 생성 화면을 건너뛰고 초대 수락으로 자동 이동한다.
   - 초대 없이 일반 가입한 사용자는 회원가입 후 onboarding에서 첫 workspace를 만든다.
   - 다른 이메일로 로그인하면 이메일 불일치로 초대를 수락할 수 없다.
4. 로그인 성공 후 초대 수락 화면으로 자동 복귀한다.
5. 초대 수락이 완료되면 지정된 workspace와 역할로 자동 참여하고 대시보드로 이동한다.

초대 링크를 로그인 전에 열었을 때 표시되는 `Unauthorized`는 정상적인 보안 응답이다. 이 경우 로그인 후 초대 이메일의 링크를 다시 클릭하면 된다. 초대 토큰이 포함된 링크는 다른 사람에게 공유하지 않는다.
## Email-provider blocker

No email provider is configured yet. The invitation POST response therefore
includes `delivery: "not_configured"` and explains that invitation acceptance
delivery is blocked. The acceptance endpoint and page are implemented, but
recipients will not automatically receive links until an email delivery
provider is configured. Until then, an administrator must securely deliver the
link out of band.
