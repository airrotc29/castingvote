// ===== 에이스 종합관리 — 관리단 구성 보고 / 본사 소통 모듈 =====
// 지점사업소 관리소장이 로그인 없이 보고를 올리고, 보고별 댓글로 본사와 소통합니다.
// 저장은 3단계로 동작합니다.
//   1) 중앙 저장 엔드포인트(window.ACE_REPORT_ENDPOINT) — 프록시가 토큰을 보관, 로그인 없이 중앙 기록
//   2) 본사 관리자 토큰(localStorage: ecv_admin_token) — GitHub Contents API로 직접 커밋
//   3) 로컬 기록 + 본사 메일 전송 — 위 둘이 없을 때의 기본 폴백(이 기기에 기록)
(function () {
  const OWNER = 'airrotc29';
  const REPO = '-';
  const BRANCH = 'main';
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'ecv_admin_token';      // 본사 관리자 토큰(기존 관리자 모듈과 공유)
  const LOCAL_KEY = 'ace_local_reports';     // 로컬 폴백 저장소
  const DATA_PATH = 'assets/data/reports.json';
  const TO_EMAIL = 'airrotc29@habitusinc.co.kr';
  const MAX_SIZE = 10 * 1024 * 1024;
  // 중앙 저장 프록시 주소(있으면 로그인 없이 중앙 기록). 비워두면 관리자 토큰/로컬로 동작.
  const ENDPOINT = (window.ACE_REPORT_ENDPOINT || localStorage.getItem('ace_report_endpoint') || '').trim();

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const listEl = $('reportList');
  if (!listEl) return; // 보고 섹션이 없는 페이지

  // ---------- 저장 모드 판별 ----------
  const hasToken = () => !!localStorage.getItem(TOKEN_KEY);
  const hasEndpoint = () => !!ENDPOINT;
  const isAdmin = () => document.body.classList.contains('admin-on');
  const isCentral = () => hasEndpoint() || hasToken();

  // ---------- 유틸 ----------
  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function headers() {
    return { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  }
  function utf8ToB64(str) { return btoa(String.fromCharCode.apply(null, new TextEncoder().encode(str))); }
  function b64ToUtf8(b64) { const bin = atob(b64.replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); }
  function readBase64(file) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(file); });
  }
  function readDataURL(file) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); });
  }
  function safeName(name) {
    const d = name.lastIndexOf('.');
    const ext = d >= 0 ? name.slice(d).toLowerCase() : '';
    const base = (d >= 0 ? name.slice(0, d) : name).replace(/[^a-zA-Z0-9가-힣_-]/g, '-').replace(/-+/g, '-').slice(0, 32);
    return base + ext;
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- GitHub Contents API (관리자 토큰 모드) ----------
  async function getContent(path) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}&_cb=${Date.now()}`, { headers: headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('읽기 실패 (' + res.status + ')');
    return res.json();
  }
  async function putContent(path, base64, message, sha) {
    const body = { message, content: base64, branch: BRANCH };
    if (sha) body.sha = sha;
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error('저장 실패 (' + res.status + ')');
    return res.json();
  }
  async function loadJson() {
    const data = await getContent(DATA_PATH);
    if (!data) return { items: [], sha: null };
    let items = [];
    try { items = JSON.parse(b64ToUtf8(data.content)); } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
    return { items, sha: data.sha };
  }
  async function mutateJson(mutator, message) {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      const { items, sha } = await loadJson();
      const next = mutator(items.slice());
      try {
        await putContent(DATA_PATH, utf8ToB64(JSON.stringify(next, null, 2)), message, sha);
        return next;
      } catch (e) { lastErr = e; if (String(e.message).includes('(409)')) { await new Promise((r) => setTimeout(r, 700)); continue; } throw e; }
    }
    throw lastErr;
  }

  // ---------- 중앙 프록시 모드 ----------
  async function callEndpoint(action, payload) {
    const res = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) throw new Error('전송 실패 (' + res.status + ')');
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.items) ? data.items : null;
  }

  // ---------- 로컬 폴백 저장소 ----------
  function getLocal() {
    try { const o = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); return { reports: o.reports || [], comments: o.comments || {} }; }
    catch (e) { return { reports: [], comments: {} }; }
  }
  function setLocal(o) { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); }

  // ---------- 데이터 로드 (중앙 + 로컬 병합) ----------
  async function loadAll() {
    let central = [];
    try { central = await fetch(DATA_PATH + '?_cb=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])); } catch (e) { central = []; }
    if (!Array.isArray(central)) central = [];

    const local = getLocal();
    // 로컬에만 있는 댓글을 중앙 보고에 병합
    central = central.map((r) => {
      const lc = local.comments[r.id] || [];
      return lc.length ? Object.assign({}, r, { comments: (r.comments || []).concat(lc) }) : r;
    });
    // 아직 중앙에 올라가지 않은 로컬 보고
    const centralIds = new Set(central.map((r) => r.id));
    const localOnly = local.reports.filter((r) => !centralIds.has(r.id)).map((r) => Object.assign({ _local: true }, r));

    return central.concat(localOnly).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  // ---------- 쓰기: 보고 추가 ----------
  async function addReport(report, imageFiles) {
    if (hasToken()) {
      const images = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const f = imageFiles[i];
        const path = `assets/images/reports/${Date.now()}-${i}-${safeName(f.name)}`;
        await putContent(path, await readBase64(f), '관리단 보고 사진');
        images.push(path);
      }
      report.images = images;
      return mutateJson((items) => items.concat([report]), '관리단 보고 추가: ' + report.branch);
    }
    if (hasEndpoint()) {
      const images = [];
      for (let i = 0; i < imageFiles.length; i++) images.push({ name: imageFiles[i].name, base64: await readBase64(imageFiles[i]) });
      const next = await callEndpoint('addReport', { report, images });
      return next; // 서버가 갱신된 전체 목록 반환
    }
    // 로컬 폴백: 사진은 dataURL로 이 기기에만 저장 + 본사 메일 전송
    const images = [];
    for (let i = 0; i < imageFiles.length; i++) images.push(await readDataURL(imageFiles[i]));
    report.images = images;
    const local = getLocal();
    local.reports.push(report);
    setLocal(local);
    sendReportMail(report);
    return null;
  }

  // ---------- 쓰기: 댓글 추가 ----------
  async function addComment(reportId, comment) {
    if (hasToken()) {
      return mutateJson((items) => items.map((r) => (r.id === reportId ? Object.assign({}, r, { comments: (r.comments || []).concat([comment]) }) : r)), '보고 댓글');
    }
    if (hasEndpoint()) return callEndpoint('addComment', { reportId, comment });
    // 로컬: 내 보고면 그 안에, 중앙 보고면 comments 맵에
    const local = getLocal();
    const own = local.reports.find((r) => r.id === reportId);
    if (own) { own.comments = (own.comments || []).concat([comment]); }
    else { (local.comments[reportId] = local.comments[reportId] || []).push(comment); }
    setLocal(local);
    return null;
  }

  // ---------- 쓰기: 삭제(본사 관리자 또는 로컬 보고 작성자) ----------
  async function deleteReport(report) {
    if (report._local) {
      const local = getLocal();
      local.reports = local.reports.filter((r) => r.id !== report.id);
      setLocal(local);
      return null;
    }
    if (hasToken()) return mutateJson((items) => items.filter((r) => r.id !== report.id), '보고 삭제');
    if (hasEndpoint()) return callEndpoint('deleteReport', { reportId: report.id });
    throw new Error('삭제 권한이 없습니다.');
  }
  async function deleteComment(reportId, commentId) {
    if (hasToken()) return mutateJson((items) => items.map((r) => (r.id === reportId ? Object.assign({}, r, { comments: (r.comments || []).filter((c) => c.id !== commentId) }) : r)), '댓글 삭제');
    if (hasEndpoint()) return callEndpoint('deleteComment', { reportId, commentId });
    // 로컬 댓글 삭제
    const local = getLocal();
    const own = local.reports.find((r) => r.id === reportId);
    if (own) own.comments = (own.comments || []).filter((c) => c.id !== commentId);
    if (local.comments[reportId]) local.comments[reportId] = local.comments[reportId].filter((c) => c.id !== commentId);
    setLocal(local);
    return null;
  }

  // ---------- 본사 메일 전송(로컬 폴백) ----------
  function sendReportMail(report) {
    const body =
      `[에이스 종합관리 관리단 구성 보고]\n` +
      `지점·사업소: ${report.branch}\n` +
      `관리소장: ${report.manager}\n` +
      (report.building ? `대상 현장: ${report.building}\n` : '') +
      (report.contact ? `연락처: ${report.contact}\n` : '') +
      `진행 단계: ${report.stage}\n` +
      `작성일: ${report.date}\n` +
      `------------------------------\n` +
      `${report.body}\n`;
    const url = `mailto:${TO_EMAIL}?subject=${encodeURIComponent('[에이스 종합관리] 관리단 보고 - ' + report.branch)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  }

  // ---------- 렌더: 보고 목록 ----------
  let ALL = [];
  let filterText = '';

  function stageClass(stage) {
    if (stage === '구성 완료') return 'done';
    if (stage === '보류·이슈') return 'hold';
    return '';
  }

  function matches(r) {
    if (!filterText) return true;
    const hay = (r.branch + ' ' + r.manager + ' ' + (r.building || '') + ' ' + r.body + ' ' + r.stage).toLowerCase();
    return hay.indexOf(filterText) >= 0;
  }

  function render() {
    const empty = $('reportEmpty');
    const items = ALL.filter(matches);
    listEl.innerHTML = '';
    if (items.length === 0) { if (empty) empty.hidden = false; return; }
    if (empty) empty.hidden = true;

    items.forEach((r) => {
      const cmtCount = (r.comments || []).length;
      const imgs = (r.images || []);
      const card = document.createElement('div');
      card.className = 'report-card';
      card.setAttribute('data-id', r.id);
      let thumbs = '';
      if (imgs.length) {
        thumbs = '<div class="report-thumbs">' + imgs.slice(0, 3).map((s) => `<img src="${esc(s)}" alt="" loading="lazy" />`).join('') + '</div>';
      }
      const adminDel = (isAdmin() || r._local)
        ? `<button type="button" class="report-del" data-del="${esc(r.id)}">삭제</button>` : '';
      card.innerHTML =
        adminDel +
        '<div class="report-card-top">' +
          `<span class="report-branch">${esc(r.branch)}</span>` +
          `<span class="report-stage ${stageClass(r.stage)}">${esc(r.stage)}</span>` +
          (r._local ? '<span class="report-local-flag">이 기기에만 저장됨</span>' : '') +
        '</div>' +
        `<div class="report-meta">관리소장 ${esc(r.manager)}` +
          (r.building ? `<span class="dot">·</span>${esc(r.building)}` : '') +
          `<span class="dot">·</span>${esc(r.date)}</div>` +
        `<div class="report-excerpt">${esc(r.body)}</div>` +
        '<div class="report-card-foot">' +
          thumbs +
          `<span class="report-cmt-count">💬 본사 소통 ${cmtCount}</span>` +
          '<span class="report-open">열기 ›</span>' +
        '</div>';
      listEl.appendChild(card);
    });
  }

  function refreshNote() {
    const note = $('reportStorageNote');
    if (!note) return;
    if (isCentral()) { note.hidden = true; return; }
    note.hidden = false;
    note.innerHTML = '<b>안내</b> · 현재 이 브라우저에는 중앙 저장이 설정되어 있지 않습니다. 올리신 보고는 <b>이 기기에 기록</b>되며 본사에는 <b>메일</b>로 전달됩니다. 모든 지점이 함께 보는 중앙 공유를 원하시면 본사 관리자에게 문의해 주세요.';
  }

  async function reload() {
    try { ALL = await loadAll(); } catch (e) { ALL = []; }
    render();
    if (openId) openDetail(openId); // 상세 모달 열려 있으면 갱신
  }
  window.HK = window.HK || {};
  window.HK.renderReports = function () { refreshNote(); reload(); };

  // ---------- 보고 작성 모달 ----------
  let photoFiles = [];

  function openModal(id) { const m = $(id); if (m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); } }
  function closeModal(id) { const m = $(id); if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); } }
  function hint(el, msg, type) { if (el) { el.className = 'form-hint' + (type ? ' ' + type : ''); el.textContent = msg; } }

  document.querySelectorAll('.amodal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); if (m.id === 'reportDetailModal') openId = null; } });
  });

  function renderPhotoPreview() {
    const box = $('reportPhotoPreview');
    box.innerHTML = '';
    photoFiles.forEach((f, i) => {
      const w = document.createElement('div');
      w.className = 'pp-item';
      w.innerHTML = `<img src="${URL.createObjectURL(f)}" alt="" /><button type="button" class="pp-del">×</button>`;
      w.querySelector('.pp-del').addEventListener('click', () => { photoFiles.splice(i, 1); renderPhotoPreview(); });
      box.appendChild(w);
    });
  }

  $('addReportBtn') && $('addReportBtn').addEventListener('click', () => {
    photoFiles = [];
    ['reportBranch', 'reportManager', 'reportBuilding', 'reportContact', 'reportBody'].forEach((id) => { if ($(id)) $(id).value = ''; });
    if ($('reportStage')) $('reportStage').selectedIndex = 0;
    if ($('reportImages')) $('reportImages').value = '';
    renderPhotoPreview();
    hint($('reportStatus'), '', '');
    openModal('reportModal');
  });

  $('reportImages') && $('reportImages').addEventListener('change', function () {
    for (const f of this.files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_SIZE) { hint($('reportStatus'), `"${f.name}" 은(는) 10MB를 초과합니다.`, 'error'); continue; }
      photoFiles.push(f);
    }
    this.value = '';
    renderPhotoPreview();
  });

  $('reportSubmit') && $('reportSubmit').addEventListener('click', async () => {
    const branch = $('reportBranch').value.trim();
    const manager = $('reportManager').value.trim();
    const body = $('reportBody').value.trim();
    if (!branch || !manager || !body) { hint($('reportStatus'), '지점·사업소명, 관리소장 성함, 보고 내용은 필수입니다.', 'error'); return; }
    const report = {
      id: uid('r'), branch, manager,
      building: $('reportBuilding').value.trim(),
      contact: $('reportContact').value.trim(),
      stage: $('reportStage').value,
      body, images: [], date: today(), ts: Date.now(), comments: [],
    };
    const btn = $('reportSubmit'); btn.disabled = true;
    try {
      hint($('reportStatus'), '보고를 올리는 중…', '');
      const next = await addReport(report, photoFiles);
      if (next) ALL = mergeLocal(next); else ALL = await loadAll();
      render();
      if (isCentral()) hint($('reportStatus'), '본사로 보고가 접수되었습니다! (반영까지 1~2분)', 'success');
      else hint($('reportStatus'), '보고가 기록되었습니다. 본사 전달용 메일 창이 열립니다 — 전송을 완료해 주세요.', 'success');
      setTimeout(() => closeModal('reportModal'), 1200);
    } catch (e) { hint($('reportStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // 중앙 응답(next)에 로컬 댓글/보고를 다시 병합
  function mergeLocal(central) {
    const local = getLocal();
    let arr = central.map((r) => { const lc = local.comments[r.id] || []; return lc.length ? Object.assign({}, r, { comments: (r.comments || []).concat(lc) }) : r; });
    const ids = new Set(arr.map((r) => r.id));
    arr = arr.concat(local.reports.filter((r) => !ids.has(r.id)).map((r) => Object.assign({ _local: true }, r)));
    return arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  // ---------- 보고 상세 + 댓글 스레드 ----------
  let openId = null;

  function findReport(id) { return ALL.find((r) => r.id === id); }

  function openDetail(id) {
    const r = findReport(id);
    if (!r) { openId = null; closeModal('reportDetailModal'); return; }
    openId = id;
    const box = $('reportDetailBody');
    const imgs = (r.images || []);
    const comments = (r.comments || []);

    let html = '<div class="rd-head">';
    html += `<div class="rd-branch">${esc(r.branch)} <span class="report-stage ${stageClass(r.stage)}">${esc(r.stage)}</span></div>`;
    html += `<div class="rd-meta">관리소장 ${esc(r.manager)}${r.building ? '<span class="dot">·</span>' + esc(r.building) : ''}<span class="dot">·</span>${esc(r.date)}</div>`;
    if (r.contact) html += `<div class="rd-meta">연락처 ${esc(r.contact)}</div>`;
    html += '</div>';
    html += `<div class="rd-body">${esc(r.body)}</div>`;
    if (imgs.length) html += '<div class="rd-images">' + imgs.map((s) => `<img src="${esc(s)}" alt="현장 사진" data-full="${esc(s)}" loading="lazy" />`).join('') + '</div>';

    html += '<div class="rd-thread-head">💬 본사 ↔ 현장 소통</div>';
    html += '<div class="rd-comments">';
    if (comments.length === 0) html += '<p class="rd-empty">아직 댓글이 없습니다. 본사 또는 현장에서 첫 댓글을 남겨 보세요.</p>';
    else comments.forEach((c) => {
      const hq = c.role === 'hq';
      const canDel = isAdmin() || r._local;
      html += `<div class="rd-cmt ${hq ? 'hq' : ''}">` +
        `<span class="rd-cmt-author">${esc(c.author)}${hq ? ' · 본사' : ''}</span>` +
        `<div class="rd-cmt-bubble">${esc(c.body)}</div>` +
        `<span class="rd-cmt-date">${esc(c.date)}</span>` +
        (canDel ? `<button type="button" class="rd-cmt-del" data-cdel="${esc(c.id)}">삭제</button>` : '') +
        '</div>';
    });
    html += '</div>';

    // 댓글 작성 폼
    html +=
      '<div class="rd-cmt-form">' +
        '<div class="rd-cmt-row">' +
          '<input type="text" id="rdCmtAuthor" placeholder="작성자 이름" autocomplete="off" />' +
          '<select id="rdCmtRole"><option value="site">현장(관리소장)</option><option value="hq">본사</option></select>' +
        '</div>' +
        '<textarea id="rdCmtBody" rows="2" placeholder="메시지를 입력하세요"></textarea>' +
        '<p class="form-hint" id="rdCmtStatus" role="alert"></p>' +
        '<button type="button" class="btn btn-primary btn-block" id="rdCmtSubmit">댓글 남기기</button>' +
      '</div>';

    box.innerHTML = html;
    openModal('reportDetailModal');

    // 이미지 확대(기존 라이트박스 재사용)
    box.querySelectorAll('.rd-images img').forEach((im) => {
      im.addEventListener('click', () => {
        const lb = $('lightbox'); const lbImg = $('lightboxImg'); const cap = $('lightboxCaption');
        if (lb && lbImg) { lbImg.src = im.getAttribute('data-full'); if (cap) cap.textContent = r.branch + ' 현장 사진'; lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); }
      });
    });

    // 댓글 등록
    $('rdCmtSubmit').addEventListener('click', async () => {
      const author = $('rdCmtAuthor').value.trim();
      const role = $('rdCmtRole').value;
      const cbody = $('rdCmtBody').value.trim();
      if (!author || !cbody) { hint($('rdCmtStatus'), '작성자 이름과 내용을 입력해 주세요.', 'error'); return; }
      const comment = { id: uid('c'), author, role, body: cbody, date: today(), ts: Date.now() };
      const sbtn = $('rdCmtSubmit'); sbtn.disabled = true;
      try {
        hint($('rdCmtStatus'), '등록 중…', '');
        const next = await addComment(id, comment);
        ALL = next ? mergeLocal(next) : await loadAll();
        render();
        openDetail(id); // 스레드 갱신
      } catch (e) { hint($('rdCmtStatus'), '오류: ' + e.message, 'error'); sbtn.disabled = false; }
    });

    // 댓글 삭제
    box.querySelectorAll('.rd-cmt-del').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('이 댓글을 삭제할까요?')) return;
        try {
          const next = await deleteComment(id, b.getAttribute('data-cdel'));
          ALL = next ? mergeLocal(next) : await loadAll();
          render(); openDetail(id);
        } catch (e) { alert('삭제 오류: ' + e.message); }
      });
    });
  }

  // 카드 클릭 → 상세 열기 / 삭제
  listEl.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (!confirm('이 보고를 삭제할까요?')) return;
      const r = findReport(del.getAttribute('data-del'));
      if (!r) return;
      try { const next = await deleteReport(r); ALL = next ? mergeLocal(next) : await loadAll(); render(); }
      catch (err) { alert('삭제 오류: ' + err.message); }
      return;
    }
    const card = e.target.closest('.report-card');
    if (card) openDetail(card.getAttribute('data-id'));
  });

  // 검색
  $('reportSearch') && $('reportSearch').addEventListener('input', function () { filterText = this.value.trim().toLowerCase(); render(); });

  // 초기 로드
  refreshNote();
  reload();
})();
