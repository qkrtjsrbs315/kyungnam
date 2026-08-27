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

## 재고 부족 알림 (무료)

출고 후 재고가 기준 수량 이하로 떨어지면 알림을 보낸다.

- **ntfy 푸시(권장)**: 핸드폰에 ntfy 앱 설치 → 원하는 토픽명 구독 → `backend/.env` 에 `NTFY_TOPIC=토픽명` 설정. 가입·비용 없음.
- **이메일**: `.env` 에 SMTP 정보 입력 (Gmail 앱 비밀번호 사용 가능).
