# 경남산업 재고관리 시스템

안전화·용품 재고를 관리하는 웹 애플리케이션.
입고/출고/반품, 사이즈별 재고, 거래처별 단가·매출, 일별/월별 출고 통계, 재고 부족 푸시 알림을 지원한다.

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | Next.js (App Router) + React + TypeScript + TailwindCSS |
| 프론트 배포 | Vercel |
| 백엔드 | FastAPI (Python) |
| DB | PostgreSQL (Neon) — 미설정 시 로컬 SQLite로 동작 |
| 알림 | ntfy.sh 무료 푸시 / 이메일(SMTP) |

## 폴더 구조

```
kyungnam/
├── frontend/          # Next.js 앱
│   └── src/
│       ├── app/       # 페이지 (대시보드, 제품, 입출고, 내역, 거래처, 통계)
│       ├── components/
│       └── lib/api.ts # 백엔드 API 클라이언트
└── backend/           # FastAPI 앱
    ├── app/
    │   ├── main.py    # 앱 진입점 (테이블 생성 + 기본 브랜드 시드)
    │   ├── models.py  # SQLAlchemy 모델
    │   ├── schemas.py # Pydantic 스키마
    │   ├── notify.py  # 재고 부족 알림 (ntfy/이메일)
    │   └── routers/   # brands, products, movements, clients, stats
    ├── kyungnam/      # 파이썬 가상환경 (git 제외)
    └── .env           # DATABASE_URL 등 (git 제외, .env.example 참고)
```

## 로컬 실행

### 백엔드 (FastAPI)

```powershell
cd backend
# 가상환경이 없다면: python -m venv kyungnam
.\kyungnam\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- `backend/.env` 가 없으면 로컬 SQLite(`dev.db`)로 동작한다.
- API 문서: http://localhost:8000/docs

### 프론트엔드 (Next.js)

```powershell
cd frontend
npm install
npm run dev
```

- http://localhost:3000 접속
- 백엔드 주소는 `frontend/.env.local` 의 `NEXT_PUBLIC_API_URL` 로 지정

## Neon (PostgreSQL) 연결

1. https://neon.tech 에서 무료 프로젝트 생성
2. 대시보드 > **Connect** 에서 연결 문자열 복사
3. `backend/.env` 생성 (`.env.example` 복사) 후 아래처럼 입력:

```
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

> 접두어를 `postgresql://` 이 아니라 `postgresql+psycopg://` 로 맞춰야 한다.
> 서버 재시작 시 테이블이 자동 생성된다.

## Vercel 배포 (프론트엔드)

1. GitHub 저장소를 Vercel 에서 Import
2. **Root Directory** 를 `frontend` 로 지정
3. 환경 변수 `NEXT_PUBLIC_API_URL` 에 배포된 백엔드 주소 입력

백엔드는 Render / Railway / Fly.io 등 무료 티어에 배포할 수 있다.
배포 후 `backend/.env` 의 `FRONTEND_ORIGINS` 에 Vercel 주소를 추가해 CORS 를 허용한다.

## 재고 부족 푸시 알림 (Firebase FCM)

출고 후 재고가 기준 수량 이하로 떨어지면 등록된 기기로 푸시 알림을 보낸다.

### Firebase 설정 절차

1. https://console.firebase.google.com 에서 프로젝트 생성 (무료 Spark 요금제면 충분)
2. **웹 앱 추가** (프로젝트 설정 > 일반 > 내 앱 > 웹) → SDK 구성값을
   `frontend/.env.local` 의 `NEXT_PUBLIC_FIREBASE_*` 에 입력
3. 프로젝트 설정 > **클라우드 메시징** > 웹 푸시 인증서에서 키 쌍 생성 →
   `NEXT_PUBLIC_FIREBASE_VAPID_KEY` 에 입력
4. 프로젝트 설정 > **서비스 계정** > 새 비공개 키 생성 → 다운로드한 json 을
   `backend/serviceAccountKey.json` 으로 저장하고 `backend/.env` 에
   `FIREBASE_CREDENTIALS=serviceAccountKey.json` 설정 (git 에는 올라가지 않음)
5. 프론트 왼쪽 메뉴의 **"푸시 알림 켜기"** 버튼 → 권한 허용 → "테스트 발송"으로 확인

> 아이폰은 Safari 에서 **홈 화면에 추가**한 뒤에만 웹 푸시를 받을 수 있다(iOS 16.4+).
> 안드로이드 Chrome 은 바로 동작한다.

### 보조 채널 (선택)

- **ntfy 푸시**: 핸드폰에 ntfy 앱 설치 → 토픽 구독 → `backend/.env` 에 `NTFY_TOPIC=토픽명`. 가입·비용 없음.
- **이메일**: `.env` 에 SMTP 정보 입력 (Gmail 앱 비밀번호 사용 가능).

## 제품 이미지

업로드한 이미지는 별도 스토리지 없이 **DB(Neon)에 바이너리로 저장**된다.
업로드 전에 프론트에서 긴 변 1000px JPEG 로 리사이즈하므로 장당 100~200KB 수준 -
Neon 무료 용량(0.5GB)으로 수천 장을 담을 수 있다.
`GET /products/{id}/image` 로 서빙되며 외부 이미지 URL 입력도 계속 지원한다.

## 데모 데이터

로컬에서 화면을 채워 보고 싶다면:

```powershell
cd backend
.\kyungnam\Scripts\python.exe seed_demo.py   # 12개월치 입출고 데모 데이터 생성
```

초기화하려면 `backend/dev.db` 파일을 삭제하면 된다 (Neon 연결 시엔 사용되지 않음).
