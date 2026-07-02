// ===== 연도 자동 표시 =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== 페이지 열 때 항상 맨 위에서 시작 (특히 모바일) =====
if ('scrollRestoration' in history) { try { history.scrollRestoration = 'manual'; } catch (e) {} }
window.addEventListener('load', function () { window.scrollTo(0, 0); });

// ===== 카카오톡 문의 =====
(function () {
  // ▼ 카카오톡 채널을 만들면 아래 KAKAO_CHANNEL_URL 에 채팅 주소를 넣으세요.
  //   예) 'http://pf.kakao.com/_채널ID/chat'  (채널이 있으면 바로 채팅창이 열립니다)
  var KAKAO_CHANNEL_URL = 'http://pf.kakao.com/_SeSPX/chat'; // 채널 채팅 주소 (없으면 아이디 안내로 동작)
  var KAKAO_ID = 'airrotc29@gmail.com'; // 카카오톡 아이디(이메일)

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    } catch (e) { return Promise.resolve(false); }
  }

  function handleKakao(e) {
    if (e) e.preventDefault();
    if (KAKAO_CHANNEL_URL) {
      window.open(KAKAO_CHANNEL_URL, '_blank', 'noopener');
      return;
    }
    // 채널이 없으면: 아이디 복사 + 안내
    copyText(KAKAO_ID).then(function (copied) {
      var msg = copied
        ? '카카오톡 아이디가 복사되었습니다.\n\n' + KAKAO_ID + '\n\n카카오톡 → 친구 추가 → 아이디 검색에 붙여넣기(추가) 후 메시지를 보내주세요.'
        : '카카오톡에서 아래 아이디를 검색해 친구 추가 후 문의해 주세요.\n\n' + KAKAO_ID;
      window.alert(msg);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.js-kakao, #kakaoFab');
    if (t) handleKakao(e);
  });
})();

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
      if (p.link) html += `<a class="btn btn-sm btn-primary" href="${hkEsc(p.link)}" target="_blank" rel="noopener">${hkEsc(p.linkText || '다운받기')} ↓</a>`;
      // 앱 출시 글이면 제목/내용에 따라 스토어 다운로드 버튼을 자동으로 옆에 추가
      var _ac = (p.title || '') + ' ' + (p.body || '');
      if (/안드로이드|android|구글|google\s*play/i.test(_ac))
        html += `<a class="btn btn-sm btn-app btn-googleplay" href="https://play.google.com/store/apps/details?id=com.lksoft.mgmt" target="_blank" rel="noopener">▶ Google Play</a>`;
      if (/애플|apple|아이폰|iphone|\bios\b|앱스토어|app\s*store/i.test(_ac))
        html += `<a class="btn btn-sm btn-app btn-appstore" href="https://apps.apple.com/kr/app/%EA%B4%80%EB%A6%AC%EB%8B%A8/id6755434083" target="_blank" rel="noopener"> App Store</a>`;
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
  const anchor = document.getElementById('resDynAnchor');

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
      if (anchor && anchor.parentNode === grid) grid.insertBefore(art, anchor);
      else grid.appendChild(art);
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

