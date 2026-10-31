# 2026-10-31 FlowDesk 회계 모듈 기획안 (검토용)

- 범위: 조사와 문서 작성만. 코드·schema·migration·DB·Production 변경 없음.
- 조사 기준: 저장소 `gopubryu/flowDesk`, 브랜치 `feat/auth-workspace`, HEAD `03660eb`.
- 전제: 한국 중소기업, workspace 1개, 사용자 2명, 향후 고객사 납품 목표, 소규모 거래량(외자 구매 월 4~5건).
- 회계기준 기본안: 일반기업회계기준(K-GAAP). 대안 검토는 2부 9항의 질문으로 남긴다.
- 구성: 1부는 코드에서 확인한 사실만, 2부는 제안만 적는다. 1부에서 "확인하지 못함"은 해당 경로를 찾지 못했다는 뜻이며 부재를 단정하지 않는다.

---

## 1부. 기존 코드 조사 (사실)

### 1-1. 금액·수량 저장 모델과 타입

출처: `prisma/schema.prisma`

금액(원화·외화·환율) 필드:

| 모델 | 필드 | 타입 | 비고 |
|---|---|---|---|
| Item | inboundPrice, outboundPrice | Float, `@default(0)` | 품목 기준단가 |
| FinanceRecord | amount | Float | 부호로 수입(+)/지출(-) 구분(1-5 참조) |
| PurchaseRequest | amount | Float, `@default(0)` | 헤더 합계 |
| PurchaseRequestLine | unitPrice, supply, vat, total | Float, `@default(0)` | |
| Purchase | amount | Float, `@default(0)` | 헤더 합계 |
| Purchase | foreignAmount | Decimal(18,2), nullable | 외자 원문 외화 금액 |
| Purchase | customsExchangeRate | Decimal(12,4), nullable | 과세환율 (JPY는 100엔당) |
| Purchase | baseAmount | Decimal(18,0), nullable | 외화 물품대금 원화 환산액 |
| Purchase | importVatBaseAmount | Decimal(18,0), nullable | 수입 VAT 과세표준 (신고필증 값) |
| Purchase | importVat | Decimal(18,0), nullable | 수입 VAT (신고필증 값) |
| PurchaseLine | unitPrice, supply, vat, total | Float, `@default(0)` | |
| SalesPlan | unitPrice, amount, vat, total | Float, `@default(0)` | 헤더 |
| SalesPlanLine | unitPrice, supply, vat, total | Float, `@default(0)` | |
| Quotation | amount, vat, total | Float, `@default(0)` | 헤더 |
| QuotationLine | unitPrice, supply, vat, total | Float (default 없음) | |

수량 필드(금액 아님, 원가 계산에 영향):

- Float: `Item.minStock`, `PurchaseRequest.quantity`, `PurchaseRequestLine.qty`, `Purchase.quantity`, `PurchaseLine.qty`, `SalesPlan.quantity`, `SalesPlanLine.qty`, `Quotation.quantity`, `QuotationLine.qty`, `StockMovement.qty`(부호 있는 수량), `StockBalance.qty`.

정리:

- **원화 금액이 Float로 저장된 필드: 28개** (Item 2, FinanceRecord 1, PurchaseRequest 1 + Line 4, Purchase 1 + Line 4, SalesPlan 4 + Line 4, Quotation 3 + Line 4).
- Decimal 금액은 `Purchase`의 외자 5개 필드뿐이다.
- Int로 저장된 금액 필드는 확인하지 못했다. Int 필드는 `sortOrder`, `SlipSequence.nextNumber`뿐이다.
- String으로 저장된 금액 필드는 확인하지 못했다. 다만 API 입력은 `num()`이 문자열·숫자를 `Number()`로 변환한다(1-2 참조).
- 금액 Float 필드 대부분이 `@default(0)`이다. 값이 없을 때 DB에는 `0`이 남아 "모름"과 "0원"을 구분할 수 없다.
- 서버 `num()`은 null/undefined/빈 문자열/비유한수를 fallback `0`으로 바꾼다. 예: `app/api/purchases/route.ts` 33~37행. 같은 형태의 함수가 purchase-requests, sales-plans, purchases/[id]에도 있다.

