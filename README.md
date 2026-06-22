# HABITUS KOREA 전자투표 홈페이지

HABITUS KOREA의 **전자투표 안내 · 현장 사진 홍보 · 홍보자료 제공 · 온라인 문의 접수**를 위한 정적 웹사이트입니다.
별도의 빌드 과정 없이 브라우저에서 바로 동작하며, GitHub Pages 등으로 즉시 배포할 수 있습니다.

## 주요 기능

- **전자투표 바로가기** — 외부 전자투표 시스템으로 연결되는 버튼
- **현장 갤러리** — 현장 사진을 올려 홍보 (클릭 시 확대 보기)
- **홍보자료** — 포스터·브로슈어, **회사 CI(로고)**, **개인정보처리 위탁계약서(위탁서)** 등을 미리보기하고 다운로드
- **견적서** — **당사 견적서 받기**(다운로드) + **타사 견적서 업로드**(파일 첨부 접수)
- **문의하기** — 이름/이메일/내용을 작성하면 담당자 메일로 전송
- **회사 CI 적용** — 헤더/푸터에 (주)HABITUS KOREA 공식 로고 표시

## 폴더 구조

```
.
├── index.html          # 메인 페이지
├── css/style.css       # 스타일
├── js/main.js          # 동작 (갤러리·미리보기·문의 폼)
└── assets/
    ├── images/         # 현장 갤러리 사진
    └── resources/      # 홍보자료(포스터, 브로슈어 등)
```

## 사용 방법

### 1. 전자투표 주소 변경
`index.html`에서 `id="voteLink"` 버튼의 `href`를 실제 전자투표 시스템 주소로 변경하세요.

### 2. 현장 사진 추가
1. 사진 파일을 `assets/images/` 폴더에 넣습니다.
2. `index.html`의 `현장 갤러리` 영역에서 아래 항목을 복사해 `src`와 캡션을 수정합니다.

```html
<figure class="gallery-item">
  <img src="assets/images/내사진.jpg" alt="설명" loading="lazy" />
  <figcaption>사진 설명</figcaption>
</figure>
```

### 3. 홍보자료 추가
1. 자료 파일(이미지 또는 PDF)을 `assets/resources/` 폴더에 넣습니다.
2. `index.html`의 `홍보자료` 영역에서 항목을 복사한 뒤
   - `data-file` : 파일 경로
   - `data-type` : `image` 또는 `pdf`
   - `다운로드` 링크의 `href` 를 같은 파일 경로로 맞춰줍니다.

```html
<article class="resource-item" data-file="assets/resources/자료.pdf" data-type="pdf">
  ...
  <a class="btn btn-sm btn-primary" href="assets/resources/자료.pdf" download>다운로드 ↓</a>
</article>
```

> 현재 들어있는 이미지들은 자리표시용(placeholder) SVG입니다. 실제 사진/자료로 교체해 사용하세요.

