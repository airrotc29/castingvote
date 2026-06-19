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

// ===== 공용 렌더 네임스페이스 (admin.js에서도 호출) =====
window.HK = window.HK || {};

function hkDelBtn(kind, id) {
  const i = String(id).replace(/"/g, '&quot;');
  return `<div class="admin-ctrls admin-only">` +
    `<button type="button" class="admin-edit" data-kind="${kind}" data-id="${i}">수정</button>` +
    `<button type="button" class="admin-del" data-kind="${kind}" data-id="${i}">삭제</button>` +
    `</div>`;
}
function hkEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// PDF.js 지연 로드 (PDF 첫 페이지 미리보기 썸네일용)
let _pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {}
      resolve(window.pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}

// 화면에 있는 .pdf-thumb 캔버스에 PDF 첫 페이지를 그림
function renderPdfThumbs() {
  const canvases = document.querySelectorAll('canvas.pdf-thumb:not([data-rendered])');
  if (canvases.length === 0) return;
  loadPdfJs().then((pdfjsLib) => {
    canvases.forEach((canvas) => {
      const url = canvas.getAttribute('data-pdf');
      if (!url) return;
      canvas.setAttribute('data-rendered', '1');
      pdfjsLib.getDocument(url).promise
        .then((pdf) => pdf.getPage(1))
        .then((page) => {
          const vp0 = page.getViewport({ scale: 1 });
          const targetW = 360;
          const scale = targetW / vp0.width;
          const viewport = page.getViewport({ scale });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          return page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        })
        .catch(() => { canvas.removeAttribute('data-rendered'); });
    });
  }).catch(() => {});
}

// ===== 현장 갤러리 =====
(function () {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('galleryEmpty');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const closeBtn = document.getElementById('lightboxClose');
  if (!grid) return;

  function render(items) {
    grid.innerHTML = '';
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0) { if (empty) empty.hidden = false; return; }
    if (empty) empty.hidden = true;
    arr.slice().reverse().forEach((item) => {
      const fig = document.createElement('figure');
      fig.className = 'gallery-item';
      fig.innerHTML =
        `<img src="${hkEsc(item.file)}" alt="${hkEsc(item.caption || '현장 사진')}" loading="lazy" />` +
        (item.caption ? `<figcaption>${hkEsc(item.caption)}</figcaption>` : '') +
        hkDelBtn('gallery', item.file);
      grid.appendChild(fig);
    });
  }

  window.HK.renderGallery = function (items) {
    if (items) return render(items);
    fetch('assets/data/gallery.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : [])).then(render).catch(() => render([]));
  };
  window.HK.renderGallery();

  // 라이트박스 (삭제 버튼 클릭은 제외)
  if (lightbox) {
    grid.addEventListener('click', (e) => {
      if (e.target.closest('.admin-del')) return;
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
    const close = () => { lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden', 'true'); };
    closeBtn.addEventListener('click', close);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }
})();

// ===== 공지·소식 =====
(function () {
  const list = document.getElementById('postsList');
  const empty = document.getElementById('postsEmpty');
  if (!list) return;

  function render(items) {
    list.innerHTML = '';
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0) { if (empty) empty.hidden = false; return; }
    if (empty) empty.hidden = true;
    arr.slice().reverse().forEach((p) => {
      const art = document.createElement('article');
      art.className = 'post-item';
      let html = '';
      if (p.image) html += `<div class="post-thumb"><img src="${hkEsc(p.image)}" alt="${hkEsc(p.title)}" loading="lazy" /></div>`;
      html += '<div class="post-body">';
      html += `<div class="post-meta">${hkEsc(p.date || '')}</div>`;
      html += `<h3>${hkEsc(p.title)}</h3>`;
      html += `<p class="post-text">${hkEsc(p.body).replace(/\n/g, '<br />')}</p>`;
      if (p.file) html += `<a class="btn btn-sm btn-primary" href="${hkEsc(p.file)}" download>${hkEsc(p.fileName || '첨부파일')} 다운로드 ↓</a>`;
      html += hkDelBtn('post', p.id);
      html += '</div>';
      art.innerHTML = html;
      list.appendChild(art);
    });
  }

  window.HK.renderPosts = function (items) {
    if (items) return render(items);
    fetch('assets/data/posts.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : [])).then(render).catch(() => render([]));
  };
  window.HK.renderPosts();
})();

// ===== 홍보자료 (관리자가 추가한 동적 자료) =====
(function () {
  const grid = document.getElementById('resourceGrid');
  if (!grid) return;

  function render(items) {
    grid.querySelectorAll('.resource-dynamic').forEach((n) => n.remove());
    const arr = Array.isArray(items) ? items : [];
    arr.slice().reverse().forEach((it) => {
      const lc = String(it.file || '').toLowerCase();
      const isPdf = it.type === 'pdf' || lc.endsWith('.pdf');
      const isImg = it.type === 'image' || /\.(jpe?g|png|gif|webp|svg)$/.test(lc);
      const art = document.createElement('article');
      art.className = 'resource-item resource-dynamic';
      art.setAttribute('data-file', it.file);
      art.setAttribute('data-type', it.type || 'file');
      let thumb;
      if (isImg) thumb = `<div class="resource-thumb"><img src="${hkEsc(it.file)}" alt="${hkEsc(it.title)}" loading="lazy" /><span class="resource-badge">이미지</span></div>`;
      else if (isPdf) thumb = `<div class="resource-thumb resource-thumb-pdf"><canvas class="pdf-thumb" data-pdf="${hkEsc(it.file)}"></canvas><span class="resource-badge">PDF</span></div>`;
      else thumb = `<div class="resource-thumb resource-thumb-doc"><span class="doc-ext">${hkEsc((it.ext || 'FILE').toUpperCase())}</span><span class="resource-badge">자료</span></div>`;
      const preview = (isImg || isPdf) ? `<button type="button" class="btn btn-sm btn-outline js-preview">미리보기</button>` : '';
      art.innerHTML =
        thumb +
        '<div class="resource-body">' +
        `<h3>${hkEsc(it.title)}</h3>` +
        `<p>${hkEsc(it.desc || '')}</p>` +
        '<div class="resource-actions">' +
        preview +
        `<a class="btn btn-sm btn-primary" href="${hkEsc(it.file)}" download>다운로드 ↓</a>` +
        '</div>' + hkDelBtn('resource', it.file) +
        '</div>';
      grid.appendChild(art);
    });
    if (window.HK.bindPreview) window.HK.bindPreview();
    renderPdfThumbs();
  }

  window.HK.renderResources = function (items) {
    if (items) return render(items);
    fetch('assets/data/resources.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : [])).then(render).catch(() => render([]));
  };
  window.HK.renderResources();
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
  function applyData(data) {
    videos = Array.isArray(data) ? data.slice().reverse() : [];
    const t = document.getElementById('videoCardThumb');
    if (videos.length > 0) {
      const id = youtubeId(videos[0].url);
      t.style.backgroundImage = `url(${thumb(id)})`;
      t.classList.add('has-thumb');
      if (cardDesc) cardDesc.textContent = `총 ${videos.length}개의 영상을 확인하세요.`;
    } else {
      t.style.backgroundImage = '';
      t.classList.remove('has-thumb');
      if (cardDesc) cardDesc.textContent = '전자투표 안내 및 현장 영상을 확인하세요.';
    }
  }
  function load(data) {
    if (data) return applyData(data);
    fetch('assets/data/videos.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : [])).then(applyData).catch(() => {});
  }
  load();
  window.HK.refreshVideos = load;
  window.HK.youtubeId = youtubeId;

  openBtn.addEventListener('click', openModal);
  card.querySelector('.resource-thumb').addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
})();

// ===== 투표 진행율 조회 챗봇 =====
(function () {
  // ▼▼▼ 투표 시스템 API 설정 (실제 값으로 변경) ▼▼▼
  // 예: 'https://votesys.example.com/api/progress?building={building}'
  // {building} 자리에 입력한 건물명이 들어갑니다.
  var API_URL = '';
  // 응답(JSON)에서 값을 읽을 필드 이름
  var FIELD = { rate: 'rate', voted: 'voted', total: 'total' };
  // ▲▲▲ 여기까지 ▲▲▲

  var win = document.getElementById('chatWindow');
  var form = document.getElementById('chatForm');
  var input = document.getElementById('chatInput');
  if (!form || !win) return;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function add(role, html) {
    var d = document.createElement('div');
    d.className = 'chat-msg ' + role;
    d.innerHTML = '<div class="bubble">' + html + '</div>';
    win.appendChild(d);
    win.scrollTop = win.scrollHeight;
    return d;
  }

  function resultHtml(name, rate, voted, total) {
    rate = Math.max(0, Math.min(100, Math.round(rate)));
    var extra = (voted != null && total != null)
      ? '<div class="chat-sub">' + voted + ' / ' + total + '명 참여</div>' : '';
    return '<strong>' + esc(name) + '</strong> 투표 진행율' +
      '<div class="progress-bar"><span style="width:' + rate + '%"></span></div>' +
      '<div class="chat-rate">' + rate + '%</div>' + extra;
  }

  function demo(name) {
    var seed = 0; for (var i = 0; i < name.length; i++) seed += name.charCodeAt(i);
    var rate = 30 + (seed % 65);
    var total = 100 + (seed % 400);
    return { rate: rate, total: total, voted: Math.round(total * rate / 100) };
  }

  // 진행율 데이터 파일 (투표 시스템에서 내보낸 현황을 변환해 올림)
  var DATA_URL = 'assets/data/progress.json';
  var _cache = null;
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }
  async function loadData() {
    if (_cache) return _cache;
    try { var r = await fetch(DATA_URL, { cache: 'no-store' }); _cache = r.ok ? await r.json() : []; }
    catch (e) { _cache = []; }
    if (!Array.isArray(_cache)) _cache = [];
    return _cache;
  }

  async function queryApi(name, bubble) {
    var url = API_URL.replace('{building}', encodeURIComponent(name));
    var res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('서버 응답 오류 (' + res.status + ')');
    var data = await res.json();
    var obj = Array.isArray(data) ? data[0] : (data.data || data.result || data);
    if (!obj) { bubble.innerHTML = '"' + esc(name) + '" 건물의 데이터를 찾지 못했습니다.'; return; }
    var rate = Number(obj[FIELD.rate]);
    var voted = obj[FIELD.voted] != null ? Number(obj[FIELD.voted]) : null;
    var total = obj[FIELD.total] != null ? Number(obj[FIELD.total]) : null;
    if (isNaN(rate) && voted != null && total) rate = voted / total * 100;
    if (isNaN(rate)) { bubble.innerHTML = '진행율 정보를 해석하지 못했습니다.'; return; }
    bubble.innerHTML = resultHtml(name, rate, voted, total);
  }

  async function queryFile(name, bubble) {
    var list = await loadData();
    if (list.length === 0) {
      var d = demo(name);
      bubble.innerHTML = resultHtml(name, d.rate, d.voted, d.total) +
        '<div class="chat-note">※ 예시 데이터입니다 (진행율 파일 등록 전)</div>';
      return;
    }
    var key = norm(name);
    var item = list.find(function (x) { return norm(x.name) === key; }) ||
      list.find(function (x) { return norm(x.name).indexOf(key) >= 0 || (key && key.indexOf(norm(x.name)) >= 0); });
    if (!item) {
      bubble.innerHTML = '"' + esc(name) + '" 건물의 진행율 정보를 찾지 못했습니다.' +
        '<div class="chat-note">건물명을 정확히 입력했는지 확인해 주세요.</div>';
      return;
    }
    var voted = item.voted != null ? Number(item.voted) : null;
    var total = item.total != null ? Number(item.total) : null;
    var rate = item.rate != null ? Number(item.rate) : (voted != null && total ? voted / total * 100 : NaN);
    if (isNaN(rate)) { bubble.innerHTML = '진행율 정보를 해석하지 못했습니다.'; return; }
    bubble.innerHTML = resultHtml(name, rate, voted, total) +
      (item.updated ? '<div class="chat-note">기준: ' + esc(item.updated) + '</div>' : '');
  }

  async function query(name) {
    var loading = add('bot', '조회 중…');
    var bubble = loading.querySelector('.bubble');
    try {
      if (API_URL) await queryApi(name, bubble);
      else await queryFile(name, bubble);
    } catch (e) {
      bubble.innerHTML = '조회 중 오류가 발생했습니다.<div class="chat-note">' + esc(e.message) + '</div>';
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = input.value.trim();
    if (!name) return;
    add('user', esc(name));
    input.value = '';
    query(name);
  });
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

  // 미리보기 (이벤트 위임 — 동적으로 추가된 자료도 동작)
  document.addEventListener('click', (e) => {
    const resBtn = e.target.closest('.resource-item .js-preview');
    if (resBtn) {
      const item = resBtn.closest('.resource-item');
      const title = item.querySelector('h3') ? item.querySelector('h3').textContent : '';
      open(item.getAttribute('data-file'), item.getAttribute('data-type') || 'image', title);
      return;
    }
    const qBtn = e.target.closest('.js-quote-preview');
    if (qBtn) open(qBtn.getAttribute('data-file'), qBtn.getAttribute('data-type') || 'image', '당사 견적서');
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
  const TO_EMAIL = 'airrotc29@habitusinc.co.kr';
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
  const TO_EMAIL = 'airrotc29@habitusinc.co.kr';

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
