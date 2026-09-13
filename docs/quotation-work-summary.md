# 견적서 모듈 작업 정리

## 현재 업무 흐름

`작성중(draft) → 발송(sent) → 수락(accepted) → 판매계획 1회 전환`

견적서 작성·상태 변경·판매계획 전환 자체는 재고를 변경하지 않습니다. 실제 재고 감소는 기존 판매·출하 흐름에서 처리합니다.

## 화면

- `/quotations/new`: 발주요청입력과 동일한 거래처·담당자·창고·품목 검색 팝업 UX, 코드/명칭 필드, 회색 라벨 박스와 인디고 톤 적용
- `/quotations`: 발주·판매 목록과 동일한 카드형 검색 필터, 얇은 입력 필드, 상태 배지, 반응형 테이블 적용
- `/quotations/status`: 발주요청현황과 동일한 검색 카드·요약 카드·상태별 현황 테이블·만료 예정 카드 적용
- 전환된 견적서는 내부 cuid 대신 판매계획 업무번호(slipNo) 링크를 표시하고 `전환됨`으로 비활성 표시
- `draft`는 화면에서 `작성중`으로 표시하며 거래처 미발송·재고 영향 없음 설명을 제공

## 서버/API 규칙

- 금액·부가세·합계는 서버에서 재계산
- 거래처·담당자·창고·품목 기준정보 참조 검증
- 상태 전이는 허용된 순서만 가능
- `accepted` 상태에서만 판매계획 전환 가능
- 견적 1건당 판매계획 1건만 생성
- 전환 판매계획에 `sourceQuotationId`를 보존
- 판매계획 전환 시 출하·재고 이동 없음

## 데이터베이스

`Quotation`, `QuotationLine`, `QuotationStatus` 및 `SalesPlan.sourceQuotationId`를 사용합니다.
견적서 창고 필드 `warehouseCode`, `warehouseName`은 Neon 실제 DB에도 반영되어 있습니다.

## 검증 및 배포

- `npm test`: 24/24 통과
- `npx tsc --noEmit`: 통과
- `npx prisma format`: 통과
- `npx prisma generate`: 통과
- `git diff --check`: 통과
- 배포 견적서 API QA: 14/14 통과
- QA 테스트 데이터: 정리 완료 (`total_quotations: 0`)
- GitHub `main` 최신 커밋: `70e1e52 fix: unify quotation list and status dashboard styling`
- 프로덕션: `https://flow-desk-ashy.vercel.app`
- `/quotations`, `/quotations/status` 프로덕션 응답: HTTP 200

## 제외 범위(v1)

전자결재, PDF 서식 생성, 메일 발송, 실제 첨부파일 저장, 다통화 환율 정산, 재고 v2는 후속 범위입니다.