### 1-2. 부가세 계산 위치

| 문서 | 계산 위치 | 서버 동작 |
|---|---|---|
| 구매입력 | 클라이언트 `components/purchases/purchase-form.tsx`의 `vatRate`(164행), `recalcLine`(169행). `supply = Math.round(qty*unitPrice)`, `vat = Math.round(supply*0.1)`(과세만) | `app/api/purchases/route.ts`, `[id]/route.ts`는 라인 `supply/vat/total`을 클라이언트 값 그대로 저장한다. `validatePurchaseInput`(`lib/erp-rules.ts` 118행)은 유한·비음수만 검사하고 `qty×unitPrice`나 10% 일치는 검사하지 않는다. |
| 구매요청 | 클라이언트 `components/purchase-requests/purchase-request-form.tsx` 128·133행, 같은 공식 | `app/api/purchase-requests/route.ts`·`[id]`는 값을 그대로 저장한다. 금액 비음수 검증은 확인하지 못했다. |
| 판매계획 | 클라이언트 `components/sales-plans/sales-plan-form.tsx` 108·113행, 같은 공식 | `app/api/sales-plans/route.ts`·`[id]`는 값을 그대로 저장한다. 헤더 `vat/amount/total`은 body 값이 있으면 그 값을 쓰고, 없으면 라인 합계를 쓴다. 금액 비음수 검증은 확인하지 못했다. |
| 견적 | 클라이언트 `components/quotations/quotation-form.tsx` 136행과 서버 `lib/quotation-domain.ts` `calculateQuotationTotals`(118행) | **서버가 재계산한 값으로 저장한다**(`app/api/quotations/route.ts` 35행, `[id]`). 계산은 JS Number와 `Math.round`다. |
| 외자 수입 VAT | 계산하지 않는다. 사용자가 신고필증의 원화 값을 직접 입력한다(`components/purchases/import-customs-dialog.tsx`). | `validateImportAmounts`(`lib/erp-rules.ts` 37행)가 Decimal(18,0) 형식과 비음수만 검증한다. `baseAmount`만 서버가 BigInt로 계산한다(`calculateImportBaseAmount` 26행, half-up). |

추가 사실:

- 구매 라인 VAT는 `taxType`으로만 결정되고 통화를 보지 않는다. USD/JPY 구매도 `taxType = 과세`이면 라인 금액의 10%가 라인 `vat`로 계산된다. 이 값은 별도 필드인 `importVat`와 따로 저장된다.
- 헤더 합계의 의미가 문서마다 다르다.
  - `Purchase.amount`·`PurchaseRequest.amount`: 라인 `total`(VAT 포함) 합. total이 0이면 supply로 대체한다.
  - `SalesPlan.amount`: 라인 `supply`(VAT 제외) 합이며, 별도로 `vat`·`total`을 저장한다.
  - 근거: `app/api/purchases/route.ts`의 `lineRows.reduce((s,l)=>s+(l.total||l.supply))`, `app/api/sales-plans/route.ts` 74~85행.
- 구매·구매요청·판매계획 API는 클라이언트가 보낸 헤더 `amount`를 그대로 받는다(`body.amount !== undefined ? num(body.amount)`).

### 1-3. 과세/영세/면세(taxType) 저장 형태

- DB: `PurchaseRequest`, `Purchase`, `SalesPlan`, `Quotation`의 `taxType String?`. enum이 아닌 자유 문자열이다.
- 선택지: 화면 상수 `TAX_TYPE_OPTIONS = ["과세","영세","면세"]`가 네 파일에 중복 정의돼 있다(`lib/purchases.ts` 97행, `lib/purchase-requests.ts` 81행, `lib/sales-plans.ts` 81행, `lib/quotations.ts` 8행). 화면 라벨은 "거래유형"이다.
- 서버 검증: 각 route는 `String(body.taxType)` 또는 `optional(row.taxType)`로 저장하며, 목록에 있는 값인지 검사하는 코드는 확인하지 못했다.
- 세율: 과세만 10%이고 영세·면세는 0이다. 영세와 면세를 구분해 다르게 처리하는 로직은 확인하지 못했다.
- 라인 단위 taxType은 없고 문서 헤더 단위다. 한 문서에 과세·면세 품목을 섞을 수 없다.
- 거래처(`Vendor`)에는 `codeType`, `bizRegNo`가 있다. 세금계산서·계산서 같은 증빙 유형 필드는 확인하지 못했다.

