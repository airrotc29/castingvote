// ===== HABITUS KOREA 관리자 - 현장 사진 업로드 =====
// GitHub Contents API를 이용해 정적 사이트에 직접 사진을 커밋합니다.

const OWNER = 'airrotc29';
const REPO = '-';
const BRANCH = 'main';
const GALLERY_DIR = 'assets/images/gallery';
const MANIFEST = 'assets/data/gallery.json';
const MAX_SIZE = 10 * 1024 * 1024;
const API = 'https://api.github.com';

const $ = (id) => document.getElementById(id);
const tokenEl = $('token');
const rememberEl = $('remember');
const filesEl = $('files');
const dropEl = $('drop');
const dropText = $('dropText');
const previewEl = $('preview');
const statusEl = $('status');
const uploadBtn = $('uploadBtn');
const currentList = $('currentList');
const refreshBtn = $('refreshBtn');

let selectedFiles = [];

// ---- 토큰 저장/복원 ----
const SAVED = 'habitus_admin_token';
if (localStorage.getItem(SAVED)) tokenEl.value = localStorage.getItem(SAVED);

function setStatus(msg, type) {
  statusEl.className = 'form-hint' + (type ? ' ' + type : '');
  statusEl.textContent = msg;
}

function token() {
  return tokenEl.value.trim();
}

function headers() {
  return {
    Authorization: 'Bearer ' + token(),
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// ---- 유틸 ----
function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function safeName(name) {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9가-힣_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  return base + ext;
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]); // data URL에서 base64만
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function utf8ToBase64(str) {
  return btoa(String.fromCharCode.apply(null, new TextEncoder().encode(str)));
}
function base64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---- GitHub API ----
async function getContent(path) {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('읽기 실패 (' + res.status + ')');
  return res.json();
}

async function putContent(path, base64, message, sha) {
  const body = { message, content: base64, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('저장 실패 (' + res.status + ') ' + t);
  }
  return res.json();
}

async function deleteContent(path, sha, message) {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
  if (!res.ok) throw new Error('삭제 실패 (' + res.status + ')');
  return res.json();
}

async function loadManifest() {
  const data = await getContent(MANIFEST);
  if (!data) return { items: [], sha: null };
  let items = [];
  try { items = JSON.parse(base64ToUtf8(data.content)); } catch (e) { items = []; }
  if (!Array.isArray(items)) items = [];
  return { items, sha: data.sha };
}

// ---- 파일 선택 ----
function renderPreview() {
  previewEl.innerHTML = '';
  if (selectedFiles.length === 0) {
    dropText.textContent = '사진을 끌어다 놓거나 클릭하여 선택 (여러 장 가능)';
    dropText.classList.remove('has-file');
    return;
  }
  dropText.textContent = selectedFiles.length + '장 선택됨';
  dropText.classList.add('has-file');
  selectedFiles.forEach((f, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'admin-preview-item';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    const cap = document.createElement('input');
    cap.type = 'text';
    cap.placeholder = '사진 설명 (선택)';
    cap.dataset.idx = i;
    cap.className = 'admin-cap';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'admin-preview-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      selectedFiles.splice(i, 1);
      renderPreview();
    });
    wrap.appendChild(del);
    wrap.appendChild(img);
    wrap.appendChild(cap);
    previewEl.appendChild(wrap);
  });
}

function addFiles(list) {
  for (const f of list) {
    if (!f.type.startsWith('image/')) continue;
    if (f.size > MAX_SIZE) { setStatus(`"${f.name}" 은 10MB를 초과합니다.`, 'error'); continue; }
    selectedFiles.push(f);
  }
  renderPreview();
}

filesEl.addEventListener('change', () => addFiles(filesEl.files));
['dragenter', 'dragover'].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.remove('dragover'); })
);
dropEl.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

