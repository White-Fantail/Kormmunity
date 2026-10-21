# NZ 한인 커뮤니티 보드 (Kakao)

뉴질랜드 거주 한인을 위한 한국어 커뮤니티 마켓 보드입니다. 카카오 오픈채팅 스타일의 빠른 글쓰기 경험을 목표로 하며, 현재 Phase 0~10 범위의 기본 기능이 구현되어 있습니다.

## Tech Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL

## Implemented (Phase 0~10)
- Next.js App Router 프로젝트 기본 구조
- Prisma 스키마 (User, City, Category, Post, PostImage, Comment, ModerationAction, UserRestriction)
- 도시/카테고리 seed 데이터
- 실제 Kakao OAuth 연동 (Phase 11)
  - `/api/auth/kakao` → 카카오 인증 URL로 리다이렉트 (state CSRF 보호)
  - `/api/auth/kakao/callback` → 코드 교환, 사용자 정보 조회, 세션 생성
  - 환경 변수 미설정 시 개발용 임시 로그인 폴백
  - 카카오 프로필 이미지 자동 동기화
- 권한 helper (USER, MODERATOR, COORDINATOR, ADMIN)
- 게시글 MVP
  - 글 작성 (제목 optional, 본문/카테고리 required, 지역은 프로필 기본 지역 사용)
  - 팔아요 카테고리 가격 required
  - 목록/상세/내 글
  - 카테고리/지역 다중 필터
  - 본인 글 수정/삭제
  - 판매글 판매완료 처리
- 이미지 업로드 (Cloudinary 연동)
  - 글 작성/수정 시 이미지 업로드
  - 목록 썸네일/상세 갤러리 표시
- 댓글 기능
  - 게시글 상세에서 댓글 작성/조회
  - 본인 댓글 삭제 (모더레이터/관리자 삭제 가능)
  - 카테고리별 quick comment template 버튼
  - Comment-before-contact 게이트 및 댓글 작성 후 즉시 Kakao 연락 해제
- Neighbour Warmth 상호작용
  - 게시글/댓글 좋아요, 베스트 댓글 지정
  - 이웃온기 점수(0~100) 및 단계 라벨 표시
- 카카오 연락 흐름
  - 프로필 기본 지역 등록
  - 프로필 오픈채팅 링크 등록
  - 게시글별 연락 링크 override
  - 게시글 상세 연락 버튼/미등록 fallback
  - 카테고리 기본값 기반 `Require comment before Kakao contact` 설정
  - 카테고리별 `contactSectionDefaultExpanded` 설정으로 글쓰기 연락 방법 섹션 기본 펼침 제어
  - 판매/나눔 등 투명성이 중요한 글에서 공개 댓글 후 1회 연락 해제
- 모더레이터 운영 기능
  - 신고 검토/확정
  - 보류/재게시
  - 사용자 관리자 검토 요청
- 관리자 기능
  - 사용자 역할/상태 관리
  - 게시글/댓글 관리
  - 게시글 상단 고정/해제
  - 카테고리/도시 관리
- Phase 10 폴리시
  - 모바일 네비게이션/카드 UI 개선
  - 라우트 로딩 스켈레톤
  - 에러 경계 UI (route/global)
  - SEO 메타데이터 보강 (layout + 목록/상세)
  - 기본 분석 이벤트 로깅 (클라이언트 전환 + 서버 액션)
  - 게시글/댓글 작성 rate limit + spam 체크
- 한국어 UI 라벨/메시지 반영
- 검색/알림
  - 제목/본문/작성자 닉네임 통합 검색
  - 검색어 저장 및 카카오톡 알림 수신 여부 설정
  - 조건 매칭 새 글 등록 시 카카오톡 메시지 자동 발송 (글 링크/사진 링크 포함)
  - 카카오 메시지 발송 파이프라인 분리 (SQS + Lambda)
    - 게시글 등록 -> 검색 매칭 큐 -> 검색 매칭 람다 -> 카톡 발송 큐 -> 발송 람다
    - 댓글/광고 알림은 카톡 발송 큐로 직접 적재
    - 전송 로그(`KakaoMessageDelivery`) 기반 재시도/실패 추적 유지