### 4. 견적서 설정
- **당사 견적서**: `assets/resources/habitus-quote.svg`(예시 양식)를 실제 견적서 파일로 교체하고, `index.html`의 견적서 다운로드 링크 `href`를 맞춰주세요.
- **타사 견적서 업로드**: 기본값은 파일을 선택하면 메일 작성 창이 열려 직접 첨부·전송하는 방식입니다.
  실제 자동 업로드(서버 저장)를 원하시면 `js/main.js`의 `UPLOAD_ENDPOINT`에 폼 처리 서비스(예: [Formspree](https://formspree.io)) 엔드포인트 주소를 입력하세요. 입력 시 파일이 해당 서비스로 직접 전송됩니다.

### 5. 회사 CI(로고) / 위탁서 교체
- 로고: `assets/images/logo.png` (헤더·푸터·OG 이미지에 사용). 교체 시 같은 파일명을 사용하면 자동 반영됩니다.
- 위탁서: `assets/resources/habitus-personal-info-consignment.hwp` (한글 파일).

### 6. 문의 접수 이메일 변경
`js/main.js`의 `TO_EMAIL` 값과 `index.html` 연락처의 이메일 주소를 원하는 주소로 변경하세요.
문의 폼은 방문자의 메일 작성 창(mailto)을 열어 전송하는 방식입니다.

## 에이스 종합관리 — 관리단 구성 보고 / 본사 소통

각 **지점사업소 관리소장**이 휴대폰에서 **관리단 구성 진행 상황을 본사에 보고**하고,
**보고별 댓글 스레드**로 본사와 직접 소통하는 기능입니다. 메인 페이지의 **관리단 보고**(`#report`) 섹션에 있습니다.

- **보고 올리기**: 로그인 없이 지점·사업소명, 관리소장, 진행 단계, 보고 내용, 현장 사진(선택)을 입력해 올립니다.
- **본사 소통**: 각 보고를 열면 댓글 스레드가 있어 본사(본사 표시)와 현장이 메시지를 주고받습니다.
- **검색**: 지점·관리소장·내용으로 보고를 검색합니다.
- 데이터는 `assets/data/reports.json` 에 저장됩니다(보고마다 `comments` 배열 포함).

### 저장 방식 (3단계)

정적 사이트라 "로그인 없는 쓰기"를 위해 다음 순서로 동작합니다.

1. **중앙 저장 엔드포인트(권장)** — 토큰을 서버에 숨기는 프록시를 설정하면, 관리소장이 **로그인 없이** 올린 보고·댓글이 모두 **중앙에 기록**되어 본사와 전 지점이 함께 봅니다.
2. **본사 관리자 토큰** — 본사가 기존 *관리자* 로그인(푸터 ‘관리자’)으로 GitHub 토큰을 넣으면, 본사가 올리거나 삭제하는 내용은 직접 저장소에 커밋됩니다.
3. **로컬 기록 + 메일 전송(기본 폴백)** — 위 둘이 없을 때, 보고는 **그 기기에만 기록**되고 본사에는 **메일**로 전달됩니다. (앱은 바로 동작하며, 섹션 상단에 안내가 표시됩니다.)

### 중앙 저장 엔드포인트 설정 (Cloudflare Worker 예시)

로그인 없이 전 지점이 함께 보는 중앙 기록을 원하면, 토큰을 보관하는 프록시를 하나 배포하고
`index.html` `<head>` 에 주소를 지정하세요.

```html
<script>window.ACE_REPORT_ENDPOINT = 'https://your-worker.workers.dev';</script>
```

> 또는 브라우저 콘솔에서 `localStorage.setItem('ace_report_endpoint','https://...')` 로 임시 지정할 수 있습니다.

Cloudflare Worker 예시 (환경변수: `GH_TOKEN` = 저장소 contents 쓰기 권한 토큰):

```js
// reports.json 을 대신 커밋해 주는 프록시. 토큰은 Worker 비밀값으로만 보관됩니다.
const OWNER = 'airrotc29', REPO = '-', BRANCH = 'main', PATH = 'assets/data/reports.json';
const API = 'https://api.github.com';

export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });

    const { action, payload } = await req.json();
    const h = { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ace-report' };

    async function load() {
      const r = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}&_=${Date.now()}`, { headers: h });
      if (r.status === 404) return { items: [], sha: null };
      const d = await r.json();
      return { items: JSON.parse(atob(d.content.replace(/\s/g, ''))), sha: d.sha };
    }
    async function save(items, sha, msg) {
      const body = { message: msg, content: btoa(unescape(encodeURIComponent(JSON.stringify(items, null, 2)))), branch: BRANCH, ...(sha ? { sha } : {}) };
      await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${PATH}`, { method: 'PUT', headers: h, body: JSON.stringify(body) });
    }
    async function putImg(name, b64, i) {
      const path = `assets/images/reports/${Date.now()}-${i}-${name.replace(/[^a-zA-Z0-9.\-]/g, '-')}`;
      await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, { method: 'PUT', headers: h, body: JSON.stringify({ message: '보고 사진', content: b64, branch: BRANCH }) });
      return path;
    }

    const { items, sha } = await load();
    let next = items;
    if (action === 'addReport') {
      const rep = payload.report;
      rep.images = [];
      for (let i = 0; i < (payload.images || []).length; i++) rep.images.push(await putImg(payload.images[i].name, payload.images[i].base64, i));
      next = items.concat([rep]);
    } else if (action === 'addComment') {
      next = items.map(r => r.id === payload.reportId ? { ...r, comments: (r.comments || []).concat([payload.comment]) } : r);
    } else if (action === 'deleteReport') {
      next = items.filter(r => r.id !== payload.reportId);
    } else if (action === 'deleteComment') {
      next = items.map(r => r.id === payload.reportId ? { ...r, comments: (r.comments || []).filter(c => c.id !== payload.commentId) } : r);
    }
    await save(next, sha, '관리단 보고: ' + action);
    return new Response(JSON.stringify({ items: next }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};
```

> 보안: GitHub 토큰은 **절대 `index.html`/`js`에 직접 넣지 마세요.** (공개 저장소에 노출되면 GitHub가 자동 폐기합니다.) 반드시 위처럼 Worker 비밀값으로만 보관하세요.

## 로컬 미리보기

```bash
# 간단한 정적 서버 실행 (Python 3)
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```
