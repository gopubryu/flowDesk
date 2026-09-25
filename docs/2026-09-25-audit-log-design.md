# FlowDesk Audit Log 설계 초안

상태: 설계만 완료, schema/API/Production 변경 없음
작성일: 2026-09-25

## 목적

구매·판매·재고·기준정보 변경을 누가, 어느 workspace에서, 언제, 어떤 요청으로 수행했는지 추적한다. 특히 품목코드 변경 허용·거부와 참조 이력 판정을 사후 검증할 수 있어야 한다.

## 기록 대상

1. 기준정보
   - 품목 생성·수정·삭제
   - 품목코드 변경 시도 및 결과(허용/409 거부)
   - 거래처·창고·사원·부서 변경
2. 거래·재고
   - 구매요청·구매·견적·판매계획 생성/수정/삭제·상태변경
   - 입고·출하·재고조정 및 stockMovement 반영
3. 권한·workspace
   - workspace 선택 실패·교차 workspace 거부
   - 역할 변경·초대·멤버십 변경

## 제안 필드

- `id`: cuid 또는 UUID
- `workspaceId`: workspace scope 필수
- `actorUserId`: 인증 사용자 ID, 시스템 작업은 명시적 system 값
- `action`: CREATE/UPDATE/DELETE/STATUS_CHANGE/RENAME/ACCESS_DENIED
- `resourceType`: item/purchase/purchaseRequest/quotation/salesPlan/inventory/workspaceMember 등
- `resourceId`: 내부 ID(없으면 요청 대상 code)
- `resourceCode`: 사용자에게 보이는 문서번호·품목코드
- `before`: 변경 전 JSON snapshot 또는 필요한 필드만 포함한 JSON
- `after`: 변경 후 JSON snapshot 또는 필요한 필드만 포함한 JSON
- `reason`: 거부 사유·업무 사유
- `requestId`: 요청 상관관계 ID
- `ipHash` 또는 마스킹된 IP: 원문 IP 장기 보관 금지
- `userAgent`: 필요 시 길이 제한·민감정보 제거
- `createdAt`: 서버 생성 시각

## 보안·보존 원칙

- 서버가 actor/workspace/action을 결정하며 클라이언트 입력을 신뢰하지 않는다.
- 비밀번호·session token·cookie·connection string·secret·CVC 등은 절대 저장하지 않는다.
- before/after에서 이메일·전화번호·주소 등 불필요한 개인정보는 마스킹하거나 제외한다.
- 일반 사용자는 자신의 권한 범위 내 workspace audit만 조회한다. ADMIN 조회 API도 workspace scope를 재검증한다.
- audit 기록 실패를 업무 mutation 성공으로 조용히 숨길지, transaction을 실패시킬지는 별도 제품 결정이다. 초기에는 중요 mutation에 대해 실패를 관찰 가능하게 하고 격리 runtime에서 선택지를 비교한다.

## 구현 순서

1. schema 변경 없이 순수 `audit-event` 정규화·마스킹·diff helper와 unit test 작성
2. 격리 PostgreSQL에만 AuditLog 모델과 migration 적용
3. 품목코드 PUT/PATCH의 성공·409 거부·교차 workspace 거부부터 기록
4. 실제 requestId와 actor/workspace context 연결
5. read-back 및 workspace 격리 runtime 시나리오 추가
6. Edison 독립 read-only QA와 총괄 승인 후 다른 업무 mutation으로 확대

## 검증 기준

- 같은 품목코드에 대해 성공 변경과 409 거부가 각각 정확한 actor/workspace/action으로 기록된다.
- 다른 workspace의 참조 이력이나 audit row가 조회 결과에 섞이지 않는다.
- 거부 이벤트는 원본 데이터가 바뀌지 않았음을 read-back으로 확인한다.
- 민감정보가 audit payload에 포함되지 않는다.
- Production/Neon main에는 설계 승인 전 어떤 schema/API 변경도 적용하지 않는다.

## 현재 결정하지 않은 항목

- 단일 AuditLog 테이블과 resource별 history 테이블 중 선택
- before/after 전체 snapshot vs 변경 필드 diff
- audit append 실패 시 mutation rollback 여부
- 보존 기간·삭제 정책·ADMIN 조회 UI
- requestId 생성 위치와 분산 요청 상관관계 방식
