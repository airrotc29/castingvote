// ===== 에이스종합관리 — 지점사업소 관리단 구성 전략 앱 =====
// 사업소 현황 대시보드 + 소장 월례 업무보고 + 본사 소통(댓글) + 소장 평가/전략 안내
// 보고/댓글 저장은 3단계: ① 중앙 엔드포인트(프록시) ② 본사 토큰(GitHub) ③ 로컬+메일 폴백
(function () {
  'use strict';

  const OWNER = 'airrotc29', REPO = 'branch-communication-webapp', BRANCH = 'main';
  const APP_VERSION = 'v98 · 2026.06.29 (시각 괄호·작게)';
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'ace_admin_token';
  const LOCAL_KEY = 'ace_branch_reports_local';
  const BRANCHES_PATH = 'assets/data/branches.json';
  const REPORTS_PATH = 'assets/data/branch-reports.json';
  const TO_EMAIL = 'airrotc29@habitusinc.co.kr';
  const ENDPOINT = (window.ACE_REPORT_ENDPOINT || localStorage.getItem('ace_report_endpoint') || '').trim();

  // ---------- 로그인 (아이디/비밀번호) ----------
  // 계정은 assets/data/auth.json 에 저장(비밀번호는 SHA-256 해시). 없으면 아래 기본값.
  const AUTH_PATH = 'assets/data/auth.json';
  const PLEDGES_PATH = 'assets/data/pledges.json'; // 관리소장 서약서 제출 기록
  const DEFAULT_ACCOUNTS = [
    { id: '1', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'sinhwa1', branchName: '신화 1차' },
    { id: '2', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'sinhwa2', branchName: '신화 2차' },
    { id: '3', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'present', branchName: '프리센트' },
    { id: '4', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'atrium', branchName: '창원 아트리움시티' },
    { id: '5', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'ace101', branchName: '에이스 101' },
    { id: '6', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'sejong', branchName: '세종에이스' },
    { id: '7', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'aceavenue', branchName: '에이스에비뉴' },
    { id: '8', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'garimsuite2', branchName: '가림스위트 2차' },
    { id: '9', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'sky3', branchName: '스카이 3차' },
    { id: '10', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'visionpark', branchName: '비전파크' },
    { id: '11', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'mastervalue', branchName: '마스터밸류' },
    { id: '12', role: 'site', pwHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branchId: 'shdream', branchName: 'SH드림타워' },
    { id: '본사', role: 'hq', pwHash: 'b89a1c3aae305aeca883f51f8e2442b9b5eb6178dfc845c751b7dcf952ac8b9e' }, // ace01
  ];
  let AUTH = DEFAULT_ACCOUNTS.slice();
  const LOGIN_FLAG = 'ace_logged_in';
  // 비밀번호 로그인 시 GitHub 저장에 쓸 토큰(난독화 문자열). 비우면 로컬 저장만 됨.
  // 값 생성: 브라우저 콘솔에서 obfHelper('your_github_token') 실행 → 결과를 아래에 붙여넣기.
  const EMBED_TOKEN_OBF = 'BioRWkVQaVEANzoDAXFwYzB3IHsAVE5AEi81BVRoc1VUHDZceEdQTFdzC2dEemNHFwAkSFxcWXIQIAACZgNsZyAUNnR/C1dQFQstd0RkfhQ7BDBoenBDUDt1XEBy';
  function deobf(b64) { try { const s = atob(b64); const k = 'aCe2026!'; let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length)); return o; } catch (e) { return ''; } }
  window.obfHelper = function (t) { const k = 'aCe2026!'; let s = ''; for (let i = 0; i < t.length; i++) s += String.fromCharCode(t.charCodeAt(i) ^ k.charCodeAt(i % k.length)); return btoa(s); };

  // 보고 서식: 군별 → 단계별 → 과제 (각 과제는 소장이 텍스트 입력)
  const _COMMON = [
    ['1-1', '관리규약내 관리위원회 결의시 수의계약으로 할수 있다 라는 문구 명문화'],
    ['1-2', '분양 입주자에게 관리규약 75% 서명 받기'],
    ['1-3', '입주현황 파악 (임차인, 구분소유자 각각 통계)'],
    ['1-4', '본사와 협의하여 등기율 조사'],
    ['1-5', '규약에따라 관리인, 관리위원장, 관리위원 섭외'],
    ['1-6', '시행사 관련동정 파악'],
    ['1-7', '시공사 관련동정 파악 (하자 보수협의, 등)'],
  ];
  const _STAGE4 = [
    ['1-1', '관리인 선임신고 대행'],
    ['1-2', '재계약 협의시행'],
    ['1-3', '인계인수서 작성 및 각종 명의변경 시행'],
    ['1-4', '재계약 시행'],
  ];
  const _mk = (name, rows) => ({ name, tasks: rows.map((r) => ({ no: r[0], t: r[1] })) });
  const REPORT_STAGES_BY_GROUP = {
    1: [
      _mk('공통단계', _COMMON),
      _mk('2단계 (추진위 자생)', [
        ['1-1', '추진위 구성인원 파악 보고'],
        ['1-2', '본사 지원사항 추진위 상대 별도 브리핑 준비/시행'],
        ['1-3', '추진위 협의 및 활동사항 본사 보고 (회의, 협의 내용 등)'],
      ]),
      _mk('3단계 (관리단 집회 준비/시행)', [
        ['1-1', '추진위와 최초관리단 집회 개최 계획(협력계획) 수립'],
        ['1-2', '본사 지원사항 추진위 상대 별도 브리핑 준비/시행'],
        ['1-3', '관리단 집회개최 협조'],
      ]),
      _mk('4단계 (재계약 협의, 인계인수)', _STAGE4),
    ],
    2: [
      _mk('공통단계', _COMMON),
      _mk('1단계 (섭외진행 추진위 구성전)', [
        ['1-1', '규약에따라 관리인, 관리위원장, 관리위원 섭외 진행사항 본사 보고'],
        ['1-2', '섭외인원에 대한 관리방안 보고 (소유 전유부에 대한 특별 관리 등)'],
      ]),
      _mk('2단계 (섭외완료 추진위 구성 완료)', [
        ['1-1', '규약에따라 관리인, 관리위원장, 관리위원 섭외 완료 본사 보고'],
        ['1-2', '추진위 발촉계획 보고 및 발촉'],
        ['1-3', '추진위 협의 및 활동사항 본사 보고 (회의, 협의 내용 등)'],
      ]),
      _mk('3단계 (관리단 집회 준비/시행)', [
        ['1-1', '추진위와 최초관리단 집회 개최 계획 수립'],
        ['1-2', '본사 지원사항 추진위 상대 별도 브리핑 준비/시행'],
        ['1-3', '시행사연락 집합건물법 제9조 3항 분양자의 의무 시행 협의'],
        ['1-4', '최초관리단 집회 소집통지서 발송'],
        ['1-5', '전자투표 시행'],
        ['1-6', '최초관리단집회 시행'],
      ]),
      _mk('4단계 (재계약 협의, 인계인수)', _STAGE4),
    ],
  };
  REPORT_STAGES_BY_GROUP[3] = REPORT_STAGES_BY_GROUP[2].map((s) => ({ name: s.name, tasks: s.tasks.map((t) => ({ no: t.no, t: t.t })) })); // 3군 = 2군 동일
  Object.keys(REPORT_STAGES_BY_GROUP).forEach((g) => {
    REPORT_STAGES_BY_GROUP[g].forEach((s, si) => s.tasks.forEach((t, ti) => { t.k = 'g' + g + '_' + si + '_' + ti; }));
  });
  function stagesForGroup(group) { return REPORT_STAGES_BY_GROUP[group] || REPORT_STAGES_BY_GROUP[2]; }
  function reportStages(r) { const g = (r && r.group) || ((BRANCHES.find((x) => x.id === (r && r.branchId)) || {}).group); return stagesForGroup(g); }
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------- 저장 모드 ----------
  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const hasToken = () => !!token();
  const hasEndpoint = () => !!ENDPOINT;
  const isAdmin = () => document.body.classList.contains('admin-on');
  const isCentral = () => hasToken() || hasEndpoint();
  // 사업소 계정(소장)으로 로그인한 경우 그 사업소 id. 본사(hq)는 빈 문자열(전체 열람).
  function lockedBranchId() { return (localStorage.getItem('ace_role') === 'site') ? (localStorage.getItem('ace_branch') || '') : ''; }
  function isHQ() { return localStorage.getItem('ace_role') === 'hq'; }

  function headers() { return { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }
  function utf8ToB64(str) { return btoa(String.fromCharCode.apply(null, new TextEncoder().encode(str))); }
  function b64ToUtf8(b64) { const bin = atob(b64.replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function todayStr(d) { d = d || new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; }
  // 표시용 날짜·시:분:초 (ts 기준). dtStr=날짜문자열+시각, fullDT=ts에서 전체 일시
  function _p2(n) { return String(n).padStart(2, '0'); }
  function timeOf(ts) { if (!ts) return ''; const d = new Date(ts); return `${_p2(d.getHours())}:${_p2(d.getMinutes())}:${_p2(d.getSeconds())}`; }
  function fullDT(ts) { if (!ts) return ''; const d = new Date(ts); return `${d.getFullYear()}.${_p2(d.getMonth() + 1)}.${_p2(d.getDate())} ${timeOf(ts)}`; }
  function dtStr(dateStr, ts) { const t = timeOf(ts); return t ? ((dateStr || '') + ' ' + t).trim() : (dateStr || ''); }
  // 표시용 HTML: 날짜 + (시:분:초)를 작게 괄호로. dateStr 없으면 ts에서 날짜 도출
  function dtHtml(dateStr, ts) {
    let base = dateStr;
    if (!base && ts) { const d = new Date(ts); base = `${d.getFullYear()}.${_p2(d.getMonth() + 1)}.${_p2(d.getDate())}`; }
    const t = timeOf(ts);
    return esc(base || '') + (t ? ` <span class="dt-time">(${t})</span>` : '');
  }
  // PDF 등 클래스 미적용 환경용 (인라인 스타일)
  function dtHtmlInline(dateStr, ts) {
    const t = timeOf(ts);
    return esc(dateStr || '') + (t ? ` <span style="font-size:.82em;color:#94a3b8;">(${t})</span>` : '');
  }
  async function sha256hex(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

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
      if (res.status === 401) throw new Error('토큰이 만료/무효입니다. (401) — 다시 로그인하세요.');
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

  // ---------- 계정(auth.json) ----------
  async function loadAuth() {
    try {
      const a = await fetch(AUTH_PATH + '?_cb=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
      if (a && Array.isArray(a.accounts) && a.accounts.length) return a.accounts;
    } catch (e) {}
    return DEFAULT_ACCOUNTS.slice();
  }
  async function getAuthObj() {
    const data = await getContent(AUTH_PATH);
    if (!data) return { obj: { accounts: DEFAULT_ACCOUNTS.slice() }, sha: null };
    let obj = {}; try { obj = JSON.parse(b64ToUtf8(data.content)); } catch (e) { obj = {}; }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.accounts)) obj = { accounts: DEFAULT_ACCOUNTS.slice() };
    return { obj, sha: data.sha };
  }
  async function mutateAuth(mutator, message) {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      const { obj, sha } = await getAuthObj();
      const next = mutator(obj);
      try { await putContent(AUTH_PATH, utf8ToB64(JSON.stringify(next, null, 2)), message, sha); return next; }
      catch (e) { lastErr = e; if (String(e.message).includes('(409)')) { await new Promise((r) => setTimeout(r, 700)); continue; } throw e; }
    }
    throw lastErr;
  }

  // ---------- 서약서(pledges.json) ----------
  async function loadPledges() {
    try {
      const o = await fetch(PLEDGES_PATH + '?_cb=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
      if (o && o.pledges && typeof o.pledges === 'object') return o.pledges;
    } catch (e) {}
    return {};
  }
  async function getPledgesObj() {
    const data = await getContent(PLEDGES_PATH);
    if (!data) return { obj: { pledges: {} }, sha: null };
    let obj = {}; try { obj = JSON.parse(b64ToUtf8(data.content)); } catch (e) { obj = {}; }
    if (!obj || typeof obj !== 'object' || typeof obj.pledges !== 'object' || !obj.pledges) obj = { pledges: {} };
    return { obj, sha: data.sha };
  }
  async function mutatePledges(mutator, message) {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      const { obj, sha } = await getPledgesObj();
      const next = mutator(obj);
      try { await putContent(PLEDGES_PATH, utf8ToB64(JSON.stringify(next, null, 2)), message, sha); return next; }
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
    const local = getLocal(); local.reports.push(report); setLocal(local); return null;
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
    throw new Error('삭제 권한이 없습니다 (로그인 필요).');
  }
  async function updateReport(report) {
    if (report._local) { const local = getLocal(); local.reports = local.reports.map((r) => (r.id === report.id ? report : r)); setLocal(local); return null; }
    if (hasToken()) return mutateReports((items) => items.map((r) => (r.id === report.id ? Object.assign({}, r, report) : r)), '보고 수정: ' + report.branchName);
    if (hasEndpoint()) return callEndpoint('updateReport', { report });
    throw new Error('수정 권한이 없습니다 (로그인 필요).');
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
  // ---------- 상태 ----------
  let META = {}, BRANCHES = [], REPORTS = [];
  let reportFilter = '', openReportId = null;

  // 새 보고(읽지 않은 보고) 추적 — 반짝임 표시용
  // 새 보고/새 댓글 추적 — {reportId: 마지막으로 본 댓글 수}
  const SEEN_KEY = 'ace_seen_reports';
  // 읽음 추적은 계정별로 분리 — 같은 기기에서 본사/소장 NEW 표시가 섞이지 않도록
  function seenKey() { return SEEN_KEY + '_' + (localStorage.getItem('ace_acct') || 'anon'); }
  function getSeen() { try { const o = JSON.parse(localStorage.getItem(seenKey()) || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch (e) { return {}; } }
  function setSeen(o) { localStorage.setItem(seenKey(), JSON.stringify(o)); }
  // 본 시점 기록: { c: 본 댓글 수, e: 본 수정시각 }. 옛 형식(숫자=댓글 수)도 호환.
  function seenOf(r) { const s = getSeen(); const c = s[r.id]; if (c === undefined) return undefined; return (typeof c === 'object' && c) ? { c: c.c || 0, e: c.e || 0 } : { c: c, e: 0 }; }
  // 'new'(새 보고/새 댓글) | 'edit'(이미 본 보고가 수정됨) | ''(변동 없음)
  function reportFlag(r) {
    const sv = seenOf(r);
    if (sv === undefined) return 'new';
    if ((r.comments || []).length > sv.c) return 'new';
    if ((r.editTs || 0) > sv.e) return 'edit';
    return '';
  }
  function isNew(r) { return reportFlag(r) === 'new'; }
  function isEdited(r) { return reportFlag(r) === 'edit'; }
  function isFresh(r) { return reportFlag(r) !== ''; }
  function markSeen(r) { const s = getSeen(); s[r.id] = { c: (r.comments || []).length, e: (r.editTs || 0) }; setSeen(s); }
  function unseenCount() { return REPORTS.filter(isFresh).length; }
  function branchUnseen(bid) { return REPORTS.some((r) => r.branchId === bid && isFresh(r)); }
  function updateTabDot() { const dot = $('reportTabDot'); if (dot) dot.hidden = unseenCount() === 0; }
  // 배지 (NEW=청색 / 수정=녹색, 글자 흰색 — 색은 CSS 클래스에서)
  function freshBadge(r, txtNew) {
    const f = reportFlag(r); if (!f) return '';
    return f === 'new' ? `<span class="new-badge">${txtNew}</span>` : '<span class="edit-badge">수정</span>';
  }
  function freshClass(r) { const f = reportFlag(r); return f === 'new' ? ' is-new' : f === 'edit' ? ' is-edit' : ''; }
  // 보고 박스 채움색 — 연회색으로 통일
  function stageFillStyle(r) { return 'background:#f3f4f6;border-color:#e2e5ea;'; }
  function stageNoStyle(r) { return 'background:#cbd1d9;color:#374151;'; }

  // ---------- 모달 ----------
  function openModal(id) { const m = $(id); if (m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); } }
  function closeModal(id) { const m = $(id); if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); if (id === 'reportDetailModal') openReportId = null; if (id === 'reportModal') editReportId = null; } }
  // 입력 폼 모달은 바깥(어두운 배경) 클릭으로 닫지 않음 — 작성 중 내용 유실 방지. ×버튼으로만 닫힘.
  const NO_BACKDROP_CLOSE = new Set(['reportModal', 'branchAddModal', 'branchEditModal', 'changeCredModal', 'pledgeModal']);
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { closeModal(m.id); return; }
      if (e.target === m && !NO_BACKDROP_CLOSE.has(m.id)) closeModal(m.id);
    });
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
    if (v === '○') return '<span class="chip yes">우호섭외 ○</span>';
    if (v === '×') return '<span class="chip no">우호섭외 ×</span>';
    return '<span class="chip">우호섭외 ?</span>';
  }
  function devChip(v) { return v === '우호' ? '<span class="chip yes">시행사 우호</span>' : '<span class="chip">시행사 ?</span>'; }

  // 사업소의 현재 단계 = 보고에 입력된 과제 중 가장 높은(진행된) 단계의 이름.
  // 보고가 없거나 입력 과제가 없으면 null(미보고).
  function branchStage(b) {
    const reps = REPORTS.filter((r) => r.branchId === b.id);
    let maxSi = -1;
    reps.forEach((r) => {
      const items = r.items || {};
      Object.keys(items).forEach((k) => {
        if (!items[k]) return;
        const m = /^g\d+_(\d+)_/.exec(k);
        if (m) { const si = parseInt(m[1], 10); if (si > maxSi) maxSi = si; }
      });
    });
    if (maxSi < 0) return null;
    const stages = stagesForGroup(b.group);
    return stages[maxSi] ? stages[maxSi].name : null;
  }
  function stageOrder(name) {
    if (name == null) return 99; // 미보고는 맨 아래
    if (/공통/.test(name)) return 0;
    const m = /^(\d+)단계/.exec(name);
    return m ? parseInt(m[1], 10) : 50;
  }
  // 단계명 → 색상 클래스 (s0 공통, s1~s4 단계)
  function stageColorClass(name) { const o = stageOrder(name); return (o >= 1 && o <= 4) ? ('s' + o) : 's0'; }
  // 단계명 표기: 괄호 부분(예: (추진위 자생))은 작은 글씨로
  function fmtStageName(name) { const m = /^(.*?)\s*(\(.*\))\s*$/.exec(String(name || '')); return m ? `${esc(m[1].trim())} <span class="sb-sub">${esc(m[2])}</span>` : esc(name); }
  function stageHex(name) { const o = stageOrder(name); return ({ 1: '#1c5fc4', 2: '#15803d', 3: '#c2660c', 4: '#b91c1c' })[o] || '#334155'; }
  // 개별 보고의 단계명(가장 높은 작성 단계) — 배지 색상용
  function reportStageName(r) {
    const items = (r && r.items) || {}; let maxSi = -1;
    Object.keys(items).forEach((k) => { if (!items[k]) return; const m = /^g\d+_(\d+)_/.exec(k); if (m) { const si = parseInt(m[1], 10); if (si > maxSi) maxSi = si; } });
    if (maxSi < 0) return null;
    const stages = reportStages(r); return stages[maxSi] ? stages[maxSi].name : null;
  }
  // 도넛(원형) 차트 HTML — 현황 화면용
  function donutHtml(orders, byOrder, namesByOrder, totalV) {
    const labelOf = (o) => (o === 0 ? '공통' : o === 99 ? '미보고' : (o + '단계'));
    const hexOf = (o) => ({ 99: '#94a3b8', 0: '#475569', 1: '#2563eb', 2: '#16a34a', 3: '#ea580c', 4: '#dc2626' })[o] || '#94a3b8';
    const r = 60, C = 2 * Math.PI * r, sw = 22; let off = 0;
    const segs = orders.filter((o) => (byOrder[o] || 0) > 0).map((o) => {
      const v = byOrder[o] || 0; const len = v / totalV * C;
      const c = `<circle class="donut-seg" data-order="${o}" cx="80" cy="80" r="${r}" fill="none" stroke="${hexOf(o)}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
      off += len; return c;
    }).join('');
    const svg = `<svg class="donut-svg" viewBox="0 0 160 160" width="150" height="150"><g transform="rotate(-90 80 80)"><circle cx="80" cy="80" r="${r}" fill="none" stroke="#eef1f5" stroke-width="${sw}"/>${segs}</g>` +
      `<text x="80" y="76" text-anchor="middle" class="donut-num">${totalV}</text><text x="80" y="97" text-anchor="middle" class="donut-sub">사업소</text></svg>`;
    const legend = orders.map((o) => {
      const v = byOrder[o] || 0; const pct = Math.round((v / totalV) * 100);
      const names = (namesByOrder[o] || []).join(', ');
      return `<li class="dl-item" data-order="${o}" title="${esc(labelOf(o))} (${v}·${pct}%): ${esc(names || '없음')}"><span class="dl-dot" style="background:${hexOf(o)}"></span><b>${esc(labelOf(o))}</b><i class="dl-v">${v}</i><i class="dl-p">${pct}%</i></li>`;
    }).join('');
    return `<div class="donut-wrap"><div class="donut-chart">${svg}</div><ul class="donut-legend">${legend}</ul></div>`;
  }
  function relTime(ts) {
    if (!ts) return '';
    const now = Date.now(); const diff = now - ts; const day = 86400000;
    if (diff < 0) return '방금';
    try { if (new Date(ts).toDateString() === new Date(now).toDateString()) return '오늘'; } catch (e) {}
    const d = Math.floor(diff / day);
    if (d <= 0) return '오늘';
    if (d === 1) return '어제';
    if (d < 7) return d + '일 전';
    if (d < 30) return Math.floor(d / 7) + '주 전';
    return Math.floor(d / 30) + '개월 전';
  }
  // 현황 우측 패널: 요약 KPI + 최근 활동 + 주의 알림 (본사 전용)
  function renderStatusPanel(visible, lb) {
    const el = $('statusPanel'); if (!el) return;
    if (lb) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';
    const ids = new Set(visible.map((b) => b.id));
    const total = visible.length;
    const reported = visible.filter((b) => branchStage(b) !== null).length;
    const notyet = total - reported;
    const now = new Date(); const ym = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0');
    // 당월 보고완료 = 이번 달에 보고한 사업소 수 / 당월 미보고 = 나머지
    const monthIds = new Set(REPORTS.filter((r) => ids.has(r.branchId) && String(r.date || '').startsWith(ym)).map((r) => r.branchId));
    const monthDone = monthIds.size;
    const monthNotyet = total - monthDone;
    let sum = 0, n = 0;
    visible.forEach((b) => { const st = branchStage(b); if (st !== null) { sum += stageOrder(st); n++; } });
    const avg = n ? (sum / n).toFixed(1) : '0';
    const notyetNames = visible.filter((b) => branchStage(b) === null).map((b) => b.name);
    const STALE = 30 * 86400000; const nowMs = Date.now();
    const stale = visible.filter((b) => { const reps = REPORTS.filter((r) => r.branchId === b.id); if (!reps.length) return false; const last = Math.max.apply(null, reps.map((r) => r.ts || 0)); return last && (nowMs - last) > STALE; }).map((b) => b.name);
    const acts = [];
    REPORTS.filter((r) => ids.has(r.branchId)).forEach((r) => {
      const firstItem = Object.values(r.items || {}).find((v) => v) || '';
      const fl = reportFlag(r); const hex = stageHex(reportStageName(r));
      acts.push({ ts: Math.max(r.ts || 0, r.editTs || 0), branch: r.branchName, kind: '보고', id: r.id, body: firstItem, flag: fl, hex: hex });
      (r.comments || []).forEach((c) => acts.push({ ts: c.ts || 0, branch: r.branchName, kind: c.role === 'hq' ? '본사 댓글' : '현장 댓글', id: r.id, body: c.body, flag: fl === 'new' ? 'new' : '', hex: hex }));
    });
    acts.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const recent = acts.slice(0, 7);
    const kpi = (v, l, key) => `<div class="sp-kpi${key ? ' sp-kpi-click' : ''}"${key ? ` data-kpi="${key}"` : ''}><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
    let h = '<div class="sp-kpis">' + kpi(total, '전체') + kpi(monthDone, '당월 보고완료', 'done') + kpi(monthNotyet, '당월 미보고', 'notyet') + kpi(avg, '평균 단계') + '</div>';
    h += '<div class="sp-cols">';
    h += '<div class="sp-card"><div class="sp-h">🕒 최근 활동</div>';
    if (!recent.length) h += '<p class="sp-empty">최근 활동이 없습니다.</p>';
    else h += '<ul class="sp-feed">' + recent.map((a) => { const fcls = a.flag === 'new' ? ' is-new' : a.flag === 'edit' ? ' is-edit' : ''; const fbadge = a.flag === 'new' ? '<span class="new-badge sp-new">NEW</span>' : a.flag === 'edit' ? '<span class="edit-badge sp-edit">수정</span>' : ''; return `<li class="sp-feed-item${fcls}" data-rid="${esc(a.id)}" data-kind="${a.kind === '보고' ? 'rep' : 'cmt'}"><div class="sp-fr"><span class="sp-kind ${a.kind === '보고' ? 'k-rep' : 'k-cmt'}"></span><b>${esc(a.branch)}</b> <span class="sp-act">${esc(a.kind)}</span>${fbadge}<i class="sp-when">${dtHtml('', a.ts)}</i></div></li>`; }).join('') + '</ul>';
    h += '</div>';
    h += '<div class="sp-card"><div class="sp-h">🔔 주의</div>';
    h += `<div class="sp-alert"><span>미보고</span><b>${notyet}</b></div>`;
    if (notyetNames.length) h += `<div class="sp-names">${esc(notyetNames.join(', '))}</div>`;
    h += `<div class="sp-alert ${stale.length ? 'warn' : ''}"><span>30일+ 정체</span><b>${stale.length}</b></div>`;
    if (stale.length) h += `<div class="sp-names">${esc(stale.join(', '))}</div>`;
    h += '</div></div>';
    el.innerHTML = h;
  }

  function renderStatus() {
    // 사업소 계정은 본인 사업소만 표시. 본사는 전체.
    const lb = lockedBranchId();
    if ($('statusLead')) $('statusLead').style.display = lb ? 'none' : '';
    document.body.classList.toggle('site-view', !!lb);
    const visible = lb ? BRANCHES.filter((b) => b.id === lb) : BRANCHES;
    // 요약 통계 — 사업소 계정 로그인 시에는 숨김(본사만 표시). 단계별 막대그래프(현황+보고 양쪽).
    const CAPS = ['statCap', 'statCap2'], ROWS = ['statRow', 'statRow2'];
    CAPS.forEach((id) => { if ($(id)) $(id).style.display = lb ? 'none' : ''; });
    if (lb) {
      ROWS.forEach((id) => { const el = $(id); if (el) { el.style.display = 'none'; el.innerHTML = ''; } });
    } else {
      const byOrder = {}, namesByOrder = {};
      visible.forEach((b) => { const o = stageOrder(branchStage(b)); byOrder[o] = (byOrder[o] || 0) + 1; (namesByOrder[o] = namesByOrder[o] || []).push(b.name); });
      const labelOf = (o) => (o === 0 ? '공통' : o === 99 ? '미보고' : (o + '단계'));
      const colorOf = (o) => (o === 99 ? 'b-none' : o === 0 ? 'b-s0' : 'b-s' + o);
      // 순서: 미보고 → (공통) → 1 → 2 → 3 → 4 단계
      const orders = [].concat(byOrder[99] ? [99] : [], byOrder[0] ? [0] : [], [1, 2, 3, 4]);
      const max = Math.max(1, ...orders.map((o) => byOrder[o] || 0));
      const totalV = visible.length || 1;
      const barsHtml = orders.map((o) => {
        const c = byOrder[o] || 0; const w = Math.round((c / max) * 100);
        const pct = Math.round((c / totalV) * 100);
        const names = (namesByOrder[o] || []).join(', ');
        return `<div class="bar-row" data-order="${o}" data-label="${esc(labelOf(o))}" data-names="${esc(names)}" title="${esc(labelOf(o))} (${c}·${pct}%): ${esc(names || '없음')}">` +
          `<span class="bar-label">${esc(labelOf(o))}</span>` +
          `<div class="bar-track"><div class="bar-fill ${colorOf(o)}" style="width:${w}%"></div></div>` +
          `<span class="bar-val">${c}<i class="bar-pct">(${pct}%)</i></span></div>`;
      }).join('');
      // 보고 탭: 막대그래프 유지 / 현황: 도넛(원형)
      const sr = $('statRow'); if (sr) { sr.style.display = ''; sr.className = 'bar-chart'; sr.innerHTML = barsHtml; }
      const sr2 = $('statRow2'); if (sr2) { sr2.style.display = ''; sr2.className = 'donut-box'; sr2.innerHTML = donutHtml(orders, byOrder, namesByOrder, totalV); }
    }
    renderStatusPanel(visible, lb);

    // 사업소 계정(소장): 본인 사업소 현황(보고 이력·전략 정보)을 바로 표시
    if (lb) {
      const wrap = $('groupWrap'); const b = visible[0];
      if (b) { wrap.innerHTML = '<div class="solo-detail">' + branchDetailHtml(b, false) + '</div>'; wireBranchDetail(wrap, b, false); }
      else wrap.innerHTML = '';
      updateTabDot();
      return;
    }

    // 단계별 그룹화 (관리소장이 입력한 과제로 산출한 현재 단계)
    const buckets = {};
    visible.forEach((b) => {
      const st = branchStage(b);
      const key = st == null ? '__none' : st;
      if (!buckets[key]) buckets[key] = { name: st == null ? '미보고' : st, order: stageOrder(st), list: [] };
      buckets[key].list.push(b);
    });
    const ordered = Object.values(buckets).sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));

    const wrap = $('groupWrap'); wrap.innerHTML = '';
    ordered.forEach((bk) => {
      const block = document.createElement('div'); block.className = 'group-block tl-item'; block.dataset.order = bk.order;
      // 단계별 색상: 공통=slate, 1=파랑, 2=녹색, 3=주황, 4=적색, 미보고=회색
      let cls = 'stage-none';
      if (bk.name !== '미보고') { const o = bk.order; cls = (o >= 1 && o <= 4) ? ('stage-s' + o) : 'stage-s0'; }
      block.innerHTML = `<span class="tl-node ${cls}"></span><div class="group-head"><span class="stage-badge ${cls}"><span class="sb-name">${fmtStageName(bk.name)}</span><span class="sb-count">${bk.list.length}</span></span></div>`;
      bk.list.forEach((b) => {
        const cnt = REPORTS.filter((r) => r.branchId === b.id).length;
        const newB = branchUnseen(b.id);
        const dot = newB ? '<span class="newdot"></span>' : '';
        const stc = bk.order === 99 ? 'st-none' : bk.order === 0 ? 'st-s0' : 'st-s' + bk.order;
        const card = document.createElement('button');
        card.type = 'button'; card.className = `b-card ${stc}` + (newB ? ' is-new' : ''); card.dataset.id = b.id;
        card.innerHTML =
          `<div class="b-top"><span class="b-name">${esc(b.name)}</span>${dot}` +
          `<span class="b-count">보고 <b>${cnt}</b>건<i class="b-chev">›</i></span></div>`;
        block.appendChild(card);
      });
      wrap.appendChild(block);
    });
    updateTabDot();
  }

  function showBarTip(row) {
    const tip = $('barTip'); if (!tip) return;
    const names = row.dataset.names || '';
    const val = row.querySelector('.bar-val') ? row.querySelector('.bar-val').textContent : '';
    tip.innerHTML = `<b>${esc(row.dataset.label || '')} · ${esc(val)}개</b>` + (names ? `<span>${esc(names)}</span>` : '<span>해당 사업소 없음</span>');
    tip.classList.add('show');
    const r = row.getBoundingClientRect();
    const tw = tip.offsetWidth;
    let left = r.left; if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = (r.bottom + 6) + 'px';
  }
  function hideBarTip() { const tip = $('barTip'); if (tip) tip.classList.remove('show'); }
  let barTipTimer = null;
  ['statRow', 'statRow2'].forEach((id) => {
    const host = $(id); if (!host) return;
    host.addEventListener('mouseover', (e) => { const row = e.target.closest('.bar-row'); if (row) showBarTip(row); });
    host.addEventListener('mouseout', (e) => { const row = e.target.closest('.bar-row'); if (row) hideBarTip(); });
    host.addEventListener('click', (e) => { const row = e.target.closest('.bar-row'); if (row) { showBarTip(row); clearTimeout(barTipTimer); barTipTimer = setTimeout(hideBarTip, 3000); return; } const seg = e.target.closest('[data-order]'); if (seg) openStageDetail(seg.getAttribute('data-order')); });
  });
  // 사업소 목록 팝업 (공용)
  function openBranchPopup(title, hex, list) {
    let h = `<h2 style="display:flex;align-items:center;gap:9px;"><span style="width:13px;height:13px;border-radius:4px;background:${hex};"></span>${esc(title)} <span style="color:var(--soft);font-weight:600;font-size:14px;">· ${list.length}개 사업소</span></h2>`;
    if (!list.length) h += '<p class="rd-empty">해당 사업소가 없습니다.</p>';
    else {
      h += '<div class="sd-list">';
      list.forEach((b) => {
        const cnt = REPORTS.filter((r) => r.branchId === b.id).length;
        h += `<button type="button" class="sd-item" data-id="${esc(b.id)}" style="border-left-color:${hex};"><span class="sd-name">${esc(b.name)}</span><span class="sd-cnt">보고 ${cnt}건 ›</span></button>`;
      });
      h += '</div>';
    }
    $('stageDetail').innerHTML = h;
    $('stageDetail').querySelectorAll('.sd-item').forEach((it) => it.addEventListener('click', () => { closeModal('stageModal'); openBranch(it.dataset.id); }));
    openModal('stageModal');
  }
  function visibleBranches() { const lb = lockedBranchId(); return lb ? BRANCHES.filter((b) => b.id === lb) : BRANCHES; }
  function monthReportedIds() {
    const now = new Date(); const ym = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0');
    return new Set(REPORTS.filter((r) => String(r.date || '').startsWith(ym)).map((r) => r.branchId));
  }
  // 도넛/범례 단계 클릭 → 해당 단계 사업소를 팝업으로 표시
  function openStageDetail(order) {
    order = parseInt(order, 10);
    const hex = ({ 99: '#94a3b8', 0: '#475569', 1: '#2563eb', 2: '#16a34a', 3: '#ea580c', 4: '#dc2626' })[order] || '#94a3b8';
    const labelOf = (o) => (o === 0 ? '공통단계' : o === 99 ? '미보고' : (o + '단계'));
    const list = visibleBranches().filter((b) => { const st = branchStage(b); return (st === null ? 99 : stageOrder(st)) === order; });
    openBranchPopup(labelOf(order), hex, list);
  }
  $('statusPanel') && $('statusPanel').addEventListener('click', (e) => {
    // KPI(당월 보고완료/미보고) 클릭 → 해당 사업소 팝업
    const kc = e.target.closest('.sp-kpi-click');
    if (kc) {
      const mIds = monthReportedIds(); const vb = visibleBranches();
      if (kc.dataset.kpi === 'done') openBranchPopup('당월 보고완료', '#16a34a', vb.filter((b) => mIds.has(b.id)));
      else openBranchPopup('당월 미보고', '#dc2626', vb.filter((b) => !mIds.has(b.id)));
      return;
    }
    const it = e.target.closest('.sp-feed-item'); if (!it || !it.dataset.rid) return;
    openReportDetail(it.dataset.rid);
    // 보고 클릭 → 상단(보고 내용) / 댓글 클릭 → 하단(댓글)로 스크롤
    const box = document.querySelector('#reportDetailModal .modal-box');
    if (!box) return;
    setTimeout(() => {
      if (it.dataset.kind === 'cmt') {
        const cm = $('reportDetail') && $('reportDetail').querySelector('.thread-head');
        if (cm && cm.scrollIntoView) cm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else box.scrollTop = box.scrollHeight;
      } else { box.scrollTop = 0; }
    }, 80);
  });
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

  function branchDetailHtml(b, withHq) {
    const id = b.id;
    let h = `<h2>${esc(b.name)} <span class="group-badge g${b.group}" style="font-size:12px;vertical-align:middle;">${b.group}군</span></h2>`;

    // 이 사업소의 보고서 — 날짜별(최근순)
    const reps = REPORTS.filter((r) => r.branchId === id).slice().sort((a, b2) => (b2.ts || 0) - (a.ts || 0));
    h += `<div class="d-sec-title">보고 이력 <span style="color:var(--soft);font-weight:600;">· ${reps.length}건 (최근순)</span></div>`;
    if (!reps.length) h += '<p class="rd-empty">아직 등록된 보고가 없습니다. 아래에서 첫 보고를 작성해 주세요.</p>';
    else {
      h += '<div class="bh-list">';
      reps.forEach((r, i) => {
        h += `<button type="button" class="bh-item${freshClass(r)}" data-rid="${esc(r.id)}" style="${stageFillStyle(r)}">` +
          `<span class="bh-no" style="${stageNoStyle(r)}">${i + 1}</span>` +
          `<span class="bh-date">${dtHtml(r.date, r.ts)} ${freshBadge(r, 'NEW')}</span>` +
          `<span class="bh-info">${esc(r.reporter)}${r.occupancy ? ` · 입주율 ${esc(r.occupancy.rate)}%` : ''}${r._local ? ' · <i style="color:var(--accent);font-style:normal;">이 기기</i>' : ''}</span>` +
          `<span class="bh-cmt">💬 ${(r.comments || []).length}</span>` +
          '</button>';
      });
      h += '</div>';
    }

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

    // 본사 담당자 — 전략 정보 수정 + 군 이동 (본사 계정 전용)
    if (withHq) {
      h += '<button type="button" class="btn ghost block" id="branchEditBtn" style="margin-top:16px;">✏️ 전략 정보 수정 (본사)</button>';
      h += '<div class="d-sec-title" style="margin-top:18px;">본사 — 분류(군) 이동</div>' +
        '<div class="group-move" id="groupMove">' +
          [1, 2, 3].map((g) => `<button type="button" class="gm-btn${b.group === g ? ' active' : ''}" data-g="${g}">${g}군</button>`).join('') +
        '</div><p class="hint" id="groupMoveHint"></p>';
    }
    return h;
  }
  function wireBranchDetail(container, b, isModal) {
    const eb = container.querySelector('#branchEditBtn');
    if (eb) eb.addEventListener('click', () => openBranchEdit(b.id));
    container.querySelectorAll('.bh-item').forEach((it) => {
      it.addEventListener('click', () => { if (isModal) closeModal('branchModal'); openReportDetail(it.dataset.rid); });
    });
    const gm = container.querySelector('#groupMove');
    if (gm) gm.addEventListener('click', (e) => {
      const btn = e.target.closest('.gm-btn'); if (!btn) return;
      const g = parseInt(btn.dataset.g, 10);
      if (g === b.group) return;
      moveBranchGroup(b.id, g);
    });
  }
  function openBranch(id) {
    const b = BRANCHES.find((x) => x.id === id); if (!b) return;
    $('branchDetail').innerHTML = branchDetailHtml(b, isHQ());
    wireBranchDetail($('branchDetail'), b, true);
    openModal('branchModal');
  }

  async function moveBranchGroup(id, g) {
    if (!hasToken()) { alert('군 이동은 로그인이 필요합니다.'); return; }
    const hintEl = $('groupMoveHint');
    if (hintEl) hint(hintEl, `${g}군으로 이동 중…`, '');
    try {
      const next = await mutateBranchesObj((o) => { o.branches = (o.branches || []).map((x) => (x.id === id ? Object.assign({}, x, { group: g }) : x)); return o; }, '사업소 군 이동: ' + g + '군');
      BRANCHES = next.branches;
      renderStatus(); renderReportFilter();
      openBranch(id); // 상세 갱신(이동 결과 반영)
    } catch (e) { if (hintEl) hint(hintEl, '오류: ' + e.message, 'error'); else alert('오류: ' + e.message); }
  }

  // ---------- 사업소 전략 정보 수정 (본사 담당자) ----------
  let editBranchId = null;
  function openBranchEdit(id) {
    const b = BRANCHES.find((x) => x.id === id); if (!b) return;
    if (!hasToken()) { alert('전략 정보 수정은 로그인이 필요합니다.'); openModal('loginModal'); return; }
    editBranchId = id;
    $('beTitle').textContent = `${b.name} — 전략 정보 수정`;
    $('beStatus').value = b.status || '';
    $('beOwnership').value = (b.ownership || []).map((o) => `${o.type} | ${o.count != null ? o.count : ''} | ${o.ratio != null ? o.ratio : ''}`).join('\n');
    $('beOwnTotal').value = b.ownershipTotal || '';
    $('beSituation').value = b.situation || '';
    $('beMgr').value = (b.managerActions || []).join('\n');
    $('beHq').value = (b.hqActions || []).join('\n');
    hint($('beHint'), '', '');
    openModal('branchEditModal');
  }
  function parseLines(v) { return String(v || '').split('\n').map((s) => s.trim()).filter(Boolean); }
  function parseOwnership(v) {
    return parseLines(v).map((line) => {
      const p = line.split('|').map((s) => s.trim());
      const count = p[1] !== undefined && p[1] !== '' ? Number(p[1]) : null;
      const ratio = p[2] !== undefined && p[2] !== '' ? Number(p[2]) : null;
      return { type: p[0] || '', count: Number.isFinite(count) ? count : null, ratio: Number.isFinite(ratio) ? ratio : null };
    }).filter((o) => o.type);
  }
  $('beSubmit') && $('beSubmit').addEventListener('click', async () => {
    if (!editBranchId) return;
    if (!hasToken()) { hint($('beHint'), '로그인이 필요합니다.', 'error'); return; }
    const patch = {
      status: $('beStatus').value.trim(),
      ownership: parseOwnership($('beOwnership').value),
      ownershipTotal: $('beOwnTotal').value.trim(),
      situation: $('beSituation').value.trim(),
      managerActions: parseLines($('beMgr').value),
      hqActions: parseLines($('beHq').value),
    };
    const btn = $('beSubmit'); btn.disabled = true;
    try {
      hint($('beHint'), '저장 중…', '');
      const next = await mutateBranchesObj((o) => { o.branches = (o.branches || []).map((x) => (x.id === editBranchId ? Object.assign({}, x, patch) : x)); return o; }, '사업소 전략 정보 수정');
      BRANCHES = next.branches;
      hint($('beHint'), '저장되었습니다! (반영까지 1~2분)', 'success');
      const id = editBranchId;
      setTimeout(() => { closeModal('branchEditModal'); openBranch(id); }, 800);
    } catch (e) { hint($('beHint'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // ---------- 보고 목록 ----------
  function renderReportFilter() {
    const sel = $('reportFilter');
    const lb = lockedBranchId();
    if (lb) {
      const b = BRANCHES.find((x) => x.id === lb);
      sel.innerHTML = `<option value="${esc(lb)}">${esc(b ? b.name : '내 사업소')}</option>`;
      sel.value = lb;
      return;
    }
    sel.innerHTML = '<option value="">전체 사업소 보고 보기</option>' + BRANCHES.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
    sel.value = reportFilter;
  }
  function renderReports() {
    const list = $('reportList'), empty = $('reportEmpty');
    const filterField = $('reportFilter') ? $('reportFilter').parentElement : null;

    // 본사 담당자 전용 — 본사 토큰 로그인 필요
    if (!isAdmin()) {
      if (filterField) filterField.style.display = 'none';
      empty.hidden = true;
      list.innerHTML =
        '<div class="info-card" style="text-align:center;">' +
          '<div style="font-size:34px;margin-bottom:6px;">🔒</div>' +
          '<h3 style="text-align:center;">로그인이 필요합니다</h3>' +
          '<p style="color:var(--soft);margin-bottom:12px;">보고 열람·작성은 <b>로그인</b> 후 가능합니다.<br>본사·관리소장 모두 GitHub 토큰으로 로그인하면 보고가 GitHub에 저장됩니다.</p>' +
          '<button type="button" class="btn block" id="goLoginBtn">로그인</button>' +
        '</div>';
      const gl = $('goLoginBtn'); if (gl) gl.addEventListener('click', () => { openModal('loginModal'); });
      return;
    }
    const lb = lockedBranchId();
    // 사업소 계정은 본인 사업소만, 필터 드롭다운은 숨김. 본사는 전체 + 필터 표시.
    if (filterField) filterField.style.display = lb ? 'none' : '';
    const eff = lb || reportFilter;
    const items = REPORTS.filter((r) => !eff || r.branchId === eff);
    list.innerHTML = '';
    if (!items.length) { empty.hidden = false; }
    else { empty.hidden = true; }
    items.forEach((r, i) => {
      const cmt = (r.comments || []).length;
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'report-card' + freshClass(r); card.dataset.id = r.id;
      card.setAttribute('style', stageFillStyle(r));
      card.innerHTML =
        `<span class="rc-no" style="${stageNoStyle(r)}">${i + 1}</span>` +
        `<span class="rc-branch">${esc(r.branchName)}</span>` +
        freshBadge(r, 'N') +
        `<span class="rc-date">${dtHtml(r.date, r.ts)}</span>` +
        `<span class="rc-cmt">💬 ${cmt}</span>` +
        '<span class="rc-open">›</span>';
      list.appendChild(card);
    });
    updateTabDot();
  }
  $('reportList').addEventListener('click', (e) => { const c = e.target.closest('.report-card'); if (c) openReportDetail(c.dataset.id); });
  $('reportFilter').addEventListener('change', function () { reportFilter = this.value; renderReports(); });

  // ---------- 보고 작성 ----------
  let editReportId = null; // 수정 중인 보고 id (없으면 신규 작성)
  // 첨부 문서 (한글·엑셀·PDF) — 보고서 작성 폼 안에서 첨부
  const ATTACH_EXT = ['hwp', 'hwpx', 'xls', 'xlsx', 'pdf'];
  let rmFiles = []; // 이번에 새로 선택한 File 목록
  function extOf(n) { const m = /\.([^.]+)$/.exec(n || ''); return m ? m[1].toLowerCase() : ''; }
  function fmtSize(n) { if (!n) return ''; if (n < 1024) return n + 'B'; if (n < 1048576) return Math.round(n / 1024) + 'KB'; return (n / 1048576).toFixed(1) + 'MB'; }
  function renderRmFiles() {
    const ul = $('rmFileList'); if (!ul) return;
    ul.innerHTML = rmFiles.map((f, i) => `<li class="rm-file"><span class="rmf-name">📎 ${esc(f.name)} <span class="rmf-sz">(${fmtSize(f.size)})</span></span><button type="button" class="rmf-del" data-rmf="${i}">삭제</button></li>`).join('');
  }
  async function uploadAttachments(reportId, files) {
    const out = [];
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let bin = ''; const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      const safe = (f.name || 'file').replace(/[^\w.\-가-힣]+/g, '_');
      const path = 'assets/uploads/' + reportId + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '_' + safe;
      await putContent(path, btoa(bin), '보고 첨부: ' + f.name);
      out.push({ name: f.name, path: path, size: f.size });
    }
    return out;
  }
  // 선택한 사업소의 군에 맞는 단계별 과제 입력칸 생성 (groupOverride: 수정 시 원 보고의 군 유지)
  function rebuildRmItems(groupOverride) {
    const b = BRANCHES.find((x) => x.id === $('rmBranch').value);
    const grp = (typeof groupOverride === 'number' && groupOverride) || (b && b.group);
    if (!grp) { $('rmItems').innerHTML = '<p class="hint">먼저 사업소를 선택하면 해당 군의 단계별 과제가 표시됩니다.</p>'; return; }
    let h = `<p class="rf-grouptag">${grp}군 보고서식</p>`;
    stagesForGroup(grp).forEach((s) => {
      const sc = stageColorClass(s.name);
      h += `<div class="rf-stage ${sc}">${esc(s.name)}</div>`;
      s.tasks.forEach((t) => {
        h += `<div class="r-item"><label><span class="rf-no ${sc}">${esc(t.no)}</span>${esc(t.t)}</label>` +
          `<textarea id="rm_${t.k}" rows="2" placeholder="내용 입력 (해당 시)"></textarea></div>`;
      });
    });
    $('rmItems').innerHTML = h;
  }
  function openReportForm(branchId, editReport) {
    editReportId = editReport ? editReport.id : null;
    // 사업소 계정(소장)은 본인 사업소만 선택 가능. 본사는 전체 선택 가능. 수정 시 사업소 고정.
    const lb = lockedBranchId();
    const opts = lb ? BRANCHES.filter((b) => b.id === lb) : BRANCHES;
    $('rmBranch').innerHTML = opts.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
    $('rmBranch').disabled = !!lb || !!editReport;
    // 사업소를 항상 한 곳 선택해 두어 보고서식이 바로 보이도록 함
    if (editReport) $('rmBranch').value = editReport.branchId;
    else if (lb) $('rmBranch').value = lb;
    else if (branchId) $('rmBranch').value = branchId;
    else if (reportFilter) $('rmBranch').value = reportFilter;
    else if (BRANCHES[0]) $('rmBranch').value = BRANCHES[0].id;
    if (editReport) {
      $('rmReporter').value = editReport.reporter || '';
      $('rmDate').value = (editReport.date || '').replace(/\./g, '-');
    } else {
      $('rmReporter').value = '';
      const d = new Date(); $('rmDate').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    rebuildRmItems(editReport ? editReport.group : undefined);
    if (editReport) { Object.keys(editReport.items || {}).forEach((k) => { const el = $('rm_' + k); if (el) el.value = editReport.items[k]; }); }
    if ($('rmFree')) $('rmFree').value = (editReport && editReport.freeNote) || '';
    updateCopyLastBtn(!!editReport);
    if ($('rmTitle')) $('rmTitle').textContent = editReport ? '업무보고 수정' : '관리단 관련 업무보고';
    $('rmSubmit').textContent = editReport ? '수정 내용 저장' : '본사로 보고 올리기';
    rmFiles = []; renderRmFiles();
    const existing = (editReport && editReport.attachments) || [];
    if ($('rmAttachField')) {
      const note = existing.length ? `<p class="hint" style="margin:4px 0 0;">기존 첨부: ${existing.map((a) => esc(a.name)).join(', ')} (유지됨)</p>` : '';
      const old = $('rmAttachField').querySelector('.rm-existing'); if (old) old.remove();
      if (note) { const d = document.createElement('div'); d.className = 'rm-existing'; d.innerHTML = note; $('rmAttachField').appendChild(d); }
    }
    hint($('rmHint'), '', '');
    openModal('reportModal');
  }
  // 최근 보고 복사 버튼: 신규 작성 + 해당 사업소에 이전 보고가 있을 때만 표시
  function updateCopyLastBtn(isEdit) {
    const btn = $('rmCopyLast'); if (!btn) return;
    const bId = $('rmBranch').value;
    const has = !isEdit && REPORTS.some((r) => r.branchId === bId);
    btn.style.display = has ? 'inline-flex' : 'none';
  }
  function loadLatestReport() {
    const bId = $('rmBranch').value;
    const reps = REPORTS.filter((r) => r.branchId === bId);
    if (!reps.length) { hint($('rmHint'), '불러올 이전 보고가 없습니다.', 'error'); return; }
    const latest = reps.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
    if (!$('rmReporter').value.trim()) $('rmReporter').value = latest.reporter || '';
    // 현재 폼(해당 사업소 군)에 일치하는 과제 칸만 채움
    Object.keys(latest.items || {}).forEach((k) => { const el = $('rm_' + k); if (el) el.value = latest.items[k]; });
    if ($('rmFree')) $('rmFree').value = latest.freeNote || '';
    hint($('rmHint'), '최근 보고(' + latest.date + ') 내용을 불러왔습니다. 수정 후 올려 주세요.', 'success');
  }
  $('rmCopyLast') && $('rmCopyLast').addEventListener('click', loadLatestReport);
  $('fabReport').addEventListener('click', () => openReportForm());
  $('rmBranch') && $('rmBranch').addEventListener('change', () => { rebuildRmItems(); updateCopyLastBtn(!!editReportId); });
  $('rmFileBtn') && $('rmFileBtn').addEventListener('click', () => $('rmFile').click());
  $('rmFile') && $('rmFile').addEventListener('change', () => {
    const picked = Array.from($('rmFile').files || []); const rejected = [];
    picked.forEach((f) => {
      if (!ATTACH_EXT.includes(extOf(f.name))) { rejected.push(f.name); return; }
      if (f.size > 20 * 1048576) { rejected.push(f.name + ' (20MB 초과)'); return; }
      if (!rmFiles.some((x) => x.name === f.name && x.size === f.size)) rmFiles.push(f);
    });
    $('rmFile').value = ''; renderRmFiles();
    hint($('rmHint'), rejected.length ? ('첨부 불가: ' + rejected.join(', ') + ' — 한글·엑셀·PDF, 20MB 이하만 가능합니다.') : '', rejected.length ? 'error' : '');
  });
  $('rmFileList') && $('rmFileList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rmf]'); if (!b) return;
    rmFiles.splice(Number(b.dataset.rmf), 1); renderRmFiles();
  });

  $('rmSubmit').addEventListener('click', async () => {
    const bId = $('rmBranch').value;
    const b = BRANCHES.find((x) => x.id === bId);
    const reporter = $('rmReporter').value.trim();
    if (!b || !reporter) { hint($('rmHint'), '사업소와 보고자(관리소장)는 필수입니다.', 'error'); return; }
    const orig = editReportId ? REPORTS.find((x) => x.id === editReportId) : null;
    const group = orig ? (orig.group || b.group) : b.group;
    const items = {}; let any = false;
    stagesForGroup(group).forEach((s) => s.tasks.forEach((t) => { const el = $('rm_' + t.k); const v = el ? el.value.trim() : ''; items[t.k] = v; if (v) any = true; }));
    const freeNote = $('rmFree') ? $('rmFree').value.trim() : '';
    if (!any && !freeNote) { hint($('rmHint'), '최소 한 개 이상의 과제 또는 자유의견을 작성해 주세요.', 'error'); return; }
    const dv = $('rmDate').value;
    const dateStr = dv ? dv.replace(/-/g, '.') : todayStr();
    const month = dv ? dv.slice(0, 7) : '';
    if (rmFiles.length && !hasToken()) { hint($('rmHint'), '파일 첨부는 로그인 후에만 업로드할 수 있습니다. 로그인 후 다시 시도해 주세요.', 'error'); return; }
    const btn = $('rmSubmit'); btn.disabled = true;
    try {
      if (orig) {
        // ----- 수정 -----
        let attachments = (orig.attachments || []).slice();
        if (rmFiles.length) { hint($('rmHint'), '첨부 파일 업로드 중…', ''); attachments = attachments.concat(await uploadAttachments(orig.id, rmFiles)); }
        const updated = Object.assign({}, orig, { branchId: b.id, branchName: b.name, group, reporter, date: dateStr, month, items, freeNote, attachments, editTs: Date.now() });
        hint($('rmHint'), '수정 내용을 저장하는 중…', '');
        const next = await updateReport(updated);
        REPORTS = next ? mergeLocal(next) : await loadReports();
        markSeen(updated); // 수정한 본인에게는 '수정' 표시 안 함 (다른 계정에만 노출)
        renderReports(); renderStatus();
        hint($('rmHint'), '수정되었습니다! (반영까지 1~2분)', 'success');
        setTimeout(() => closeModal('reportModal'), 1000);
        btn.disabled = false; return;
      }
      const report = { id: uid('r'), branchId: b.id, branchName: b.name, group, reporter, date: dateStr, month, occupancy: null, items, freeNote, ts: Date.now(), comments: [], attachments: [] };
      if (rmFiles.length) { hint($('rmHint'), '첨부 파일 업로드 중…', ''); report.attachments = await uploadAttachments(report.id, rmFiles); }
      hint($('rmHint'), '보고를 올리는 중…', '');
      const next = await addReport(report);
      REPORTS = next ? mergeLocal(next) : await loadReports();
      renderReports(); renderStatus();
      hint($('rmHint'), isCentral() ? '본사로 보고가 접수되었습니다! (GitHub 저장 · 반영까지 1~2분)' : '보고가 이 기기에 저장되었습니다. (GitHub 저장은 로그인 필요)', 'success');
      setTimeout(() => closeModal('reportModal'), 1100);
    } catch (e) { hint($('rmHint'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // ---------- 보고 상세 + 댓글 ----------
  // ---------- 보고서 PDF (인쇄 → PDF로 저장) ----------
  function pdfBlock(num, title, body) {
    return '<div style="margin-bottom:10px;">' +
      `<div style="font-size:13px;font-weight:800;color:#0f2a4a;margin-bottom:4px;">${num}. ${esc(title)}</div>` +
      `<div style="font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-all;background:#f4f7fb;border-radius:8px;padding:9px 12px;">${esc(body)}</div>` +
      '</div>';
  }
  function reportPdfHtml(r) {
    let h = '<div style="font-family:\'Noto Sans KR\',sans-serif;color:#1f2937;width:100%;box-sizing:border-box;">';
    h += '<div style="border-bottom:2px solid #123a6b;padding-bottom:8px;margin-bottom:14px;">' +
      '<div style="font-size:12px;color:#1c5fc4;font-weight:700;">에이스종합관리㈜ · 지점사업소 관리단 구성</div>' +
      `<div style="font-size:22px;font-weight:900;color:#0f2a4a;">${esc(r.branchName)} 업무보고</div>` +
      `<div style="font-size:12px;color:#5b6573;margin-top:4px;">보고자 ${esc(r.reporter)} · ${dtHtmlInline(r.date, r.ts)}</div>` +
      '</div>';
    if (r.occupancy) h += pdfBlock('0', '입주현황', `입주 ${r.occupancy.occupied}호실 / 전체 ${r.occupancy.total}호실 · 입주율 ${r.occupancy.rate}%`);
    reportStages(r).forEach((s) => {
      const filled = s.tasks.filter((t) => r.items && r.items[t.k]);
      if (!filled.length) return;
      h += `<div style="font-size:13px;font-weight:900;color:#fff;background:${stageHex(s.name)};border-radius:6px;margin:14px 0 6px;padding:5px 10px;">${esc(s.name)}</div>`;
      filled.forEach((t) => { h += pdfBlock(t.no, t.t, r.items[t.k]); });
    });
    if (r.freeNote) {
      h += '<div style="margin-top:14px;font-weight:800;color:#0f2a4a;border-top:1px solid #e2e8f0;padding-top:10px;margin-bottom:6px;">소장 자유의견</div>' +
        `<div style="font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-all;background:#f4f7fb;border-radius:8px;padding:9px 12px;">${esc(r.freeNote)}</div>`;
    }
    const cmts = r.comments || [];
    if (cmts.length) {
      h += '<div style="margin-top:14px;font-weight:800;color:#0f2a4a;border-top:1px solid #e2e8f0;padding-top:10px;margin-bottom:6px;">본사 ↔ 현장 소통</div>';
      cmts.forEach((c) => {
        const hq = c.role === 'hq';
        h += `<div style="margin:6px 0;padding:8px 12px;border-radius:8px;background:${hq ? '#e8f0fe' : '#fff8e1'};">` +
          `<b style="font-size:11px;color:${hq ? '#1c5fc4' : '#9a7b00'};">${hq ? '본사' : '현장(소장)'}</b> ` +
          `<span style="font-size:11px;color:#999;">${dtHtmlInline(c.date, c.ts)}</span>` +
          `<div style="font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;">${esc(c.body)}</div></div>`;
      });
    }
    return h + '</div>';
  }
  function genReportPdf(r) {
    // 새 창에 보고서를 그려 인쇄(=PDF로 저장) — 한글이 완벽히 나오고 백지 문제 없음
    const w = window.open('', '_blank');
    if (!w) { alert('PDF 저장을 위해 팝업을 허용해 주세요. (브라우저 주소창의 팝업 차단 해제)'); return; }
    const title = esc((r.branchName || '업무보고') + ' 업무보고 ' + (r.date || ''));
    const css = '@page{size:A4;margin:14mm}' +
      '*{box-sizing:border-box}' +
      "body{font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif;color:#1f2937;margin:0;padding:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
      '@media print{body{padding:0}}';
    w.document.open();
    w.document.write(
      '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + title + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">' +
      '<style>' + css + '</style></head><body>' +
      reportPdfHtml(r) +
      '<scr' + 'ipt>window.onload=function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},500);};<\/scr' + 'ipt>' +
      '</body></html>'
    );
    w.document.close();
  }

  function openReportDetail(id) {
    const r = REPORTS.find((x) => x.id === id);
    if (!r) { closeModal('reportDetailModal'); return; }
    openReportId = id;
    if (isNew(r)) { markSeen(r); renderStatus(); renderReports(); } else { markSeen(r); } // 읽음(댓글 수 포함) 처리 → 표시 해제
    updateTabDot();
    const comments = r.comments || [];
    let h = `<h2>${esc(r.branchName)} 업무보고</h2>`;
    h += `<div class="rc-meta" style="margin:6px 0 10px;">보고자 ${esc(r.reporter)} · ${dtHtml(r.date, r.ts)}${r._local ? ' · <span style="color:var(--accent);font-weight:700;">이 기기에만 저장됨</span>' : ''}</div>`;
    h += '<button type="button" class="btn block" id="pdfBtn" style="margin-bottom:14px;">📄 이 보고서 PDF로 저장</button>';
    if (r.occupancy) {
      h += `<div class="r-block"><div class="bt"><span class="num zero">0</span>입주현황</div><div class="bd">입주 ${esc(r.occupancy.occupied)}호실 / 전체 ${esc(r.occupancy.total)}호실 · <b>입주율 ${esc(r.occupancy.rate)}%</b></div></div>`;
    }
    reportStages(r).forEach((s) => {
      const filled = s.tasks.filter((t) => r.items && r.items[t.k]);
      if (!filled.length) return;
      const sc = stageColorClass(s.name);
      h += `<div class="rd-stage ${sc}">${esc(s.name)}</div>`;
      filled.forEach((t) => {
        h += `<div class="r-block"><div class="bt"><span class="rf-no ${sc}">${esc(t.no)}</span>${esc(t.t)}</div><div class="bd">${esc(r.items[t.k])}</div></div>`;
      });
    });

    if (r.attachments && r.attachments.length) {
      h += '<div class="rd-attach"><div class="rd-attach-h">📎 첨부 문서</div>';
      r.attachments.forEach((a) => {
        h += `<a class="rd-attach-item" href="${esc(a.path)}" target="_blank" rel="noopener" download>${esc(a.name)}${a.size ? ` <span class="rdf-sz">${esc(fmtSize(a.size))}</span>` : ''}</a>`;
      });
      h += '</div>';
    }
    if (r.freeNote) {
      h += '<div class="rd-free"><div class="rd-free-h">📝 소장 자유의견</div>' +
        `<div class="rd-free-body">${esc(r.freeNote)}</div></div>`;
    }
    h += '<div class="thread-head">💬 본사 ↔ 현장 소통</div><div class="cmts">';
    if (!comments.length) h += '<p class="empty" style="padding:14px 0;">아직 댓글이 없습니다.</p>';
    else comments.forEach((c) => {
      const hq = c.role === 'hq';
      const canDel = isAdmin() || r._local;
      h += `<div class="cmt ${hq ? 'hq' : ''}"><div class="bubble">${esc(c.body)}</div><div class="cmt-meta"><span class="when">${dtHtml(c.date, c.ts)}</span>${canDel ? `<button type="button" class="cdel" data-cdel="${esc(c.id)}">삭제</button>` : ''}</div></div>`;
    });
    h += '</div>';
    // 댓글 작성자 = 로그인한 계정에 따라 고정 (사업소 계정→현장(소장), 본사 계정→본사)
    const myRole = (localStorage.getItem('ace_role') === 'hq') ? 'hq' : 'site';
    const myLabel = myRole === 'hq' ? '본사' : '현장(소장)';
    h += '<div class="cmt-form">' +
      `<div class="cmt-asrole ${myRole === 'hq' ? 'hq' : 'site'}">작성자: <b>${myLabel}</b></div>` +
      '<div class="field" style="margin-bottom:8px;"><textarea id="cBody" rows="3" placeholder="메시지를 입력하세요"></textarea></div>' +
      '<p class="hint" id="cHint"></p><button type="button" class="btn block" id="cSubmit">댓글 남기기</button></div>';
    if (isAdmin() || r._local) h += `<button type="button" class="btn ghost block" id="rEditBtn" style="margin-top:10px;">✏️ 이 보고 수정</button>`;
    if (isAdmin() || r._local) h += `<button type="button" class="btn ghost block" id="rDelBtn" style="margin-top:10px;">이 보고 삭제</button>`;

    $('reportDetail').innerHTML = h;
    openModal('reportDetailModal');

    if ($('pdfBtn')) $('pdfBtn').addEventListener('click', function () { genReportPdf(r, this); });
    const rEdit = $('rEditBtn');
    if (rEdit) rEdit.addEventListener('click', () => { closeModal('reportDetailModal'); openReportForm(null, r); });

    $('cSubmit').addEventListener('click', async () => {
      const role = myRole, body = $('cBody').value.trim();
      if (!body) { hint($('cHint'), '내용을 입력해 주세요.', 'error'); return; }
      const author = role === 'hq' ? '본사' : '현장';
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
    pill.textContent = on ? '로그인 ✓' : '로그인';
    $('logoutBtn').style.display = on ? 'block' : 'none';
    if ($('changeCredBtn')) $('changeCredBtn').style.display = on ? 'block' : 'none';
    if ($('addBranchBtn')) $('addBranchBtn').style.display = (on && isHQ()) ? 'inline-flex' : 'none';
    if ($('pledgeAdminBtn')) $('pledgeAdminBtn').style.display = (on && isHQ()) ? 'inline-flex' : 'none';
    if ($('hdrLogoutBtn')) $('hdrLogoutBtn').style.display = on ? 'inline-flex' : 'none';
  }
  $('hdrLogoutBtn') && $('hdrLogoutBtn').addEventListener('click', () => { if (window.confirm('로그아웃 하시겠습니까?')) $('logoutBtn').click(); });

  // ---------- 사업소 추가 (본사 담당자) ----------
  $('addBranchBtn') && $('addBranchBtn').addEventListener('click', () => {
    if (!hasToken()) { alert('사업소 추가는 로그인이 필요합니다.'); openModal('loginModal'); return; }
    $('baName').value = ''; $('baReg').value = ''; $('baGroup').value = '3';
    if ($('baLoginId')) $('baLoginId').value = ''; if ($('baLoginPw')) $('baLoginPw').value = '';
    hint($('baHint'), '', ''); openModal('branchAddModal');
  });
  $('baSubmit') && $('baSubmit').addEventListener('click', async () => {
    const name = $('baName').value.trim();
    if (!name) { hint($('baHint'), '사업소명을 입력해 주세요.', 'error'); return; }
    if (!hasToken()) { hint($('baHint'), '로그인이 필요합니다.', 'error'); return; }
    const wantId = ($('baLoginId') ? $('baLoginId').value : '').trim();
    const wantPw = ($('baLoginPw') ? $('baLoginPw').value : '').trim();
    // 입력 아이디가 이미 있으면 거부
    if (wantId && (AUTH || []).some((a) => a.id === wantId)) { hint($('baHint'), '이미 사용 중인 로그인 아이디입니다. 다른 아이디를 입력하세요.', 'error'); return; }
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
      // 새 사업소 로그인 계정 생성 (아이디·비번 직접 부여 / 비우면 자동: 아이디=다음 번호, 비번=1234)
      let newId = '', newPw = '';
      try {
        const pwHash = await sha256hex(wantPw || '1234');
        newPw = wantPw || '1234';
        let dup = false;
        const nextAuth = await mutateAuth((o) => {
          const accs = o.accounts || [];
          if (wantId) {
            if (accs.some((a) => a.id === wantId)) { dup = true; return o; }
            newId = wantId;
          } else {
            const maxNum = accs.reduce((m, a) => { const n = parseInt(a.id, 10); return (Number.isFinite(n) && n > m) ? n : m; }, 0);
            newId = String(maxNum + 1);
          }
          o.accounts = accs.concat([{ id: newId, role: 'site', pwHash, branchId: branch.id, branchName: name }]);
          return o;
        }, '사업소 계정 추가: ' + name);
        if (dup) { newId = ''; } else { AUTH = nextAuth.accounts; }
      } catch (e2) { newId = ''; }
      renderStatus(); renderReportFilter();
      $('hdrSub').textContent = `${BRANCHES.length}개 지점사업소 · 본사 ↔ 관리소장 소통`;
      hint($('baHint'), newId ? `추가되었습니다! [${name} · ${branch.group}군] 로그인 아이디 ${newId} · 비번 ${newPw} (반영 1~2분)` : '사업소는 추가됐지만 계정 생성 실패(아이디 중복 등) — 다시 시도해 주세요.', newId ? 'success' : 'error');
      if (newId) setTimeout(() => closeModal('branchAddModal'), 2200);
    } catch (e) { hint($('baHint'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });
  function openLogin() {
    const on = isAdmin();
    if ($('loginTitle')) $('loginTitle').textContent = on ? ('계정 · ' + (curAcct() || '')) : '로그인';
    ['loginHelp', 'loginIdField', 'loginPwField', 'loginHint', 'loginSubmit'].forEach((id) => { const el = $(id); if (el) el.style.display = on ? 'none' : ''; });
    if ($('changeCredBtn')) $('changeCredBtn').style.display = on ? 'block' : 'none';
    if ($('logoutBtn')) $('logoutBtn').style.display = on ? 'block' : 'none';
    if (!on) { if ($('loginPw')) $('loginPw').value = ''; if ($('loginId')) $('loginId').value = ''; }
    hint($('loginHint'), '', '');
    openModal('loginModal');
  }
  $('adminPill').addEventListener('click', openLogin);
  $('gateLoginBtn') && $('gateLoginBtn').addEventListener('click', openLogin);
  $('loginSubmit').addEventListener('click', async () => {
    const id = ($('loginId').value || '').trim();
    const pw = $('loginPw').value || '';
    hint($('loginHint'), '확인 중…', '');
    AUTH = await loadAuth();
    const acc = AUTH.find((a) => a.id === id);
    const ok = acc && (await sha256hex(pw)) === acc.pwHash;
    if (!ok) { hint($('loginHint'), '아이디 또는 비밀번호가 올바르지 않습니다.', 'error'); return; }
    // 내장 토큰이 있으면 GitHub 저장 활성화
    const tok = EMBED_TOKEN_OBF ? deobf(EMBED_TOKEN_OBF) : '';
    if (tok) localStorage.setItem(TOKEN_KEY, tok); else localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(LOGIN_FLAG, '1');
    localStorage.setItem('ace_acct', acc.id);
    localStorage.setItem('ace_role', acc.role);
    if (acc.branchId) localStorage.setItem('ace_branch', acc.branchId); else localStorage.removeItem('ace_branch');
    setAdmin(true);
    hint($('loginHint'), '', ''); closeModal('loginModal');
    reportFilter = ''; renderReportFilter();
    REPORTS = await loadReports(); renderReports(); renderStatus(); refreshNote(); updateEduForUser();
    // 관리소장: 최초 로그인 시 서약서 미제출이면 서약서 모달 표시
    if (acc.role === 'site') {
      try { const pl = await loadPledges(); if (!pl[acc.id]) openPledge(acc); } catch (e) {}
    }
  });
  $('logoutBtn').addEventListener('click', () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(LOGIN_FLAG); localStorage.removeItem('ace_acct'); localStorage.removeItem('ace_branch'); pledgeAcct = null; closeModal('pledgeModal'); setAdmin(false); closeModal('loginModal'); reportFilter = ''; renderReportFilter(); refreshNote(); renderReports(); renderStatus(); eduGroup = 1; updateEduForUser(); });

  // ---------- 관리소장 서약서 ----------
  let pledgeAcct = null;
  // 서명 패드 (PC: 마우스 / 모바일: 손가락 — pointer 이벤트로 모두 지원)
  let signPad = null;
  function setupSignPad() {
    const canvas = $('pledgeSign'); if (!canvas || signPad) return;
    const ctx = canvas.getContext('2d');
    let drawing = false, last = null, dirty = false;
    // 좌표 추출 — 마우스/포인터(clientX) + 터치(touches[0]) 모두 지원
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      const cx = t ? t.clientX : e.clientX, cy = t ? t.clientY : e.clientY;
      return { x: (cx - r.left) * (canvas.width / r.width), y: (cy - r.top) * (canvas.height / r.height) };
    }
    function start(e) {
      e.preventDefault(); drawing = true; last = pos(e);
      if (e.pointerId != null && canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (x) {} }
    }
    function move(e) {
      if (!drawing) return; e.preventDefault();
      const p = pos(e);
      ctx.strokeStyle = '#12233f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; dirty = true;
    }
    function end() { drawing = false; }
    if (window.PointerEvent) {
      // 포인터 이벤트(마우스·터치·펜 통합) — 대부분의 PC/스마트폰
      canvas.addEventListener('pointerdown', start);
      canvas.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    } else {
      // 폴백: 구형 스마트폰(터치) + 마우스 별도 처리
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
    }
    signPad = {
      clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
      isEmpty() { return !dirty; },
      dataURL() { return canvas.toDataURL('image/png'); }
    };
  }
  function openPledge(acc) {
    pledgeAcct = acc;
    if ($('pledgeBranch')) $('pledgeBranch').textContent = acc.branchName || (BRANCHES.find((b) => b.id === acc.branchId) || {}).name || '';
    if ($('pledgeName')) $('pledgeName').value = '';
    if ($('pledgeAgree')) $('pledgeAgree').checked = false;
    setupSignPad(); if (signPad) signPad.clear();
    hint($('pledgeHint'), '', '');
    openModal('pledgeModal');
  }
  $('pledgeSignClear') && $('pledgeSignClear').addEventListener('click', () => { if (signPad) signPad.clear(); });
  $('pledgeSubmit') && $('pledgeSubmit').addEventListener('click', async () => {
    if (!pledgeAcct) { closeModal('pledgeModal'); return; }
    const name = ($('pledgeName').value || '').trim();
    const agree = $('pledgeAgree') && $('pledgeAgree').checked;
    if (!name) { hint($('pledgeHint'), '서약자 성명을 입력해 주세요.', 'error'); return; }
    if (!agree) { hint($('pledgeHint'), '서약 내용에 동의(체크)해 주세요.', 'error'); return; }
    if (!signPad || signPad.isEmpty()) { hint($('pledgeHint'), '서명란에 직접 서명해 주세요.', 'error'); return; }
    if (!hasToken()) { hint($('pledgeHint'), '저장 권한이 없습니다. 다시 로그인해 주세요.', 'error'); return; }
    const acc = pledgeAcct; const sign = signPad.dataURL(); const btn = $('pledgeSubmit'); btn.disabled = true;
    try {
      hint($('pledgeHint'), '서약서를 제출하는 중…', '');
      await mutatePledges((o) => {
        o.pledges[acc.id] = { name, accountId: acc.id, branchId: acc.branchId || '', branchName: acc.branchName || '', date: todayStr(), ts: Date.now(), sign };
        return o;
      }, '서약서 제출: ' + (acc.branchName || acc.id));
      hint($('pledgeHint'), '서약서가 제출되었습니다. 감사합니다!', 'success');
      setTimeout(() => { closeModal('pledgeModal'); pledgeAcct = null; }, 1100);
    } catch (e) { hint($('pledgeHint'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });
  $('pledgeCancel') && $('pledgeCancel').addEventListener('click', () => {
    pledgeAcct = null; closeModal('pledgeModal');
    if ($('logoutBtn')) $('logoutBtn').click(); else { localStorage.removeItem(LOGIN_FLAG); setAdmin(false); }
  });

  // ---------- 서약서 현황 (본사 담당자) ----------
  // 서약서 본문(전문) — 화면 보기·PDF 공통
  function pledgeClauses() {
    return [
      '관계 법령(집합건물법 등)과 관리규약을 준수하며 정당하고 투명하게 업무를 수행한다.',
      '본사의 지침과 보고 체계를 따르고, 진행 상황을 매월 성실히 보고한다.',
      '업무상 알게 된 입주자·구분소유자의 개인정보와 회사 기밀을 외부에 유출하지 않는다.',
      '관리단 조성 활동 시 부정한 금품 제공/수수 등 불법 행위를 하지 않는다.',
      '회사의 명예를 훼손하거나 회사의 이해에 반하는 행위를 하지 않는다.',
      '상기 내용 포함 관리단 구성에 관한 모든 사항에 대해 본사 이외 제3자(추진위 포함)에게 공유를 금지한다.',
      '관리소장은 에이스종합관리㈜의 소속 직원으로서 집합건물법 및 민법상 관리인이 될 수 없음을 인지하고 성실히 본연의 직무에 전념한다.'
    ];
  }
  function pledgeDocHtml(p) {
    let h = '<div style="font-family:\'Noto Sans KR\',sans-serif;color:#1f2937;line-height:1.7;">';
    h += '<div style="text-align:center;border-bottom:2px solid #123a6b;padding-bottom:10px;margin-bottom:16px;">' +
      '<div style="font-size:12px;color:#1c5fc4;font-weight:700;">에이스종합관리㈜</div>' +
      '<div style="font-size:24px;font-weight:900;color:#0f2a4a;letter-spacing:4px;">관 리 소 장 서 약 서</div></div>';
    h += `<p style="font-size:13.5px;">본인은 에이스종합관리㈜의 지점사업소 <b>${esc(p.branchName || '')}</b> 관리소장으로서, 관리단 구성 업무를 수행함에 있어 다음 사항을 성실히 준수할 것을 서약합니다.</p>`;
    h += '<ol style="font-size:13px;padding-left:20px;">';
    pledgeClauses().forEach((c) => { h += `<li style="margin:5px 0;">${esc(c)}</li>`; });
    h += '</ol>';
    h += '<p style="font-size:13.5px;">위 사항을 위반할 경우에 그에 따른 민·형사상 책임을 질 것을 서약합니다.</p>';
    h += `<p style="text-align:center;font-size:14px;font-weight:700;margin:22px 0 14px;">${esc(p.date || '')}</p>`;
    h += '<div style="display:flex;justify-content:flex-end;align-items:flex-end;gap:10px;margin-top:6px;">' +
      `<div style="text-align:right;"><div style="font-size:13px;color:#5b6573;">서약자(관리소장)</div><div style="font-size:17px;font-weight:800;color:#0f2a4a;">${esc(p.name || '')} <span style="font-size:12px;color:#5b6573;">(서명)</span></div></div>`;
    if (p.sign) h += `<img src="${esc(p.sign)}" alt="서명" style="width:170px;height:64px;object-fit:contain;border-bottom:1px solid #cbd5e1;" />`;
    h += '</div></div>';
    return h;
  }
  let pledgeData = {};
  async function openPledgeAdmin() {
    if (!isHQ()) { alert('서약서 현황은 본사 담당자만 열람할 수 있습니다.'); return; }
    const body = $('pledgeAdminBody'); if (!body) return;
    body.innerHTML = '<h2>📜 서약서 현황</h2><p class="hint">불러오는 중…</p>';
    openModal('pledgeAdminModal');
    let pl = {}; try { pl = await loadPledges(); } catch (e) {}
    pledgeData = pl;
    const byBranch = {}; Object.keys(pl).forEach((k) => { const p = pl[k]; if (p && p.branchId) byBranch[p.branchId] = p; });
    const total = BRANCHES.length, done = BRANCHES.filter((b) => byBranch[b.id]).length;
    let h = `<h2>📜 서약서 현황</h2><p class="login-help">제출 ${done} / 전체 ${total} 곳. 제출된 서약서는 ‘보기’로 서명을 확인하고 PDF로 저장할 수 있습니다.</p>`;
    h += '<ul class="pl-list">';
    BRANCHES.forEach((b) => {
      const p = byBranch[b.id];
      h += '<li class="pl-row">' +
        `<div class="pl-info"><span class="pl-bname">${esc(b.name)}</span>` +
        (p ? `<span class="pl-meta">${esc(p.name)} · ${esc(p.date)}</span>` : '<span class="pl-meta pl-no">미제출</span>') +
        '</div>' +
        (p ? `<button type="button" class="btn ghost pl-view" data-pv="${esc(b.id)}">보기</button>` : '<span class="pl-badge-no">미제출</span>') +
        '</li>';
    });
    h += '</ul>';
    body.innerHTML = h;
  }
  function showPledgeDetail(branchId) {
    const byBranch = {}; Object.keys(pledgeData).forEach((k) => { const p = pledgeData[k]; if (p && p.branchId) byBranch[p.branchId] = p; });
    const p = byBranch[branchId]; if (!p) return;
    const body = $('pledgeAdminBody'); if (!body) return;
    body.innerHTML = '<button type="button" class="btn ghost" id="plBack" style="margin-bottom:12px;">← 목록</button>' +
      '<div class="pl-detail">' + pledgeDocHtml(p) + '</div>' +
      '<button type="button" class="btn block" id="plPdfBtn" style="margin-top:14px;">📄 이 서약서 PDF로 저장</button>';
    $('plBack') && $('plBack').addEventListener('click', openPledgeAdmin);
    $('plPdfBtn') && $('plPdfBtn').addEventListener('click', () => genPledgePdf(p));
  }
  function genPledgePdf(p) {
    const w = window.open('', '_blank');
    if (!w) { alert('PDF 저장을 위해 팝업을 허용해 주세요.'); return; }
    const title = esc((p.branchName || '서약서') + ' 관리소장 서약서');
    const css = '@page{size:A4;margin:18mm}*{box-sizing:border-box}' +
      "body{font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif;color:#1f2937;margin:0;padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
      '@media print{body{padding:0}}';
    w.document.open();
    w.document.write('<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet"><style>' + css + '</style></head><body>' +
      pledgeDocHtml(p) +
      '<scr' + 'ipt>window.onload=function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},500);};<\/scr' + 'ipt></body></html>');
    w.document.close();
  }
  $('pledgeAdminBtn') && $('pledgeAdminBtn').addEventListener('click', openPledgeAdmin);
  $('pledgeAdminBody') && $('pledgeAdminBody').addEventListener('click', (e) => {
    const v = e.target.closest('[data-pv]'); if (v) showPledgeDetail(v.dataset.pv);
  });

  // ---------- 아이디/비밀번호 변경 ----------
  function curRole() { return localStorage.getItem('ace_role') || ''; }
  function curAcct() { return localStorage.getItem('ace_acct') || ''; }
  $('changeCredBtn') && $('changeCredBtn').addEventListener('click', () => {
    if (!isAdmin()) { alert('로그인 후 변경할 수 있습니다.'); return; }
    $('ccNewId').value = curAcct();
    $('ccNewPw').value = ''; $('ccNewPw2').value = '';
    $('resetCredBtn').style.display = curRole() === 'hq' ? 'block' : 'none';
    hint($('ccHint'), '', ''); closeModal('loginModal'); openModal('changeCredModal');
  });
  $('ccSubmit') && $('ccSubmit').addEventListener('click', async () => {
    if (!hasToken()) { hint($('ccHint'), '저장 권한이 없습니다(토큰 필요).', 'error'); return; }
    const newId = ($('ccNewId').value || '').trim();
    const newPw = $('ccNewPw').value || '';
    const newPw2 = $('ccNewPw2').value || '';
    const oldId = curAcct();
    if (!newId) { hint($('ccHint'), '아이디를 입력해 주세요.', 'error'); return; }
    if (!newPw) { hint($('ccHint'), '새 비밀번호를 입력해 주세요.', 'error'); return; }
    if (newPw !== newPw2) { hint($('ccHint'), '새 비밀번호가 일치하지 않습니다.', 'error'); return; }
    const btn = $('ccSubmit'); btn.disabled = true;
    try {
      hint($('ccHint'), '저장 중…', '');
      const hash = await sha256hex(newPw);
      const next = await mutateAuth((o) => {
        const accs = o.accounts || [];
        if (newId !== oldId && accs.some((a) => a.id === newId)) throw new Error('이미 있는 아이디입니다.');
        o.accounts = accs.map((a) => (a.id === oldId ? Object.assign({}, a, { id: newId, pwHash: hash }) : a));
        return o;
      }, '계정 변경: ' + newId);
      AUTH = next.accounts;
      localStorage.setItem('ace_acct', newId);
      hint($('ccHint'), '변경되었습니다! (반영까지 1~2분)', 'success');
      setTimeout(() => closeModal('changeCredModal'), 1200);
    } catch (e) { hint($('ccHint'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });
  $('resetCredBtn') && $('resetCredBtn').addEventListener('click', async () => {
    if (curRole() !== 'hq') { alert('본사만 초기화할 수 있습니다.'); return; }
    if (!confirm('모든 계정을 기본값(사업소 1~12 / 비번 1234, 본사 / ace01)으로 초기화할까요?')) return;
    const btn = $('resetCredBtn'); btn.disabled = true;
    try {
      hint($('ccHint'), '초기화 중…', '');
      const next = await mutateAuth((o) => { o.accounts = DEFAULT_ACCOUNTS.slice(); return o; }, '계정 초기화');
      AUTH = next.accounts;
      hint($('ccHint'), '초기화되었습니다. 기본: 사업소 1~12 / 비번 1234, 본사 / ace01 (반영 1~2분)', 'success');
    } catch (e) { hint($('ccHint'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  function refreshNote() {
    const note = $('reportNote');
    if (isCentral()) { note.hidden = true; return; }
    note.hidden = false;
    note.innerHTML = '<b>안내</b> · 로그인 전이라 보고가 <b>이 기기에만</b> 저장됩니다. GitHub에 저장해 전체가 함께 보려면 헤더의 <b>‘로그인’</b>을 눌러 토큰으로 로그인하세요. (본사·관리소장 공용)';
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
  // ---------- 전략 탭: 관리소장 교육자료 (군별·단계별 과제) ----------
  let eduGroup = 1;
  function syncEduTabs() { document.querySelectorAll('#eduTabs .edu-tab').forEach((x) => x.classList.toggle('active', parseInt(x.dataset.g, 10) === eduGroup)); }
  function renderEduGuide() {
    const wrap = $('eduGuide'); if (!wrap) return;
    const stages = stagesForGroup(eduGroup);
    let h = '';
    stages.forEach((s, si) => {
      const sc = stageColorClass(s.name);
      h += `<div class="edu-stage"><div class="rd-stage ${sc}" style="margin:0 0 10px;">${esc(s.name)}</div><ul class="edu-tasks">`;
      s.tasks.forEach((t) => { h += `<li><span class="edu-no ${sc}">${esc(t.no)}</span><span class="edu-t">${esc(t.t)}</span></li>`; });
      h += '</ul></div>';
      if (si < stages.length - 1) h += '<div class="edu-arrow">▼</div>';
    });
    wrap.innerHTML = h;
  }
  function updateEduForUser() {
    const myb = lockedBranchId();
    if (myb) { const bb = BRANCHES.find((x) => x.id === myb); if (bb && bb.group) eduGroup = bb.group; }
    syncEduTabs(); renderEduGuide();
  }
  $('eduTabs') && $('eduTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.edu-tab'); if (!b) return;
    eduGroup = parseInt(b.dataset.g, 10); syncEduTabs(); renderEduGuide();
  });

  async function init() {
    try {
      const meta = await fetch(BRANCHES_PATH + '?_cb=' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
      META = meta || {};
      BRANCHES = (meta && Array.isArray(meta.branches) && meta.branches.length) ? meta.branches : FALLBACK_BRANCHES;
    } catch (e) { META = {}; BRANCHES = FALLBACK_BRANCHES; }
    $('hdrSub').textContent = `${BRANCHES.length}개 지점사업소 · ${APP_VERSION}`;
    renderStatus();
    renderReportFilter();
    if (localStorage.getItem(LOGIN_FLAG) === '1') { if (EMBED_TOKEN_OBF && !hasToken()) localStorage.setItem(TOKEN_KEY, deobf(EMBED_TOKEN_OBF)); setAdmin(true); }
    loadAuth().then((a) => { AUTH = a; });
    REPORTS = await loadReports();
    renderReports();
    renderStatus(); // 보고 건수 반영
    refreshNote();
    updateEduForUser(); // 교육자료 — 로그인한 사업소의 군 기본 선택
  }
  init();

  // ---------- 앱 나가기 확인 ----------
  (function () {
    let leaving = false;
    // 모바일/데스크탑 뒤로가기 가로채기
    try { history.pushState({ ace: 1 }, '', location.href); } catch (e) {}
    window.addEventListener('popstate', function () {
      if (leaving) return;
      if (window.confirm('앱을 나가시겠습니까?')) { leaving = true; history.back(); }
      else { try { history.pushState({ ace: 1 }, '', location.href); } catch (e) {} }
    });
    // 탭 닫기·새로고침·주소 이동 시 브라우저 확인창
    window.addEventListener('beforeunload', function (e) {
      if (leaving) return;
      e.preventDefault();
      e.returnValue = '';
    });
  })();
})();
