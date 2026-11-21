/* =========================================================
   home.js | logika halaman Beranda (file baru).
   script.js tidak diubah; file ini hanya menambah:
   - kartu tool otomatis dari menu sidebar
   - pencarian tool
   - navigasi ke/dari Beranda
   ========================================================= */
(function () {
  const TOOL_DESC = {
    yt: 'Video & Shorts, pilih kualitas',
    tiktok: 'Tanpa watermark, video atau MP3',
    instagram: 'Reel, post, dan foto carousel',
    twitter: 'Video dan foto dari tweet',
    capcut: 'Ambil video preview template',
    imgconv: 'PNG, JPG, WEBP, dan lainnya',
    imgcompress: 'Perkecil ukuran gambar',
    mp4tomp3: 'Ekstrak audio dari video',
    bgremove: 'Hapus background pakai AI',
    img2pdf: 'Gabung gambar jadi satu PDF',
    pdf2img: 'Setiap halaman jadi PNG',
    pdfcompress: 'Kecilkan ukuran file PDF',
    qrgen: 'QR kustom dengan logo',
    fontgen: '100+ gaya font aesthetic & cute',
    siggen: 'Tanda tangan digital PNG',
    endec: 'Base64, URL, Hex, dan lainnya',
    passgen: 'Password acak yang kuat & aman',
    colorgen: 'Palet warna serasi + gradient CSS',
    texttools: 'Hitung kata & ubah gaya huruf',
    imgresize: 'Ubah ukuran gambar (px)',
  };

  const GROUPS = [
    { nav: 'nav-downloader', title: 'Downloader' },
    { nav: 'nav-converter', title: 'Converter' },
    { nav: 'nav-generator', title: 'Generator' },
  ];

  const toolNavButtons = () =>
    document.querySelectorAll('#nav-downloader button, #nav-converter button, #nav-generator button');
  const mainEl = document.getElementById('main');
  const homeBtn = document.getElementById('nav-home-btn');

  function scrollTop() {
    if (mainEl) mainEl.scrollTo({ top: 0 });
  }

  function showHome() {
    toolNavButtons().forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    homeBtn?.classList.add('active');
    document.getElementById('panel-home')?.classList.add('active');
    if (typeof closeDrawer === 'function') closeDrawer();
    scrollTop();
  }

  function goToTool(id) {
    const btn = document.querySelector(
      `#nav-downloader button[data-id="${id}"], #nav-converter button[data-id="${id}"], #nav-generator button[data-id="${id}"]`
    );
    if (btn) btn.click();
  }

  // --- bangun kartu tool dari sidebar ---
  function buildHomeGroups() {
    const wrap = document.getElementById('home-groups');
    if (!wrap) return;
    wrap.innerHTML = '';

    GROUPS.forEach((g) => {
      const buttons = document.querySelectorAll(`#${g.nav} button`);
      if (!buttons.length) return;

      const group = document.createElement('div');
      group.className = 'tool-group';
      group.innerHTML = `<h4>${g.title}</h4><div class="tool-grid"></div>`;
      const grid = group.querySelector('.tool-grid');

      buttons.forEach((b) => {
        const id = b.dataset.id;
        const label = b.querySelector('.nav-label')?.textContent.trim() || id;
        const icon = b.querySelector('.nav-icon')?.innerHTML || '';
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'tool-card';
        card.dataset.go = id;
        card.dataset.search = `${label} ${TOOL_DESC[id] || ''}`.toLowerCase();
        card.innerHTML =
          `<span class="tool-ic">${icon}</span>` +
          `<span class="tool-txt"><strong></strong><small></small></span>`;
        card.querySelector('strong').textContent = label;
        card.querySelector('small').textContent = TOOL_DESC[id] || '';
        grid.appendChild(card);
      });

      wrap.appendChild(group);
    });
  }

  // --- pencarian ---
  function bindSearch() {
    const input = document.getElementById('home-search');
    const empty = document.getElementById('home-empty');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let total = 0;
      document.querySelectorAll('#home-groups .tool-group').forEach((group) => {
        let visible = 0;
        group.querySelectorAll('.tool-card').forEach((card) => {
          const show = !q || card.dataset.search.includes(q);
          card.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        group.style.display = visible ? '' : 'none';
        total += visible;
      });
      if (empty) empty.style.display = total ? 'none' : 'block';
    });
  }

  // --- klik: kartu, tombol hero, scroll ---
  function bindClicks() {
    document.getElementById('panel-home')?.addEventListener('click', (e) => {
      const goEl = e.target.closest('[data-go]');
      if (goEl) return goToTool(goEl.dataset.go);
      const scrollEl = e.target.closest('[data-scroll]');
      if (scrollEl) {
        document.getElementById(scrollEl.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    homeBtn?.addEventListener('click', showHome);

    // pindah ke tool lain: matikan state aktif Beranda & mulai dari atas
    toolNavButtons().forEach((b) =>
      b.addEventListener('click', () => {
        homeBtn?.classList.remove('active');
        scrollTop();
      })
    );

    // klik logo/brand di sidebar -> Beranda
    document.querySelector('#sidebar .brand-mark')?.addEventListener('click', showHome);
    document.querySelector('#sidebar .brand-text')?.addEventListener('click', showHome);
  }

  buildHomeGroups();
  bindSearch();
  bindClicks();
})();