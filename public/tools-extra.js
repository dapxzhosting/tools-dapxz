/* =========================================================
   tools-extra.js | Tool tambahan (semua jalan di browser, tanpa server):
   1) Password Generator   2) Text Tools   3) Color Palette   4) Resize Image
   Dimuat SETELAH script.js (memakai setStatus dari sana).
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);

  function copyText(text, btn) {
    const done = () => {
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = 'Tersalin!';
      setTimeout(() => { btn.textContent = original; }, 1200);
    };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* abaikan */ }
      ta.remove();
      done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  // angka acak yang seragam (tanpa modulo bias)
  function randInt(max) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
  }

  /* ---------------------------------------------------------
     1) PASSWORD GENERATOR
     --------------------------------------------------------- */
  const PG_SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.?/',
  };
  const PG_AMBIGUOUS = /[0O1lI|`'"]/g;

  function pgStrength(entropy) {
    if (entropy < 40) return { text: 'Lemah', color: 'var(--danger)' };
    if (entropy < 60) return { text: 'Sedang', color: '#e6a23c' };
    if (entropy < 80) return { text: 'Kuat', color: 'var(--success)' };
    return { text: 'Sangat kuat', color: 'var(--success)' };
  }

  function pgGenerate() {
    const out = $('pg-output');
    if (!out) return;
    const len = Number($('pg-length').value);
    $('pg-len-label').textContent = String(len);

    const sets = [];
    ['upper', 'lower', 'digits', 'symbols'].forEach((k) => {
      if ($(`pg-${k}`).checked) {
        let s = PG_SETS[k];
        if ($('pg-ambig').checked) s = s.replace(PG_AMBIGUOUS, '');
        if (s) sets.push(s);
      }
    });

    const fill = $('pg-strength-fill');
    const label = $('pg-strength-text');
    if (!sets.length) {
      out.value = '';
      fill.style.width = '0%';
      label.textContent = '';
      setStatus('pg-status', 'Pilih minimal satu jenis karakter.', 'error');
      return;
    }
    setStatus('pg-status', '');

    const pool = sets.join('');
    const chars = sets.map((s) => s[randInt(s.length)]); // minimal 1 karakter dari tiap jenis
    while (chars.length < len) chars.push(pool[randInt(pool.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    out.value = chars.slice(0, len).join('');

    const entropy = len * Math.log2(pool.length);
    const st = pgStrength(entropy);
    fill.style.width = Math.min(100, (entropy / 100) * 100) + '%';
    fill.style.background = st.color;
    label.textContent = `${st.text} (${Math.round(entropy)} bit)`;
  }

  function initPassgen() {
    if (!$('panel-passgen')) return;
    $('pg-length').addEventListener('input', pgGenerate);
    ['upper', 'lower', 'digits', 'symbols', 'ambig'].forEach((k) => $(`pg-${k}`).addEventListener('change', pgGenerate));
    $('pg-regen').addEventListener('click', pgGenerate);
    $('pg-copy').addEventListener('click', (e) => {
      if ($('pg-output').value) copyText($('pg-output').value, e.currentTarget);
    });
    pgGenerate();
  }

  /* ---------------------------------------------------------
     2) TEXT TOOLS (penghitung + pengubah huruf)
     --------------------------------------------------------- */
  const perLine = (fn) => (t) => t.split('\n').map(fn).join('\n');
  const words = (line) => line.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const TT_ACTIONS = {
    upper: (t) => t.toUpperCase(),
    lower: (t) => t.toLowerCase(),
    title: (t) => t.toLowerCase().replace(/(^|[\s\-_(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
    sentence: (t) => t.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
    camel: perLine((l) => words(l).map((w, i) => {
      const lw = w.toLowerCase();
      return i === 0 ? lw : lw.charAt(0).toUpperCase() + lw.slice(1);
    }).join('')),
    snake: perLine((l) => words(l).map((w) => w.toLowerCase()).join('_')),
    kebab: perLine((l) => words(l).map((w) => w.toLowerCase()).join('-')),
    spaces: (t) => t.replace(/[ \t]+/g, ' ').replace(/^ +| +$/gm, ''),
    blank: (t) => t.split('\n').filter((l) => l.trim()).join('\n'),
    reverse: (t) => Array.from(t).reverse().join(''),
    sort: (t) => t.split('\n').sort((a, b) => a.localeCompare(b)).join('\n'),
    uniq: (t) => [...new Set(t.split('\n'))].join('\n'),
  };

  function ttUpdateStats() {
    const t = $('tt-input').value;
    const trimmed = t.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
    let sentences = 0;
    if (trimmed) sentences = (trimmed.match(/[^.!?]+[.!?]+/g) || []).length || 1;
    const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
    $('tt-chars').textContent = t.length.toLocaleString('id-ID');
    $('tt-chars-ns').textContent = t.replace(/\s/g, '').length.toLocaleString('id-ID');
    $('tt-words').textContent = wordCount.toLocaleString('id-ID');
    $('tt-sentences').textContent = sentences.toLocaleString('id-ID');
    $('tt-paragraphs').textContent = paragraphs.toLocaleString('id-ID');
    $('tt-read').textContent = wordCount ? `${Math.max(1, Math.ceil(wordCount / 200))} mnt` : '0 mnt';
  }

  function initTexttools() {
    if (!$('panel-texttools')) return;
    const input = $('tt-input');
    let previous = null;
    input.addEventListener('input', ttUpdateStats);

    $('panel-texttools').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tt]');
      if (!btn) return;
      const action = btn.dataset.tt;
      if (action === 'copy') {
        if (input.value) copyText(input.value, btn);
        return;
      }
      if (action === 'clear') {
        previous = input.value;
        input.value = '';
        ttUpdateStats();
        return;
      }
      if (action === 'undo') {
        if (previous !== null) {
          const now = input.value;
          input.value = previous;
          previous = now;
          ttUpdateStats();
        }
        return;
      }
      const fn = TT_ACTIONS[action];
      if (!fn || !input.value) return;
      previous = input.value;
      input.value = fn(input.value);
      ttUpdateStats();
    });
    ttUpdateStats();
  }

  /* ---------------------------------------------------------
     3) COLOR PALETTE GENERATOR
     --------------------------------------------------------- */
  const norm360 = (h) => ((h % 360) + 360) % 360;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function parseHex(input) {
    let h = String(input || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null;
  }
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexToHsl(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }
  function hslToHex(h, s, l) {
    h = norm360(h); s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  function textColorFor(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111827' : '#ffffff';
  }

  const HARMONIES = {
    complementary: (h, s, l) => [[h, s, l], [h + 180, s, l], [h, s, clamp(l + 25, 10, 92)], [h + 180, s, clamp(l - 25, 8, 90)], [h, s * 0.4, clamp(l + 40, 10, 95)]],
    analogous: (h, s, l) => [-60, -30, 0, 30, 60].map((d) => [h + d, s, l]),
    triadic: (h, s, l) => [[h, s, l], [h + 120, s, l], [h + 240, s, l], [h + 120, s, clamp(l + 20, 10, 92)], [h + 240, s, clamp(l + 20, 10, 92)]],
    tetradic: (h, s, l) => [0, 90, 180, 270].map((d) => [h + d, s, l]).concat([[h, s * 0.3, clamp(l + 35, 10, 95)]]),
    split: (h, s, l) => [[h, s, l], [h + 150, s, l], [h + 210, s, l], [h + 150, s, clamp(l + 22, 10, 92)], [h + 210, s, clamp(l - 22, 8, 90)]],
    mono: (h, s) => [20, 35, 50, 65, 80].map((l) => [h, s, l]),
    pastel: (h) => [0, 40, 80, 120, 160].map((d) => [h + d, 75, 86]),
  };

  let cgColors = [];

  function cgRender() {
    const base = parseHex($('cg-hex').value);
    if (!base) {
      setStatus('cg-status', 'Kode HEX tidak valid. Contoh: #5aa2ff', 'error');
      return;
    }
    setStatus('cg-status', '');
    $('cg-base').value = base;
    const [h, s, l] = hexToHsl(base);
    const kind = $('cg-harmony').value;
    cgColors = HARMONIES[kind](h, s, l).map(([hh, ss, ll]) => hslToHex(hh, ss, ll));

    $('cg-swatches').innerHTML = cgColors.map((c) => {
      const [r, g, b] = hexToRgb(c);
      return `<button type="button" class="swatch" data-hex="${c}" style="background:${c};color:${textColorFor(c)};" title="Klik untuk menyalin">`
        + `${c.toUpperCase()}<small>rgb(${r}, ${g}, ${b})</small></button>`;
    }).join('');
    cgUpdateGradient();
  }

  function cgUpdateGradient() {
    const angle = Number($('cg-angle').value);
    $('cg-angle-label').textContent = angle + '°';
    const css = `linear-gradient(${angle}deg, ${cgColors.join(', ')})`;
    $('cg-gradient').style.background = css;
    $('cg-css').value = `background: ${css};`;
  }

  function cgRandom() {
    $('cg-hex').value = hslToHex(randInt(360), 55 + randInt(35), 45 + randInt(20));
    cgRender();
  }

  function initColorgen() {
    if (!$('panel-colorgen')) return;
    $('cg-base').addEventListener('input', () => { $('cg-hex').value = $('cg-base').value; cgRender(); });
    $('cg-hex').addEventListener('input', () => { if (parseHex($('cg-hex').value)) cgRender(); });
    $('cg-harmony').addEventListener('change', cgRender);
    $('cg-angle').addEventListener('input', cgUpdateGradient);
    $('cg-random').addEventListener('click', cgRandom);
    $('cg-copy-all').addEventListener('click', (e) => copyText(cgColors.map((c) => c.toUpperCase()).join(', '), e.currentTarget));
    $('cg-copy-css').addEventListener('click', (e) => copyText($('cg-css').value, e.currentTarget));
    $('cg-swatches').addEventListener('click', (e) => {
      const sw = e.target.closest('[data-hex]');
      if (!sw) return;
      copyText(sw.dataset.hex.toUpperCase());
      setStatus('cg-status', `${sw.dataset.hex.toUpperCase()} tersalin.`, 'success');
    });
    cgRender();
  }

  /* ---------------------------------------------------------
     4) RESIZE IMAGE
     --------------------------------------------------------- */
  const IR_MAX_SIDE = 8000;
  const ir = { img: null, name: 'gambar', w: 0, h: 0, srcUrl: null, outUrl: null };

  const fmtBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  function irSyncFrom(which) {
    if (!ir.img || !$('ir-lock').checked) return;
    if (which === 'w') {
      const w = Number($('ir-w').value);
      if (w > 0) $('ir-h').value = Math.max(1, Math.round((w * ir.h) / ir.w));
    } else {
      const h = Number($('ir-h').value);
      if (h > 0) $('ir-w').value = Math.max(1, Math.round((h * ir.w) / ir.h));
    }
  }

  function irLoadFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('ir-status', 'File harus berupa gambar (PNG, JPG, WEBP, dll).', 'error');
      return;
    }
    if (ir.srcUrl) URL.revokeObjectURL(ir.srcUrl);
    ir.srcUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      ir.img = img;
      ir.w = img.naturalWidth;
      ir.h = img.naturalHeight;
      ir.name = file.name.replace(/\.[^.]+$/, '') || 'gambar';
      $('ir-file-label').textContent = file.name;
      $('ir-w').value = ir.w;
      $('ir-h').value = ir.h;
      $('ir-info').textContent = `Ukuran asli: ${ir.w} × ${ir.h} px · ${fmtBytes(file.size)}`;
      $('ir-options').style.display = '';
      $('ir-result').innerHTML = '';
      setStatus('ir-status', '');
    };
    img.onerror = () => setStatus('ir-status', 'Gambar tidak bisa dibaca. Coba file lain.', 'error');
    img.src = ir.srcUrl;
  }

  function irResize() {
    if (!ir.img) return;
    const w = Math.round(Number($('ir-w').value));
    const h = Math.round(Number($('ir-h').value));
    if (!(w > 0 && h > 0)) return setStatus('ir-status', 'Isi lebar dan tinggi dengan angka lebih dari 0.', 'error');
    if (w > IR_MAX_SIDE || h > IR_MAX_SIDE) return setStatus('ir-status', `Ukuran maksimal ${IR_MAX_SIDE} px per sisi.`, 'error');

    const type = $('ir-format').value;
    const quality = Number($('ir-quality').value) / 100;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ir.img, 0, 0, w, h);

    setStatus('ir-status', 'Memproses...');
    canvas.toBlob((blob) => {
      if (!blob) return setStatus('ir-status', 'Gagal membuat gambar. Coba ukuran lebih kecil atau format lain.', 'error');
      if (ir.outUrl) URL.revokeObjectURL(ir.outUrl);
      ir.outUrl = URL.createObjectURL(blob);
      const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      const filename = `${ir.name}-${w}x${h}.${ext}`;
      $('ir-result').innerHTML =
        `<img src="${ir.outUrl}" alt="Hasil resize" />`
        + `<div class="hint" style="margin:0 0 6px;">Hasil: ${w} × ${h} px · ${fmtBytes(blob.size)}</div>`
        + `<a class="action success" href="${ir.outUrl}" download="${filename}" style="margin-top:6px;">Download ${ext.toUpperCase()}</a>`;
      setStatus('ir-status', 'Selesai. Gambar siap didownload.', 'success');
    }, type, quality);
  }

  function initImgresize() {
    if (!$('panel-imgresize')) return;
    $('ir-file').addEventListener('change', (e) => irLoadFile(e.target.files[0]));
    $('ir-w').addEventListener('input', () => irSyncFrom('w'));
    $('ir-h').addEventListener('input', () => irSyncFrom('h'));
    $('ir-quality').addEventListener('input', () => { $('ir-quality-label').textContent = $('ir-quality').value + '%'; });
    $('ir-btn').addEventListener('click', irResize);
    $('ir-options').addEventListener('click', (e) => {
      const p = e.target.closest('[data-pct],[data-width]');
      if (!p || !ir.img) return;
      if (p.dataset.pct) {
        const f = Number(p.dataset.pct) / 100;
        $('ir-w').value = Math.max(1, Math.round(ir.w * f));
        $('ir-h').value = Math.max(1, Math.round(ir.h * f));
      } else {
        const w = Number(p.dataset.width);
        $('ir-w').value = w;
        $('ir-h').value = Math.max(1, Math.round((w * ir.h) / ir.w));
      }
    });
  }

  initPassgen();
  initTexttools();
  initColorgen();
  initImgresize();
})();
