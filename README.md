# 위험물검사 고객지원 — GitHub + Supabase 버전

관리자가 사이트의 제목·문구·품질사례·매뉴얼·FAQ·양식자료를 직접 수정하고,
사진과 파일까지 Supabase에 저장하는 정적 웹사이트입니다.

## 이번 버전의 핵심

- 관리자 아이디 `kfi2275`는 `src/config/site.ts`에 고정
- 비밀번호 로그인과 변경은 Supabase Auth 사용
- 콘텐츠는 Supabase Database에 저장
- 사례 사진과 양식파일은 Supabase Storage에 저장
- RLS 정책으로 관리자만 등록·수정·삭제 가능
- 방문자는 공개된 내용만 로그인 없이 조회
- 브라우저 PBKDF2 코드가 없어 기존 반복 횟수 오류가 발생하지 않음
- 전체 기본 글씨를 기존보다 한 단계 크게 적용
- 검사시기·검사절차는 후배 직원 코드 연결 자리만 준비

## 1. GitHub에 코드 올리기

ZIP을 풀고 그 안의 **모든 파일과 폴더**를 GitHub 저장소 최상위에 올립니다.
`package.json`, `src`, `supabase`, `.github`가 저장소 첫 화면에서 보여야 합니다.

## 2. Supabase 관리자 계정 만들기

1. Supabase 프로젝트에서 `Authentication → Users`로 이동합니다.
2. `Add user → Create new user`를 선택합니다.
3. 이메일은 `kfi2275@admin.example.com`으로 입력합니다.
4. 사용할 초기 비밀번호를 입력합니다.
5. `Auto Confirm User`를 켜고 생성합니다.

이 이메일은 로그인 화면에 노출되지 않습니다. 사이트에는 아이디 `kfi2275`만 표시됩니다.

## 3. 데이터베이스와 저장소 만들기

둘 중 하나만 사용하면 됩니다.

### 가장 쉬운 방법

1. `supabase/migrations/20260819000000_admin_content.sql` 파일을 엽니다.
2. 전체 내용을 복사합니다.
3. Supabase `SQL Editor → New query`에 붙여넣고 `Run`을 누릅니다.

관리자 사용자를 먼저 만든 뒤 SQL을 실행해야 마지막 관리자 권한 등록까지 한 번에 됩니다.
SQL을 먼저 실행했다면 사용자 생성 후 SQL을 다시 실행해도 안전합니다.

### GitHub Integration을 사용하는 방법

Supabase의 GitHub 연결 화면에서 Working directory는 `.`으로 입력합니다.
저장소 최상위의 `supabase/` 폴더를 찾는다는 뜻입니다. Production branch는 `main`으로 지정합니다.

## 4. Supabase 연결값 넣기

Supabase `Project Settings → API`에서 다음 두 값을 확인합니다.

- Project URL
- publishable key 또는 legacy anon key

로컬 실행 시 `.env.example`을 복사해 `.env`로 이름을 바꾼 후 입력합니다.

```env
VITE_SUPABASE_URL=https://프로젝트주소.supabase.co
VITE_SUPABASE_ANON_KEY=공개용키
```

`service_role` 또는 secret key는 절대 이 프로젝트에 넣지 않습니다.
브라우저에는 공개용 키만 들어가며 실제 수정 권한은 RLS가 막아줍니다.

## 5. GitHub Pages로 공개하기

1. GitHub 저장소 `Settings → Secrets and variables → Actions`로 이동합니다.
2. 아래 Repository secret 두 개를 만듭니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. `Settings → Pages → Build and deployment`에서 Source를 `GitHub Actions`로 선택합니다.
4. 저장소의 `Actions` 탭에서 `Deploy site to GitHub Pages`가 완료될 때까지 기다립니다.

main 브랜치에 코드를 수정해 올릴 때마다 사이트가 자동으로 다시 배포됩니다.

## 6. 관리자 로그인과 비밀번호 변경

사이트의 `관리자` 메뉴에서 다음처럼 로그인합니다.

- 아이디: `kfi2275`
- 비밀번호: Supabase에서 관리자를 만들 때 정한 비밀번호

로그인 후 `비밀번호` 탭에서 새 비밀번호로 변경할 수 있습니다.

## 직접 수정할 위치

| 바꾸려는 내용 | 수정 위치 |
|---|---|
| 관리자 아이디·내부 로그인 이메일 | `src/config/site.ts` |
| 기본 제목·소개문구 | `src/defaults.ts` |
| 실제 운영 중 제목·문구 | 사이트 `관리자 → 기본문구` |
| 전체 글씨 크기 | `src/styles.css`의 `html { font-size: 17px; }` |
| 색상·레이아웃 | `src/styles.css` |
| 품질사례·사진 | 사이트 `관리자 → 품질사례` |
| 매뉴얼·FAQ | 사이트 `관리자 → 매뉴얼·FAQ` |
| 양식·첨부파일 | 사이트 `관리자 → 양식자료` |
| 검사시기 코드 | `src/features/schedule/` |
| 검사절차 코드 | `src/features/procedure/` |

관리자 아이디나 내부 로그인 이메일을 바꿀 때는 Supabase Auth 사용자 이메일과
`admin_users` 등록값도 같이 바꿔야 합니다. 사이트 문구는 관리자 화면에서 바꾸는 것이 가장 쉽습니다.

## 로컬에서 확인하기

Node.js 22 이상에서 실행합니다.

```bash
npm install
npm run dev
```

배포 전 최종 확인:

```bash
npm run build
```

## 보안 구조

- `anon/publishable key`가 공개되어도 RLS가 수정 요청을 차단합니다.
- 로그인 성공만으로는 관리자가 되지 않습니다.
- `public.admin_users`에 등록된 Auth 사용자만 `is_admin()`을 통과합니다.
- 비공개로 저장한 사례·매뉴얼·자료는 관리자에게만 조회됩니다.
- 공개 Storage 버킷은 방문자 다운로드용이며 업로드·삭제는 관리자만 가능합니다.
- 추후 검사시기 업체정보는 별도의 비공개 테이블과 업체별 RLS로 추가해야 합니다.

## 문제 해결

### “로그인은 됐지만 관리자 권한이 등록되지 않았습니다”

SQL Editor에서 아래 구문만 다시 실행합니다.

```sql
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = 'kfi2275@admin.example.com'
on conflict (user_id) do nothing;
```

### 사이트에 “Supabase 연결값을 입력하기 전”이라고 표시됨

GitHub Actions의 두 Repository secret 이름과 값이 정확한지 확인한 뒤 Actions를 다시 실행합니다.

### 관리자 저장만 실패함

Supabase SQL Editor에서 migration 전체가 오류 없이 실행됐는지 확인합니다.
특히 `public.is_admin()`, RLS policy, `public-assets` 버킷이 있어야 합니다.
