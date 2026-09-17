# Runtime API integration test design

작성 기준: 2026-09-17  
상태: CI 격리 PostgreSQL 실행 기반 추가, 실제 route handler suite 구현·실행 대기

## 목표

실제 route handler와 Prisma 쿼리를 격리된 PostgreSQL에서 호출해 source contract 테스트의 한계를 보완한다. Production URL, Neon `main`, 운영 `DATABASE_URL`은 어떤 단계에서도 테스트 입력으로 사용하지 않는다.

## 데이터베이스 격리

- CI에서 ephemeral PostgreSQL service/container를 생성한다.
- 테스트 전용 `TEST_DATABASE_URL`만 주입한다.
- `TEST_DATABASE_URL`이 없으면 런타임 suite는 실행하지 않고 명확히 skip한다. 기본 `npm test`가 운영 DB를 찾거나 연결하지 않도록 한다.
- 시작 시 다음 안전 검사를 실패 처리한다.
  - `TEST_DATABASE_URL`이 비어 있음
  - `DATABASE_URL`과 동일함
  - hostname이 Production/Neon main으로 알려진 값임
  - URL에 운영 프로젝트 식별자가 포함됨
- 테스트 DB에만 `npx prisma migrate deploy`로 baseline 및 신규 migration을 적용한다.
- CI concurrency를 1개 DB당 하나로 제한한다.

현재 로컬에는 Docker가 설치되어 있지 않아 ephemeral PostgreSQL을 만들 수 없다. 따라서 이 단계에서는 Production을 사용하지 않고 설계와 안전 검증만 반영한다. 실제 handler 실행은 CI service DB가 준비된 후 별도 결과로 보고한다.

## Fixture

각 suite 시작 시 무작위 prefix를 생성하고 두 workspace를 만든다.

- `workspaceA`, `workspaceB`
- `ADMIN`, `OPERATOR`, `VIEWER` 사용자 각각
- 각 사용자에 대한 Better Auth `Session`
- workspace A/B membership를 필요한 역할로 구성
- workspace A에만 item/vendor/purchase/task 등의 probe row 생성

Fixture ID와 code는 매 실행 무작위 값으로 생성하며 기존 데이터에 의존하지 않는다. 테스트 종료 시 `finally`에서 workspace cascade 삭제 후 연결 확인을 수행한다. 실패 시에도 teardown을 시도하고, teardown 실패는 원래 assertion과 함께 보고한다.

## 실행 방식

Next route handler의 exported `GET`/`POST`/`PUT`/`PATCH`/`DELETE`를 실제 `Request`와 context params로 직접 호출한다. 테스트 요청에는 fixture session cookie와 명시적인 `workspaceId`를 넣는다. 응답 status와 JSON을 검증하고, 상태 변경 가능성이 있는 테스트는 호출 전후 row snapshot을 비교한다.

## 핵심 매트릭스

| 우선순위 | 시나리오 | 기대 결과 | 무변경 검증 |
|---|---|---|---|
| 1 | 다른 workspace ID로 GET | 403(멤버십 없음) | 해당 row 조회 없음 |
| 1 | 다른 workspace code/id로 PATCH | 403 또는 404 | 원래 row snapshot 동일 |
| 1 | 다른 workspace code/id로 DELETE | 403 또는 404 | 원래 row 존재·동일 |
| 2 | VIEWER POST/PATCH/PUT/재고 write | 403 | row/count 동일 |
| 3 | OPERATOR 업무 write | 2xx | 생성·수정 반영 |
| 3 | OPERATOR DELETE/대량 삭제 | 403 | row/count 동일 |
| 4 | ADMIN CRUD·삭제·초대 관리 | 2xx | 의도한 변경만 반영 |
| 5 | 초대 이메일 불일치 | 403 | invitation pending 유지 |
| 5 | 초대 만료·이미 사용됨 | 400/410 계열 정책 status | membership 미생성 |
| 5 | 동일 초대 동시 accept | 정확히 1회 성공 | membership 1개·invitation consumed 1회 |

각 업무 리소스는 최소 기준정보 1개, 구매/구매요청, 견적/판매계획, 재고 입출고/조정, 재무, 일정/할 일, 메일을 대표한다. 전체 route 목록과 역할 배열은 `lib/route-authorization.test.ts`의 계약표와 동기화한다.

## 인증 세션 주의

세션 cookie/token은 fixture에서 생성한 임의 값만 사용한다. 사용자 비밀번호·Production cookie·API key는 읽거나 입력하지 않는다. Better Auth session 스키마의 cookie 이름과 token 형식은 실제 auth 설정에서 확인하고, 테스트 DB의 Session row와 함께 구성한다.

## 배포 분리

- 일반 `npm run build`: `next build`만 실행하며 DB를 변경하지 않는다.
- 별도 CI migration job: test/staging/Production 환경을 명시하고, 승인된 migration만 단일 실행한다.
- 이 테스트 suite는 PR/CI의 test DB job에서만 실행한다.
- Production migration과 E2E는 별도 승인 및 별도 job으로 유지한다.

## 현재 남은 작업

1. Docker 또는 CI PostgreSQL service 확보
2. 테스트 전용 env safety helper 구현 및 검증
3. Better Auth fixture session 생성 helper 구현
4. 대표 route handler runtime 호출 테스트 구현
5. `npm run test:integration` 명령과 CI job 연결
6. 실제 테스트 DB 실행 결과와 누락 route/위험 보고
