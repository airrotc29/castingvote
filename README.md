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

## 로컬 미리보기

```bash
# 간단한 정적 서버 실행 (Python 3)
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```