// ---- 업로드 ----
uploadBtn.addEventListener('click', async () => {
  if (!token()) { setStatus('GitHub 토큰을 입력해 주세요.', 'error'); return; }
  if (selectedFiles.length === 0) { setStatus('업로드할 사진을 선택해 주세요.', 'error'); return; }

  if (rememberEl.checked) localStorage.setItem(SAVED, token());
  else localStorage.removeItem(SAVED);

  uploadBtn.disabled = true;
  const caps = Array.from(document.querySelectorAll('.admin-cap'));

  try {
    setStatus('갤러리 정보를 불러오는 중…', '');
    const { items, sha } = await loadManifest();
    const newItems = items.slice();

    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i];
      setStatus(`사진 업로드 중… (${i + 1}/${selectedFiles.length}) ${f.name}`, '');
      const fname = `${Date.now()}-${i}-${safeName(f.name)}`;
      const path = `${GALLERY_DIR}/${fname}`;
      const b64 = await readAsBase64(f);
      await putContent(path, b64, `사진 업로드: ${fname}`);
      const capInput = caps.find((c) => Number(c.dataset.idx) === i);
      newItems.push({ file: path, caption: capInput ? capInput.value.trim() : '' });
    }

    setStatus('갤러리 목록 갱신 중…', '');
    await putContent(MANIFEST, utf8ToBase64(JSON.stringify(newItems, null, 2)), '갤러리 목록 갱신', sha);

    setStatus(`완료! ${selectedFiles.length}장이 갤러리에 추가됐습니다. (사이트 반영까지 1~2분)`, 'success');
    selectedFiles = [];
    filesEl.value = '';
    renderPreview();
    loadCurrent();
  } catch (e) {
    setStatus('오류: ' + e.message, 'error');
  } finally {
    uploadBtn.disabled = false;
  }
});

// ---- 현재 갤러리 목록 ----
async function loadCurrent() {
  currentList.textContent = '불러오는 중…';
  if (!token()) { currentList.textContent = '토큰을 입력하면 현재 사진 목록을 볼 수 있습니다.'; return; }
  try {
    const { items } = await loadManifest();
    if (items.length === 0) { currentList.textContent = '아직 등록된 사진이 없습니다.'; return; }
    currentList.innerHTML = '';
    items.slice().reverse().forEach((item) => {
      const row = document.createElement('div');
      row.className = 'admin-current-item';
      const img = document.createElement('img');
      img.src = item.file;
      const span = document.createElement('span');
      span.textContent = item.caption || '(설명 없음)';
      const del = document.createElement('button');
      del.className = 'btn btn-sm btn-outline';
      del.textContent = '삭제';
      del.addEventListener('click', () => removePhoto(item.file));
      row.appendChild(img);
      row.appendChild(span);
      row.appendChild(del);
      currentList.appendChild(row);
    });
  } catch (e) {
    currentList.textContent = '목록을 불러오지 못했습니다: ' + e.message;
  }
}

async function removePhoto(file) {
  if (!confirm('이 사진을 갤러리에서 삭제할까요?')) return;
  try {
    setStatus('삭제 중…', '');
    // 1) 매니페스트에서 제거
    const { items, sha } = await loadManifest();
    const next = items.filter((it) => it.file !== file);
    await putContent(MANIFEST, utf8ToBase64(JSON.stringify(next, null, 2)), '갤러리에서 사진 제거', sha);
    // 2) 실제 이미지 파일 삭제
    const meta = await getContent(file);
    if (meta) await deleteContent(file, meta.sha, '사진 파일 삭제: ' + file);
    setStatus('삭제됐습니다. (사이트 반영까지 1~2분)', 'success');
    loadCurrent();
  } catch (e) {
    setStatus('삭제 오류: ' + e.message, 'error');
  }
}

refreshBtn.addEventListener('click', loadCurrent);
if (token()) loadCurrent();
else currentList.textContent = '토큰을 입력하면 현재 사진 목록을 볼 수 있습니다.';