### 1-4. accountingReflect 현황

- 위치: `Purchase.accountingReflect Boolean @default(false)`. 구매에만 있다.
- 의미: 코드상 효과는 하나다. `true`이면 외자 통관 필드 수정을 409로 막는다(`app/api/purchases/[id]/route.ts` 116행). 통관 다이얼로그는 이 값으로 입력을 잠근다(`import-customs-dialog.tsx` 45행). 목록에는 "반영/미반영", "통관 잠금"으로 표시된다(`app/purchases/page.tsx` 584·589행).
- 설정 경로:
  - `POST /api/purchases`는 `accountingReflect: Boolean(body.accountingReflect)`(179행), `PATCH /api/purchases/[id]`는 `body.accountingReflect`가 있으면 그대로 저장한다(199~200행). 쓰기 권한(ADMIN/OPERATOR)이 있으면 요청 body로 `true`나 `false`를 넣을 수 있고, `true`에서 `false`로 되돌리는 것도 막지 않는다.
  - 화면 경로: 구매입력 저장 payload는 항상 `accountingReflect: false`를 보낸다(`purchase-form.tsx` 437행). `true`로 바꾸는 화면이나 서버 업무 로직은 확인하지 못했다.
  - `true` 값은 데모·목업 데이터(`lib/purchases.ts` mock 행, `lib/seed-demo.ts` 175행)에만 있다.
- 범위 밖: `accountingReflect = true`여도 삭제, 라인·금액·거래처 수정, 상태 변경은 막지 않는다. 라인·금액 수정 차단은 입고 이력이 있을 때만 별도로 동작한다(1-8 참조).
- 결론: 실제 회계 반영 상태를 나타내는 값이 아니다. 실제로 true가 되는 업무 경로가 없다.

### 1-5. 기존 finance 화면/API

- 모델: `FinanceRecord`(client 문자열, description, `amount Float`, `status paid/pending/overdue`, date, dueDate, `category sales/expense/subscription`).
- API: `app/api/finances/route.ts`(GET/POST), `app/api/finances/[id]/route.ts`(GET/PATCH/DELETE). workspace 권한 검사를 적용했고, DELETE에는 연쇄 검사가 없다.
- 화면: `app/finance/page.tsx`. 메뉴 라벨은 "매출·재무"(`components/layout/sidebar.tsx` 107행)이고 부제는 "매출·입금·미수금을 한곳에서 추적합니다. (데모 데이터)"다. `amount > 0`은 매출/입금, `amount < 0`은 지출로 합산하고 월별 차트를 그린다. 상태는 순환 버튼으로 바꾼다.
- 대시보드(`app/dashboard/page.tsx`)도 같은 FinanceRecord로 입금·미수·연체를 집계한다.
- 연결: 구매·판매·재고와 연결되는 키(거래처 코드, 문서 ID)는 없다. 거래처는 자유 문자열 `client`다.
- 회계 모듈과 겹치는 부분:
  - "매출·재무"라는 메뉴명과 매출·지출 집계가 회계 원장·손익과 의미가 겹친다.
  - 부호 기반 금액(+/−)은 차변/대변 체계와 맞지 않는다.
  - 미수·연체 상태 관리는 회계의 채권 관리와 겹친다.

### 1-6. 재고 원가 정보

- `StockMovement`: 수량(`qty Float`), 거래처, 관련 문서(`relatedType`/`relatedId`)만 저장한다. 단가·금액 필드는 없다.
- `StockBalance`: 수량만 저장한다.
- 입고(`app/api/inventory/receipts/route.ts`)와 출하(`.../shipments/route.ts`)는 수량과 관련 문서만 기록한다. `app/api/inventory/**`와 `lib/inventory-server.ts`에서 `unitPrice/amount/price/cost` 문자열을 찾지 못했다.
- 원가로 쓸 수 있는 값:
  - 입고와 연결된 구매 라인의 `unitPrice`(Float). `relatedType: "purchase"`로 구매 헤더에 연결된다.
  - 품목 기준단가 `Item.inboundPrice`(Float, 기본 0)
  - 외자 구매의 `baseAmount`(Decimal, 헤더 단위)
