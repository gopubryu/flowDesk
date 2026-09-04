import type { Task, CalendarEvent, FinanceRecord, MailMessage } from "./types";

export const TEAM_MEMBERS: { name: string; department?: string }[] = [
  { name: "demo", department: "관리자" },
  { name: "김서연", department: "디자인" },
  { name: "박민수", department: "개발" },
  { name: "윤지훈", department: "경영" },
  { name: "이하늘", department: "마케팅" },
  { name: "최준영", department: "영업" },
];

export const initialTasks: Task[] = [
  {
    id: "task-1",
    title: "한빛소프트 견적서 작성",
    description: "ERP 커스터마이징 1차 견적 및 일정 제안",
    status: "todo",
    priority: "high",
    dueDate: "2026-09-05",
    assignee: "김서연",
    createdAt: "2026-09-01T09:00:00",
    updatedAt: "2026-09-01T09:00:00",
  },
  {
    id: "task-2",
    title: "월간 매출 리포트 정리",
    description: "8월 매출·미수금 현황 스프레드시트 업데이트",
    status: "todo",
    priority: "medium",
    dueDate: "2026-09-06",
    assignee: "이하늘",
    createdAt: "2026-09-02T10:00:00",
    updatedAt: "2026-09-02T10:00:00",
  },
  {
    id: "task-3",
    title: "신규 거래처 온보딩 체크리스트",
    description: "네오푸드 계약 후 계정·권한·킥오프 일정",
    status: "todo",
    priority: "medium",
    dueDate: "2026-09-08",
    assignee: "박민수",
    createdAt: "2026-09-03T11:00:00",
    updatedAt: "2026-09-03T11:00:00",
  },
  {
    id: "task-4",
    title: "플로우데스크 UI 와이어프레임 검토",
    description: "대시보드·칸반·캘린더 화면 피드백 반영",
    status: "in_progress",
    priority: "high",
    dueDate: "2026-09-04",
    assignee: "윤지훈",
    createdAt: "2026-08-28T14:00:00",
    updatedAt: "2026-09-03T16:00:00",
  },
  {
    id: "task-5",
    title: "고객사 데모 리허설",
    description: "블루웨이브 미팅용 데모 시나리오 준비",
    status: "in_progress",
    priority: "high",
    dueDate: "2026-09-05",
    assignee: "최준영",
    createdAt: "2026-09-01T15:00:00",
    updatedAt: "2026-09-04T09:30:00",
  },
  {
    id: "task-6",
    title: "세금계산서 발행 요청",
    description: "그린로지스 9월분 세금계산서",
    status: "in_progress",
    priority: "low",
    dueDate: "2026-09-10",
    assignee: "이하늘",
    createdAt: "2026-09-02T09:00:00",
    updatedAt: "2026-09-02T09:00:00",
  },
  {
    id: "task-7",
    title: "8월 결산 마감",
    description: "입금 확인 및 장부 마감 완료",
    status: "done",
    priority: "high",
    dueDate: "2026-09-01",
    assignee: "윤지훈",
    createdAt: "2026-08-25T10:00:00",
    updatedAt: "2026-09-01T18:00:00",
  },
  {
    id: "task-8",
    title: "팀 주간 스탠드업 노트 공유",
    status: "done",
    priority: "low",
    dueDate: "2026-09-03",
    assignee: "박민수",
    createdAt: "2026-09-03T09:00:00",
    updatedAt: "2026-09-03T10:30:00",
  },
];