- Unified Post Card system
  - 공통 `PostCard` variant 시스템(`featured` / `compact` / `minimal`)으로 목록 UI 통합
  - `/posts`는 featured, `/my/posts`·`/my/saved`·`/users/[userId]`는 compact, `/my/notifications`는 minimal 적용
  - 공통 Badge 컴포넌트(`components/posts/post-badge.tsx`) 기반 태그 스타일 통일
- category-based configurable post tag/status system
  - 카테고리별 태그 옵션 관리(활성/기본/정렬/색상)
  - 글 작성/수정/상세/목록에서 설정 기반 태그 선택 및 표시
- **커뮤니티 스코어 기반 자동 보류 시스템 (internal)**
  - Post/Comment에 내부 `communityScore` 추가
  - 좋아요·신고·베스트댓글·운영 조치에 따른 점수 자동 반영 (행위자 `neighbourWarmth` 가중치 적용)
  - 임계값(-8 게시글 / -5 댓글) 이하 시 자동 `HELD` 처리
  - 보류 게시글: 일반 사용자에게 검토 중 메시지 표시, 모더레이터/관리자만 전문 열람 가능
  - 보류 댓글: 현재 일반 사용자 조회에서는 제외되며, 모더레이터/관리자만 전문 열람 가능
  - `CommunityScoreEvent` 감사 로그 테이블 추가
  - 모더레이터/관리자 화면에 점수 및 신고 수 표시
  - 상세 문서: `docs/community-score-moderation.md`
- **사용자 온기 감점 정책 (moderation-confirmed only)**
  - 신고 제출 시점에는 `neighbourWarmth`를 감점하지 않음
  - 확정된 조치에 대해서만 감점: 게시글 신고확정(-1.0), 댓글 신고확정(-1.2), 운영진 보류확정(-3.0), 관리자 삭제확정(-6.0), 허위 신고확정(-2.0)

## Comment-before-contact system
- 카테고리별로 `requireCommentBeforeContactDefault` 값을 설정할 수 있습니다.
- 카테고리별로 `contactSectionDefaultExpanded` 값을 설정해 글쓰기 화면의 연락 방법 섹션 기본 상태를 제어할 수 있습니다.
- 게시글 작성자는 글 단위로 기본값을 override 할 수 있습니다.
- 글 작성자 본인과 모더레이터/관리자는 게이트를 우회합니다.

## Role Policy
- `USER`: 일반 사용자(본인 글/댓글 작성 및 수정)
- `MODERATOR`: 신고/보류/복구/숨김·삭제 등 콘텐츠 moderation 담당
- `COORDINATOR`: 지역 운영/공지/커뮤니티 활성화 담당(기본 moderation 권한 없음)
- `ADMIN`: 전체 권한(MODERATOR + COORDINATOR 포함, 역할 부여/시스템 설정)

## AccountType Policy
- `REAL_USER`: 실제 사용자 계정
- `PERSONA`: 운영자가 관리하는 커뮤니티 활성화용 일반형 계정
- `OPERATOR`: 운영팀/공지/안내용 운영 계정
- `SYSTEM`: 자동 시스템 메시지용 계정
- 상세 문서: `docs/managed-accounts.md`

## 작성자 선택 정책
- 일반 사용자(`USER`/`MODERATOR`/`COORDINATOR`)는 항상 본인 계정으로만 글/댓글 작성 가능
- `ADMIN`만 글/댓글 작성 시 `PERSONA` 또는 `OPERATOR` + `isManagedAccount=true` + `isActive=true` 계정을 선택 가능
- `SYSTEM`, `REAL_USER`, 비활성 managed 계정은 대리 작성 대상으로 선택 불가
- 게시글/댓글에는 `authorId`(공개 작성자)와 `createdByUserId`(실제 작성자)를 분리 저장해 내부 감사 추적
- `OPERATOR` 작성자는 공개 UI에서 운영자 배지를 표시하며 온기/신뢰성 지표를 노출하지 않음
- `PERSONA`는 공개 UI에서 일반 사용자처럼 표시(별도 페르소나 라벨 비노출)