- 외자 부대비용: 관세 금액 필드는 없다. `importVatBaseAmount`는 신고필증 과세표준(관세 등 포함)이며, 관세 자체를 따로 저장하지 않는다.
- 재고조정(`adjustment`)은 수량만 바꾸고 금액 영향을 기록하지 않는다.
- 결론: 현재 수불은 금액을 추적하지 않는다. 기말재고 금액과 매출원가를 시스템 데이터만으로 계산할 수 없다.

### 1-7. 매출 쪽 금액·부가세·거래처 확정 저장 여부

- 판매계획(`SalesPlan`/`SalesPlanLine`): vendorCode/vendorName, 공급가·VAT·합계(Float), taxType을 저장한다. 상태는 `confirmed/in_progress/completed`이며, 출하 진척은 `outboundStatus`로 별도 관리한다.
- 출하(`StockMovement type=shipment`): 수량, 거래처, `relatedType: "salesPlan"` 연결만 저장하고 금액·VAT는 저장하지 않는다.
- 매출 확정 문서(매출전표·세금계산서 발행 기록)에 해당하는 모델은 확인하지 못했다.
- 견적 → 판매계획 전환은 있다(`Quotation.convertedSalesPlanId`, `SalesPlan.sourceQuotationId`).
- 결론: 매출을 인식할 시점과 그 시점의 확정 금액을 기록하는 문서가 없다. 판매계획 금액은 계획값이며, 출하 후에도 1-8에서 보듯 수정할 수 있다.

### 1-8. 수정·삭제 시 연쇄 처리

| 대상 | 삭제 | 수정 |
|---|---|---|
| 구매 | 입고 이력(`StockMovement receipt`)이 있거나 `inboundStatus != none`이면 409 (`[id]` DELETE 265~276행, bulk 48~56행) | 입고 이력이 있으면 거래처·라인·수량·금액 변경을 serializable 트랜잭션 안에서 차단한다(228~230행). `inboundStatus`는 PATCH로 바꿀 수 없다(409, 189행). 상태 전이는 `canTransitionPurchase`로 검사한다. |
| 구매요청 | 연쇄 검사 없이 삭제한다(ADMIN). 이 요청을 원본으로 불러온 구매(`PurchaseLine.sourceType/sourceId`)가 있는지 확인하지 않는다. | 연쇄 검사를 확인하지 못했다. |
| 판매계획 | 연쇄 검사 없이 삭제한다(ADMIN, `app/api/sales-plans/[id]/route.ts` DELETE). 출하 이력(`relatedType: salesPlan`)이 있어도 삭제되어 해당 수불의 `relatedId`가 존재하지 않는 문서를 가리키게 된다. | 출하 이력과 관계없이 라인·금액 수정을 막는 검사를 확인하지 못했다. `outboundStatus`만 출하 posting이 결정한다(123행 주석). |
| 견적 | 전환되지 않은 draft/sent만 삭제할 수 있다. | 상태 lifecycle 규칙을 적용한다(`lib/quotation-domain.ts`). |
| 재고 수불 | 입고·출하·조정 DELETE route가 없다. 수불은 append-only로 운영된다. | 해당 없음 |
| FinanceRecord | 연쇄 검사 없이 삭제한다. | 검사 없음 |

기타:

- 감사 로그: `AuditLog` 모델과 `lib/audit-log.ts`의 `recordAuditEvent`가 있으나, 실제 호출은 품목 수정(`app/api/items/[code]/route.ts`)뿐이다. 구매·판매 금액 변경은 감사 로그에 남지 않는다.
- 구매 수정 화면: `PurchaseForm`은 `mode="new"`로만 사용되며(`app/purchases/new/page.tsx`, `app/purchases/page.tsx` 646행), 구매 수정 페이지는 확인하지 못했다. PATCH는 통관 다이얼로그와 상태 변경 경로에서 쓰인다.

---

## 2부. 기획 (제안)

### 2-1. 1차 범위

넣을 것:

- 계정과목 관리
- 수동 일반전표(분개) 입력·조회·확정
- 분개장, 총계정원장, 시산표(합계잔액)
- 거래처 보조원장 키(전표 라인에 거래처 코드). 채권·채무를 계정 잔액만으로 관리하면 거래처별 잔액을 따로 맞춰야 하기 때문이다.
- 확정 전표의 수정 차단과 역분개(취소 전표). 처음부터 넣어야 이후 자동분개와 기간 잠금이 같은 규칙을 쓴다.

뺄 것과 근거:

| 제외 항목 | 근거 |
|---|---|
| 재무제표(재무상태표·손익계산서) | 시산표가 맞은 뒤 계정 매핑만 추가하면 된다. 2단계 |
| 결산·마감 | 기간 잠금은 2-6의 단계로 별도 도입한다. |
| 구매·판매·재고 자동분개 | 1부에서 원천 금액이 Float이고 서버가 재계산하지 않으며, 매출 확정 문서가 없다. 지금 자동분개를 붙이면 부정확한 원천을 원장에 고정하게 된다. 3단계 |
| 원가계산·재고자산 평가 | 수불에 금액이 없다(1-6). 4단계 |
| 부가세 신고서 서식, 전자세금계산서 연동 | 외부 연동·서식 유지 부담에 비해 월 거래량이 작다. 집계 조회만 2단계에서 검토한다. |
| 예산, 부서별 손익, 다중 통화 원장, 연결회계, 고정자산 상각 | 사용자 2명·workspace 1개 규모에서 실무 사용 근거가 확인되지 않았다. 고정자산은 질문 목록으로 남긴다. |
| 기존 FinanceRecord 이관 | "(데모 데이터)"로 표시된 자유 문자열·부호 금액 구조라 계정으로 안전하게 매핑할 수 없다. 사용자 확인 후 결정한다. |

### 2-2. 계정과목 체계

대분류 초안(중소 제조·유통, K-GAAP 기준):

| 코드 범위 | 대분류 | 예시 중분류 |
|---|---|---|
| 1xxxx | 자산 | 당좌자산(현금, 보통예금, 외상매출금, 받을어음, 미수금, 부가세대급금, 선급금), 재고자산(상품, 제품, 원재료, 미착품), 투자자산, 유형자산, 무형자산 |
| 2xxxx | 부채 | 유동부채(외상매입금, 지급어음, 미지급금, 예수금, 부가세예수금, 선수금, 단기차입금), 비유동부채 |
| 3xxxx | 자본 | 자본금, 이익잉여금 |
| 4xxxx | 수익 | 상품매출, 제품매출, 영업외수익(이자수익, 외환차익) |
| 5xxxx | 매출원가 | 상품매출원가, 제품매출원가 |
| 8xxxx | 판매비와관리비 | 급여, 복리후생비, 운반비, 지급수수료, 임차료 |
| 9xxxx | 영업외비용·법인세 | 이자비용, 외환차손, 법인세비용 |

- 코드 형식: 5자리 숫자로 하고, 앞자리가 대분류를 나타낸다. 실제 코드 값은 회사가 사용하는 세무사 계정표와 맞추도록 질문으로 남긴다.
- 표준 계정은 시스템 시드로 넣고 삭제할 수 없게 한다. 사용자는 이름 변경과 사용중지만 할 수 있다.
- 사용자 추가는 하위 계정만 허용한다. 대분류와 차대 성격(정상잔액 방향)은 바꿀 수 없다.
- 전표에 쓰인 계정은 삭제할 수 없고 사용중지만 할 수 있다. 화면에서 숨기지 않고 잠근 뒤 사유를 표시하며, 서버가 409로 막는다.
- 거래처·부서·프로젝트는 계정을 늘리지 않고 전표 라인의 관리항목으로 둔다.

### 2-3. 전표 유형과 분개

- 1차: 수동 일반전표만 둔다. 입금·출금·대체 구분은 화면 편의일 뿐 저장 구조는 같게 한다.
- 3차 자동분개 후보:
  - 외자 구매: 통관 확정 시 상품·미착품 / 외상매입금, 부가세대급금 / 현금 또는 미지급금
  - 내자 구매: 확정 또는 입고 시점
  - 매출: 출하 또는 매출 확정 시점. 매출 확정 문서가 필요하다(1-7).