// ===== 투표 영상 관리 (videos.json) =====
const VIDEOS_MANIFEST = 'assets/data/videos.json';
const videoUrlEl = $('videoUrl');
const videoTitleInput = $('videoTitleInput');
const videoStatusEl = $('videoStatus');
const videoAddBtn = $('videoAddBtn');
const videoCurrentList = $('videoCurrentList');

function setVideoStatus(msg, type) {
  videoStatusEl.className = 'form-hint' + (type ? ' ' + type : '');
  videoStatusEl.textContent = msg;
}

function extractYoutubeId(url) {
  if (!url) return '';
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return '';
}

async function loadVideos() {
  const data = await getContent(VIDEOS_MANIFEST);
  if (!data) return { items: [], sha: null };
  let items = [];
  try { items = JSON.parse(base64ToUtf8(data.content)); } catch (e) { items = []; }
  if (!Array.isArray(items)) items = [];
  return { items, sha: data.sha };
}

videoAddBtn.addEventListener('click', async () => {
  if (!token()) { setVideoStatus('GitHub 토큰을 먼저 입력해 주세요.', 'error'); return; }
  const url = videoUrlEl.value.trim();
  const title = videoTitleInput.value.trim();
  const id = extractYoutubeId(url);
  if (!id) { setVideoStatus('올바른 유튜브 주소가 아닙니다.', 'error'); return; }

  videoAddBtn.disabled = true;
  try {
    setVideoStatus('영상 추가 중…', '');
    const { items, sha } = await loadVideos();
    items.push({ url: 'https://youtu.be/' + id, title: title || '제목 없는 영상' });
    await putContent(VIDEOS_MANIFEST, utf8ToBase64(JSON.stringify(items, null, 2)), '투표 영상 추가', sha);
    setVideoStatus('추가됐습니다! (사이트 반영까지 1~2분)', 'success');
    videoUrlEl.value = '';
    videoTitleInput.value = '';
    loadVideoList();
  } catch (e) {
    setVideoStatus('오류: ' + e.message, 'error');
  } finally {
    videoAddBtn.disabled = false;
  }
});

async function loadVideoList() {
  videoCurrentList.textContent = '불러오는 중…';
  if (!token()) { videoCurrentList.textContent = '토큰을 입력하면 영상 목록을 볼 수 있습니다.'; return; }
  try {
    const { items } = await loadVideos();
    if (items.length === 0) { videoCurrentList.textContent = '아직 등록된 영상이 없습니다.'; return; }
    videoCurrentList.innerHTML = '';
    items.slice().reverse().forEach((v) => {
      const id = extractYoutubeId(v.url);
      const row = document.createElement('div');
      row.className = 'admin-current-item';
      const img = document.createElement('img');
      img.src = `https://img.youtube.com/vi/${id}/default.jpg`;
      const span = document.createElement('span');
      span.textContent = v.title || '(제목 없음)';
      const del = document.createElement('button');
      del.className = 'btn btn-sm btn-outline';
      del.textContent = '삭제';
      del.addEventListener('click', () => removeVideo(v.url));
      row.appendChild(img);
      row.appendChild(span);
      row.appendChild(del);
      videoCurrentList.appendChild(row);
    });
  } catch (e) {
    videoCurrentList.textContent = '목록을 불러오지 못했습니다: ' + e.message;
  }
}

async function removeVideo(url) {
  if (!confirm('이 영상을 목록에서 삭제할까요?')) return;
  try {
    setVideoStatus('삭제 중…', '');
    const { items, sha } = await loadVideos();
    const next = items.filter((it) => it.url !== url);
    await putContent(VIDEOS_MANIFEST, utf8ToBase64(JSON.stringify(next, null, 2)), '투표 영상 삭제', sha);
    setVideoStatus('삭제됐습니다. (사이트 반영까지 1~2분)', 'success');
    loadVideoList();
  } catch (e) {
    setVideoStatus('삭제 오류: ' + e.message, 'error');
  }
}

if (token()) loadVideoList();
else videoCurrentList.textContent = '토큰을 입력하면 영상 목록을 볼 수 있습니다.';
