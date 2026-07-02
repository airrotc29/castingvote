// ===== CASTING VOTE 통합 관리자 모듈 =====
// 토큰 로그인 → 관리자 모드 → 사진/영상/공지/홍보자료를 GitHub API로 직접 커밋
(function () {
  const OWNER = 'airrotc29';
  const REPO = 'castingvote';
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
    // 캐시 우회를 위해 고유 쿼리 파라미터 추가 (오래된 sha로 인한 409 방지)
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}&_cb=${Date.now()}`, {
      headers: headers(),
    });
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
  // 최신 내용을 다시 읽어 변형 후 저장. 409(충돌) 시 재시도.
  async function mutateJson(path, mutator, message) {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      const { items, sha } = await loadJson(path);
      const next = mutator(items.slice());
      try {
        await saveJson(path, next, message, sha);
        return next;
      } catch (e) {
        lastErr = e;
        if (String(e.message).includes('(409)')) { await new Promise((r) => setTimeout(r, 700)); continue; }
        throw e;
      }
    }
    throw lastErr;
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

  // 접속 시에는 항상 '로그아웃(일반)' 상태로 시작합니다.
  // (저장된 토큰이 있어도 자동 로그인하지 않고, [관리자] → [로그인] 시에만 관리자 모드가 켜집니다.
  //  저장된 토큰은 로그인 창에 자동 입력되어 클릭 한 번으로 로그인됩니다.)

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
      const added = [];
      for (let i = 0; i < photoFiles.length; i++) {
        hint($('photoStatus'), `업로드 중… (${i + 1}/${photoFiles.length})`, '');
        const f = photoFiles[i];
        const path = `assets/images/gallery/${Date.now()}-${i}-${safeName(f.name)}`;
        await putContent(path, await readBase64(f), '사진 업로드');
        const cap = caps.find((c) => Number(c.dataset.idx) === i);
        added.push({ file: path, caption: cap ? cap.value.trim() : '' });
      }
      const next = await mutateJson('assets/data/gallery.json', (items) => items.concat(added), '갤러리 갱신');
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
        var thumb = id ? '<img src="https://img.youtube.com/vi/' + id + '/default.jpg" />' : '<img src="data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2248%22%3E%3Crect width=%2264%22 height=%2248%22 fill=%22%230f2a4a%22/%3E%3Ctext x=%2232%22 y=%2230%22 fill=%22white%22 font-size=%2220%22 text-anchor=%22middle%22%3E%E2%96%B6%3C/text%3E%3C/svg%3E" />';
        row.innerHTML = thumb + '<span>' + (v.title || '(제목 없음)') + (v.file ? ' (파일)' : '') + '</span>';
        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-outline'; del.textContent = '삭제';
        del.addEventListener('click', () => deleteVideo(v.url || v.file, v));
        row.appendChild(del);
        box.appendChild(row);
      });
    } catch (e) { box.textContent = '오류: ' + e.message; }
  }

  $('videoAddSubmit') && $('videoAddSubmit').addEventListener('click', async () => {
    const url = $('videoAddUrl').value.trim();
    const title = $('videoAddTitle').value.trim();
    const vf = $('videoAddFile') ? $('videoAddFile').files[0] : null;
    const id = window.HK.youtubeId ? window.HK.youtubeId(url) : '';
    if (!id && !vf) { hint($('videoAddStatus'), '유튜브 주소를 넣거나 동영상 파일을 선택해 주세요.', 'error'); return; }
    if (vf && vf.size > MAX_SIZE) { hint($('videoAddStatus'), '동영상 파일이 10MB를 초과합니다.', 'error'); return; }
    const btn = $('videoAddSubmit'); btn.disabled = true;
    try {
      var entry;
      if (vf) {
        hint($('videoAddStatus'), '동영상 업로드 중…', '');
        var path = 'assets/videos/' + Date.now() + '-' + safeName(vf.name);
        await putContent(path, await readBase64(vf), '동영상 업로드');
        entry = { file: path, title: title || vf.name };
      } else {
        entry = { url: 'https://youtu.be/' + id, title: title || '제목 없는 영상' };
      }
      const next = await mutateJson('assets/data/videos.json', (items) => items.concat([entry]), '영상 추가');
      hint($('videoAddStatus'), '추가됐습니다! (반영까지 1~2분)', 'success');
      $('videoAddUrl').value = ''; $('videoAddTitle').value = ''; if ($('videoAddFile')) $('videoAddFile').value = '';
      window.HK.refreshVideos(next);
      renderVideoAdminList();
    } catch (e) { hint($('videoAddStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  async function deleteVideo(key, v) {
    if (!confirm('이 영상을 삭제할까요?')) return;
    try {
      const next = await mutateJson('assets/data/videos.json', (items) => items.filter((x) => (x.url || x.file) !== key), '영상 삭제');
      if (v && v.file) await tryDeleteFile(v.file);
      window.HK.refreshVideos(next);
      renderVideoAdminList();
    } catch (e) { alert('삭제 오류: ' + e.message); }
  }

  // ---------- 위탁계약서 파일 교체 (docs.json — 객체) ----------
  async function getDocs() {
    var data = await getContent('assets/data/docs.json');
    if (!data) return { obj: {}, sha: null };
    var obj = {};
    try { obj = JSON.parse(b64ToUtf8(data.content)); } catch (e) { obj = {}; }
    if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) obj = {};
    return { obj: obj, sha: data.sha };
  }
  async function mutateDocs(mutator, msg) {
    var lastErr;
    for (var i = 0; i < 4; i++) {
      var d = await getDocs();
      var next = mutator(d.obj);
      try { await putContent('assets/data/docs.json', utf8ToB64(JSON.stringify(next, null, 2)), msg, d.sha); return next; }
      catch (e) { lastErr = e; if (String(e.message).indexOf('(409)') >= 0) { await new Promise(function (r) { setTimeout(r, 700); }); continue; } throw e; }
    }
    throw lastErr;
  }

  $('consignmentReplace') && $('consignmentReplace').addEventListener('click', function () {
    if (!TOKEN) { alert('관리자 로그인이 필요합니다.'); return; }
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.hwp,.hwpx,.pdf,.doc,.docx';
    inp.addEventListener('change', async function () {
      var f = inp.files[0]; if (!f) return;
      if (f.size > MAX_SIZE) { alert('파일이 10MB를 초과합니다.'); return; }
      try {
        var ext = extOf(f.name);
        var path = 'assets/resources/uploads/' + Date.now() + '-' + safeName(f.name);
        await putContent(path, await readBase64(f), '위탁계약서 파일 교체');
        var next = await mutateDocs(function (obj) { obj.consignment = { file: path, ext: ext, fileName: f.name }; return obj; }, '위탁계약서 갱신');
        if (window.HK.renderConsignment) window.HK.renderConsignment(next);
        alert('위탁계약서 파일이 교체됐습니다. (반영까지 1~2분)');
      } catch (e) { alert('오류: ' + e.message); }
    });
    inp.click();
  });

  // ---------- 공지·소식 글 (작성/수정) ----------
  let editPostId = null;

  $('addPostBtn') && $('addPostBtn').addEventListener('click', () => {
    editPostId = null;
    $('postModalTitle').textContent = '공지·소식 글 작성';
    $('postSubmit').textContent = '글 올리기';
    $('postTitle').value = ''; $('postBody').value = ''; $('postImage').value = ''; $('postFile').value = '';
    $('postLink').value = ''; $('postLinkText').value = '';
    hint($('postStatus'), '', ''); openModal('postModal');
  });

  $('postSubmit') && $('postSubmit').addEventListener('click', async () => {
    const title = $('postTitle').value.trim();
    const body = $('postBody').value.trim();
    if (!title || !body) { hint($('postStatus'), '제목과 내용을 입력해 주세요.', 'error'); return; }
    const imgFile = $('postImage').files[0];
    const attFile = $('postFile').files[0];
    const link = $('postLink').value.trim();
    const linkText = $('postLinkText').value.trim();
    const btn = $('postSubmit'); btn.disabled = true;
    try {
      let image = null, file = null, fileName = null;
      if (imgFile) {
        if (imgFile.size > MAX_SIZE) throw new Error('이미지가 10MB를 초과합니다.');
        hint($('postStatus'), '이미지 업로드 중…', '');
        image = `assets/images/posts/${Date.now()}-${safeName(imgFile.name)}`;
        await putContent(image, await readBase64(imgFile), '공지 이미지 업로드');
      }
      if (attFile) {
        if (attFile.size > MAX_SIZE) throw new Error('첨부파일이 10MB를 초과합니다.');
        hint($('postStatus'), '첨부파일 업로드 중…', '');
        file = `assets/resources/posts/${Date.now()}-${safeName(attFile.name)}`;
        await putContent(file, await readBase64(attFile), '공지 첨부파일 업로드');
        fileName = attFile.name;
      }
      hint($('postStatus'), '글 저장 중…', '');
      let next;
      if (editPostId) {
        // 수정: 제목/내용은 교체, 이미지·첨부는 새로 올린 경우에만 교체
        next = await mutateJson('assets/data/posts.json', (items) => items.map((p) => {
          if (p.id !== editPostId) return p;
          return {
            ...p, title, body,
            image: image || p.image,
            file: file || p.file,
            fileName: fileName || p.fileName,
            link: link, linkText: linkText,
          };
        }), '공지 글 수정');
        hint($('postStatus'), '글이 수정됐습니다! (반영까지 1~2분)', 'success');
      } else {
        const post = { id: 'p' + Date.now(), title, body, date: today(), image, file, fileName, link, linkText };
        next = await mutateJson('assets/data/posts.json', (items) => items.concat([post]), '공지 글 추가');
        hint($('postStatus'), '글이 등록됐습니다! (반영까지 1~2분)', 'success');
      }
      window.HK.renderPosts(next);
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
      const next = await mutateJson('assets/data/resources.json',
        (items) => items.concat([{ file: path, type: typeOfExt(ext), ext, title, desc }]), '홍보자료 추가');
      hint($('resStatus'), '자료가 추가됐습니다! (반영까지 1~2분)', 'success');
      window.HK.renderResources(next);
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
        const next = await mutateJson('assets/data/gallery.json', (items) => items.filter((it) => it.file !== id), '사진 삭제');
        await tryDeleteFile(id);
        window.HK.renderGallery(next);
      } else if (kind === 'post') {
        let target = null;
        const next = await mutateJson('assets/data/posts.json', (items) => {
          target = items.find((p) => p.id === id);
          return items.filter((p) => p.id !== id);
        }, '공지 삭제');
        if (target) { await tryDeleteFile(target.image); await tryDeleteFile(target.file); }
        window.HK.renderPosts(next);
      } else if (kind === 'resource') {
        const next = await mutateJson('assets/data/resources.json', (items) => items.filter((it) => it.file !== id), '홍보자료 삭제');
        await tryDeleteFile(id);
        window.HK.renderResources(next);
      }
    } catch (err) { alert('삭제 오류: ' + err.message); }
  });

  async function tryDeleteFile(path) {
    if (!path) return;
    try { const meta = await getContent(path); if (meta) await deleteContent(path, meta.sha, '파일 삭제: ' + path); } catch (e) { /* 무시 */ }
  }

  // ---------- 수정 (이벤트 위임) ----------
  let editGalleryId = null;
  let editResourceId = null;

  document.addEventListener('click', async (e) => {
    const ed = e.target.closest('.admin-edit');
    if (!ed || !document.body.classList.contains('admin-on')) return;
    e.preventDefault();
    const kind = ed.dataset.kind, id = ed.dataset.id;
    try {
      if (kind === 'gallery') {
        const { items } = await loadJson('assets/data/gallery.json');
        const it = items.find((x) => x.file === id);
        editGalleryId = id;
        $('galleryEditCaption').value = it ? (it.caption || '') : '';
        hint($('galleryEditStatus'), '', ''); openModal('galleryEditModal');
      } else if (kind === 'resource') {
        const { items } = await loadJson('assets/data/resources.json');
        const it = items.find((x) => x.file === id);
        editResourceId = id;
        $('resourceEditTitle').value = it ? (it.title || '') : '';
        $('resourceEditDesc').value = it ? (it.desc || '') : '';
        hint($('resourceEditStatus'), '', ''); openModal('resourceEditModal');
      } else if (kind === 'post') {
        const { items } = await loadJson('assets/data/posts.json');
        const p = items.find((x) => x.id === id);
        editPostId = id;
        $('postModalTitle').textContent = '공지·소식 글 수정';
        $('postSubmit').textContent = '수정 저장';
        $('postTitle').value = p ? p.title : '';
        $('postBody').value = p ? p.body : '';
        $('postImage').value = ''; $('postFile').value = '';
        $('postLink').value = p ? (p.link || '') : '';
        $('postLinkText').value = p ? (p.linkText || '') : '';
        hint($('postStatus'), p && (p.image || p.file) ? '이미지·첨부는 새로 선택할 때만 교체됩니다.' : '', '');
        openModal('postModal');
      }
    } catch (err) { alert('불러오기 오류: ' + err.message); }
  });

  // 갤러리 사진 설명 저장
  $('galleryEditSubmit') && $('galleryEditSubmit').addEventListener('click', async () => {
    if (!editGalleryId) return;
    const caption = $('galleryEditCaption').value.trim();
    const btn = $('galleryEditSubmit'); btn.disabled = true;
    try {
      const next = await mutateJson('assets/data/gallery.json',
        (items) => items.map((it) => (it.file === editGalleryId ? { ...it, caption } : it)), '사진 설명 수정');
      hint($('galleryEditStatus'), '저장됐습니다! (반영까지 1~2분)', 'success');
      window.HK.renderGallery(next);
    } catch (e) { hint($('galleryEditStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // 홍보자료 정보 저장
  $('resourceEditSubmit') && $('resourceEditSubmit').addEventListener('click', async () => {
    if (!editResourceId) return;
    const title = $('resourceEditTitle').value.trim();
    const desc = $('resourceEditDesc').value.trim();
    if (!title) { hint($('resourceEditStatus'), '제목을 입력해 주세요.', 'error'); return; }
    const btn = $('resourceEditSubmit'); btn.disabled = true;
    try {
      const next = await mutateJson('assets/data/resources.json',
        (items) => items.map((it) => (it.file === editResourceId ? { ...it, title, desc } : it)), '홍보자료 정보 수정');
      hint($('resourceEditStatus'), '저장됐습니다! (반영까지 1~2분)', 'success');
      window.HK.renderResources(next);
    } catch (e) { hint($('resourceEditStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // ---------- 투표 진행율 엑셀 업로드 ----------
  function nameKey(s) { return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }

  function loadXlsxLib() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = function () { resolve(window.XLSX); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function findCell(rows, label) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0]).trim() === label) return rows[i];
    }
    return null;
  }
  function findRate(rows) {
    // '투표자 수 기준' 행 중 숫자 값이 있는 행 (참여율 요약 표)
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r && String(r[0]).indexOf('투표자 수 기준') >= 0 && typeof r[1] === 'number') {
        return { rate: r[1], voted: Number(r[2]), total: Number(r[3]) };
      }
    }
    return null;
  }

  function parseAgendas(rows) {
    var hi = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0]).trim() === '안건순번') { hi = i; break; }
    }
    if (hi < 0) return [];
    var map = {}, order = [];
    for (var j = hi + 1; j < rows.length; j++) {
      var r = rows[j];
      if (!r) continue;
      var no = r[0], title = r[1], opt = r[2];
      if (no == null || opt == null || String(opt).trim() === '') continue;
      var key = String(no);
      if (!map[key]) { map[key] = { no: Number(no) || no, title: String(title || '').trim(), options: [] }; order.push(key); }
      map[key].options.push({
        label: String(opt).trim(),
        count: r[5] != null ? Number(r[5]) : null,   // 합계_명
        pct: r[6] != null ? Number(r[6]) : null,      // 투표자수기준_전체대비(%)
        areaPct: r[10] != null ? Number(r[10]) : null // 면적기준_전체대비(%)
      });
    }
    return order.map(function (k) { return map[k]; });
  }

  function parseReport(rows) {
    var nameRow = findCell(rows, '건물명');
    var titleRow = findCell(rows, '투표명');
    var updRow = findCell(rows, '엑셀 생성 일시 (KST)');
    var statusRow = findCell(rows, '상태');
    var rt = findRate(rows);
    if (!nameRow || !nameRow[1]) throw new Error("'건물명'을 찾지 못했습니다. (개요·집계 시트인지 확인)");
    if (!rt) throw new Error("'참여율 요약'을 찾지 못했습니다.");
    return {
      name: String(nameRow[1]).trim(),
      voteTitle: titleRow ? String(titleRow[1]).trim() : '',
      voted: rt.voted, total: rt.total, rate: Math.round(rt.rate * 10) / 10,
      status: statusRow ? String(statusRow[1]).trim() : '',
      updated: updRow ? String(updRow[1]).trim() : '',
      agendas: parseAgendas(rows),
    };
  }

  $('addProgressBtn') && $('addProgressBtn').addEventListener('click', function () {
    hint($('progressStatus'), '', ''); $('progressFile').value = '';
    openModal('progressModal'); renderProgressList();
  });

  $('progressFile') && $('progressFile').addEventListener('change', async function () {
    var file = this.files[0];
    if (!file) return;
    hint($('progressStatus'), '엑셀을 읽는 중…', '');
    try {
      var XLSX = await loadXlsxLib();
      var buf = await file.arrayBuffer();
      var wb = XLSX.read(buf, { type: 'array' });
      var ws = wb.Sheets['개요_및_집계'] || wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      var entry = parseReport(rows);
      hint($('progressStatus'), '"' + entry.name + '" 저장 중…', '');
      var next = await mutateJson('assets/data/progress.json', function (items) {
        var idx = items.findIndex(function (x) { return nameKey(x.name) === nameKey(entry.name); });
        if (idx >= 0) items[idx] = entry; else items.push(entry);
        return items;
      }, '진행율 갱신: ' + entry.name);
      hint($('progressStatus'), '완료! ' + entry.name + ' — ' + entry.voted + '/' + entry.total + '명 (' + entry.rate + '%) (반영까지 1~2분)', 'success');
      renderProgressList(next);
      if (window.HK.renderProgress) window.HK.renderProgress(next);
    } catch (e) {
      hint($('progressStatus'), '오류: ' + e.message, 'error');
    }
  });

  async function renderProgressList(list) {
    var box = $('progressList');
    if (!box) return;
    box.textContent = '불러오는 중…';
    try {
      if (!list) list = (await loadJson('assets/data/progress.json')).items;
      if (!list || list.length === 0) { box.textContent = '아직 등록된 진행율이 없습니다.'; return; }
      box.innerHTML = '';
      list.slice().reverse().forEach(function (it) {
        var row = document.createElement('div');
        row.className = 'admin-current-item';
        row.innerHTML = '<span><b>' + (it.name || '') + '</b> — ' + (it.voted != null ? it.voted + '/' + it.total + '명 ' : '') + '(' + (it.rate != null ? it.rate : '?') + '%)</span>';
        var del = document.createElement('button');
        del.className = 'btn btn-sm btn-outline'; del.textContent = '삭제';
        del.addEventListener('click', async function () {
          if (!confirm('"' + it.name + '" 진행율을 삭제할까요?')) return;
          try {
            var next = await mutateJson('assets/data/progress.json', function (items) { return items.filter(function (x) { return nameKey(x.name) !== nameKey(it.name); }); }, '진행율 삭제: ' + it.name);
            renderProgressList(next);
            if (window.HK.renderProgress) window.HK.renderProgress(next);
          } catch (e) { alert('삭제 오류: ' + e.message); }
        });
        row.appendChild(del);
        box.appendChild(row);
      });
    } catch (e) { box.textContent = '목록 오류: ' + e.message; }
  }

  // ---------- 투표 진행율 직접 수정 ----------
  function pesc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  let peEditingName = null;

  function peText(id, label, val) {
    return '<label class="pe-label">' + label + '<input id="' + id + '" type="text" value="' + pesc(val) + '" /></label>';
  }
  function peNum(id, label, val) {
    return '<label class="pe-label">' + label + '<input id="' + id + '" type="number" step="any" value="' + (val == null ? '' : val) + '" /></label>';
  }
  function peOptRow(o) {
    o = o || {};
    return '<div class="pe-opt">' +
      '<input class="pe-o-label" type="text" value="' + pesc(o.label || '') + '" placeholder="항목(찬성/반대/미투표)" />' +
      '<input class="pe-o-count" type="number" step="any" value="' + (o.count == null ? '' : o.count) + '" placeholder="명" />' +
      '<input class="pe-o-pct" type="number" step="any" value="' + (o.pct == null ? '' : o.pct) + '" placeholder="%" />' +
      '<button type="button" class="pe-o-del" title="항목 삭제">×</button>' +
      '</div>';
  }
  function peAgendaBlock(a) {
    a = a || {};
    var opts = (a.options || []).map(peOptRow).join('');
    return '<div class="pe-ag">' +
      '<div class="pe-ag-head"><input class="pe-ag-title" type="text" value="' + pesc(a.title || '') + '" placeholder="안건명" /><button type="button" class="pe-ag-del">삭제</button></div>' +
      '<div class="pe-opts">' + opts + '</div>' +
      '<button type="button" class="btn btn-sm btn-outline pe-add-opt">+ 항목</button>' +
      '</div>';
  }
  function buildProgressForm(it) {
    var h = '';
    h += peText('peName', '건물명', it.name || '');
    h += peText('peVoteTitle', '투표명', it.voteTitle || '');
    h += '<div class="pe-row">' + peNum('peVoted', '참여수(명)', it.voted) + peNum('peTotal', '전체수(명)', it.total) + '</div>';
    h += '<div class="pe-row">' + peText('peStatus', '상태', it.status || '') + peText('peUpdated', '기준시각', it.updated || '') + '</div>';
    h += '<div class="pe-section-label">안건별 집계</div>';
    h += '<div id="peAgendas">' + (it.agendas || []).map(peAgendaBlock).join('') + '</div>';
    h += '<button type="button" class="btn btn-sm btn-outline" id="peAddAgenda">+ 안건 추가</button>';
    $('progressEditForm').innerHTML = h;
  }

  async function openProgressEdit(name) {
    try {
      var data = await loadJson('assets/data/progress.json');
      var it = name ? (data.items.find(function (x) { return nameKey(x.name) === nameKey(name); }) || { name: name }) : { agendas: [] };
      peEditingName = name || null;
      buildProgressForm(it);
      hint($('progressEditStatus'), '', '');
      closeModal('progressDetail');
      openModal('progressEditModal');
    } catch (e) { alert('불러오기 오류: ' + e.message); }
  }

  // 세부 모달의 '수정' 버튼
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.js-prog-edit');
    if (!b || !document.body.classList.contains('admin-on')) return;
    openProgressEdit(b.dataset.name);
  });
  // 직접 입력(신규)
  $('addProgressManualBtn') && $('addProgressManualBtn').addEventListener('click', function () { openProgressEdit(null); });

  // 폼 내부 추가/삭제(이벤트 위임)
  $('progressEditForm') && $('progressEditForm').addEventListener('click', function (e) {
    if (e.target.closest('.pe-ag-del')) { e.target.closest('.pe-ag').remove(); return; }
    if (e.target.closest('.pe-o-del')) { e.target.closest('.pe-opt').remove(); return; }
    if (e.target.closest('.pe-add-opt')) { e.target.closest('.pe-ag').querySelector('.pe-opts').insertAdjacentHTML('beforeend', peOptRow({})); return; }
    if (e.target.id === 'peAddAgenda') {
      $('peAgendas').insertAdjacentHTML('beforeend', peAgendaBlock({ title: '', options: [{ label: '찬성' }, { label: '반대' }, { label: '미투표' }] }));
    }
  });

  $('progressEditSubmit') && $('progressEditSubmit').addEventListener('click', async function () {
    var name = $('peName').value.trim();
    if (!name) { hint($('progressEditStatus'), '건물명을 입력해 주세요.', 'error'); return; }
    var voted = $('peVoted').value !== '' ? Number($('peVoted').value) : null;
    var total = $('peTotal').value !== '' ? Number($('peTotal').value) : null;
    var entry = {
      name: name,
      voteTitle: $('peVoteTitle').value.trim(),
      voted: voted, total: total,
      rate: (total ? Math.round(voted / total * 1000) / 10 : null),
      status: $('peStatus').value.trim(),
      updated: $('peUpdated').value.trim(),
      agendas: [],
    };
    Array.prototype.forEach.call(document.querySelectorAll('#peAgendas .pe-ag'), function (ag, i) {
      var title = ag.querySelector('.pe-ag-title').value.trim();
      var options = [];
      Array.prototype.forEach.call(ag.querySelectorAll('.pe-opt'), function (row) {
        var label = row.querySelector('.pe-o-label').value.trim();
        if (!label) return;
        var c = row.querySelector('.pe-o-count').value;
        var p = row.querySelector('.pe-o-pct').value;
        options.push({ label: label, count: c !== '' ? Number(c) : null, pct: p !== '' ? Number(p) : null });
      });
      if (title || options.length) entry.agendas.push({ no: i + 1, title: title, options: options });
    });
    var btn = $('progressEditSubmit'); btn.disabled = true;
    try {
      var orig = peEditingName || entry.name;
      var next = await mutateJson('assets/data/progress.json', function (items) {
        var idx = items.findIndex(function (x) { return nameKey(x.name) === nameKey(orig); });
        if (idx >= 0) items[idx] = entry; else items.push(entry);
        return items;
      }, '진행율 수정: ' + entry.name);
      hint($('progressEditStatus'), '저장됐습니다! (반영까지 1~2분)', 'success');
      if (window.HK.renderProgress) window.HK.renderProgress(next);
    } catch (e) { hint($('progressEditStatus'), '오류: ' + e.message, 'error'); }
    finally { btn.disabled = false; }
  });
})();