## RBAC Change Log
- 기존 `COORDINATOR`가 담당하던 신고 처리/보류 복구/콘텐츠 제재 중심 moderation 권한을 `MODERATOR`로 이전했습니다.
- 일반 사용자는 삭제/보류되지 않은 댓글 1개만 남겨도 Kakao 연락 버튼이 즉시 열립니다.

## 글쓰기 UX 흐름
- 게시 위치 선택(국가/도시/카테고리) → 제목(선택) → 본문 → 사진 → 추천 태그 → 연락 방법(선택) → 하단 액션(취소/올리기) 순서로 구성됩니다.
- 연락 방법 섹션은 카테고리 설정 기반 기본 펼침 상태로 시작하며, 작성자가 직접 펼치기/접기를 전환할 수 있습니다.

## Category quick comment templates
- 카테고리별 `quickCommentTemplates` JSON 배열로 상세 페이지 quick reply chip을 구성합니다.
- SALE / GIVEAWAY / RECRUIT / QUESTION 카테고리는 기본 quick template seed를 제공합니다.
- quick template 클릭 시 댓글 입력창이 즉시 채워져 공개 상호작용을 더 빠르게 유도합니다.

## Community engagement strategy
- 거래/나눔 글에서 비공개 연락 전에 공개 댓글을 유도해 중복 문의를 줄입니다.
- quick comment template로 첫 댓글 진입 장벽을 낮춰 커뮤니티 대화를 늘립니다.
- 공개 질문/답변이 누적되어 같은 문의를 반복하지 않아도 되는 정보 자산을 만듭니다.

## Trade transparency benefits
- “Still available?” 같은 기본 질문을 공개 댓글로 남기면 다른 사용자도 상태를 확인할 수 있습니다.
- 픽업 위치/가능 시간/가격 협의 여부가 공개되면 거래 신뢰도와 속도가 높아집니다.
- 삭제/보류 댓글은 연락 해제 조건에서 제외되어 운영 투명성을 유지합니다.

## Not Yet Implemented
- 업로드 Provider 추상화 (Cloudinary 외 provider 교체 가능 구조)
- 분석 이벤트 외부 대시보드 연동
- 검색 고도화 및 운영 자동화
- 상세 백로그: `docs/current-improvement-backlog.md`

## Post Card Component Structure
```txt
components/posts/
  PostCard/
   ├─ PostCard.tsx
   ├─ PostCardFeatured.tsx
   ├─ PostCardCompact.tsx
   ├─ PostCardMinimal.tsx
   ├─ PostCardActions.tsx
   ├─ PostCardMeta.tsx
   ├─ PostCardBadges.tsx
   └─ types.ts
```

## Local Setup
1. 의존성 설치
   ```bash
   npm install
   ```
2. 환경 변수 설정
   ```bash
   cp .env.example .env
   ```
3. Prisma Client 생성
   ```bash
   npm run prisma:generate
   ```
4. DB 마이그레이션 실행
   ```bash
   npm run prisma:migrate -- --name init
   ```
5. Seed 실행
   ```bash
   npm run prisma:seed
   ```
6. 개발 서버 실행
   ```bash
   npm run dev
   ```

