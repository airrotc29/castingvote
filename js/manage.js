// ===== 에이스 종합관리 — 지점사업소 관리단 구성 전략 앱 =====
// 사업소 현황 대시보드 + 소장 월례 업무보고 + 본사 소통(댓글) + 소장 평가/전략 안내
// 보고/댓글 저장은 3단계: ① 중앙 엔드포인트(프록시) ② 본사 토큰(GitHub) ③ 로컬+메일 폴백
(function () {
  'use strict';

  const OWNER = 'airrotc29', REPO = 'branch-communication-webapp', BRANCH = 'main';
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'ace_admin_token';
  const LOCAL_KEY = 'ace_branch_reports_local';
  const BRANCHES_PATH = 'assets/data/branches.json';
  const REPORTS_PATH = 'assets/data/branch-reports.json';
  const TO_EMAIL = 'airrotc29@habitusinc.co.kr';
  const ENDPOINT = (window.ACE_REPORT_ENDPOINT || localStorage.getItem('ace_report_endpoint') || '').trim();

  // 전체 보고 열람 암호(본사 담당자 전용). 기본 암호: ace2026
  // 변경: 새 암호의 SHA-256 해시를 아래 기본값 또는 branches.json의 "reportViewPwSha256"에 넣으면 됨.
  const VIEW_PW_DEFAULT = 'a3b5e354c796d0bd0f8a966462c4a738858611963ff85f59d59bc9c9838eec51';
  let VIEW_PW = window.ACE_REPORT_VIEW_PW_SHA256 || VIEW_PW_DEFAULT;
  const VIEW_OK_KEY = 'ace_report_view_ok';

  const REPORT_ITEMS = [
    { k: '1', t: '관리단 구성 동정' },
    { k: '2', t: '우호 인원 포섭 결과' },
    { k: '3', t: '포섭 인원 래포 형성' },
    { k: '4', t: '추진위 미팅 실적' },
    { k: '5', t: '시행/시공사 관련' },
    { k: '6', t: '계획 및 착안사항' },
  ];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------- 저장 모드 ----------
  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const hasToken = () => !!token();
  const hasEndpoint = () => !!ENDPOINT;
  const isAdmin = () => document.body.classList.contains('admin-on');
  const isCentral = () => hasToken() || hasEndpoint();

  function headers() { return { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }
  function utf8ToB64(str) { return btoa(String.fromCharCode.apply(null, new TextEncoder().encode(str))); }
  function b64ToUtf8(b64) { const bin = atob(b64.replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  async function sha256hex(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const isViewUnlocked = () => isAdmin() || localStorage.getItem(VIEW_OK_KEY) === '1';
  function todayStr(d) { d = d || new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; }

  // ---------- GitHub Contents API (본사 토큰 모드) ----------
  async function getContent(path) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}&_cb=${Date.now()}`, { headers: headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('읽기 실패 (' + res.status + ')');
    return res.json();
  }
  async function putContent(path, b64, message, sha) {
    const body = { message, content: b64, branch: BRANCH };
    if (sha) body.sha = sha;
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) {
      if (res.status === 403) throw new Error('이 토큰에 저장소 쓰기 권한이 없습니다. (403) — 토큰을 Contents: Read and write 권한으로 재발급한 뒤 다시 로그인하세요.');
      if (res.status === 401) throw new Error('토큰이 만료/무효입니다. (401) — 본사 로그인을 다시 하세요.');
      throw new Error('저장 실패 (' + res.status + ')');
    }
    return res.json();
  }
  async function loadReportsJson() {
    const data = await getContent(REPORTS_PATH);
    if (!data) return { items: [], sha: null };
    let items = []; try { items = JSON.parse(b64ToUtf8(data.content)); } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
    return { items, sha: data.sha };
  }
  async function mutateReports(mutator, message) {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      const { items, sha } = await loadReportsJson();
      const next = mutator(items.slice());
      try { await putContent(REPORTS_PATH, utf8ToB64(JSON.stringify(next, null, 2)), message, sha); return next; }
      catch (e) { lastErr = e; if (String(e.message).includes('(409)')) { await new Promise((r) => setTimeout(r, 700)); continue; } throw e; }
    }
    throw lastErr;
  }
  async function verifyToken(t) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}`, { headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    return res.ok;
  }
  // branches.json(객체) 읽기/변형 — 본사 토큰 모드
  async function getBranchesObj() {
    const data = await getContent(BRANCHES_PATH);
    if (!data) return { obj: { branches: [] }, sha: null };
    let obj = {}; try { obj = JSON.parse(b64ToUtf8(data.content)); } catch (e) { obj = {}; }
    if (typeof obj !== 'object' || Array.isArray(obj) || !obj) obj = {};
    if (!Array.isArray(obj.branches)) obj.branches = [];
    return { obj, sha: data.sha };
  }
  async function mutateBranchesObj(mutator, message) {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      const { obj, sha } = await getBranchesObj();
      const next = mutator(obj);
      try { await putContent(BRANCHES_PATH, utf8ToB64(JSON.stringify(next, null, 2)), message, sha); return next; }
      catch (e) { lastErr = e; if (String(e.message).includes('(409)')) { await new Promise((r) => setTimeout(r, 700)); continue; } throw e; }
    }
    throw lastErr;
  }

  // ---------- 중앙 프록시 ----------
  async function callEndpoint(action, payload) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) });
    if (!res.ok) throw new Error('전송 실패 (' + res.status + ')');
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.items) ? data.items : null;
  }

  // ---------- 로컬 폴백 ----------
  function getLocal() { try { const o = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); return { reports: o.reports || [], comments: o.comments || {} }; } catch (e) { return { reports: [], comments: {} }; } }
  function setLocal(o) { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); }

  // ---------- 보고 로드(중앙+로컬 병합) ----------
  async function loadReports() {
    let central = [];
    try { central = await fetch(REPORTS_PATH + '?_cb=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])); } catch (e) { central = []; }
    if (!Array.isArray(central)) central = [];
    const local = getLocal();
    central = central.map((r) => { const lc = local.comments[r.id] || []; return lc.length ? Object.assign({}, r, { comments: (r.comments || []).concat(lc) }) : r; });
    const ids = new Set(central.map((r) => r.id));
    const localOnly = local.reports.filter((r) => !ids.has(r.id)).map((r) => Object.assign({ _local: true }, r));
    return central.concat(localOnly).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  function mergeLocal(central) {
    const local = getLocal();
    let arr = central.map((r) => { const lc = local.comments[r.id] || []; return lc.length ? Object.assign({}, r, { comments: (r.comments || []).concat(lc) }) : r; });
    const ids = new Set(arr.map((r) => r.id));
    arr = arr.concat(local.reports.filter((r) => !ids.has(r.id)).map((r) => Object.assign({ _local: true }, r)));
    return arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  // ---------- 쓰기 ----------
  async function addReport(report) {
    if (hasToken()) return mutateReports((items) => items.concat([report]), '월례 보고: ' + report.branchName);
    if (hasEndpoint()) return callEndpoint('addReport', { report });
    const local = getLocal(); local.reports.push(report); setLocal(local); sendReportMail(report); return null;
  }
  async function addComment(reportId, comment) {
    // 로컬에만 있는 보고는 토큰/엔드포인트 여부와 무관하게 로컬에 저장(중앙엔 그 보고가 없어 유실되던 문제 방지)
    const local0 = getLocal();
    const ownLocal = local0.reports.find((r) => r.id === reportId);
    if (ownLocal) { ownLocal.comments = (ownLocal.comments || []).concat([comment]); setLocal(local0); return null; }
    if (hasToken()) return mutateReports((items) => items.map((r) => (r.id === reportId ? Object.assign({}, r, { comments: (r.comments || []).concat([comment]) }) : r)), '보고 댓글');
    if (hasEndpoint()) return callEndpoint('addComment', { reportId, comment });
    const local = getLocal();
    (local.comments[reportId] = local.comments[reportId] || []).push(comment);
    setLocal(local); return null;
  }
  async function deleteReport(report) {
    if (report._local) { const local = getLocal(); local.reports = local.reports.filter((r) => r.id !== report.id); setLocal(local); return null; }
    if (hasToken()) return mutateReports((items) => items.filter((r) => r.id !== report.id), '보고 삭제');
    if (hasEndpoint()) return callEndpoint('deleteReport', { reportId: report.id });
    throw new Error('삭제 권한이 없습니다 (본사 로그인 필요).');
  }
  async function deleteComment(reportId, commentId) {
    const local0 = getLocal();
    const ownLocal = local0.reports.find((r) => r.id === reportId);
    if (ownLocal) { ownLocal.comments = (ownLocal.comments || []).filter((c) => c.id !== commentId); setLocal(local0); return null; }
    if (hasToken()) return mutateReports((items) => items.map((r) => (r.id === reportId ? Object.assign({}, r, { comments: (r.comments || []).filter((c) => c.id !== commentId) }) : r)), '댓글 삭제');
    if (hasEndpoint()) return callEndpoint('deleteComment', { reportId, commentId });
    const local = getLocal();
    if (local.comments[reportId]) local.comments[reportId] = local.comments[reportId].filter((c) => c.id !== commentId);
    setLocal(local); return null;
  }
  function sendReportMail(r) {
    let body = `[에이스 종합관리 — 관리단 업무보고]\n사업소: ${r.branchName}\n보고자: ${r.reporter}\n보고일: ${r.date}\n`;
    REPORT_ITEMS.forEach((it) => { body += `------------------------------\n${it.k}. ${it.t}\n${(r.items && r.items[it.k]) || '-'}\n`; });
    window.open(`mailto:${TO_EMAIL}?subject=${encodeURIComponent('[에이스 종합관리] ' + r.branchName + ' 업무보고')}&body=${encodeURIComponent(body)}`, '_blank');
  }

  // ---------- 상태 ----------
  let META = {}, BRANCHES = [], REPORTS = [];
  let reportFilter = '', openReportId = null;

  // ---------- 모달 ----------
  function openModal(id) { const m = $(id); if (m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); } }
  function closeModal(id) { const m = $(id); if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); if (id === 'reportDetailModal') openReportId = null; } }
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m.id); });
  });
  function hint(el, msg, type) { if (el) { el.className = 'hint' + (type ? ' ' + type : ''); el.textContent = msg; } }

  // ---------- 탭 ----------
  $('tabbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]'); if (!btn) return;
    document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b === btn));
    const tab = btn.dataset.tab;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === tab));
    $('fabReport').classList.toggle('show', tab === 'scr-report');
    window.scrollTo(0, 0);
  });

  // ---------- 현황 대시보드 ----------
  function groupClass(g) { return 'g' + g; }
  function abilityChip(v) {
    if (v === '上') return '<span class="chip yes">소장능력 上</span>';
    if (v === '下') return '<span class="chip no">소장능력 下</span>';
    return '<span class="chip">소장능력 ?</span>';
  }
  function allyChip(v) {
    if (v === '○') return '<span class="chip yes">우호포섭 ○</span>';
    if (v === '×') return '<span class="chip no">우호포섭 ×</span>';
    return '<span class="chip">우호포섭 ?</span>';
  }
  function devChip(v) { return v === '우호' ? '<span class="chip yes">시행사 우호</span>' : '<span class="chip">시행사 ?</span>'; }

  function renderStatus() {
    // 요약 통계
    const total = BRANCHES.length;
    const g1 = BRANCHES.filter((b) => b.group === 1).length;
    const g2 = BRANCHES.filter((b) => b.group === 2).length;
    const g3 = BRANCHES.filter((b) => b.group === 3).length;
    $('statRow').innerHTML =
      `<div class="stat"><b>${total}</b><span>전체 사업소</span></div>` +
      `<div class="stat"><b>${g1}</b><span>1군</span></div>` +
      `<div class="stat"><b>${g2}</b><span>2군</span></div>` +
      `<div class="stat"><b>${g3}</b><span>3군</span></div>`;

    const wrap = $('groupWrap'); wrap.innerHTML = '';
    [1, 2, 3].forEach((g) => {
      const list = BRANCHES.filter((b) => b.group === g);
      if (!list.length) return;
      const block = document.createElement('div'); block.className = 'group-block';
      block.innerHTML = `<div class="group-head"><span class="group-badge g${g}">${g}군</span><span class="group-desc">${esc(META.groupCriteria && META.groupCriteria[g] || '')}</span></div>`;
      list.forEach((b) => {
        const cnt = REPORTS.filter((r) => r.branchId === b.id).length;
        const card = document.createElement('button');
        card.type = 'button'; card.className = `b-card g${g}`; card.dataset.id = b.id;
        card.innerHTML =
          `<div class="b-top"><span class="b-name">${esc(b.name)}</span>` +
          `<span class="b-count">보고 ${cnt}건 ›</span></div>`;
        block.appendChild(card);
      });
      wrap.appendChild(block);
    });
  }

  $('groupWrap').addEventListener('click', (e) => {
    const card = e.target.closest('.b-card'); if (!card) return;
    openBranch(card.dataset.id);
  });

  function ownTable(b) {
    if (!b.ownership || !b.ownership.length) return '';
    let h = '<table class="own-table"><tr><th>구분</th><th>인원</th><th>지분율</th></tr>';
    b.ownership.forEach((o) => { h += `<tr><td class="l">${esc(o.type)}</td><td>${o.count != null ? esc(o.count) + '명' : '-'}</td><td>${o.ratio != null ? esc(o.ratio) + '%' : '-'}</td></tr>`; });
    h += '</table>';
    if (b.ownershipTotal) h += `<div class="own-total">계 : ${esc(b.ownershipTotal)}</div>`;
    return h;
  }

  function openBranch(id) {
    const b = BRANCHES.find((x) => x.id === id); if (!b) return;
    let h = `<h2>${esc(b.name)} <span class="group-badge g${b.group}" style="font-size:12px;vertical-align:middle;">${b.group}군</span></h2>`;

    // 이 사업소의 보고서 — 날짜별(최근순)
    const reps = REPORTS.filter((r) => r.branchId === id).slice().sort((a, b2) => (b2.ts || 0) - (a.ts || 0));
    h += `<div class="d-sec-title">보고 이력 <span style="color:var(--soft);font-weight:600;">· ${reps.length}건 (최근순)</span></div>`;
    if (!reps.length) h += '<p class="rd-empty">아직 등록된 보고가 없습니다. 아래에서 첫 보고를 작성해 주세요.</p>';
    else {
      h += '<div class="bh-list">';
      reps.forEach((r) => {
        h += `<button type="button" class="bh-item" data-rid="${esc(r.id)}">` +
          `<span class="bh-date">${esc(r.date)}</span>` +
          `<span class="bh-info">${esc(r.reporter)}${r.occupancy ? ` · 입주율 ${esc(r.occupancy.rate)}%` : ''}${r._local ? ' · <i style="color:var(--accent);font-style:normal;">이 기기</i>' : ''}</span>` +
          `<span class="bh-cmt">💬 ${(r.comments || []).length}</span>` +
          '</button>';
      });
      h += '</div>';
    }
    h += `<button type="button" class="btn ghost block" id="branchReportBtn" style="margin-top:14px;">＋ 이 사업소 보고 작성</button>`;

    // 사업소 전략 정보 (있을 때만)
    if (b.status || (b.ownership && b.ownership.length) || b.situation || (b.managerActions && b.managerActions.length) || (b.hqActions && b.hqActions.length)) {
      h += '<div class="d-sec-title" style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">사업소 전략 정보</div>';
      if (b.status) h += `<div class="d-status">📌 ${esc(b.status)}</div>`;
      if (b.ownership && b.ownership.length) { h += '<div class="d-sec-title">지분율 현황</div>' + ownTable(b); }
      if (b.situation) h += '<div class="d-sec-title">현황 · 핵심 이슈</div><div class="d-text">' + esc(b.situation) + '</div>';
      if (b.managerActions && b.managerActions.length) {
        h += '<div class="d-sec-title">관리소장 대응방안</div><ul class="act-list mgr">' + b.managerActions.map((a) => `<li>${esc(a)}</li>`).join('') + '</ul>';
      }
      if (b.hqActions && b.hqActions.length) {
        h += '<div class="d-sec-title">본사 대응방안</div><ul class="act-list hq">' + b.hqActions.map((a) => `<li>${esc(a)}</li>`).join('') + '</ul>';
      }
    }

    // 본사 담당자 — 군 이동
    if (isAdmin()) {
      h += '<div class="d-sec-title" style="margin-top:18px;">본사 — 분류(군) 이동</div>' +
        '<div class="group-move" id="groupMove">' +
          [1, 2, 3].map((g) => `<button type="button" class="gm-btn${b.group === g ? ' active' : ''}" data-g="${g}">${g}군</button>`).join('') +
        '</div><p class="hint" id="groupMoveHint"></p>';
    }

    $('branchDetail').innerHTML = h;
    $('branchReportBtn').addEventListener('click', () => { closeModal('branchModal'); openReportForm(b.id); });
    // 보고 이력 항목 클릭 → 해당 보고 상세(+댓글)
    $('branchDetail').querySelectorAll('.bh-item').forEach((it) => {
      it.addEventListener('click', () => { closeModal('branchModal'); openReportDetail(it.dataset.rid); });
    });
    const gm = $('groupMove');
    if (gm) gm.addEventListener('click', (e) => {
      const btn = e.target.closest('.gm-btn'); if (!btn) return;
      const g = parseInt(btn.dataset.g, 10);
      if (g === b.group) return;
      moveBranchGroup(b.id, g);
    });
    openModal('branchModal');
  }

  async function moveBranchGroup(id, g) {
    if (!hasToken()) { alert('군 이동은 본사 담당자 로그인이 필요합니다.'); return; }
    const hintEl = $('groupMoveHint');
    if (hintEl) hint(hintEl, `${g}군으로 이동 중…`, '');
    try {
      const next = await mutateBranchesObj((o) => { o.branches = (o.branches || []).map((x) => (x.id === id ? Object.assign({}, x, { group: g }) : x)); return o; }, '사업소 군 이동: ' + g + '군');
      BRANCHES = next.branches;
      renderStatus(); renderReportFilter();
      openBranch(id); // 상세 갱신(이동 결과 반영)
    } catch (e) { if (hintEl) hint(hintEl, '오류: ' + e.message, 'error'); else alert('오류: ' + e.message); }
  }

  // ---------- 보고 목록 ----------
  function renderReportFilter() {
    const sel = $('reportFilter');
    sel.innerHTML = '<option value="">전체 사업소 보고 보기</option>' + BRANCHES.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
    sel.value = reportFilter;
  }
  function renderReports() {
    const list = $('reportList'), empty = $('reportEmpty');
    const filterField = $('reportFilter') ? $('reportFilter').parentElement : null;

    // 본사 담당자 전용 — 암호 잠금
    if (!isViewUnlocked()) {
      if (filterField) filterField.style.display = 'none';
      empty.hidden = true;
      list.innerHTML =
        '<div class="info-card" style="text-align:center;">' +
          '<div style="font-size:34px;margin-bottom:6px;">🔒</div>' +
          '<h3 style="text-align:center;">본사 담당자 전용</h3>' +
          '<p style="color:var(--soft);margin-bottom:12px;">전체 사업소 보고 열람은 본사 담당자 암호가 필요합니다.<br>관리소장님은 아래 ‘＋ 보고 작성’으로 보고를 올리실 수 있습니다.</p>' +
          '<div class="field"><input type="password" id="viewPw" placeholder="본사 담당자 암호" autocomplete="off" /></div>' +
          '<p class="hint" id="viewHint"></p>' +
          '<button type="button" class="btn block" id="viewUnlockBtn">열람하기</button>' +
        '</div>';
      bindLock();
      return;
    }
    if (filterField) filterField.style.display = '';

    const items = REPORTS.filter((r) => !reportFilter || r.branchId === reportFilter);
    list.innerHTML = '';
    if (!items.length) { empty.hidden = false; }
    else { empty.hidden = true; }
    items.forEach((r) => {
      const cmt = (r.comments || []).length;
      const first = REPORT_ITEMS.map((it) => (r.items && r.items[it.k]) ? r.items[it.k] : '').find((x) => x) || '';
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'report-card'; card.dataset.id = r.id;
      card.innerHTML =
        '<div class="rc-top">' +
          `<span class="rc-branch">${esc(r.branchName)}</span>` +
          `<span class="rc-month">${esc(r.month || r.date)}</span>` +
          (r._local ? '<span class="rc-local">이 기기에만</span>' : '') +
        '</div>' +
        `<div class="rc-meta">보고자 ${esc(r.reporter)} · ${esc(r.date)}${r.occupancy ? ` · 입주율 ${esc(r.occupancy.rate)}%` : ''}</div>` +
        `<div class="rc-excerpt">${esc(first)}</div>` +
        `<div class="rc-foot"><span class="rc-cmt">💬 본사 소통 ${cmt}</span><span class="rc-open">열기 ›</span></div>`;
      list.appendChild(card);
    });
    // 본사 토큰 로그인이 아닌 암호 열람 상태면 다시 잠글 수 있게
    if (!isAdmin() && localStorage.getItem(VIEW_OK_KEY) === '1') {
      const lock = document.createElement('button');
      lock.type = 'button'; lock.className = 'btn ghost block'; lock.style.marginTop = '8px';
      lock.textContent = '🔒 열람 잠그기';
      lock.addEventListener('click', () => { localStorage.removeItem(VIEW_OK_KEY); renderReports(); window.scrollTo(0, 0); });
      list.appendChild(lock);
    }
  }
  async function doUnlock() {
    const v = ($('viewPw').value || '').trim();
    if (!v) { hint($('viewHint'), '암호를 입력해 주세요.', 'error'); return; }
    hint($('viewHint'), '확인 중…', '');
    try {
      const h = await sha256hex(v);
      if (h === VIEW_PW) { localStorage.setItem(VIEW_OK_KEY, '1'); renderReports(); }
      else hint($('viewHint'), '암호가 일치하지 않습니다.', 'error');
    } catch (e) { hint($('viewHint'), '오류: ' + e.message, 'error'); }
  }
  function bindLock() {
    const btn = $('viewUnlockBtn'), inp = $('viewPw');
    if (btn) btn.addEventListener('click', doUnlock);
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doUnlock(); });
  }
  $('reportList').addEventListener('click', (e) => { const c = e.target.closest('.report-card'); if (c) openReportDetail(c.dataset.id); });
  $('reportFilter').addEventListener('change', function () { reportFilter = this.value; renderReports(); });

  // ---------- 보고 작성 ----------
  function openReportForm(branchId) {
    $('rmBranch').innerHTML = '<option value="" disabled selected>사업소 선택</option>' +
      BRANCHES.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
    if (branchId) $('rmBranch').value = branchId; else if (reportFilter) $('rmBranch').value = reportFilter;
    $('rmReporter').value = '';
    const d = new Date(); $('rmDate').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    REPORT_ITEMS.forEach((it) => { if ($('rm' + it.k)) $('rm' + it.k).value = ''; });
    $('rmOccTotal').value = ''; $('rmOccDone').value = ''; $('rmOccRate').value = '';
    hint($('rmHint'), '', '');
    openModal('reportModal');
  }
  $('fabReport').addEventListener('click', () => openReportForm());

  // 입주율 자동 계산 (입주호실 / 전체호실)
  function calcOcc() {
    const t = parseInt($('rmOccTotal').value, 10);
    const d = parseInt($('rmOccDone').value, 10);
    if (Number.isFinite(t) && t > 0 && Number.isFinite(d) && d >= 0) {
      const rate = Math.round((d / t) * 1000) / 10;
      $('rmOccRate').value = rate + '%';
      return { total: t, occupied: d, rate };
    }
    $('rmOccRate').value = '';
    return null;
  }
  $('rmOccTotal').addEventListener('input', calcOcc);
  $('rmOccDone').addEventListener('input', calcOcc);

  $('rmSubmit').addEventListener('click', async () => {
    const bId = $('rmBranch').value;
    const b = BRANCHES.find((x) => x.id === bId);
    const reporter = $('rmReporter').value.trim();
    if (!b || !reporter) { hint($('rmHint'), '사업소와 보고자(관리소장)는 필수입니다.', 'error'); return; }
    const items = {}; let any = false;
    REPORT_ITEMS.forEach((it) => { const v = ($('rm' + it.k).value || '').trim(); items[it.k] = v; if (v) any = true; });
    if (!any) { hint($('rmHint'), '최소 한 개 이상의 항목을 작성해 주세요.', 'error'); return; }
    const dv = $('rmDate').value;
    const dateStr = dv ? dv.replace(/-/g, '.') : todayStr();
    const month = dv ? dv.slice(0, 7) : '';
    const occupancy = calcOcc();
    const report = { id: uid('r'), branchId: b.id, branchName: b.name, reporter, date: dateStr, month, occupancy, items, ts: Date.now(), comments: [] };
    const btn = $('rmSubmit'); btn.disabled = true;
    try {
      hint($('rmHint'), '보고를 올리는 중…', '');
      const next = await addReport(report);
      REPORTS = next ? mergeLocal(next) : await loadReports();
      renderReports(); renderStatus();
      hint($('rmHint'), isCentral() ? '본사로 보고가 접수되었습니다! (반영까지 1~2분)' : '보고가 기록되었습니다. 본사 전달용 메일 창이 열립니다.', 'success');
      setTimeout(() => closeModal('reportModal'), 1100);
    } catch (e) { hint($('rmHint'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // ---------- 보고 상세 + 댓글 ----------
  function openReportDetail(id) {
    const r = REPORTS.find((x) => x.id === id);
    if (!r) { closeModal('reportDetailModal'); return; }
    openReportId = id;
    const comments = r.comments || [];
    let h = `<h2>${esc(r.branchName)} 업무보고</h2>`;
    h += `<div class="rc-meta" style="margin:6px 0 12px;">보고자 ${esc(r.reporter)} · ${esc(r.date)}${r._local ? ' · <span style="color:var(--accent);font-weight:700;">이 기기에만 저장됨</span>' : ''}</div>`;
    if (r.occupancy) {
      h += `<div class="r-block"><div class="bt"><span class="num zero">0</span>입주현황</div><div class="bd">입주 ${esc(r.occupancy.occupied)}호실 / 전체 ${esc(r.occupancy.total)}호실 · <b>입주율 ${esc(r.occupancy.rate)}%</b></div></div>`;
    }
    REPORT_ITEMS.forEach((it) => {
      const v = (r.items && r.items[it.k]) ? r.items[it.k] : '';
      if (!v) return;
      h += `<div class="r-block"><div class="bt"><span class="num">${it.k}</span>${esc(it.t)}</div><div class="bd">${esc(v)}</div></div>`;
    });

    h += '<div class="thread-head">💬 본사 ↔ 현장 소통</div><div class="cmts">';
    if (!comments.length) h += '<p class="empty" style="padding:14px 0;">아직 댓글이 없습니다.</p>';
    else comments.forEach((c) => {
      const hq = c.role === 'hq';
      const canDel = isAdmin() || r._local;
      h += `<div class="cmt ${hq ? 'hq' : ''}"><span class="who">${esc(c.author)}${hq ? ' · 본사' : ''}</span><div class="bubble">${esc(c.body)}</div><span class="when">${esc(c.date)}</span>${canDel ? `<button type="button" class="cdel" data-cdel="${esc(c.id)}">삭제</button>` : ''}</div>`;
    });
    h += '</div>';
    h += '<div class="cmt-form"><div class="cmt-row"><input type="text" id="cAuthor" placeholder="작성자 이름" autocomplete="off" /><select id="cRole"><option value="site">현장(소장)</option><option value="hq">본사</option></select></div>' +
      '<div class="field" style="margin-bottom:8px;"><textarea id="cBody" rows="2" placeholder="메시지를 입력하세요"></textarea></div>' +
      '<p class="hint" id="cHint"></p><button type="button" class="btn block" id="cSubmit">댓글 남기기</button></div>';
    if (isAdmin() || r._local) h += `<button type="button" class="btn ghost block" id="rDelBtn" style="margin-top:10px;">이 보고 삭제</button>`;

    $('reportDetail').innerHTML = h;
    openModal('reportDetailModal');

    $('cSubmit').addEventListener('click', async () => {
      const author = $('cAuthor').value.trim(), role = $('cRole').value, body = $('cBody').value.trim();
      if (!author || !body) { hint($('cHint'), '이름과 내용을 입력해 주세요.', 'error'); return; }
      const comment = { id: uid('c'), author, role, body, date: todayStr(), ts: Date.now() };
      $('cSubmit').disabled = true;
      try {
        const next = await addComment(id, comment);
        REPORTS = next ? mergeLocal(next) : await loadReports();
        renderReports(); openReportDetail(id);
      } catch (e) { hint($('cHint'), '오류: ' + e.message, 'error'); $('cSubmit').disabled = false; }
    });
    $('reportDetail').querySelectorAll('.cdel').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('이 댓글을 삭제할까요?')) return;
        try { const next = await deleteComment(id, b.dataset.cdel); REPORTS = next ? mergeLocal(next) : await loadReports(); renderReports(); openReportDetail(id); }
        catch (e) { alert('삭제 오류: ' + e.message); }
      });
    });
    const rDel = $('rDelBtn');
    if (rDel) rDel.addEventListener('click', async () => {
      if (!confirm('이 보고를 삭제할까요?')) return;
      try { const next = await deleteReport(r); REPORTS = next ? mergeLocal(next) : await loadReports(); renderReports(); renderStatus(); closeModal('reportDetailModal'); }
      catch (e) { alert('삭제 오류: ' + e.message); }
    });
  }

  // ---------- 본사 로그인 ----------
  function setAdmin(on) {
    document.body.classList.toggle('admin-on', on);
    const pill = $('adminPill');
    pill.classList.toggle('on', on);
    pill.textContent = on ? '본사 ✓' : '본사';
    $('logoutBtn').style.display = on ? 'block' : 'none';
    if ($('addBranchBtn')) $('addBranchBtn').style.display = on ? 'inline-flex' : 'none';
  }

  // ---------- 사업소 추가 (본사 담당자) ----------
  $('addBranchBtn') && $('addBranchBtn').addEventListener('click', () => {
    if (!hasToken()) { alert('사업소 추가는 본사 담당자 로그인이 필요합니다.'); $('loginToken').value = token(); openModal('loginModal'); return; }
    $('baName').value = ''; $('baReg').value = ''; $('baGroup').value = '3';
    hint($('baHint'), '', ''); openModal('branchAddModal');
  });
  $('baSubmit') && $('baSubmit').addEventListener('click', async () => {
    const name = $('baName').value.trim();
    if (!name) { hint($('baHint'), '사업소명을 입력해 주세요.', 'error'); return; }
    if (!hasToken()) { hint($('baHint'), '본사 담당자 로그인이 필요합니다.', 'error'); return; }
    const regVal = $('baReg').value.trim();
    const branch = {
      id: uid('b'), name, group: parseInt($('baGroup').value, 10),
      regRate: regVal === '' ? null : Number(regVal),
      committee: false, developerRel: '?', managerAbility: '?', allyRecruited: '?', status: '',
      ownership: [], ownershipTotal: '', situation: '', managerActions: [], hqActions: [],
    };
    const btn = $('baSubmit'); btn.disabled = true;
    try {
      hint($('baHint'), '추가하는 중…', '');
      const next = await mutateBranchesObj((o) => { o.branches = (o.branches || []).concat([branch]); return o; }, '사업소 추가: ' + name);
      BRANCHES = next.branches;
      renderStatus(); renderReportFilter();
      $('hdrSub').textContent = `${BRANCHES.length}개 지점사업소 · 본사 ↔ 관리소장 소통`;
      hint($('baHint'), '추가되었습니다! (반영까지 1~2분)', 'success');
      setTimeout(() => closeModal('branchAddModal'), 1100);
    } catch (e) { hint($('baHint'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });
  $('adminPill').addEventListener('click', () => { $('loginToken').value = token(); hint($('loginHint'), '', ''); openModal('loginModal'); });
  $('loginSubmit').addEventListener('click', async () => {
    const t = $('loginToken').value.trim();
    if (!t) { hint($('loginHint'), '토큰을 입력해 주세요.', 'error'); return; }
    hint($('loginHint'), '확인 중…', '');
    try {
      if (!(await verifyToken(t))) { hint($('loginHint'), '유효하지 않은 토큰이거나 저장소 권한이 없습니다.', 'error'); return; }
      localStorage.setItem(TOKEN_KEY, t); setAdmin(true);
      hint($('loginHint'), '', ''); closeModal('loginModal');
      REPORTS = await loadReports(); renderReports(); refreshNote();
    } catch (e) { hint($('loginHint'), '오류: ' + e.message, 'error'); }
  });
  $('logoutBtn').addEventListener('click', () => { localStorage.removeItem(TOKEN_KEY); setAdmin(false); closeModal('loginModal'); refreshNote(); renderReports(); });

  function refreshNote() {
    const note = $('reportNote');
    if (isCentral()) { note.hidden = true; return; }
    note.hidden = false;
    note.innerHTML = '<b>안내</b> · 이 브라우저에는 중앙 저장이 설정되어 있지 않습니다. 올리신 보고는 <b>이 기기에 기록</b>되고 본사에는 <b>메일</b>로 전달됩니다. 모든 사업소가 함께 보는 중앙 공유는 본사에 문의하세요.';
  }

  // 내장 기본 사업소 목록 — branches.json 로드 실패(파일 직접 열기 등) 시에도 12개가 항상 선택되도록 보장.
  // branches.json 이 정상 로드되면 그 데이터(상세 포함)로 대체됩니다.
  const FALLBACK_BRANCHES = [
    { id: 'sinhwa1', name: '신화 1차', group: 1 },
    { id: 'present', name: '프리센트', group: 1 },
    { id: 'mastervalue', name: '마스터밸류', group: 1 },
    { id: 'shdream', name: 'SH드림타워', group: 1 },
    { id: 'sinhwa2', name: '신화 2차', group: 2 },
    { id: 'ace101', name: '에이스 101', group: 2 },
    { id: 'sejong', name: '세종에이스', group: 2 },
    { id: 'aceavenue', name: '에이스에비뉴', group: 2 },
    { id: 'atrium', name: '창원 아트리움시티', group: 3 },
    { id: 'garimsuite2', name: '가림스위트 2차', group: 3 },
    { id: 'sky3', name: '스카이 3차', group: 3 },
    { id: 'visionpark', name: '비전파크', group: 3 },
  ];

  // ---------- 초기화 ----------
  async function init() {
    try {
      const meta = await fetch(BRANCHES_PATH + '?_cb=' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
      META = meta || {};
      BRANCHES = (meta && Array.isArray(meta.branches) && meta.branches.length) ? meta.branches : FALLBACK_BRANCHES;
      if (!window.ACE_REPORT_VIEW_PW_SHA256 && META.reportViewPwSha256) VIEW_PW = META.reportViewPwSha256;
    } catch (e) { META = {}; BRANCHES = FALLBACK_BRANCHES; }
    $('hdrSub').textContent = `${BRANCHES.length}개 지점사업소 · 본사 ↔ 관리소장 소통`;
    renderStatus();
    renderReportFilter();
    if (hasToken()) { verifyToken(token()).then((ok) => { if (ok) setAdmin(true); }); }
    REPORTS = await loadReports();
    renderReports();
    renderStatus(); // 보고 건수 반영
    refreshNote();
  }
  init();
})();
