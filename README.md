# HABITUS KOREA 전자투표 홈페이지

HABITUS KOREA의 **전자투표 안내 · 현장 사진 홍보 · 홍보자료 제공 · 온라인 문의 접수**를 위한 정적 웹사이트입니다.
별도의 빌드 과정 없이 브라우저에서 바로 동작하며, GitHub Pages 등으로 즉시 배포할 수 있습니다.

## 주요 기능

- **전자투표 바로가기** — 외부 전자투표 시스템으로 연결되는 버튼
- **현장 갤러리** — 현장 사진을 올려 홍보 (클릭 시 확대 보기)
- **홍보자료** — 포스터·브로슈어 등을 미리보기하고 다운로드
- **문의하기** — 이름/이메일/내용을 작성하면 담당자 메일로 전송

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

### 4. 문의 접수 이메일 변경
`js/main.js`의 `TO_EMAIL` 값과 `index.html` 연락처의 이메일 주소를 원하는 주소로 변경하세요.
문의 폼은 방문자의 메일 작성 창(mailto)을 열어 전송하는 방식입니다.

## 로컬 미리보기

```bash
# 간단한 정적 서버 실행 (Python 3)
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```