// ===== 위탁계약서 파일 (docs.json) =====
(function () {
  var link = document.getElementById('consignmentLink');
  var extEl = document.getElementById('consignmentExt');
  if (!link) return;
  function apply(docs) {
    var c = docs && docs.consignment;
    if (c && c.file) {
      link.href = c.file;
      if (extEl && c.ext) extEl.textContent = String(c.ext).toUpperCase();
    }
  }
  window.HK.renderConsignment = function (docs) {
    if (docs) return apply(docs);
    fetch('assets/data/docs.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; }).then(apply).catch(function () {});
  };
  window.HK.renderConsignment();
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
    if (video.file) {
      player.innerHTML = '<video src="' + String(video.file).replace(/"/g, '&quot;') + '" controls autoplay playsinline style="width:100%;height:100%;background:#000"></video>';
    } else {
      const id = youtubeId(video.url);
      player.innerHTML =
        `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0" ` +
        `title="${(video.title || '투표 영상').replace(/"/g, '')}" frameborder="0" ` +
        `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
        `allowfullscreen></iframe>`;
    }
    titleEl.textContent = video.title || '';
    listEl.querySelectorAll('.videomodal-thumb').forEach((t) => t.classList.remove('active'));
    const key = video.url || video.file;
    const active = listEl.querySelector('[data-key="' + (key || '').replace(/"/g, '&quot;') + '"]');
    if (active) active.classList.add('active');
  }

  function renderList() {
    listEl.innerHTML = '';
    videos.forEach((v) => {
      const id = youtubeId(v.url);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'videomodal-thumb';
      item.dataset.key = v.url || v.file || '';
      const thumbHtml = id
        ? `<img src="${thumb(id)}" alt="${(v.title || '영상').replace(/"/g, '')}" loading="lazy" />`
        : `<span class="vthumb-file">▶</span>`;
      item.innerHTML = thumbHtml + `<span>${v.title || '제목 없음'}</span>`;
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
      if (id) { t.style.backgroundImage = `url(${thumb(id)})`; t.classList.add('has-thumb'); }
      else { t.style.backgroundImage = ''; t.classList.remove('has-thumb'); }
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


// ===== 투표 진행율 (건물별 목록 + 세부 보기) =====
(function () {
  var grid = document.getElementById('progressGrid');
  var empty = document.getElementById('progressEmpty');
  var modal = document.getElementById('progressDetail');
  var modalBody = document.getElementById('progressDetailBody');
  var modalClose = document.getElementById('progressDetailClose');
  if (!grid) return;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function rateOf(it) {
    var v = it.voted != null ? Number(it.voted) : null;
    var t = it.total != null ? Number(it.total) : null;
    return it.rate != null ? Number(it.rate) : (v != null && t ? v / t * 100 : 0);
  }

  function agendasHtml(ags) {
    if (!ags || !ags.length) return '';
    var h = '<div class="agenda-block"><div class="agenda-head">안건별 집계</div>';
    ags.forEach(function (a) {
      h += '<div class="agenda"><div class="agenda-title">[' + esc(a.no) + '] ' + esc(a.title) + '</div>';
      (a.options || []).forEach(function (o) {
        var pct = o.pct != null ? Number(o.pct) : 0;
        var w = Math.max(0, Math.min(100, pct));
        var lab = String(o.label || '');
        var cls = lab.indexOf('찬성') >= 0 ? 'ao-yes' : (lab.indexOf('반대') >= 0 ? 'ao-no' : 'ao-none');
        h += '<div class="agenda-opt ' + cls + '">' +
          '<span class="ao-label">' + esc(lab) + '</span>' +
          '<span class="ao-bar"><i style="width:' + w + '%"></i></span>' +
          '<span class="ao-val">' + (o.count != null ? esc(o.count) + '명' : '') + (o.pct != null ? ' (' + esc(o.pct) + '%)' : '') + '</span>' +
          '</div>';
      });
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  function render(items) {
    var current = Array.isArray(items) ? items : [];
    grid.innerHTML = '';
    if (current.length === 0) { if (empty) empty.hidden = false; return; }
    if (empty) empty.hidden = true;
    current.forEach(function (it) {
      var r = Math.round(rateOf(it));
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'prog-card';
      card.innerHTML =
        '<div class="prog-top">' +
          '<span class="prog-name">' + esc(it.name) + '</span>' +
          (it.status ? '<span class="prog-status">' + esc(it.status) + '</span>' : '') +
        '</div>' +
        '<div class="prog-bar"><span style="width:' + Math.max(0, Math.min(100, r)) + '%"></span></div>' +
        '<div class="prog-bottom">' +
          '<span class="prog-rate-num">' + r + '%</span>' +
          (it.voted != null ? '<span class="prog-count">' + esc(it.voted) + ' / ' + esc(it.total) + '명</span>' : '') +
          '<span class="prog-more">세부 보기 ›</span>' +
        '</div>';
      card.addEventListener('click', function () { openDetail(it); });
      grid.appendChild(card);
    });
  }

  function openDetail(it) {
    if (!modal) return;
    var r = Math.round(rateOf(it));
    var html = '<h3 class="pd-title">' + esc(it.name) + '</h3>';
    if (it.voteTitle) html += '<div class="pd-sub">' + esc(it.voteTitle) + '</div>';
    html += '<div class="pd-rate">' + r + '%</div>';
    html += '<div class="progress-bar"><span style="width:' + Math.max(0, Math.min(100, r)) + '%"></span></div>';
    if (it.voted != null) html += '<div class="pd-meta">' + esc(it.voted) + ' / ' + esc(it.total) + '명 참여</div>';
    var m = '';
    if (it.status) m += '상태: ' + esc(it.status) + ' · ';
    if (it.updated) m += '기준: ' + esc(it.updated);
    if (m) html += '<div class="chat-note">' + m + '</div>';
    html += agendasHtml(it.agendas);
    html += '<button type="button" class="btn btn-outline btn-block admin-only js-prog-edit" data-name="' + esc(it.name).replace(/"/g, '&quot;') + '" style="margin-top:18px;">✏️ 이 진행율 수정</button>';
    modalBody.innerHTML = html;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeDetail() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

  window.HK.renderProgress = function (items) {
    if (items) return render(items);
    fetch('assets/data/progress.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; }).then(render).catch(function () { render([]); });
  };
  window.HK.renderProgress();

  if (modal) {
    modalClose.addEventListener('click', closeDetail);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeDetail(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
  }
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