## Environment Variables
- `DATABASE_URL`: PostgreSQL 연결 문자열
- `KAKAO_CLIENT_ID`
- `KAKAO_CLIENT_SECRET`
- `KAKAO_REDIRECT_URI`
- `KAKAO_AUTH_SCOPE` (기본값 `talk_message`)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL` (기본 SEO 메타데이터 base URL)
- `SESSION_MAX_AGE_SECONDS` (기본값 604800초 = 7일)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `OPENROUTER_API_KEY` (운영 계정 게시글/댓글 자동 생성용 OpenRouter API 키)
- `OPENROUTER_MODEL` (선택, generic 호출 기본값 `openrouter/auto`)
- `OPENROUTER_POST_MODEL` (선택, 게시글 기본값 `google/gemini-3-flash-preview`)
- `OPENROUTER_COMMENT_MODEL` (선택, 댓글 기본값 `google/gemini-3-flash-preview`)
- `OPENROUTER_COST_TIER` (선택, Auto Router 사용 시 `low`/`medium`/`high`/`xhigh`/`max`, 기본값 `low`)
- `OPENROUTER_API_BASE_URL` (선택, 기본값 `https://openrouter.ai/api/v1`)
- `OPENROUTER_TIMEOUT_MS` (선택, 공통 기본값 22000ms)
- `OPENROUTER_POST_TIMEOUT_MS` (선택, 게시글 timeout override)
- `OPENROUTER_COMMENT_TIMEOUT_MS` (선택, 댓글 기본값 10000ms; 빈 응답/timeout 시 1회 재시도)
- `AMAZON_WEB_SERVICE_REGION` (SQS/Lambda 연동 시 권장, `AWS_REGION` 대체)
- `KAKAO_USE_SQS_PIPELINE` (`true`면 카카오 전송을 SQS 기반으로 비동기 처리)
- `KAKAO_USE_SEARCH_MATCHER_LAMBDA` (`true`면 게시글 검색 매칭을 별도 람다로 분리)
- `KAKAO_SEARCH_MATCH_QUEUE_URL` (검색 매칭 큐 URL)
- `KAKAO_SEND_QUEUE_URL` (카카오 발송 큐 URL)

## Important Notes
- 카카오 로그인은 `KAKAO_CLIENT_ID`와 `KAKAO_REDIRECT_URI` 환경 변수가 설정된 경우 실제 OAuth 흐름을 사용합니다. 미설정 시 개발용 임시 로그인으로 폴백됩니다.
- 카카오 개발자 콘솔(https://developers.kakao.com)에서 앱을 등록하고, `KAKAO_REDIRECT_URI`에 `/api/auth/kakao/callback` 경로를 등록해야 합니다.
- 이미지 업로드는 현재 Cloudinary API 환경 변수 설정이 필요합니다.
- `OPENROUTER_API_KEY`가 없으면 ADMIN 자동 생성 버튼은 보여도 생성 요청은 실패 메시지를 반환합니다.
- AWS Amplify + Amazon RDS(PostgreSQL) 배포 시 `DATABASE_URL`은 RDS 연결 문자열로 설정하고, `NEXT_PUBLIC_SITE_URL`(권장) 또는 `NEXTAUTH_URL`을 반드시 설정해야 SEO 메타데이터와 카카오 알림 링크가 올바른 절대 URL을 사용합니다.
- 카카오 SQS/Lambda 파이프라인은 `nodejs22.x` 런타임을 사용하며, ES module `.js` 번들 실행을 위해 배포 아티팩트 루트에 `package.json`의 `"type": "module"`이 반드시 포함되어야 합니다.
- 카카오 SQS/Lambda 파이프라인 배포/운영 가이드는 `docs/kakao-notification-pipeline.md`를 참고하세요. Lambda 콘솔에서 수동으로 런타임을 바꿔도 다음 SAM 배포 시 워크플로우 설정값으로 덮어써질 수 있습니다.

## Next Focus
- Near-term / Mid-term / Long-term 로드맵 기준으로 진행
- 상세 로드맵: `docs/future-feature-roadmap.md`

## ChatGPT MCP (Admin only)

Kormmunity supports authenticated ChatGPT MCP publishing for managed PERSONA/OPERATOR accounts. An active Kakao ADMIN can connect via OAuth PKCE, review the selected account's persona and local public discussion, create a substantive draft, and explicitly publish it. Manage connections and revoke tokens at /admin/mcp. Apply migration 20261022093000_mcp_oauth first. See [setup guide](docs/mcp-chatgpt.md).
