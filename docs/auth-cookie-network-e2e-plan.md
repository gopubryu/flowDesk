# Better Auth cookie/session/network E2E 계획

## 목적

현재 runtime suite는 integration session override로 handler 이후 권한 경계를 검증한다. 이 계획은 실제 HTTP 서버와 Better Auth 쿠키 경로를 별도로 검증해 다음을 확인한다.

- 회원가입·로그인 응답의 Set-Cookie 발급
- 후속 HTTP 요청의 쿠키 자동 전송 및 `/api/auth/me` 세션 해석
- 로그아웃 후 쿠키 무효화
- 만료·갱신 경계
- 쿠키 기반 사용자와 workspace membership의 실제 연결

## 안전 범위

- Production·Neon `main` 접근 금지
- GitHub Actions ephemeral PostgreSQL 16만 사용
- loopback test URL과 `*_test` DB명만 허용
- workflow secrets, Production credentials, 실제 사용자 password를 사용하지 않음
- fixture user/workspace는 unique suffix로 생성하고 실행 후 cleanup
- 초대 이메일은 외부 발송하지 않고 test delivery 경로를 사용
- 실패 로그에 쿠키 값, token, password, connection string을 출력하지 않음

## 권장 harness

1. GitHub Actions PostgreSQL 16 service를 시작한다.
2. baseline migration을 적용한다.
3. `npm run start` 또는 Next test server를 loopback 고정 포트에서 실행한다.
4. Node `fetch`와 명시적 cookie jar를 사용한다. `fetch`의 응답 status/body와 `set-cookie` 존재 여부만 기록하고 값은 기록하지 않는다.
5. 테스트마다 독립적인 user/workspace suffix를 사용한다.
6. 서버 종료와 DB disconnect를 `finally`에서 보장한다.

실제 Better Auth 설정값은 test-only 값으로 주입한다. `BETTER_AUTH_URL`은 harness loopback origin과 일치시킨다. 포트가 바뀌면 trusted origin 설정도 명시적으로 갱신한다.

## 최소 시나리오

### 인증 쿠키

- 회원가입 성공 응답이 성공 status와 `Set-Cookie`를 반환한다.
- 로그인 성공 후 cookie jar로 `/api/auth/me` 요청 시 `200`, 동일 user email/id가 반환된다.
- cookie jar를 제거한 `/api/auth/me`는 `401`이다.
- 로그아웃 후 동일 cookie jar의 `/api/auth/me`는 `401`이다.
- 잘못된 password는 인증 실패이며 성공 세션 cookie를 만들지 않는다.

### workspace membership

- 로그인 user가 `/api/auth/workspaces`를 호출하면 자신의 active membership만 반환한다.
- membership 없는 user의 onboarding 성공 후 자동 ADMIN membership을 실제 HTTP 응답으로 확인한다.
- 동일 onboarding 재시도는 `409`이며 중복 workspace/membership이 생성되지 않는다.
- workspace A/B membership을 가진 user는 명시적인 workspace selector 없이 업무 API를 호출할 수 없다.
- 명시적 workspace selector는 실제 cookie user의 membership/role로 재검증된다.

### invitation cookie 경로

- ADMIN cookie user가 invitation을 생성하고 raw token이 응답에 포함되지 않는지 확인한다.
- 외부 이메일 전송 없이 test-only delivery 결과를 받는다.
- 초대 대상 cookie user가 유효 token을 HTTP로 수락하면 membership과 `acceptedAt`을 read-back한다.
- 다른 email user의 cookie로 같은 token을 수락하면 `403`이고 membership/invitation 상태가 불변이다.
- 만료·재사용 token은 `404`이며 초대 존재를 노출하지 않는다.

## 검증 증거

각 시나리오는 status와 제한된 JSON 필드만 assertion한다. 다음은 기록하지 않는다.

- Cookie 원문, session token, invitation token
- 비밀번호, API key, DB URL
- 전체 사용자/세션 row

CI guard는 integration suite와 별도의 cookie/network suite에 적용한다. suite가 skip되거나 실행 수가 최소 기준보다 낮으면 job을 실패시킨다.

## 완료 조건

- loopback HTTP 서버를 통한 쿠키 발급·전송·무효화가 CI에서 실행됨
- isolated PostgreSQL에서 user/session/workspace/invitation read-back이 통과함
- unit/runtime override suite와 cookie/network suite의 범위가 분리됨
- Edison 독립 QA와 Jegallyang 최종 승인 전에는 provisional로 유지함
- Production·Neon `main` 무변경

## 현재 상태

설계 문서만 작성했다. 실제 HTTP harness 구현과 실행은 별도 변경으로 진행하며, 현재 runtime 승인 범위를 변경하지 않는다.
