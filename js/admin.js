// ===== E-CASTING VOTE 통합 관리자 모듈 =====
// 토큰 로그인 → 관리자 모드 → 사진/영상/공지/홍보자료를 GitHub API로 직접 커밋
(function () {
  const OWNER = 'airrotc29';
  const REPO = '-';
  const BRANCH = 'main';
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'ecv_admin_token';
  const MAX_SIZE = 10 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);

  // ---------- 토큰 / 인증 ----------
  let TOKEN = localStorage.getItem(TOKEN_KEY) || '';

  function headers() {
    return {
      Authorization: 'Bearer ' + TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  function setAdminMode(on) {
    document.body.classList.toggle('admin-on', on);
    const bar = $('adminBar');
    if (bar) bar.hidden = !on;
  }

  async function verifyToken(t) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}`, {
      headers: {
        Authorization: 'Bearer ' + t,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return res.ok;
  }

  // ---------- GitHub Contents API ----------
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
      method: 'PUT', headers: headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('저장 실패 (' + res.status + ') ' + (await res.text()));
    return res.json();
  }
  async function deleteContent(path, sha, message) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'DELETE', headers: headers(), body: JSON.stringify({ message, sha, branch: BRANCH }),
    });
    if (!res.ok) throw new Error('삭제 실패 (' + res.status + ')');
    return res.json();
  }

  async function loadJson(path) {
    const data = await getContent(path);
    if (!data) return { items: [], sha: null };
    let items = [];
    try { items = JSON.parse(b64ToUtf8(data.content)); } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
    return { items, sha: data.sha };
  }
  async function saveJson(path, items, message, sha) {
    return putContent(path, utf8ToB64(JSON.stringify(items, null, 2)), message, sha);
  }

  // ---------- 유틸 ----------
  function utf8ToB64(str) { return btoa(String.fromCharCode.apply(null, new TextEncoder().encode(str))); }
  function b64ToUtf8(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function extOf(name) { const d = name.lastIndexOf('.'); return d >= 0 ? name.slice(d + 1).toLowerCase() : ''; }
  function safeName(name) {
    const d = name.lastIndexOf('.');
    const ext = d >= 0 ? name.slice(d).toLowerCase() : '';
    const base = (d >= 0 ? name.slice(0, d) : name).replace(/[^a-zA-Z0-9가-힣_-]/g, '-').replace(/-+/g, '-').slice(0, 40);
    return base + ext;
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  function typeOfExt(ext) {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'file';
  }

  // ---------- 모달 ----------
  function openModal(id) { const m = $(id); if (m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); } }
  function closeModal(id) { const m = $(id); if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); } }
  document.querySelectorAll('.amodal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); } });
  });

  function hint(el, msg, type) { if (el) { el.className = 'form-hint' + (type ? ' ' + type : ''); el.textContent = msg; } }

  // ---------- 로그인 ----------
  $('adminLoginBtn') && $('adminLoginBtn').addEventListener('click', () => {
    if (document.body.classList.contains('admin-on')) { openModal('loginModal'); return; }
    $('loginToken').value = TOKEN || '';
    openModal('loginModal');
  });
  // #admin 으로 접속 시 로그인 창
  if (location.hash === '#admin') openModal('loginModal');

  $('loginSubmit') && $('loginSubmit').addEventListener('click', async () => {
    const t = $('loginToken').value.trim();
    if (!t) { hint($('loginStatus'), '토큰을 입력해 주세요.', 'error'); return; }
    hint($('loginStatus'), '확인 중…', '');
    try {
      const ok = await verifyToken(t);
      if (!ok) { hint($('loginStatus'), '유효하지 않은 토큰이거나 저장소 권한이 없습니다.', 'error'); return; }
      TOKEN = t;
      if ($('loginRemember').checked) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
      setAdminMode(true);
      hint($('loginStatus'), '', '');
      closeModal('loginModal');
      // 관리자용 삭제 버튼 표시를 위해 다시 렌더
      if (window.HK.renderGallery) window.HK.renderGallery();
      if (window.HK.renderPosts) window.HK.renderPosts();
      if (window.HK.renderResources) window.HK.renderResources();
    } catch (e) {
      hint($('loginStatus'), '오류: ' + e.message, 'error');
    }
  });

  $('adminLogout') && $('adminLogout').addEventListener('click', () => {
    TOKEN = '';
    localStorage.removeItem(TOKEN_KEY);
    setAdminMode(false);
    if (window.HK.renderGallery) window.HK.renderGallery();
    if (window.HK.renderPosts) window.HK.renderPosts();
    if (window.HK.renderResources) window.HK.renderResources();
  });

  // 저장된 토큰이 있으면 자동 로그인
  if (TOKEN) verifyToken(TOKEN).then((ok) => { if (ok) setAdminMode(true); });

  // ---------- 사진 올리기 ----------
  let photoFiles = [];
  const photoDrop = $('photoDrop'), photoInput = $('photoInput'), photoPreview = $('photoPreview'), photoDropText = $('photoDropText');

  $('addPhotoBtn') && $('addPhotoBtn').addEventListener('click', () => { photoFiles = []; renderPhotoPreview(); hint($('photoStatus'), '', ''); openModal('photoModal'); });

  function renderPhotoPreview() {
    photoPreview.innerHTML = '';
    photoDropText.textContent = photoFiles.length ? photoFiles.length + '장 선택됨' : '사진을 끌어다 놓거나 클릭하여 선택 (여러 장 가능)';
    photoFiles.forEach((f, i) => {
      const w = document.createElement('div');
      w.className = 'admin-preview-item';
      w.innerHTML = `<button type="button" class="admin-preview-del">×</button><img src="${URL.createObjectURL(f)}" /><input type="text" class="admin-cap" data-idx="${i}" placeholder="사진 설명 (선택)" />`;
      w.querySelector('.admin-preview-del').addEventListener('click', () => { photoFiles.splice(i, 1); renderPhotoPreview(); });
      photoPreview.appendChild(w);
    });
  }
  function addPhotoFiles(list) {
    for (const f of list) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_SIZE) { hint($('photoStatus'), `"${f.name}" 은 10MB 초과`, 'error'); continue; }
      photoFiles.push(f);
    }
    renderPhotoPreview();
  }
  photoInput && photoInput.addEventListener('change', () => addPhotoFiles(photoInput.files));
  if (photoDrop) {
    ['dragenter', 'dragover'].forEach((ev) => photoDrop.addEventListener(ev, (e) => { e.preventDefault(); photoDrop.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach((ev) => photoDrop.addEventListener(ev, (e) => { e.preventDefault(); photoDrop.classList.remove('dragover'); }));
    photoDrop.addEventListener('drop', (e) => addPhotoFiles(e.dataTransfer.files));
  }

  $('photoSubmit') && $('photoSubmit').addEventListener('click', async () => {
    if (photoFiles.length === 0) { hint($('photoStatus'), '사진을 선택해 주세요.', 'error'); return; }
    const btn = $('photoSubmit'); btn.disabled = true;
    const caps = Array.from(document.querySelectorAll('#photoPreview .admin-cap'));
    try {
      const { items, sha } = await loadJson('assets/data/gallery.json');
      const next = items.slice();
      for (let i = 0; i < photoFiles.length; i++) {
        hint($('photoStatus'), `업로드 중… (${i + 1}/${photoFiles.length})`, '');
        const f = photoFiles[i];
        const path = `assets/images/gallery/${Date.now()}-${i}-${safeName(f.name)}`;
        await putContent(path, await readBase64(f), '사진 업로드');
        const cap = caps.find((c) => Number(c.dataset.idx) === i);
        next.push({ file: path, caption: cap ? cap.value.trim() : '' });
      }
      await saveJson('assets/data/gallery.json', next, '갤러리 갱신', sha);
      hint($('photoStatus'), `완료! ${photoFiles.length}장 추가됨 (반영까지 1~2분)`, 'success');
      window.HK.renderGallery(next);
      photoFiles = []; renderPhotoPreview();
    } catch (e) { hint($('photoStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // ---------- 영상 추가 ----------
  $('addVideoBtn') && $('addVideoBtn').addEventListener('click', () => { hint($('videoAddStatus'), '', ''); openModal('videoAddModal'); renderVideoAdminList(); });

  async function renderVideoAdminList() {
    const box = $('videoAdminList');
    box.textContent = '불러오는 중…';
    try {
      const { items } = await loadJson('assets/data/videos.json');
      if (items.length === 0) { box.textContent = '등록된 영상이 없습니다.'; return; }
      box.innerHTML = '';
      items.slice().reverse().forEach((v) => {
        const id = window.HK.youtubeId ? window.HK.youtubeId(v.url) : '';
        const row = document.createElement('div');
        row.className = 'admin-current-item';
        row.innerHTML = `<img src="https://img.youtube.com/vi/${id}/default.jpg" /><span>${v.title || '(제목 없음)'}</span>`;
        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-outline'; del.textContent = '삭제';
        del.addEventListener('click', () => deleteVideo(v.url));
        row.appendChild(del);
        box.appendChild(row);
      });
    } catch (e) { box.textContent = '오류: ' + e.message; }
  }

  $('videoAddSubmit') && $('videoAddSubmit').addEventListener('click', async () => {
    const url = $('videoAddUrl').value.trim();
    const title = $('videoAddTitle').value.trim();
    const id = window.HK.youtubeId ? window.HK.youtubeId(url) : '';
    if (!id) { hint($('videoAddStatus'), '올바른 유튜브 주소가 아닙니다.', 'error'); return; }
    const btn = $('videoAddSubmit'); btn.disabled = true;
    try {
      const { items, sha } = await loadJson('assets/data/videos.json');
      items.push({ url: 'https://youtu.be/' + id, title: title || '제목 없는 영상' });
      await saveJson('assets/data/videos.json', items, '영상 추가', sha);
      hint($('videoAddStatus'), '추가됐습니다! (반영까지 1~2분)', 'success');
      $('videoAddUrl').value = ''; $('videoAddTitle').value = '';
      window.HK.refreshVideos(items);
      renderVideoAdminList();
    } catch (e) { hint($('videoAddStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  async function deleteVideo(url) {
    if (!confirm('이 영상을 삭제할까요?')) return;
    try {
      const { items, sha } = await loadJson('assets/data/videos.json');
      const next = items.filter((v) => v.url !== url);
      await saveJson('assets/data/videos.json', next, '영상 삭제', sha);
      window.HK.refreshVideos(next);
      renderVideoAdminList();
    } catch (e) { alert('삭제 오류: ' + e.message); }
  }

  // ---------- 공지·소식 글 ----------
  $('addPostBtn') && $('addPostBtn').addEventListener('click', () => {
    $('postTitle').value = ''; $('postBody').value = ''; $('postImage').value = ''; $('postFile').value = '';
    hint($('postStatus'), '', ''); openModal('postModal');
  });

  $('postSubmit') && $('postSubmit').addEventListener('click', async () => {
    const title = $('postTitle').value.trim();
    const body = $('postBody').value.trim();
    if (!title || !body) { hint($('postStatus'), '제목과 내용을 입력해 주세요.', 'error'); return; }
    const imgFile = $('postImage').files[0];
    const attFile = $('postFile').files[0];
    const btn = $('postSubmit'); btn.disabled = true;
    try {
      const post = { id: 'p' + Date.now(), title, body, date: today(), image: null, file: null, fileName: null };
      if (imgFile) {
        if (imgFile.size > MAX_SIZE) throw new Error('이미지가 10MB를 초과합니다.');
        hint($('postStatus'), '이미지 업로드 중…', '');
        const p = `assets/images/posts/${Date.now()}-${safeName(imgFile.name)}`;
        await putContent(p, await readBase64(imgFile), '공지 이미지 업로드');
        post.image = p;
      }
      if (attFile) {
        if (attFile.size > MAX_SIZE) throw new Error('첨부파일이 10MB를 초과합니다.');
        hint($('postStatus'), '첨부파일 업로드 중…', '');
        const p = `assets/resources/posts/${Date.now()}-${safeName(attFile.name)}`;
        await putContent(p, await readBase64(attFile), '공지 첨부파일 업로드');
        post.file = p; post.fileName = attFile.name;
      }
      hint($('postStatus'), '글 저장 중…', '');
      const { items, sha } = await loadJson('assets/data/posts.json');
      items.push(post);
      await saveJson('assets/data/posts.json', items, '공지 글 추가', sha);
      hint($('postStatus'), '글이 등록됐습니다! (반영까지 1~2분)', 'success');
      window.HK.renderPosts(items);
    } catch (e) { hint($('postStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // ---------- 홍보자료 추가 ----------
  $('addResourceBtn') && $('addResourceBtn').addEventListener('click', () => {
    $('resTitle').value = ''; $('resDesc').value = ''; $('resFile').value = '';
    hint($('resStatus'), '', ''); openModal('resourceModal');
  });

  $('resSubmit') && $('resSubmit').addEventListener('click', async () => {
    const title = $('resTitle').value.trim();
    const desc = $('resDesc').value.trim();
    const file = $('resFile').files[0];
    if (!title || !file) { hint($('resStatus'), '제목과 파일을 입력해 주세요.', 'error'); return; }
    if (file.size > MAX_SIZE) { hint($('resStatus'), '파일이 10MB를 초과합니다.', 'error'); return; }
    const btn = $('resSubmit'); btn.disabled = true;
    try {
      hint($('resStatus'), '파일 업로드 중…', '');
      const ext = extOf(file.name);
      const path = `assets/resources/uploads/${Date.now()}-${safeName(file.name)}`;
      await putContent(path, await readBase64(file), '홍보자료 업로드');
      const { items, sha } = await loadJson('assets/data/resources.json');
      items.push({ file: path, type: typeOfExt(ext), ext, title, desc });
      await saveJson('assets/data/resources.json', items, '홍보자료 추가', sha);
      hint($('resStatus'), '자료가 추가됐습니다! (반영까지 1~2분)', 'success');
      window.HK.renderResources(items);
    } catch (e) { hint($('resStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // ---------- 삭제 (이벤트 위임) ----------
  document.addEventListener('click', async (e) => {
    const del = e.target.closest('.admin-del');
    if (!del || !document.body.classList.contains('admin-on')) return;
    e.preventDefault();
    const kind = del.dataset.kind, id = del.dataset.id;
    if (!confirm('정말 삭제할까요?')) return;
    try {
      if (kind === 'gallery') {
        const { items, sha } = await loadJson('assets/data/gallery.json');
        const next = items.filter((it) => it.file !== id);
        await saveJson('assets/data/gallery.json', next, '사진 삭제', sha);
        await tryDeleteFile(id);
        window.HK.renderGallery(next);
      } else if (kind === 'post') {
        const { items, sha } = await loadJson('assets/data/posts.json');
        const target = items.find((p) => p.id === id);
        const next = items.filter((p) => p.id !== id);
        await saveJson('assets/data/posts.json', next, '공지 삭제', sha);
        if (target) { await tryDeleteFile(target.image); await tryDeleteFile(target.file); }
        window.HK.renderPosts(next);
      } else if (kind === 'resource') {
        const { items, sha } = await loadJson('assets/data/resources.json');
        const next = items.filter((it) => it.file !== id);
        await saveJson('assets/data/resources.json', next, '홍보자료 삭제', sha);
        await tryDeleteFile(id);
        window.HK.renderResources(next);
      }
    } catch (err) { alert('삭제 오류: ' + err.message); }
  });

  async function tryDeleteFile(path) {
    if (!path) return;
    try { const meta = await getContent(path); if (meta) await deleteContent(path, meta.sha, '파일 삭제: ' + path); } catch (e) { /* 무시 */ }
  }
})();