export const initialEvents: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "그린테크 현장 킥오프",
    description: "업무자동화 시스템 구축 킥오프 · 범위 합의",
    date: "2026-09-01",
    endDate: "2026-09-05",
    allDay: true,
    type: "meeting",
    project: "[26-1] 그린테크 업무자동화 시스템 구축",
    location: "그린테크 본사",
    attendees: ["demo", "김서연", "박민수"],
  },
  {
    id: "evt-2",
    title: "블루웨이브 킥오프 미팅",
    description: "프로젝트 범위·일정 합의",
    date: "2026-09-04",
    startTime: "14:00",
    endTime: "15:30",
    type: "meeting",
    company: "블루웨이브",
    location: "회의실 A",
    project: "블루웨이브 SaaS 도입",
    attendees: ["demo", "최준영", "윤지훈"],
  },
  {
    id: "evt-3",
    title: "한빛소프트 견적 마감",
    date: "2026-09-05",
    allDay: true,
    type: "deadline",
    company: "한빛소프트",
    attendees: ["이하늘"],
  },
  {
    id: "evt-4",
    title: "네오푸드 계약 서명",
    description: "전자계약서 최종 검토 후 서명",
    date: "2026-09-08",
    startTime: "11:00",
    endTime: "12:00",
    type: "meeting",
    company: "네오푸드",
    location: "네오푸드 회의실",
    attendees: ["demo", "윤지훈"],
  },
  {
    id: "evt-5",
    title: "신입 온보딩 강의",
    description: "플로우데스크 사용법 교육",
    date: "2026-09-09",
    startTime: "10:00",
    endTime: "12:00",
    type: "lecture",
    location: "교육장",
    attendees: ["김서연", "박민수", "이하늘"],
  },
  {
    id: "evt-6",
    title: "월간 매출 리뷰",
    date: "2026-09-10",
    startTime: "10:00",
    endTime: "11:00",
    type: "meeting",
    location: "화상회의",
    attendees: ["demo", "윤지훈", "최준영"],
  },
  {
    id: "evt-7",
    title: "부산 고객사 출장",
    description: "그린로지스 현장 점검",
    date: "2026-09-11",
    endDate: "2026-09-12",
    allDay: true,
    type: "trip",
    company: "그린로지스",
    location: "부산",
    attendees: ["최준영", "박민수"],
  },
  {
    id: "evt-8",
    title: "김서연 연차",
    date: "2026-09-15",
    endDate: "2026-09-16",
    allDay: true,
    type: "leave",
    attendees: ["김서연"],
  },
  {
    id: "evt-9",
    title: "분기 목표 워크숍",
    date: "2026-09-18",
    startTime: "09:00",
    endTime: "12:00",
    type: "other",
    location: "본사 대회의실",
    attendees: ["demo", "김서연", "박민수", "윤지훈", "이하늘", "최준영"],
  },
  {
    id: "evt-10",
    title: "세금 신고 마감",
    date: "2026-09-25",
    allDay: true,
    type: "deadline",
    attendees: [],
  },
  {
    id: "evt-11",
    title: "디자인 리뷰",
    date: "2026-09-04",
    startTime: "10:00",
    endTime: "11:00",
    type: "meeting",
    location: "디자인실",
    attendees: ["김서연", "이하늘"],
  },
];

export const initialFinances: FinanceRecord[] = [
  {
    id: "fin-1",
    client: "블루웨이브",
    description: "SaaS 연간 구독료",
    amount: 4800000,
    status: "paid",
    date: "2026-08-05",
    category: "subscription",
  },
  {
    id: "fin-2",
    client: "한빛소프트",
    description: "커스터마이징 1차 대금",
    amount: 3500000,
    status: "pending",
    date: "2026-08-20",
    dueDate: "2026-09-10",
    category: "sales",
  },
  {
    id: "fin-3",
    client: "네오푸드",
    description: "온보딩·교육 패키지",
    amount: 1200000,
    status: "paid",
    date: "2026-08-28",
    category: "sales",
  },
  {
    id: "fin-4",
    client: "그린로지스",
    description: "월 유지보수",
    amount: 850000,
    status: "overdue",
    date: "2026-08-01",
    dueDate: "2026-08-31",
    category: "subscription",
  },
  {
    id: "fin-5",
    client: "스카이마케팅",
    description: "대시보드 구축 프로젝트",
    amount: 6200000,
    status: "pending",
    date: "2026-09-01",
    dueDate: "2026-09-20",
    category: "sales",
  },
  {
    id: "fin-6",
    client: "클라우드팩토리",
    description: "추가 시트 라이선스",
    amount: 450000,
    status: "paid",
    date: "2026-09-02",
    category: "subscription",
  },
  {
    id: "fin-7",
    client: "오피스용품",
    description: "9월 비품 구매",
    amount: -320000,
    status: "paid",
    date: "2026-09-03",
    category: "expense",
  },
  {
    id: "fin-8",
    client: "미라클헬스케어",
    description: "파일럿 도입 비용",
    amount: 2100000,
    status: "pending",
    date: "2026-09-04",
    dueDate: "2026-09-25",
    category: "sales",
  },
];

