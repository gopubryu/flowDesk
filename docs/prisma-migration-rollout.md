# Prisma migration baseline and deployment plan

작성 기준: 2026-09-17
브랜치: `feat/auth-workspace`

## 목적

현재 저장소에는 Prisma migration history가 없고 기존 `npm run build`가 `prisma db push`를 실행했다. 이 문서는 현재 전체 Prisma schema를 baseline으로 고정하고, 이후 DB 변경과 Vercel build를 분리하는 절차를 정의한다.

Production에는 이 문서 작성 단계에서 어떤 migration 명령도 실행하지 않는다.

## 준비된 baseline

- 파일: `prisma/migrations/00000000000000_baseline/migration.sql`
- 생성 방식: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
- 범위: 기존 ERP 전체 테이블·열·enum·인덱스·관계와 인증/workspace schema
- 생성 결과: 799 lines
- 주의: 이 SQL은 빈 DB 재현용이다. 이미 schema가 있는 Production에 직접 실행하지 않는다.

## 기존 Production 기준선 등록 절차

1. Neon `main`의 ready backup branch를 생성하고 복구 가능성을 확인한다.
2. Production 연결을 사용해 현재 DB와 Prisma schema의 diff가 비어 있는지 확인한다.
3. `_prisma_migrations`에 baseline 기록이 이미 있는지 read-only 확인한다.
4. 실제 schema가 baseline과 일치하고 baseline 기록이 없을 때만 다음을 한 번 실행한다.

```bash
npx prisma migrate resolve --applied 00000000000000_baseline
```

5. `npx prisma migrate status`로 기준선 상태를 확인한다.
6. `information_schema` 및 핵심 테이블 read-back을 다시 실행한다.

`migrate resolve --applied`는 baseline DDL을 실행하지 않고 migration history에 적용 완료로 기록하는 작업이다. schema diff가 비어 있지 않거나 기록이 이미 있으면 실행하지 말고 원인을 먼저 해결한다.

## 신규 DB와 staging 재현 절차

빈 DB 또는 schema-only branch에서는 다음을 실행한다.

```bash
npx prisma migrate deploy
```

이 명령은 baseline SQL을 실제로 실행한다. 이후 `information_schema`에서 전체 테이블과 핵심 인증 테이블을 확인하고, `npm run build`로 애플리케이션 build를 검증한다.

이미 현재 schema가 적용된 staging branch에는 baseline SQL을 재실행하지 않는다. schema 일치 여부와 migration history를 확인한 뒤 동일하게 `migrate resolve --applied`로 기준선을 등록한다.

## 이후 신규 변경 절차

1. feature branch에서 schema를 수정한다.
2. 개발용 별도 DB에서 reviewed migration을 생성한다.
3. 생성된 SQL을 사람이 검토하고 테스트한다.
4. staging에서 `npx prisma migrate deploy`를 실행한다.
5. `information_schema`, API, 화면을 read-back한다.
6. 승인된 migration만 Production의 단일 migration 단계에서 실행한다.
7. migration 성공 후 Vercel 애플리케이션을 별도로 배포한다.

## Vercel build와 DB migration 분리

`package.json`의 build는 `next build`만 실행하도록 변경한다.

```json
"build": "next build",
"db:migrate:deploy": "prisma migrate deploy"
```

Vercel build/retry는 schema를 변경하지 않는다. Production migration은 CI 또는 운영 런너에서 한 번만 실행하고, 성공한 뒤 Vercel 배포를 시작한다. migration 단계에는 동시 실행 방지(lock 또는 CI concurrency group), 명시적 Production 환경, backup 확인, 실행 로그(credential 제외)를 사용한다.

권장 순서:

```text
backup 확인
→ migration 단일 실행
→ migration status/read-back
→ Vercel production deploy
→ public page/API probe
```

## 실패·부분 적용 복구

- migration이 실패하면 오류와 migration status를 먼저 보존하고 같은 명령을 무작정 반복하지 않는다.
- 트랜잭션으로 완전히 rollback된 경우 원인을 수정한 새 migration을 만든다.
- 부분 적용 또는 수동 DDL이 확인되면 backup branch와 schema diff를 비교하고, forward-fix migration을 우선 검토한다.
- `migrate resolve --applied`는 SQL이 실제로 적용됐고 schema가 일치할 때만 사용한다. 실패한 migration을 성공으로 표시하는 용도로 사용하지 않는다.
- Production 데이터 복구가 필요하면 사전에 확인한 Neon backup branch를 기준으로 복구 계획을 승인받고, 원본 `main`에 즉시 파괴적 명령을 실행하지 않는다.
- 배포 실패 시 DB migration 성공 여부와 애플리케이션 배포 상태를 분리해 보고한다.

## 현재 상태와 남은 승인

- baseline SQL 생성 완료
- Production schema는 기존에 적용되어 있으나 baseline migration history 등록은 아직 하지 않음
- Production에는 이 문서 준비 중 migration 명령을 실행하지 않음
- 다음 구현 단계는 migration history read-only 확인 후 package script 변경 검증과 빈 DB 재현 테스트다.
