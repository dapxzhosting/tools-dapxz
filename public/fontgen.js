/* =========================================================
   fontgen.js | Font Generator 100+ gaya (cute, huruf unik, efek, hiasan)
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

  const CANADIAN = 'ᗩᗷᑕᗪEᖴGᕼIᒍKᒪᗰᑎOᑭᑫᖇᔕTᑌᐯᗯᕽYᘔ';
  const AESTHETIC = 'αв¢∂єƒgнιנкℓмησρqяѕтυνωχуz';
  const SUPER_U = 'ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾQᴿˢᵀᵁⱽᵂˣʸᶻ';
  const SUPER_L = 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ';
  const SUB_L = 'ₐbcdₑfgₕᵢⱼₖₗₘₙₒₚqᵣₛₜᵤᵥwₓyz';
  const PAREN = cpRange(0x249C);   // ⒜⒝⒞
  const NEG_SQ = cpRange(0x1F170); // 🅰🅱🅲

  // [label, kategori, fungsi]
  const STYLES = [];
  const add = (label, cat, fn) => STYLES.push({ label, cat, fn });

  // ===== Huruf Unik =====
  add('Bold', 'unik', bold);
  add('Italic', 'unik', italic);
  add('Bold Italic', 'unik', boldItalic);
  add('Script', 'unik', script);
  add('Bold Script', 'unik', boldScript);
  add('Fraktur / Gothic', 'unik', fraktur);
  add('Bold Fraktur', 'unik', boldFraktur);
  add('Double-Struck', 'unik', doubleStruck);
  add('Sans-Serif', 'unik', sans);
  add('Sans-Serif Bold', 'unik', sansBold);
  add('Sans-Serif Italic', 'unik', sansItalic);
  add('Sans-Serif Bold Italic', 'unik', sansBoldItalic);
  add('Monospace', 'unik', mono);
  add('Fullwidth', 'unik', (t) => fontgenFullwidth(t));
  add('Bubble (Circled)', 'unik', (t) => fontgenCircled(t));
  add('Bubble Solid', 'unik', (t) => fontgenCircledNegative(t));
  add('Squared', 'unik', (t) => fontgenSquared(t));
  add('Squared Solid', 'unik', (t) => strMap(t.toUpperCase(), NEG_SQ, NEG_SQ));
  add('Small Caps', 'unik', (t) => fontgenSmallCaps(t));
  add('Upside Down', 'unik', (t) => fontgenUpsideDown(t));
  add('Superscript ᵗᵒᵒˡˢ', 'unik', (t) => strMap(t, SUPER_U, SUPER_L, '⁰¹²³⁴⁵⁶⁷⁸⁹'));
  add('Subscript ₜₒₒₗₛ', 'unik', (t) => strMap(t.toLowerCase(), '', SUB_L, '₀₁₂₃₄₅₆₇₈₉'));
  add('Canadian ᗩᗷᑕ', 'unik', (t) => strMap(t.toUpperCase(), CANADIAN, CANADIAN));
  add('Aesthetic αв¢∂', 'unik', (t) => strMap(t.toLowerCase(), '', AESTHETIC));
  add('Kurung ⒜⒝⒞', 'unik', (t) => strMap(t.toLowerCase(), '', PAREN));
  add('Spasi Lebar', 'unik', (t) => Array.from(t).join(' '));
  add('HURUF BESAR', 'unik', (t) => t.toUpperCase());
  add('huruf kecil semua', 'unik', (t) => t.toLowerCase());
  add('Huruf Awal Besar', 'unik', titleCase);
  add('aLtErNaTiNg', 'unik', alt);

  // ===== Efek garis / tanda =====
  add('Coret', 'efek', (t) => fontgenStrikethrough(t));
  add('Garis Bawah', 'efek', (t) => fontgenUnderline(t));
  add('Garis Bawah Ganda', 'efek', mark('\u0333'));
  add('Garis Atas', 'efek', mark('\u0305'));
  add('Garis Atas Ganda', 'efek', mark('\u033F'));
  add('Garis Miring', 'efek', mark('\u0338'));
  add('Coret Pendek', 'efek', mark('\u0335'));
  add('Coret Gelombang', 'efek', mark('\u0334'));
  add('Titik Bawah', 'efek', mark('\u0323'));
  add('Titik Atas', 'efek', mark('\u0307'));
  add('Cincin Atas', 'efek', mark('\u030A'));
  add('Umlaut', 'efek', mark('\u0308'));
  add('Tanda X Atas', 'efek', mark('\u033D'));
  add('Bintang Bawah', 'efek', mark('\u0359'));
  add('Gelombang Atas', 'efek', mark('\u0303'));
  add('Jembatan Bawah', 'efek', mark('\u032A'));

  // ===== Cute: pemisah antar huruf =====
  ['♡', '✿', '✧', '★', '☆', '⋆', '˚', '♪', '❀', '❥', '☾', '✦', '♥', '❁', '~', '·', '₊', '🌸', '💖', '✨']
    .forEach((s) => add(`Pemisah ${s}`, 'cute', sep(s)));

  // ===== Cute: dibungkus hiasan [label, awalan, akhiran] =====
  [
    ['Hati ♡', '♡ ', ' ♡'],
    ['Hati Dobel ♡♡', '♡♡ ', ' ♡♡'],
    ['Hati Penuh ♥', '♥ ', ' ♥'],
    ['Hati Pink 💗', '💗 ', ' 💗'],
    ['Panah Hati ❥', '❥ ', ' ❥'],
    ['Bunga ✿', '✿ ', ' ✿'],
    ['Kuntum ❀', '❀ ', ' ❀'],
    ['Sakura 🌸', '🌸 ', ' 🌸'],
    ['Tulip 🌷', '🌷 ', ' 🌷'],
    ['Sparkle ✨', '✨ ', ' ✨'],
    ['Bintang ✦', '✦ ', ' ✦'],
    ['Bintang Soft', '⋆｡°✩ ', ' ✩°｡⋆'],
    ['Bintang Anime', '☆*: .｡. ', ' .｡.:*☆'],
    ['Kawaii', '✧･ﾟ: *✧･ﾟ:* ', ' *:･ﾟ✧*:･ﾟ✧'],
    ['Kilau ･ﾟ✧', '･ﾟ✧ ', ' ✧ﾟ･'],
    ['Kilau ✧˖°', '✧˖° ', ' °˖✧'],
    ['Kilau ₊˚', '₊˚ ', ' ˚₊'],
    ['Bintang Malam', '⋆⁺₊⋆ ☾⋆⁺₊⋆ ', ' ⋆⁺₊⋆ ☽⋆⁺₊⋆'],
    ['Kupu-kupu 🦋', '🦋 ', ' 🦋'],
    ['Beruang ʕ•ᴥ•ʔ', 'ʕ•ᴥ•ʔ ', ' ʕ•ᴥ•ʔ'],
    ['Kucing ฅ^•ﻌ•^ฅ', 'ฅ^•ﻌ•^ฅ ', ' ฅ^•ﻌ•^ฅ'],
    ['Kucing 🐱', '🐱 ', ' 🐱'],
    ['Kelinci 🐰', '🐰 ', ' 🐰'],
    ['Panda 🐼', '🐼 ', ' 🐼'],
    ['Awan ☁', '☁ ', ' ☁'],
    ['Bulan ☾', '☾ ', ' ☽'],
    ['Bulan & Bintang', '☽ ✧ ', ' ✧ ☾'],
    ['Pelangi 🌈', '🌈 ', ' 🌈'],
    ['Stroberi 🍓', '🍓 ', ' 🍓'],
    ['Ceri 🍒', '🍒 ', ' 🍒'],
    ['Boba 🧋', '🧋 ', ' 🧋'],
    ['Donat 🍩', '🍩 ', ' 🍩'],
    ['Es Krim 🍦', '🍦 ', ' 🍦'],
    ['Pita 🎀', '🎀 ', ' 🎀'],
    ['Mahkota 👑', '👑 ', ' 👑'],
    ['Cinta ˗ˏˋ ♡ ˎˊ˗', '˗ˏˋ ♡ ˎˊ˗ ', ' ˗ˏˋ ♡ ˎˊ˗'],
    ['Not Musik ♪', '♪ ', ' ♪'],
    ['Musik ♫', '♫ ', ' ♫'],
    ['Tersenyum ☺', '☺ ', ' ☺'],
    ['Wajah ᵔᴥᵔ', 'ᵔᴥᵔ ', ' ᵔᴥᵔ'],
    ['Kaomoji Senang', '(｡♥‿♥｡) ', ' (｡♥‿♥｡)'],
    ['Kaomoji ٩(◕‿◕｡)۶', '٩(◕‿◕｡)۶ ', ' ٩(◕‿◕｡)۶'],
    ['Kaomoji Peluk', '( ˘ ³˘)♥ ', ' ♥(˘ ³˘ )'],
    ['Kaomoji ✧٩(ˊᗜˋ*)و✧', '✧٩(ˊᗜˋ*)و✧ ', ' ✧٩(ˊᗜˋ*)و✧'],
    ['Kaomoji (ᵔ◡ᵔ)', '(ᵔ◡ᵔ) ', ' (ᵔ◡ᵔ)'],
    ['UwU', 'UwU ', ' UwU'],
    ['OwO', 'OwO ', ' OwO'],
    ['Awalan Hati saja', '♡ ', ''],
    ['Akhiran Sparkle saja', '', ' ✧'],
    ['Awalan Bunga saja', '❀ ', ''],
  ].forEach(([label, a, b]) => add(label, 'cute', wrap(a, b)));

  // ===== Hiasan: kurung & garis =====
  [
    ['Kurung Jepang 「」', '「', '」'],
    ['Kurung Jepang Ganda 『』', '『', '』'],
    ['Kurung Tebal 【】', '【', '】'],
    ['Kurung Sudut ⟪⟫', '⟪ ', ' ⟫'],
    ['Kurung Kecil ₍₎', '₍ ', ' ₎'],
    ['Kurung Siku ⸢⸥', '⸢', '⸥'],
    ['Bintang Anime 彡', '★彡 ', ' 彡★'],
    ['Sayap ꧁༺༻꧂', '꧁༺ ', ' ༻꧂'],
    ['Garis Bintang', '──── ✦ ', ' ✦ ────'],
    ['Garis Hati', '—— ♡ ', ' ♡ ——'],
    ['Garis Titik', '･･･ ', ' ･･･'],
    ['Tilde ~', '~', '~'],
    ['Pagar ░', '░▒▓ ', ' ▓▒░'],
    ['Panah ➤', '➤ ', ' ◄'],
    ['Segitiga ▶◀', '▶ ', ' ◀'],
    ['Berlian ◆', '◆ ', ' ◆'],
    ['Kotak Titik ⁘', '⁘ ', ' ⁘'],
  ].forEach(([label, a, b]) => add(label, 'hiasan', wrap(a, b)));

  // ===== Cute: kombinasi huruf unik + hiasan =====
  [
    ['Bold Script + Bunga', boldScript, '✿ ', ' ✿'],
    ['Bold Script + Kawaii', boldScript, '✧･ﾟ: *✧･ﾟ:* ', ' *:･ﾟ✧*:･ﾟ✧'],
    ['Bold Script + Gelombang', boldScript, '~*', '*~'],
    ['Script + Hati', script, '♡ ', ' ♡'],
    ['Fullwidth + Sparkle', (t) => fontgenFullwidth(t), '✧ ', ' ✧'],
    ['Small Caps + Bulan', (t) => fontgenSmallCaps(t), '☾ ', ' ☽'],
    ['Sans Bold + Bintang', sansBold, '★ ', ' ★'],
    ['Italic + Not Musik', italic, '♪ ', ' ♪'],
    ['Double-Struck + Kuntum', doubleStruck, '❀ ', ' ❀'],
    ['Fraktur + Bulan', fraktur, '☾ ', ' ☽'],
    ['Monospace + Sparkle', mono, '✦ ', ' ✦'],
    ['Bubble + Hati', (t) => fontgenCircled(t), '♡', '♡'],
    ['Bubble Solid + Bintang', (t) => fontgenCircledNegative(t), '☆ ', ' ☆'],
    ['Bold + Pita', bold, '🎀 ', ' 🎀'],
    ['Sans + Sakura', sans, '🌸 ', ' 🌸'],
    ['Superscript + Hati', (t) => strMap(t, SUPER_U, SUPER_L, '⁰¹²³⁴⁵⁶⁷⁸⁹'), '♡ ', ' ♡'],
    ['Canadian + Kupu-kupu', (t) => strMap(t.toUpperCase(), CANADIAN, CANADIAN), '🦋 ', ' 🦋'],
    ['Aesthetic + Kilau', (t) => strMap(t.toLowerCase(), '', AESTHETIC), '₊˚ ', ' ˚₊'],
  ].forEach(([label, font, a, b]) => add(label, 'cute', wrapWith(font, a, b)));

  const FILTERS = [
    { id: 'all', label: 'Semua' },
    { id: 'cute', label: 'Cute ✿' },
    { id: 'unik', label: 'Huruf Unik' },
    { id: 'efek', label: 'Efek' },
    { id: 'hiasan', label: 'Hiasan' },
    { id: 'fav', label: '★ Favorit' },
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
    const favCount = loadFavs().size;
    wrapEl.innerHTML = FILTERS.map((f) => {
      const n = f.id === 'all' ? STYLES.length : f.id === 'fav' ? favCount : STYLES.filter((s) => s.cat === f.id).length;
      return `<button type="button" class="chip${f.id === filter ? ' active' : ''}" data-f="${f.id}">${f.label} (${n})</button>`;
    }).join('');
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

    visible = STYLES.filter((s) => filter === 'all' || (filter === 'fav' ? favs.has(s.label) : s.cat === filter));

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
