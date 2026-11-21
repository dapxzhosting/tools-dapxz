/* =========================================================
   fontgen.js | Font Generator 100+ gaya (HURUF SAJA, tanpa emoji / hiasan)
   Dimuat SETELAH script.js (memakai helper fontgen* di sana).
   Fitur: filter kategori, favorit (disimpan di browser), contoh teks otomatis.
   ========================================================= */
(function () {
  const FAV_KEY = 'tools-dapxz-fontgen-favs';
  const SAMPLE = 'Tools Dapxz';

  // ---------- helper pembuat gaya ----------
  function strMap(text, upper, lower, digits) {
    const U = Array.from(upper || ''), L = Array.from(lower || ''), D = Array.from(digits || '');
    return Array.from(text).map((ch) => {
      if (ch >= 'A' && ch <= 'Z') return (U.length && U[ch.charCodeAt(0) - 65]) || ch;
      if (ch >= 'a' && ch <= 'z') return (L.length && L[ch.charCodeAt(0) - 97]) || ch;
      if (ch >= '0' && ch <= '9') return (D.length && D[ch.charCodeAt(0) - 48]) || ch;
      return ch;
    }).join('');
  }
  const cpRange = (base) => Array.from({ length: 26 }, (_, i) => String.fromCodePoint(base + i)).join('');
  const mark = (m) => (t) => Array.from(t).map((c) => (/\s/.test(c) ? c : c + m)).join('');
  const sep = (s) => (t) => t.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? w : Array.from(w).join(s))).join('');
  const wrap = (a, b) => (t) => a + t + b;
  const wrapWith = (font, a, b) => (t) => a + font(t) + b;
  const alt = (t) => {
    let n = 0;
    return Array.from(t).map((c) => (/\p{L}/u.test(c) ? (n++ % 2 ? c.toLowerCase() : c.toUpperCase()) : c)).join('');
  };
  const titleCase = (t) => t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

  // ---------- gaya huruf dasar (pakai helper di script.js) ----------
  const bold = (t) => fontgenOffsetMap(t, 0x1D400, 0x1D41A, 0x1D7CE);
  const italic = (t) => fontgenOffsetMap(t, 0x1D434, 0x1D44E, null, 'italic');
  const boldItalic = (t) => fontgenOffsetMap(t, 0x1D468, 0x1D482, null);
  const script = (t) => fontgenOffsetMap(t, 0x1D49C, 0x1D4B6, null, 'script');
  const boldScript = (t) => fontgenOffsetMap(t, 0x1D4D0, 0x1D4EA, null);
  const fraktur = (t) => fontgenOffsetMap(t, 0x1D504, 0x1D51E, null, 'fraktur');
  const boldFraktur = (t) => fontgenOffsetMap(t, 0x1D56C, 0x1D586, null);
  const doubleStruck = (t) => fontgenOffsetMap(t, 0x1D538, 0x1D552, 0x1D7D8, 'doublestruck');
  const sans = (t) => fontgenOffsetMap(t, 0x1D5A0, 0x1D5BA, 0x1D7E2);
  const sansBold = (t) => fontgenOffsetMap(t, 0x1D5D4, 0x1D5EE, 0x1D7EC);
  const sansItalic = (t) => fontgenOffsetMap(t, 0x1D608, 0x1D622, null);
  const sansBoldItalic = (t) => fontgenOffsetMap(t, 0x1D63C, 0x1D656, null);
  const mono = (t) => fontgenOffsetMap(t, 0x1D670, 0x1D68A, 0x1D7F6);

  // ---------- alfabet tambahan (semua 26 huruf, dicek saat uji) ----------
  const MAPS = {
    canadian: 'ᗩᗷᑕᗪEᖴGᕼIᒍKᒪᗰᑎOᑭᑫᖇᔕTᑌᐯᗯᕽYᘔ',
    japanese: 'ﾑ乃ᄃり乇ｷム卄丨ﾌҜㄥ爪几ㄖ卩Ɋ尺丂ㄒㄩᐯ山乂ㄚ乙',
    greek: 'ΛβCDΣFGΗIJKLMNΘPQЯSΤUVWXΨZ',
    cyrillic: 'ДБСDЄFGНІЈКLМИОPQЯЅТЦVШЖЧZ',
    accent: 'ÀßÇÐÈƑGĤÌJKĽMÑÖPQŖŞŤÛVŴXŸŹ',
    currency: ['₳', '฿', '₵', 'Đ', 'Ɇ', '₣', '₲', 'Ⱨ', 'ł', 'J', '₭', 'Ⱡ', '₥', '₦', 'Ø', '₱', 'Q', 'Ɽ', '₴', '₮', 'Ʉ', 'V', '₩', 'Ӿ', 'Ɏ', 'Ⱬ'].join(''),
    // huruf kecil
    aesthetic: 'αв¢∂єƒgнιנкℓмησρqяѕтυνωχуz',
    tiny: 'ǟɮƈɖɛʄɢɦɨʝӄʟʍռօքզʀֆȶʊʋաӼʏʐ',
    armenian: 'ąცƈɖҽƒցԋιʝƙʅɱղօρգɾʂƚυʋɯxყȥ',
    superU: 'ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾQᴿˢᵀᵁⱽᵂˣʸᶻ',
    superL: 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ',
    subL: 'ₐbcdₑfgₕᵢⱼₖₗₘₙₒₚqᵣₛₜᵤᵥwₓyz',
  };
  const PAREN = cpRange(0x249C);   // ⒜⒝⒞
  const NEG_SQ = cpRange(0x1F170); // 🅰🅱🅲
  const upperFont = (m) => (t) => strMap(t.toUpperCase(), m, m);
  const lowerFont = (m) => (t) => strMap(t.toLowerCase(), '', m);

  // ---------- daftar gaya ----------
  // cat: 'unik' (huruf) | 'garis' (huruf + garis/coret); cute: tampil di filter "Cute"
  const STYLES = [];
  const add = (label, cat, fn, cute) => STYLES.push({ label, cat, fn, cute: !!cute });

  // ===== Huruf Unik: alfabet Unicode =====
  add('Bold', 'unik', bold);
  add('Italic', 'unik', italic);
  add('Bold Italic', 'unik', boldItalic);
  add('Script', 'unik', script, true);
  add('Bold Script', 'unik', boldScript, true);
  add('Fraktur / Gothic', 'unik', fraktur);
  add('Bold Fraktur', 'unik', boldFraktur);
  add('Double-Struck', 'unik', doubleStruck, true);
  add('Sans-Serif', 'unik', sans);
  add('Sans-Serif Bold', 'unik', sansBold);
  add('Sans-Serif Italic', 'unik', sansItalic);
  add('Sans-Serif Bold Italic', 'unik', sansBoldItalic);
  add('Monospace', 'unik', mono);
  add('Fullwidth', 'unik', (t) => fontgenFullwidth(t));
  add('Bubble (Circled)', 'unik', (t) => fontgenCircled(t), true);
  add('Bubble Solid', 'unik', (t) => fontgenCircledNegative(t), true);
  add('Squared', 'unik', (t) => fontgenSquared(t));
  add('Squared Solid', 'unik', upperFont(NEG_SQ));
  add('Kurung ⒜⒝⒞', 'unik', lowerFont(PAREN), true);
  add('Small Caps', 'unik', (t) => fontgenSmallCaps(t), true);
  add('Upside Down', 'unik', (t) => fontgenUpsideDown(t));
  add('Superscript ᵗᵒᵒˡˢ', 'unik', (t) => strMap(t, MAPS.superU, MAPS.superL, '⁰¹²³⁴⁵⁶⁷⁸⁹'), true);
  add('Subscript ₜₒₒₗₛ', 'unik', (t) => strMap(t.toLowerCase(), '', MAPS.subL, '₀₁₂₃₄₅₆₇₈₉'));
  add('Canadian ᗩᗷᑕ', 'unik', upperFont(MAPS.canadian), true);
  add('Aesthetic αв¢∂', 'unik', lowerFont(MAPS.aesthetic), true);
  add('Tiny ǟɮƈ', 'unik', lowerFont(MAPS.tiny), true);
  add('Armenian ąცƈ', 'unik', lowerFont(MAPS.armenian), true);
  add('Japanese ﾑ乃ᄃ', 'unik', upperFont(MAPS.japanese));
  add('Greek ΛβC', 'unik', upperFont(MAPS.greek));
  add('Cyrillic ДБС', 'unik', upperFont(MAPS.cyrillic));
  add('Aksen ÀßÇ', 'unik', upperFont(MAPS.accent));
  add('Currency ₳฿₵', 'unik', upperFont(MAPS.currency));

  // ===== Huruf Unik: pengaturan huruf biasa =====
  add('Spasi Lebar', 'unik', (t) => Array.from(t).join(' '));
  add('HURUF BESAR', 'unik', (t) => t.toUpperCase());
  add('huruf kecil semua', 'unik', (t) => t.toLowerCase());
  add('Huruf Awal Besar', 'unik', titleCase);
  add('aLtErNaTiNg', 'unik', alt);

  // ===== Garis & Coret: huruf polos + 12 gaya huruf, masing-masing x 6 efek garis =====
  const LINES = [
    ['Coret', '\u0336'],
    ['Garis Bawah', '\u0332'],
    ['Garis Bawah Ganda', '\u0333'],
    ['Garis Atas', '\u0305'],
    ['Titik Bawah', '\u0323'],
    ['Garis Miring', '\u0338'],
  ];
  const LINE_BASES = [
    ['Bold', bold],
    ['Italic', italic],
    ['Bold Italic', boldItalic],
    ['Script', script],
    ['Bold Script', boldScript],
    ['Fraktur', fraktur],
    ['Double-Struck', doubleStruck],
    ['Sans Bold', sansBold],
    ['Monospace', mono],
    ['Small Caps', (t) => fontgenSmallCaps(t)],
    ['Fullwidth', (t) => fontgenFullwidth(t)],
    ['Aesthetic', lowerFont(MAPS.aesthetic)],
  ];
  LINES.forEach(([name, m]) => add(name, 'garis', mark(m)));
  LINE_BASES.forEach(([base, font]) => {
    LINES.forEach(([name, m]) => add(`${base} + ${name}`, 'garis', (t) => mark(m)(font(t))));
  });

  const FILTERS = [
    { id: 'all', label: 'Semua', test: () => true },
    { id: 'cute', label: 'Cute', test: (st) => st.cute },
    { id: 'unik', label: 'Huruf Unik', test: (st) => st.cat === 'unik' },
    { id: 'garis', label: 'Garis & Coret', test: (st) => st.cat === 'garis' },
  ];

  let filter = 'all';
  let visible = [];

  // ---------- favorit ----------
  function loadFavs() {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { return new Set(); }
  }
  function saveFavs(set) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...set])); } catch { /* abaikan */ }
  }

  // ---------- tampilan ----------
  function buildFilters() {
    const wrapEl = document.getElementById('fontgen-filters');
    if (!wrapEl) return;
    const favs = loadFavs();
    const favCount = STYLES.filter((st) => favs.has(st.label)).length;
    const all = FILTERS.map((f) => ({ id: f.id, label: f.label, n: STYLES.filter(f.test).length }))
      .concat([{ id: 'fav', label: '★ Favorit', n: favCount }]);
    wrapEl.innerHTML = all.map((f) => (
      `<button type="button" class="chip${f.id === filter ? ' active' : ''}" data-f="${f.id}">${f.label} (${f.n})</button>`
    )).join('');
    wrapEl.onclick = (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      filter = b.dataset.f;
      buildFilters();
      render();
    };
  }

  function render() {
    const container = document.getElementById('fontgen-results');
    if (!container) return;
    const input = document.getElementById('fontgen-input');
    const raw = input ? input.value : '';
    const isSample = !raw.trim();
    const text = isSample ? SAMPLE : raw;
    const favs = loadFavs();

    const f = FILTERS.find((x) => x.id === filter);
    visible = STYLES.filter((st) => (filter === 'fav' ? favs.has(st.label) : (f ? f.test(st) : true)));

    const info = document.getElementById('fontgen-count');
    if (info) {
      info.textContent = isSample
        ? `Contoh tampilan (${visible.length} gaya). Ketik teks di atas untuk mulai.`
        : `${visible.length} gaya tersedia. Klik "Salin" untuk memakainya.`;
    }

    if (!visible.length) {
      container.innerHTML = '<div class="hint">Belum ada favorit. Klik ☆ pada gaya yang kamu suka.</div>';
      return;
    }

    container.innerHTML = visible.map((style, idx) => {
      let output;
      try { output = style.fn(text); } catch { output = text; }
      const on = favs.has(style.label);
      return `
      <div class="fontgen-row">
        <div class="fontgen-row-text">
          <div class="hint" style="margin-bottom:2px;">${escapeHtml(style.label)}</div>
          <div class="fontgen-output" id="fontgen-output-${idx}">${escapeHtml(output)}</div>
        </div>
        <div class="fontgen-actions">
          <button type="button" class="fav-btn${on ? ' on' : ''}" title="${on ? 'Hapus dari favorit' : 'Simpan ke favorit'}" onclick="toggleFontGenFav(${idx}, this)">${on ? '★' : '☆'}</button>
          <button type="button" class="ghost fontgen-copy-btn" onclick="copyFontGenResult(${idx}, this)">Salin</button>
        </div>
      </div>`;
    }).join('');
  }

  function toggleFav(idx, btn) {
    const style = visible[idx];
    if (!style) return;
    const favs = loadFavs();
    if (favs.has(style.label)) favs.delete(style.label); else favs.add(style.label);
    saveFavs(favs);
    buildFilters();
    if (filter === 'fav') { render(); return; }
    if (btn) {
      const on = favs.has(style.label);
      btn.classList.toggle('on', on);
      btn.textContent = on ? '★' : '☆';
      btn.title = on ? 'Hapus dari favorit' : 'Simpan ke favorit';
    }
  }

  window.renderFontGenResults = render;
  window.toggleFontGenFav = toggleFav;
  window.FONTGEN_STYLES = STYLES;

  buildFilters();
  render();
})();