- 원 문서 수정·삭제 규칙(자동분개 도입 시):
  - 기본은 수정 차단이다. 확정 전표가 연결된 원 문서의 금액·거래처·날짜·과세유형 변경과 삭제를 서버가 409로 막고, 화면은 잠금과 사유를 표시한다. 현재 구매의 입고 이력 409 패턴을 같은 형태로 확장한다.
  - 정정이 필요하면 역분개 전표를 만들어 원 전표를 취소한 뒤에만 원 문서 잠금을 푼다. 이미 확정된 전표 자체를 직접 수정하거나 삭제하지 않는다.
  - 이미 잠긴 기간(2-6)에 속한 역분개는 다음 열린 기간 날짜로만 만들 수 있다.
- accountingReflect 확장 여부: 현재 값은 요청 body로 바꿀 수 있어 잠금 근거로 쓸 수 없다(1-4). 자동분개를 도입할 때는 다음 두 가지를 함께 처리해야 한다.
  - 이 값을 "연결된 확정 전표 존재 여부"에서 서버가 파생하도록 바꾼다.
  - POST/PATCH body로 받는 경로를 제거한다.
  - 판매계획에는 같은 잠금이 없으므로 매출 쪽에도 같은 규칙을 새로 적용해야 한다.
- 차대 균형 강제 원칙:
  - 서버가 저장 트랜잭션 안에서 라인 합계를 정수(원)로 비교하고, `차변 합 = 대변 합`이 아니면 거부한다. 클라이언트 합계를 신뢰하지 않는다.
  - 라인마다 차변 또는 대변 한쪽만 양수로 한다. 0원 라인과 음수는 거부한다.
  - 확정 전표는 append-only로 하고, 수정은 역분개로만 한다.
  - DB 수준 보강(체크 제약 또는 트리거)은 기술 검토 항목으로 남긴다. 애플리케이션 검증만으로 충분한지 판단해야 한다.

### 2-4. 부가가치세

- 계정: 매입 부가세는 `부가세대급금`, 매출 부가세는 `부가세예수금`으로 둔다. 납부·환급 정산 전표는 수동으로 처리한다.
- 수입 부가세 구분은 미결이다.

| 안 | 장점 | 단점 |
|---|---|---|
| A. 같은 `부가세대급금` 계정을 쓰고 전표 라인의 증빙유형(수입세금계산서)과 거래처(세관)로 구분 | 계정이 단순하다. 공제 처리가 같다. | 신고 집계 시 증빙유형 데이터 품질에 의존한다. |
| B. `부가세대급금-수입` 하위 계정을 별도로 둠 | 원장에서 바로 구분된다. 수입 VAT가 신고필증 값(1-2)이라 대사하기 쉽다. | 하위 계정을 관리해야 한다. 내자·외자 혼동 입력의 위험이 있다. |

- 영세·면세: 현재 세율 차이만 있고(1-3) 신고상 구분 근거(영세율 첨부서류, 면세 계산서)가 없다. 1차 수동 전표에서는 과세유형을 전표 라인 관리항목으로 받는다.
- 원천 문서의 taxType이 자유 문자열이라(1-3) 자동분개 전에 서버 측 허용값 검증이 필요하다.

### 2-5. 재고 원가

후보 평가:

| 방법 | 필요 데이터 | 현 구조와의 적합성 |
|---|---|---|
| 총평균법(월별) | 기간별 입고 금액 합과 수량 합 | 수불에 금액이 없어도 월말에 구매 금액을 집계해 계산할 수 있다. 소량 거래에 적합하다. |
| 이동평균법 | 입고 시점마다 금액 기록, 출고 시점 단가 확정 | 수불 행마다 금액이 필요하다(현재 없음). 과거 수정 시 이후 단가 전부를 다시 계산해야 한다. |
| 선입선출법 | 입고 로트별 잔량·단가 | 로트 개념이 없다. 구현과 검증 부담이 가장 크다. |

