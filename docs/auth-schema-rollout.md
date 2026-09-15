# 인증·workspace schema 운영 적용 검토안

작성 기준: 2026-09-15
브랜치: `feat/auth-workspace`

## 현재 상태

- 인증·workspace Prisma 모델은 feature branch에만 존재한다.
- `main`, Vercel Production, 운영 Neon DB에는 아직 적용하지 않았다.
- 운영 DB 연결 문자열과 비밀값은 이 문서에 기록하지 않는다.
- Vercel Production에는 `DATABASE_URL`과 `DATABASE_URL_UNPOOLED`가 Hidden/Secret으로 등록되어 있다.
- 로컬 build는 해당 변수가 로컬에 없어 Prisma 단계에서 중단된다.

## schema 변경 범위

기존 업무 테이블은 유지하고 다음 인증·권한 테이블 및 관계를 추가한다.

- `User`: Better Auth 사용자
- `Session`: 로그인 세션
- `Account`: 비밀번호·향후 소셜 provider 계정
- `Verification`: 이메일·인증 흐름
- `WorkspaceMember`: 사용자- workspace 멤버십과 `ADMIN`/`OPERATOR`/`VIEWER` 역할
- `Invitation`: workspace 초대, 만료, 수락 시각, 토큰 SHA-256 해시
- `Workspace`에 members/invitations 관계 추가

주요 제약:

- `WorkspaceMember(workspaceId, userId)` unique
- `Invitation.tokenHash` unique
- workspace/user/session/account/invitation 외래키는 cascade 정책을 포함하므로 삭제 영향 검토 필요
- 초대 토큰 원문은 schema·DB·응답·로그에 저장하지 않는다.

## 적용 전 필수 절차

1. 운영 DB 백업 또는 Neon branch 생성과 복구 가능성 확인
2. Prisma schema diff를 사람이 검토
3. 별도 staging/Neon branch에서 schema push 또는 reviewed migration 실행
4. `information_schema`로 신규 테이블·열·제약조건 read-only 확인
5. 테스트 사용자로 회원가입→첫 workspace 생성→초대→수락 흐름 검증
6. 기존 workspace 업무 데이터가 보존되고 기존 API가 의도한 workspace 범위로만 조회되는지 확인
7. 실패 시 schema rollback 또는 Neon branch 폐기 절차 확인
8. 운영 적용 후에만 feature branch 배포 여부를 결정

## 이번 단계에서 하지 않은 것

- 운영 Neon DB schema push/migration
- 운영 데이터 생성·수정·삭제
- 전체 초기화 API 실행
- main 브랜치 병합
- Production 배포
- 실제 이메일 provider 연결

## 내일 실행 순서

1. staging/별도 Neon branch와 backup 상태 확인
2. 적용 명령 및 변경 SQL을 먼저 dry-run/검토
3. 적용 후 `to_regclass` 및 `information_schema` read-back
4. 인증 API 401/정상 세션 응답 확인
5. workspace 교차 접근 403 확인
6. 문제 없을 때만 운영 적용 승인 여부 판단
