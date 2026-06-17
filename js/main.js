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

// ===== 갤러리 라이트박스 =====
(function () {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const closeBtn = document.getElementById('lightboxClose');
  if (!lightbox) return;

  document.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const caption = item.querySelector('figcaption');
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxCaption.textContent = caption ? caption.textContent : '';
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
    });
  });

  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
  }
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();

// ===== 홍보자료 미리보기 모달 =====
(function () {
  const previewer = document.getElementById('previewer');
  const stage = document.getElementById('previewerStage');
  const closeBtn = document.getElementById('previewerClose');
  const downloadBtn = document.getElementById('previewerDownload');
  if (!previewer) return;

  document.querySelectorAll('.resource-item .js-preview').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.resource-item');
      const file = item.getAttribute('data-file');
      const type = item.getAttribute('data-type') || 'image';
      const title = item.querySelector('h3') ? item.querySelector('h3').textContent : '';

      stage.innerHTML = '';
      if (type === 'pdf') {
        const frame = document.createElement('iframe');
        frame.src = file;
        frame.title = title;
        stage.appendChild(frame);
      } else {
        const img = document.createElement('img');
        img.src = file;
        img.alt = title;
        stage.appendChild(img);
      }

      downloadBtn.href = file;
      previewer.classList.add('open');
      previewer.setAttribute('aria-hidden', 'false');
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