- 현실적 선택(제안): 월별 총평균법을 1안으로 둔다.
- 전제 조건:
  1. 구매 금액이 Decimal로 전환되고 서버가 재계산해야 한다.
  2. 외자 매입원가에 관세·운임 등 부대비용을 넣을 데이터가 필요하다. 현재 관세 필드가 없다(1-6).
  3. 재고조정의 금액 처리 규칙이 필요하다.
- 이 전제가 충족될 때까지 매출원가는 수동 결산 전표로 처리하는 것을 제안한다.
- 평가방법은 계속성 원칙상 한 번 정하면 바꾸기 어려우므로 사용자·세무사 확인 항목으로 둔다.

### 2-6. 마감과 기간 잠금

원칙:

- 월 단위 회계기간을 둔다. 잠긴 기간의 전표 생성·확정·역분개를 서버가 거부한다.
- 잠금 해제는 ADMIN만 할 수 있고 사유를 받아 감사 로그에 남긴다. 현재 AuditLog 인프라를 재사용한다.
- 자동분개 도입 후에는 잠긴 기간에 속한 원 문서의 수정도 같은 판정으로 막는다.

단계:

1. 1차: 기간 개념 없이 전표 확정/역분개만 둔다.
2. 2차: 월 잠금·해제를 도입한다.
3. 3차: 연 결산 전표(손익 대체)와 이월을 도입한다.

### 2-7. 기존 모듈 영향

- 신규(additive): 계정과목, 전표 헤더, 전표 라인, 회계기간.
  - 기존 테이블과 FK 없이 추가할 수 있어 1차는 additive migration만으로 가능하다고 판단한다.
- 수정이 필요한 기존 테이블·API·화면(3차 이후):
  - 금액 컬럼 Float → Decimal 전환: Purchase/PurchaseLine, SalesPlan/SalesPlanLine, PurchaseRequest/Line, Quotation/Line, Item 단가.
    - 대상: 해당 route 전부, 클라이언트 lib(`lib/purchases.ts` 등), 폼 4종, 현황 화면, 견적 도메인 로직
  - 서버 측 공급가·VAT 재계산 도입: purchases, purchase-requests, sales-plans route
  - `accountingReflect` 쓰기 경로 제거, 서버 파생으로 변경: `app/api/purchases/route.ts`, `[id]/route.ts`, `purchase-form.tsx`, `lib/purchases.ts`
  - 판매계획 삭제·수정 연쇄 검사 추가: `app/api/sales-plans/[id]/route.ts`
  - "매출·재무" 메뉴와 FinanceRecord의 정리 방침: `app/finance/page.tsx`, 대시보드, sidebar
- 되돌릴 수 없는 변경:
  - Float → Decimal 컬럼 타입 변환은 기존 값을 반올림해 확정한다. 변환 전 소수 오차 값이 있으면 원래 값으로 복원할 수 없다. 변환 전 백업 브랜치와 차이 리포트가 필요하다.
  - 시드 계정 코드가 전표에 쓰이기 시작하면 코드 체계를 바꾸기 어렵다.
  - 확정 전표는 append-only이므로 잘못된 자동분개는 역분개로만 정정되고 흔적이 남는다.

### 2-8. 치명적 위험 (데이터가 쌓인 뒤 되돌리기 어려운 지점)

1. Float 원천 금액을 원장으로 옮기는 것. 소수 오차가 차대 불일치나 1원 차이로 고정된다. Decimal 전환 전에는 자동분개를 금지한다.
2. 클라이언트가 계산한 VAT·합계를 신뢰하는 것(1-2). 원장 금액이 서버 규칙과 다를 수 있다.
3. 요청 body로 바뀌는 `accountingReflect`를 잠금 근거로 쓰는 것(1-4). 회계 반영 여부가 위조·해제될 수 있다.
4. 매출 인식 시점이 정해지지 않은 상태에서 판매계획 금액으로 매출을 기표하는 것(1-7). 계획값이 매출로 남는다.
5. 판매계획 삭제가 출하·전표와 연쇄되지 않는 것(1-8). 원장의 원 문서 참조가 끊긴다.
6. 계정 코드 체계를 확정하기 전에 전표를 쌓는 것. 재분류 전표가 대량으로 필요해진다.
7. 재고 평가방법을 확정하기 전에 원가 전표를 쌓는 것. 방법을 바꾸면 과거 원가 재계산이 필요해진다.
8. "모름"을 0으로 저장하는 것(1-1). 원가·단가 0이 실제 0원으로 집계된다. 회계 모듈은 미확정 값을 null로 두고 화면에 `-`로 표시해야 한다.
9. 외자 부대비용(관세 등)을 저장하지 않는 것(1-6). 재고 원가가 체계적으로 과소 계상될 수 있다.

