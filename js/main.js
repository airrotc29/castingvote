// ===== 연도 자동 표시 =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== 모바일 네비게이션 토글 =====
(function () {
  const toggle = document.getElementById('navToggle');
  const list = document.getElementById('navList');
  if (!toggle || !list) return;

  toggle.addEventListener('click', () => {
    const open = list.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // 메뉴 항목 클릭 시 닫기
  list.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      list.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ===== 현장 갤러리 (gallery.json 동적 로드 + 라이트박스) =====
(function () {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('galleryEmpty');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const closeBtn = document.getElementById('lightboxClose');

  // 갤러리 데이터 로드 후 렌더링
  if (grid) {
    fetch('assets/data/gallery.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => {
        if (!Array.isArray(items) || items.length === 0) {
          if (empty) empty.hidden = false;
          return;
        }
        // 최신 사진이 위로 오도록 역순 정렬
        items.slice().reverse().forEach((item) => {
          const fig = document.createElement('figure');
          fig.className = 'gallery-item';
          const img = document.createElement('img');
          img.src = item.file;
          img.alt = item.caption || '현장 사진';
          img.loading = 'lazy';
          fig.appendChild(img);
          if (item.caption) {
            const cap = document.createElement('figcaption');
            cap.textContent = item.caption;
            fig.appendChild(cap);
          }
          grid.appendChild(fig);
        });
      })
      .catch(() => { if (empty) empty.hidden = false; });
  }

  // 라이트박스 (이벤트 위임 — 동적으로 추가된 항목도 동작)
  if (!lightbox) return;
  if (grid) {
    grid.addEventListener('click', (e) => {
      const item = e.target.closest('.gallery-item');
      if (!item) return;
      const img = item.querySelector('img');
      const caption = item.querySelector('figcaption');
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxCaption.textContent = caption ? caption.textContent : '';
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
    });
  }

  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
  }
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();

// ===== 투표 영상 (videos.json + 유튜브 임베드) =====
(function () {
  const card = document.getElementById('videoCard');
  const modal = document.getElementById('videoModal');
  if (!card || !modal) return;

  const openBtn = card.querySelector('.js-video-open');
  const closeBtn = document.getElementById('videoModalClose');
  const player = document.getElementById('videoPlayer');
  const titleEl = document.getElementById('videoTitle');
  const listEl = document.getElementById('videoList');
  const cardDesc = document.getElementById('videoCardDesc');

  let videos = [];

  // 다양한 유튜브 URL에서 영상 ID 추출
  function youtubeId(url) {
    if (!url) return '';
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    if (m) return m[1];
    if (/^[\w-]{11}$/.test(url)) return url; // 이미 ID인 경우
    return '';
  }

  function thumb(id) {
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  function play(video) {
    const id = youtubeId(video.url);
    player.innerHTML =
      `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0" ` +
      `title="${(video.title || '투표 영상').replace(/"/g, '')}" frameborder="0" ` +
      `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
      `allowfullscreen></iframe>`;
    titleEl.textContent = video.title || '';
    listEl.querySelectorAll('.videomodal-thumb').forEach((t) => t.classList.remove('active'));
    const active = listEl.querySelector(`[data-url="${video.url}"]`);
    if (active) active.classList.add('active');
  }

  function renderList() {
    listEl.innerHTML = '';
    videos.forEach((v) => {
      const id = youtubeId(v.url);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'videomodal-thumb';
      item.dataset.url = v.url;
      item.innerHTML =
        `<img src="${thumb(id)}" alt="${(v.title || '영상').replace(/"/g, '')}" loading="lazy" />` +
        `<span>${v.title || '제목 없음'}</span>`;
      item.addEventListener('click', () => play(v));
      listEl.appendChild(item);
    });
  }

  function openModal() {
    if (videos.length === 0) {
      player.innerHTML = '<p class="videomodal-empty">아직 등록된 영상이 없습니다.</p>';
      titleEl.textContent = '';
      listEl.innerHTML = '';
    } else {
      renderList();
      play(videos[0]);
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    player.innerHTML = ''; // 재생 중지
  }

  // 영상 목록 로드 → 카드 썸네일/설명 갱신
  fetch('assets/data/videos.json', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : []))
    .then((data) => {
      videos = Array.isArray(data) ? data.slice().reverse() : [];
      if (videos.length > 0) {
        const id = youtubeId(videos[0].url);
        const t = document.getElementById('videoCardThumb');
        t.style.backgroundImage = `url(${thumb(id)})`;
        t.classList.add('has-thumb');
        if (cardDesc) cardDesc.textContent = `총 ${videos.length}개의 영상을 확인하세요.`;
      }
    })
    .catch(() => {});

  openBtn.addEventListener('click', openModal);
  card.querySelector('.resource-thumb').addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
})();

// ===== 미리보기 모달 (홍보자료 · 견적서 공용) =====
(function () {
  const previewer = document.getElementById('previewer');
  const stage = document.getElementById('previewerStage');
  const closeBtn = document.getElementById('previewerClose');
  const downloadBtn = document.getElementById('previewerDownload');
  if (!previewer) return;

  function open(file, type, title) {
    stage.innerHTML = '';
    if (type === 'pdf') {
      const frame = document.createElement('iframe');
      frame.src = file;
      frame.title = title || '';
      stage.appendChild(frame);
    } else {
      const img = document.createElement('img');
      img.src = file;
      img.alt = title || '';
      stage.appendChild(img);
    }
    downloadBtn.href = file;
    previewer.classList.add('open');
    previewer.setAttribute('aria-hidden', 'false');
  }

  // 홍보자료 카드 미리보기
  document.querySelectorAll('.resource-item .js-preview').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.resource-item');
      const title = item.querySelector('h3') ? item.querySelector('h3').textContent : '';
      open(item.getAttribute('data-file'), item.getAttribute('data-type') || 'image', title);
    });
  });

  // 견적서 미리보기 (버튼 자체에 data 속성)
  document.querySelectorAll('.js-quote-preview').forEach((btn) => {
    btn.addEventListener('click', () => {
      open(btn.getAttribute('data-file'), btn.getAttribute('data-type') || 'image', '당사 견적서');
    });
  });

  function close() {
    previewer.classList.remove('open');
    previewer.setAttribute('aria-hidden', 'true');
    stage.innerHTML = '';
  }
  closeBtn.addEventListener('click', close);
  previewer.addEventListener('click', (e) => { if (e.target === previewer) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();

// ===== 타사 견적서 업로드 =====
(function () {
  const form = document.getElementById('uploadForm');
  if (!form) return;

  const drop = document.getElementById('uploadDrop');
  const input = document.getElementById('uploadInput');
  const text = document.getElementById('uploadText');
  const hint = document.getElementById('uploadHint');
  const nameEl = document.getElementById('uploadName');
  const emailEl = document.getElementById('uploadEmail');

  // 실제 파일 업로드를 사용하려면 아래에 폼 처리 엔드포인트(예: Formspree)를 입력하세요.
  // 비워두면 메일 클라이언트(mailto)로 안내하는 방식으로 동작합니다.
  const UPLOAD_ENDPOINT = '';
  const TO_EMAIL = 'airrotc29@gmail.com';
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  let selected = null;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function setFile(file) {
    if (!file) return;
    if (file.size > MAX_SIZE) {
      hint.className = 'form-hint error';
      hint.textContent = '파일 용량이 너무 큽니다. (최대 10MB)';
      return;
    }
    selected = file;
    text.textContent = file.name + ' (' + formatSize(file.size) + ')';
    text.classList.add('has-file');
    hint.className = 'form-hint';
    hint.textContent = '';
  }

  input.addEventListener('change', () => setFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('dragover'); })
  );
  drop.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) { input.files = e.dataTransfer.files; setFile(file); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hint.className = 'form-hint';
    hint.textContent = '';

    const name = nameEl.value.trim();
    const email = emailEl.value.trim();

    if (!selected) {
      hint.className = 'form-hint error';
      hint.textContent = '업로드할 견적서 파일을 선택해 주세요.';
      return;
    }
    if (!name || !email) {
      hint.className = 'form-hint error';
      hint.textContent = '담당자 이름과 이메일을 입력해 주세요.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      hint.className = 'form-hint error';
      hint.textContent = '올바른 이메일 주소를 입력해 주세요.';
      return;
    }

    // 엔드포인트가 설정된 경우: 실제 파일 업로드
    if (UPLOAD_ENDPOINT) {
      try {
        const fd = new FormData();
        fd.append('name', name);
        fd.append('email', email);
        fd.append('file', selected);
        const res = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('upload failed');
        hint.className = 'form-hint success';
        hint.textContent = '견적서가 정상적으로 접수되었습니다. 빠르게 회신드리겠습니다.';
        form.reset();
        text.textContent = '파일을 끌어다 놓거나 클릭하여 선택';
        text.classList.remove('has-file');
        selected = null;
      } catch (err) {
        hint.className = 'form-hint error';
        hint.textContent = '업로드 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      }
      return;
    }

    // 엔드포인트 미설정: 메일 클라이언트로 안내 (파일은 직접 첨부)
    const body =
      `담당자: ${name}\n` +
      `이메일: ${email}\n` +
      `첨부 예정 파일: ${selected.name}\n` +
      `------------------------------\n` +
      `※ 메일에 위 견적서 파일을 첨부하여 전송해 주세요.\n`;
    window.location.href =
      `mailto:${TO_EMAIL}` +
      `?subject=${encodeURIComponent('[HABITUS KOREA 타사 견적서] ' + name)}` +
      `&body=${encodeURIComponent(body)}`;
    hint.className = 'form-hint success';
    hint.textContent = '메일 작성 창이 열립니다. 선택한 파일을 첨부하여 전송해 주세요.';
  });
})();

// ===== 문의 폼 (mailto 전송) =====
(function () {
  const form = document.getElementById('contactForm');
  const hint = document.getElementById('formHint');
  if (!form) return;

  // 문의가 접수될 이메일 주소
  const TO_EMAIL = 'airrotc29@gmail.com';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    hint.className = 'form-hint';
    hint.textContent = '';

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const subject = form.subject.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !subject || !message) {
      hint.classList.add('error');
      hint.textContent = '필수 항목(*)을 모두 입력해 주세요.';
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      hint.classList.add('error');
      hint.textContent = '올바른 이메일 주소를 입력해 주세요.';
      return;
    }

    const body =
      `이름: ${name}\n` +
      `이메일: ${email}\n` +
      `연락처: ${phone || '-'}\n` +
      `------------------------------\n` +
      `${message}\n`;

    const mailto =
      `mailto:${TO_EMAIL}` +
      `?subject=${encodeURIComponent('[HABITUS KOREA 문의] ' + subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;

    hint.classList.add('success');
    hint.textContent = '메일 작성 창이 열립니다. 전송을 완료해 주세요.';
  });
})();