export const ME_EMAIL = "demo@flowdesk.kr";
export const ME_FROM = "플로우데스크 <demo@flowdesk.kr>";

export const initialMails: MailMessage[] = [
  {
    id: "mail-1",
    folder: "inbox",
    from: "김현우 <kim@hanbitsoft.co.kr>",
    to: ME_FROM,
    subject: "ERP 커스터마이징 견적 문의",
    body: `안녕하세요, 한빛소프트 김현우입니다.

지난번 미팅에서 말씀드린 ERP 커스터마이징 건으로 1차 견적을 요청드립니다.
- 모듈: 재고·발주·정산
- 사용자 수: 약 40명
- 희망 일정: 10월 킥오프

가능하신 일정과 대략 금액을 회신 부탁드립니다.
감사합니다.`,
    snippet: "ERP 커스터마이징 1차 견적 요청드립니다. 모듈은 재고·발주·정산…",
    starred: true,
    read: false,
    createdAt: "2026-09-04T08:20:00",
  },
  {
    id: "mail-2",
    folder: "inbox",
    from: "이수진 <lee@bluewave.io>",
    to: ME_FROM,
    cc: "최준영 <choi@flowdesk.kr>",
    subject: "블루웨이브 킥오프 미팅 확인",
    body: `안녕하세요.

오늘 14:00 킥오프 미팅 일정을 확인드립니다.
장소는 회의실 A이며, 화상 링크는 별도 공유드리겠습니다.

안건: 범위 합의, 일정, 담당자 배정
준비해 오실 자료가 있으시면 미리 알려주세요.

수고하세요.`,
    snippet: "오늘 14:00 킥오프 미팅 일정을 확인드립니다. 장소는 회의실 A…",
    starred: false,
    read: false,
    createdAt: "2026-09-04T07:45:00",
  },
  {
    id: "mail-3",
    folder: "inbox",
    from: "박지우 <park@neofood.kr>",
    to: ME_FROM,
    subject: "계약서 최종본 검토 요청",
    body: `윤지훈 님, 안녕하세요. 네오푸드 박지우입니다.

전자계약서 최종본을 첨부했습니다(데모에서는 본문만).
8일 서명 미팅 전까지 조항 검토 부탁드립니다.
특히 유지보수 기간과 SLA 부분을 봐주시면 감사하겠습니다.`,
    snippet: "전자계약서 최종본 검토 부탁드립니다. 유지보수·SLA 조항…",
    starred: true,
    read: true,
    createdAt: "2026-09-03T16:10:00",
  },
  {
    id: "mail-4",
    folder: "inbox",
    from: "정민아 <jung@greenlogis.com>",
    to: ME_FROM,
    subject: "월 유지보수 입금 일정 안내",
    body: `안녕하세요, 그린로지스 정민아입니다.

8월분 유지보수 비용 입금이 지연되어 연락드립니다.
이번 주 금요일까지 처리 예정이며, 세금계산서 재발행이 필요하면 말씀해 주세요.

불편을 드려 죄송합니다.`,
    snippet: "8월분 유지보수 입금이 지연되어 안내드립니다. 금요일 처리 예정…",
    starred: false,
    read: true,
    createdAt: "2026-09-03T11:30:00",
  },
  {
    id: "mail-5",
    folder: "inbox",
    from: "오세훈 <oh@skymarketing.kr>",
    to: ME_FROM,
    subject: "대시보드 구축 범위 추가 문의",
    body: `플로우데스크 팀 안녕하세요.

스카이마케팅 대시보드 프로젝트에 마케팅 채널별 ROI 위젯을 추가하고 싶습니다.
추가 공수와 비용을 알려주시면 내부 검토 후 회신드리겠습니다.`,
    snippet: "마케팅 채널별 ROI 위젯 추가 가능 여부와 공수·비용 문의…",
    starred: false,
    read: false,
    createdAt: "2026-09-02T14:05:00",
  },
  {
    id: "mail-6",
    folder: "sent",
    from: ME_FROM,
    to: "김현우 <kim@hanbitsoft.co.kr>",
    subject: "Re: ERP 커스터마이징 견적 문의",
    body: `김현우 님, 안녕하세요.

견적 요청 감사합니다. 이번 주 중으로 1차 견적서를 보내드리겠습니다.
필요하신 모듈 범위(재고·발주·정산) 기준으로 산정하겠습니다.

추가로 연동하실 기존 시스템(회계/POS 등)이 있으시면 알려주세요.`,
    snippet: "이번 주 중 1차 견적서를 보내드리겠습니다. 추가 연동 시스템…",
    starred: false,
    read: true,
    createdAt: "2026-09-04T09:15:00",
  },
  {
    id: "mail-7",
    folder: "sent",
    from: ME_FROM,
    to: "박지우 <park@neofood.kr>",
    cc: "윤지훈 <yoon@flowdesk.kr>",
    subject: "네오푸드 킥오프 일정 제안",
    body: `박지우 님 안녕하세요.

9월 8일 11시 계약 서명 이후, 같은 날 오후 온보딩 킥오프를 제안드립니다.
참석 가능하신지 회신 부탁드립니다.`,
    snippet: "9월 8일 계약 서명 이후 온보딩 킥오프를 제안드립니다…",
    starred: false,
    read: true,
    createdAt: "2026-09-02T10:40:00",
  },
  {
    id: "mail-8",
    folder: "drafts",
    from: ME_FROM,
    to: "오세훈 <oh@skymarketing.kr>",
    subject: "ROI 위젯 추가 견적 (작성 중)",
    body: `오세훈 님, 안녕하세요.

요청하신 ROI 위젯 추가 건으로 초안을 작성 중입니다.

- 예상 공수: 약 2주
- 포함: 채널별 집계, CSV보내기

(본문 마저 작성 후 발송 예정)`,
    snippet: "ROI 위젯 추가 견적 초안 — 예상 공수 약 2주…",
    starred: false,
    read: true,
    createdAt: "2026-09-04T10:00:00",
  },
  {
    id: "mail-9",
    folder: "drafts",
    from: ME_FROM,
    to: "정민아 <jung@greenlogis.com>",
    subject: "부산 출장 일정 조율",
    body: `정민아 님,

11–12일 부산 현장 점검 일정 관련 초안입니다.
방문 가능 시간대를 적어 주시면 확정하겠습니다.`,
    snippet: "부산 현장 점검 일정 조율 초안입니다…",
    starred: false,
    read: true,
    createdAt: "2026-09-03T18:20:00",
  },
  {
    id: "mail-10",
    folder: "trash",
    from: "스팸마케팅 <promo@adblast.example>",
    to: ME_FROM,
    subject: "[광고] 지금 가입하면 할인!",
    body: "관심 없는 프로모션 메일입니다.",
    snippet: "관심 없는 프로모션 메일입니다.",
    starred: false,
    read: true,
    createdAt: "2026-09-01T12:00:00",
    previousFolder: "inbox",
  },
  {
    id: "mail-11",
    folder: "inbox",
    from: "한지민 <han@miraclehc.kr>",
    to: ME_FROM,
    subject: "파일럿 도입 킥오프 일정 문의",
    body: `안녕하세요, 미라클헬스케어 한지민입니다.

파일럿 도입 비용 관련 미팅을 잡고 싶습니다.
다음 주 화·수 오후 중 가능하신 슬롯이 있으신가요?

자료는 사전에 공유드리겠습니다.`,
    snippet: "파일럿 도입 킥오프 미팅 일정 문의 — 다음 주 화·수 오후…",
    starred: false,
    read: true,
    createdAt: "2026-09-04T06:50:00",
  },
];