### 2-9. 사용자 확인 질문

추정하지 않고 확인받을 항목:

1. 회계기준: 외부감사 대상 여부, 그리고 일반기업회계기준과 중소기업회계기준 중 어느 쪽을 적용할지(세무사 기준)
2. 현재 장부를 세무사(기장대리)가 작성하는지, 작성한다면 사용하는 계정과목표·코드를 받을 수 있는지
3. 회계 모듈의 목적: 내부 관리용인지, 세무사 제출 자료 생성용인지, 법정 장부 대체용인지
4. 매출 인식 시점: 출하 시점인지, 세금계산서 발행 시점인지, 대금 청구 시점인지
5. 세금계산서 발행 방식(홈택스 직접, 별도 프로그램)과 FlowDesk에 발행 기록을 남겨야 하는지
6. 업종이 제조·유통 중 어디에 해당하는지, 제품·상품 구분이 필요한지
7. 외자 구매의 관세·운임·통관수수료 정보를 어떤 서류로 받는지, 재고 원가에 넣는지
8. 수입 부가세를 일반 매입 부가세와 원장에서 구분해 보고 싶은지(2-4 A/B안)
9. 재고 평가방법을 이미 신고했는지(총평균·이동평균·선입선출)
10. 결산 주기(월·분기·연)와 마감 후 수정이 필요할 때의 승인자
11. 기존 "매출·재무"(FinanceRecord) 데이터가 실제 업무 데이터인지 데모인지, 계속 쓸지
12. 고정자산·감가상각 관리가 필요한지
13. 은행 거래내역 연동이나 업로드가 필요한지
14. 향후 고객사 납품 시 고객사별로 계정과목표를 다르게 쓸 수 있어야 하는지

### 2-10. 단계와 완료 기준

1단계: 계정과목 + 수동 전표 + 분개장·총계정원장·시산표 (additive, 기존 테이블 무변경)

- 완료 기준(CI 격리 PostgreSQL에서 검증):
  - 표준 계정 시드
  - 계정 CRUD 중 사용중 계정 삭제 409
  - 전표 저장 시 차대 불일치 400, 0원·음수 라인 400
  - 확정 전표 수정·삭제 409, 역분개로 잔액 원복 read-back
  - 시산표 차변 합 = 대변 합
  - 원장 잔액과 전표 합계 일치
  - 금액 Decimal(18,0) 정수 저장 read-back
  - workspace 교차 접근 403/404, foreign 데이터 불변
  - VIEWER 쓰기 403, OPERATOR 확정 권한 정책 반영
  - 기존 integration·E2E 전부 녹색, CI pass guard 상향
  - Edison 독립 QA와 제갈량 승인

2단계: 기간 잠금 + 재무제표(재무상태표·손익계산서) + 부가세 집계 조회

- 완료 기준:
  - 잠긴 기간 전표 생성·확정·역분개 거부
  - 잠금 해제 감사 로그 read-back
  - 재무제표 합계가 시산표와 일치

3단계: 원천 금액 정비 → 자동분개

- 3a 완료 기준(원천 금액 정비):
  - 금액 컬럼 Decimal 전환 migration을 staging에서 검증(백업, 차이 리포트, rollback)
  - 서버 공급가·VAT 재계산
  - taxType 허용값 검증
  - `accountingReflect` 서버 파생화
  - 판매계획 삭제·수정 연쇄 검사
- 3b 완료 기준(외자 구매 자동분개부터):
  - 원 문서 수정·삭제 409
  - 역분개 후 해제
  - 차대 균형과 원 문서 금액 일치를 runtime 검증

4단계: 재고 원가(월 총평균) + 매출원가 자동 계산

- 2-5의 전제 조건이 충족된 뒤 진행한다.
