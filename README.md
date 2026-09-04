# 플로우데스크 (FlowDesk)

중소기업(SMB)을 위한 **할 일 · 일정 · 매출 · 메일** 통합 업무 관리 MVP입니다.  
Next.js App Router + TypeScript + Tailwind CSS 기반의 클린 SaaS UI 데모입니다.

## 주요 기능

- **대시보드** (`/dashboard`) — 오늘 할 일, 다가오는 일정, 매출·미수금 스냅샷
- **할 일 칸반** (`/tasks`) — 할 일 / 진행 중 / 완료 컬럼, `@dnd-kit` 드래그 앤 드롭, CRUD
- **캘린더** (`/calendar`) — 월간 그리드, 일정 추가·수정·삭제
- **매출·정산** (`/finance`) — 거래 테이블, 합계 카드, Recharts 막대 차트
- **메일** (`/mail`) — 폴더·검색·읽기 창·작성/답장, localStorage 영속화

데이터는 브라우저 `localStorage`에 저장되며, 헤더의 **데모 초기화**로 샘플 데이터를 되돌릴 수 있습니다.

## 기술 스택

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS 3, lucide-react
- @dnd-kit (core / sortable), date-fns, recharts
- clsx, tailwind-merge, class-variance-authority
- shadcn 스타일 UI 컴포넌트 (수동 구성)

## 실행 방법

```bash
cd flowDesk
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다. 루트(`/`)는 대시보드로 이동합니다.

### 기타 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |

## 프로젝트 구조

```
flowDesk/
├── app/
│   ├── layout.tsx          # 루트 레이아웃 + StoreProvider
│   ├── globals.css
│   ├── page.tsx            # / → /dashboard 리다이렉트
│   ├── dashboard/page.tsx
│   ├── tasks/page.tsx
│   ├── calendar/page.tsx
│   ├── finance/page.tsx
│   └── mail/page.tsx
├── components/
│   ├── layout/             # sidebar, header, app-shell
│   └── ui/                 # button, card, input, badge, dialog, ...
├── lib/
│   ├── types.ts
│   ├── mock-data.ts        # 한국어 데모 시드
│   ├── store.tsx           # Context + localStorage
│   └── utils.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## 참고

- 백엔드/인증 없음 — 클라이언트 상태만 사용합니다.
- 패키지 설치 후 최초 실행 시 `next-env.d.ts`가 갱신될 수 있습니다.
- UI 카피는 한국어이며, 데모 거래처·미팅·매출 데이터가 포함되어 있습니다.

---

© FlowDesk MVP — 플로우데스크
