# 파일럿 초기 데이터 CSV 템플릿

기본 파일럿 설정: 본인 업무용, 1개월, 익명화 데이터, CSV export.

## 사용 규칙

- 원본 ERP export는 별도 보관하고 템플릿에 복사하지 않는다.
- 아래 샘플의 `DEMO-` 값은 형식 예시일 뿐 실제 데이터가 아니다.
- UTF-8 CSV를 사용한다. 금액·수량은 천 단위 구분기호 없이 입력한다.
- 날짜는 `YYYY-MM-DD` 형식으로 통일한다.
- 먼저 1~2건으로 dry-run 검증한 뒤 전체 파일을 처리한다.
- Production DB에 직접 적재하지 않고 격리 환경에서 먼저 검증한다.

## 파일별 필수 키

| 파일 | 필수 키 | 참조 |
|---|---|---|
| items.csv | code | warehouse는 선택 |
| vendors.csv | code | - |
| warehouses.csv | code | - |
| departments.csv | code | - |
| employees.csv | code | departmentCode 선택 |

## 다음 단계

기존 ERP에서 CSV를 export한 뒤 헤더를 이 템플릿에 맞추고, 익명화 샘플 1~2건으로 컬럼 매핑·중복·참조 무결성을 확인한다. 현재 저장소에는 CSV 파서/적재 기능을 추가하지 않았으며, 먼저 매핑 검증 후 구현한다.
