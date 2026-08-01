document.querySelectorAll('#nav-downloader button, #nav-converter button, #nav-generator button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    document.querySelectorAll('#nav-downloader button, #nav-converter button, #nav-generator button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(`panel-${id}`);
    if (panel) panel.classList.add('active');
    closeDrawer();
  });
});

function closeDrawer() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('open');
  document.getElementById('mobile-menu-btn')?.classList.remove('is-hidden');
  document.body.classList.remove('drawer-open');
}
document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-backdrop')?.classList.add('open');
  document.getElementById('mobile-menu-btn')?.classList.add('is-hidden');
  document.body.classList.add('drawer-open');
});
document.getElementById('sidebar-backdrop')?.addEventListener('click', closeDrawer);

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tools-dev-theme', theme);
  const isDark = theme === 'dark';
  const knob = document.getElementById('theme-toggle-knob');
  const label = document.getElementById('theme-toggle-label');
  const mobileIcon = document.getElementById('mobile-theme-icon');
  if (knob) knob.textContent = isDark ? '🌙' : '☀️';
  if (label) label.textContent = isDark ? 'Mode Gelap' : 'Mode Terang';
  if (mobileIcon) mobileIcon.textContent = isDark ? '🌙' : '☀️';
}
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});
document.getElementById('mobile-theme-toggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});
applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

function toggleClearBtn(input) {
  const wrap = input.closest('.input-clear-wrap');
  const clearBtn = wrap?.querySelector('.input-clear-btn');
  if (clearBtn) clearBtn.style.display = input.value ? 'block' : 'none';
}
function clearInput(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.value = '';
  toggleClearBtn(input);
  input.focus();
}
async function pasteToInput(id) {
  const input = document.getElementById(id);
  if (!input) return;
  try {
    const text = await navigator.clipboard.readText();
    input.value = text;
    toggleClearBtn(input);
  } catch {
    input.focus();
  }
}
function handleEnterKey(event, callback) {
  if (event.key === 'Enter') {
    event.preventDefault();
    callback();
  }
}
function setStatus(id, message, type = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.className = 'hint' + (type ? ` hint-${type}` : '');
}
async function downloadResponseAsFile(resp, fallbackName) {
  const disposition = resp.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function checkSocial(platform) {
  const url = document.getElementById(`${platform}-url`)?.value.trim();
  const resultBox = document.getElementById(`${platform}-result`);
  const btn = document.getElementById(`${platform}-check-btn`);
  if (!url) return setStatus(`${platform}-status`, 'Masukkan link terlebih dahulu.', 'error');

  if (resultBox) resultBox.innerHTML = '';
  setStatus(`${platform}-status`, 'Mengambil info postingan...');
  if (btn) btn.disabled = true;

  try {
    const resp = await fetch('/api/social/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, platform }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Gagal mengambil info.');

    setStatus(`${platform}-status`, '');
    renderSocialResult(platform, url, data, resultBox);
  } catch (err) {
    setStatus(`${platform}-status`, err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderSocialResult(platform, url, data, container) {
  if (!container) return;
  const isPhotoOnly = data.content_type === 'image' || data.content_type === 'carousel';

  container.innerHTML = `
    <div class="result-card">
      ${data.thumbnail ? `<img src="${data.thumbnail}" alt="Thumbnail" class="result-thumb" />` : ''}
      <div class="result-info">
        <div class="result-title">${escapeHtml(data.title || 'Postingan')}</div>
        ${data.uploader ? `<div class="result-sub">${escapeHtml(data.uploader)}</div>` : ''}
        ${data.content_type ? `<div class="result-sub">Tipe: ${data.content_type}${data.image_count ? ` (${data.image_count} foto)` : ''}</div>` : ''}
      </div>
    </div>
    <div class="result-actions" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
      ${!isPhotoOnly ? `<button class="action" id="${platform}-dl-video">⬇ Download Video</button>` : ''}
      ${!isPhotoOnly ? `<button class="action" id="${platform}-dl-mp3" style="background:#28a745;">🎵 Download MP3</button>` : ''}
      ${isPhotoOnly ? `<button class="action" id="${platform}-dl-images">⬇ Download Semua Foto${data.image_count > 1 ? ` (${data.image_count})` : ''}</button>` : ''}
    </div>
    ${isPhotoOnly ? `<div id="${platform}-image-preview" style="margin-top:14px;"><div class="hint" style="color:var(--text-muted);">Memuat preview foto...</div></div>` : ''}
  `;

  document.getElementById(`${platform}-dl-video`)?.addEventListener('click', () => downloadSocialMedia(platform, url, 'video'));
  document.getElementById(`${platform}-dl-mp3`)?.addEventListener('click', () => downloadSocialMedia(platform, url, 'mp3'));
  document.getElementById(`${platform}-dl-images`)?.addEventListener('click', () => downloadSocialMediaAll(platform, url));

  if (isPhotoOnly) {
    fetchAndRenderImagePreviews(platform, url);
  }
}

async function fetchAndRenderImagePreviews(platform, url) {
  const previewContainer = document.getElementById(`${platform}-image-preview`);
  if (!previewContainer) return;

  try {
    const resp = await fetch('/api/social/download-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, platform }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Gagal memuat foto.');

    window[`${platform}_images_cache`] = data.images;

    if (!data.images || data.images.length === 0) {
      previewContainer.innerHTML = '<div class="hint hint-error">Tidak ada foto ditemukan.</div>';
      return;
    }

    const gridHTML = data.images.map((img, idx) => `
      <div class="img-item">
        <img src="data:${img.mime};base64,${img.data}" alt="Foto ${idx + 1}" loading="lazy" />
        <button class="dl-btn-individual" onclick="downloadSingleImage('${platform}', ${idx})" title="Download foto ${idx + 1}">
          ⬇ Foto ${idx + 1}
        </button>
      </div>
    `).join('');

    previewContainer.innerHTML = `
      <div class="social-image-grid">${gridHTML}</div>
    `;

    const dlAllBtn = document.getElementById(`${platform}-dl-images`);
    if (dlAllBtn) dlAllBtn.textContent = `⬇ Download Semua Foto (${data.images.length})`;

    setStatus(`${platform}-status`, `${data.images.length} foto siap didownload.`, 'success');
  } catch (err) {
    previewContainer.innerHTML = `<div class="hint hint-error">${escapeHtml(err.message)}</div>`;
    setStatus(`${platform}-status`, err.message, 'error');
  }
}

function downloadSingleImage(platform, idx) {
  const images = window[`${platform}_images_cache`];
  if (!images || !images[idx]) return;
  const img = images[idx];
  const a = document.createElement('a');
  a.href = `data:${img.mime};base64,${img.data}`;
  a.download = img.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadSocialMediaAll(platform, url) {
  const cached = window[`${platform}_images_cache`];
  if (cached && cached.length > 0) {
    cached.forEach((img) => {
      const a = document.createElement('a');
      a.href = `data:${img.mime};base64,${img.data}`;
      a.download = img.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    setStatus(`${platform}-status`, `Berhasil download ${cached.length} foto.`, 'success');
    return;
  }

  setStatus(`${platform}-status`, 'Mengunduh foto...');
  try {
    const resp = await fetch('/api/social/download-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, platform }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Gagal download.');
    data.images.forEach((img) => {
      const a = document.createElement('a');
      a.href = `data:${img.mime};base64,${img.data}`;
      a.download = img.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    setStatus(`${platform}-status`, `Berhasil download ${data.count} foto.`, 'success');
  } catch (err) {
    setStatus(`${platform}-status`, err.message, 'error');
  }
}

async function downloadSocialMedia(platform, url, kind) {
  setStatus(`${platform}-status`, kind === 'mp3' ? 'Mengonversi ke MP3...' : 'Menyiapkan download...');
  try {
    const endpoint = kind === 'mp3' ? '/api/social/download-mp3' : '/api/social/download';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, platform }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal download.');
    }
    await downloadResponseAsFile(resp, `${platform}-media.${kind === 'mp3' ? 'mp3' : 'mp4'}`);
    setStatus(`${platform}-status`, 'Download selesai.', 'success');
  } catch (err) {
    setStatus(`${platform}-status`, err.message, 'error');
  }
}

async function checkCapcut() {
  const url = document.getElementById('capcut-url')?.value.trim();
  const resultBox = document.getElementById('capcut-result');
  const btn = document.getElementById('capcut-check-btn');
  if (!url) return setStatus('capcut-status', 'Masukkan link template CapCut terlebih dahulu.', 'error');

  if (resultBox) resultBox.innerHTML = '';
  setStatus('capcut-status', 'Mengambil info template...');
  if (btn) btn.disabled = true;

  try {
    const resp = await fetch('/api/capcut/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Gagal mengambil info template.');

    setStatus('capcut-status', '');
    resultBox.innerHTML = `
      <div class="result-card">
        ${data.thumbnail ? `<img src="${data.thumbnail}" alt="Thumbnail" class="result-thumb" />` : ''}
        <div class="result-info">
          <div class="result-title">${escapeHtml(data.title || 'CapCut Template')}</div>
          ${data.author ? `<div class="result-sub">👤 ${escapeHtml(data.author)}</div>` : ''}
          ${data.description ? `<div class="result-sub">${escapeHtml(data.description)}</div>` : ''}
        </div>
      </div>
      <button class="action" id="capcut-dl-video" style="margin-top:12px;">⬇ Download Video</button>
    `;
    document.getElementById('capcut-dl-video')?.addEventListener('click', () => downloadCapcutVideo(url));
  } catch (err) {
    setStatus('capcut-status', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function downloadCapcutVideo(url) {
  setStatus('capcut-status', 'Menyiapkan download...');
  try {
    const resp = await fetch('/api/capcut/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal download.');
    }
    await downloadResponseAsFile(resp, 'capcut-template.mp4');
    setStatus('capcut-status', 'Download selesai.', 'success');
  } catch (err) {
    setStatus('capcut-status', err.message, 'error');
  }
}

function formatDuration(seconds) {
  const s = Math.floor(Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
function formatFilesize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

async function checkVideo() {
  const url = document.getElementById('yt-url')?.value.trim();
  const resultBox = document.getElementById('yt-result');
  const btn = document.getElementById('yt-check-btn');
  if (!url) return setStatus('yt-status', 'Masukkan link video YouTube terlebih dahulu.', 'error');

  if (resultBox) resultBox.innerHTML = '';
  setStatus('yt-status', 'Mengambil info video...');
  if (btn) btn.disabled = true;

  try {
    const resp = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Gagal mengambil info video.');

    setStatus('yt-status', '');
    renderYoutubeResult(url, data, resultBox);
  } catch (err) {
    setStatus('yt-status', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderYoutubeResult(url, data, container) {
  if (!container) return;

  const formats = Array.isArray(data.formats) ? data.formats : [];
  if (!formats.length) {
    container.innerHTML = '<p class="hint hint-error">Tidak ada format yang bisa didownload untuk video ini.</p>';
    return;
  }

  const formatOptions = formats.map((f, idx) => `
    <option value="${idx}">${escapeHtml(f.label)}${f.filesize ? ` — ${formatFilesize(f.filesize)}` : ''}</option>
  `).join('');

  container.innerHTML = `
    <div class="result-card">
      ${data.thumbnail ? `<img src="${data.thumbnail}" alt="Thumbnail" class="result-thumb" />` : ''}
      <div class="result-info">
        <div class="result-title">${escapeHtml(data.title || 'Video YouTube')}</div>
        ${data.author ? `<div class="result-sub">👤 ${escapeHtml(data.author)}</div>` : ''}
        ${data.duration ? `<div class="result-sub">⏱️ ${formatDuration(data.duration)}</div>` : ''}
      </div>
    </div>
    <div style="margin-top:12px;">
      <label>Pilih Format</label>
      <select id="yt-format">${formatOptions}</select>
    </div>
    <div class="result-actions" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
      <button class="action" id="yt-dl-video">⬇ Download</button>
    </div>
  `;

  document.getElementById('yt-dl-video')?.addEventListener('click', () => {
    const idx = Number(document.getElementById('yt-format')?.value || 0);
    const chosen = formats[idx];
    if (!chosen) return;
    downloadYoutubeVideo(url, chosen);
  });
}

function downloadYoutubeVideo(url, format) {
  setStatus('yt-status', 'Menyiapkan download (bisa agak lama untuk kualitas tinggi)...');
  const params = new URLSearchParams({
    url,
    formatId: format.id,
    hasAudio: String(!!format.hasAudio),
  });
  const a = document.createElement('a');
  a.href = `/api/download?${params.toString()}`;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus('yt-status', 'Download dimulai di tab baru.', 'success');
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
function canvasFromImage(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas;
}
function extExtFromMime(mime) {
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    'image/bmp': 'bmp', 'image/gif': 'gif', 'image/x-icon': 'ico', 'image/avif': 'avif',
  };
  return map[mime] || 'png';
}
function encodeManualFormat(canvas, mime) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height).data;

  if (mime === 'image/bmp') {
    const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    view.setUint16(0, 0x4d42, true);
    view.setUint32(2, fileSize, true);
    view.setUint32(10, 54, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(34, pixelArraySize, true);
    let offset = 54;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        view.setUint8(offset++, imgData[i + 2]);
        view.setUint8(offset++, imgData[i + 1]);
        view.setUint8(offset++, imgData[i]);
      }
      offset += rowSize - width * 3;
    }
    return new Blob([buffer], { type: 'image/bmp' });
  }

  if (mime === 'image/x-icon') {
    const pngDataUrl = canvas.toDataURL('image/png');
    const pngBytes = atob(pngDataUrl.split(',')[1]);
    const pngArr = new Uint8Array(pngBytes.length);
    for (let i = 0; i < pngBytes.length; i++) pngArr[i] = pngBytes.charCodeAt(i);
    const header = new ArrayBuffer(22);
    const hv = new DataView(header);
    hv.setUint16(0, 0, true);
    hv.setUint16(2, 1, true);
    hv.setUint16(4, 1, true);
    hv.setUint8(6, width >= 256 ? 0 : width);
    hv.setUint8(7, height >= 256 ? 0 : height);
    hv.setUint8(8, 0);
    hv.setUint8(9, 0);
    hv.setUint16(10, 1, true);
    hv.setUint16(12, 32, true);
    hv.setUint32(14, pngArr.length, true);
    hv.setUint32(18, 22, true);
    return new Blob([header, pngArr], { type: 'image/x-icon' });
  }

  return null;
}
async function convertCanvasToBlob(canvas, mime, quality) {
  if (mime === 'image/bmp' || mime === 'image/x-icon') {
    const manual = encodeManualFormat(canvas, mime);
    if (manual) return manual;
  }
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || null), mime === 'image/gif' ? 'image/png' : mime, quality);
  });
}

let imgConvFiles = [];
function handleImagePreview(event) {
  imgConvFiles = Array.from(event.target.files || []).slice(0, 10);
  const grid = document.getElementById('img-preview-grid');
  const label = document.getElementById('img-file-label');
  const btn = document.getElementById('img-convert-btn');
  if (grid) grid.innerHTML = '';
  if (!imgConvFiles.length) {
    if (label) label.textContent = 'Klik untuk pilih gambar (PNG / JPG / WEBP)';
    if (btn) btn.disabled = true;
    return;
  }
  if (label) label.textContent = `${imgConvFiles.length} gambar dipilih`;
  if (btn) btn.disabled = false;
  imgConvFiles.forEach((file) => {
    const url = URL.createObjectURL(file);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:4px; width:80px;';
    const thumb = document.createElement('img');
    thumb.src = url;
    thumb.alt = file.name;
    thumb.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;';
    const formatLabel = document.createElement('span');
    formatLabel.textContent = imageFormatLabel(file);
    formatLabel.style.cssText = 'font-size:11px; color:var(--text-muted, #9aa0a6); text-align:center; word-break:break-all;';
    wrap.appendChild(thumb);
    wrap.appendChild(formatLabel);
    grid.appendChild(wrap);
  });
}
function imageFormatLabel(file) {
  if (file.type) {
    const parts = file.type.split('/');
    if (parts[1]) return parts[1].toUpperCase();
  }
  const ext = file.name.split('.').pop();
  return ext ? ext.toUpperCase() : 'UNKNOWN';
}
async function convertImage() {
  if (!imgConvFiles.length) return;
  const mime = document.getElementById('img-format')?.value || 'image/png';
  const btn = document.getElementById('img-convert-btn');
  if (btn) btn.disabled = true;
  setStatus('img-status', 'Mengonversi gambar...');

  try {
    const results = [];
    for (const file of imgConvFiles) {
      const img = await loadImageFromFile(file);
      const canvas = canvasFromImage(img);
      const blob = await convertCanvasToBlob(canvas, mime, 0.92);
      if (!blob) throw new Error(`Gagal mengonversi ${file.name} (format tidak didukung browser ini).`);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      results.push({ blob, filename: `${baseName}.${extExtFromMime(mime)}` });
    }

    if (results.length === 1) {
      triggerBlobDownload(results[0].blob, results[0].filename);
    } else {
      const zip = new JSZip();
      results.forEach((r) => zip.file(r.filename, r.blob));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, 'converted-images.zip');
    }
    setStatus('img-status', 'Konversi selesai.', 'success');
  } catch (err) {
    setStatus('img-status', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

let imgCompressFiles = [];
function handleImgCompressPreview(event) {
  imgCompressFiles = Array.from(event.target.files || []).slice(0, 10);
  const grid = document.getElementById('imgc-preview-grid');
  const label = document.getElementById('imgc-file-label');
  const btn = document.getElementById('imgc-compress-btn');
  if (grid) grid.innerHTML = '';
  if (!imgCompressFiles.length) {
    if (label) label.textContent = 'Klik untuk pilih gambar (PNG / JPG / WEBP)';
    if (btn) btn.disabled = true;
    return;
  }
  if (label) label.textContent = `${imgCompressFiles.length} gambar dipilih`;
  if (btn) btn.disabled = false;
  imgCompressFiles.forEach((file) => {
    const url = URL.createObjectURL(file);
    const thumb = document.createElement('img');
    thumb.src = url;
    thumb.alt = file.name;
    thumb.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;';
    grid.appendChild(thumb);
  });
}
async function compressImages() {
  if (!imgCompressFiles.length) return;
  const mime = document.getElementById('imgc-format')?.value || 'image/jpeg';
  const quality = (Number(document.getElementById('imgc-quality')?.value) || 70) / 100;
  const btn = document.getElementById('imgc-compress-btn');
  if (btn) btn.disabled = true;
  setStatus('imgc-status', 'Mengompres gambar...');

  try {
    const results = [];
    let totalBefore = 0;
    let totalAfter = 0;
    for (const file of imgCompressFiles) {
      const img = await loadImageFromFile(file);
      const canvas = canvasFromImage(img);
      const blob = await convertCanvasToBlob(canvas, mime, quality);
      if (!blob) throw new Error(`Gagal mengompres ${file.name}.`);
      totalBefore += file.size;
      totalAfter += blob.size;
      const baseName = file.name.replace(/\.[^.]+$/, '');
      results.push({ blob, filename: `${baseName}-compressed.${extExtFromMime(mime)}` });
    }

    if (results.length === 1) {
      triggerBlobDownload(results[0].blob, results[0].filename);
    } else {
      const zip = new JSZip();
      results.forEach((r) => zip.file(r.filename, r.blob));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, 'compressed-images.zip');
    }
    const savedPct = totalBefore ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;
    setStatus('imgc-status', `Selesai. Ukuran berkurang ~${savedPct}%.`, 'success');
  } catch (err) {
    setStatus('imgc-status', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

let mp4SelectedFile = null;
function handleMp4Preview(event) {
  const file = event.target.files?.[0];
  const label = document.getElementById('mp4-file-label');
  const btn = document.getElementById('mp4-convert-btn');
  const thumbWrap = document.getElementById('mp4-thumb-wrap');
  const thumbImg = document.getElementById('mp4-thumb-img');
  mp4SelectedFile = file || null;

  if (!file) {
    if (label) label.textContent = 'Klik untuk pilih file video (MP4)';
    if (btn) btn.disabled = true;
    if (thumbWrap) thumbWrap.style.display = 'none';
    return;
  }
  if (label) label.textContent = file.name;
  if (btn) btn.disabled = false;

  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.addEventListener('loadeddata', () => {
    video.currentTime = Math.min(1, (video.duration || 1) / 2);
  });
  video.addEventListener('seeked', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    if (thumbImg) thumbImg.src = canvas.toDataURL('image/jpeg', 0.85);
    if (thumbWrap) thumbWrap.style.display = 'block';
    URL.revokeObjectURL(video.src);
  });
}
async function convertMp4ToMp3() {
  if (!mp4SelectedFile) return;
  const btn = document.getElementById('mp4-convert-btn');
  if (btn) btn.disabled = true;
  setStatus('mp4-status', 'Mengupload & mengekstrak audio (bisa agak lama)...');

  try {
    const formData = new FormData();
    formData.append('video', mp4SelectedFile);
    const resp = await fetch('/api/convert/mp4-to-mp3', { method: 'POST', body: formData });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal mengonversi video.');
    }
    await downloadResponseAsFile(resp, `${mp4SelectedFile.name.replace(/\.[^.]+$/, '')}.mp3`);
    setStatus('mp4-status', 'Konversi selesai.', 'success');
  } catch (err) {
    setStatus('mp4-status', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

let bgrSelectedFile = null;
let bgrRemovalModule = null;
function handleBgRemovePreview(event) {
  const file = event.target.files?.[0];
  const btn = document.getElementById('bgr-remove-btn');
  const compareWrap = document.getElementById('bgr-compare-wrap');
  const originalImg = document.getElementById('bgr-original-img');
  const resultImg = document.getElementById('bgr-result-img');
  const downloadBtn = document.getElementById('bgr-download-btn');
  bgrSelectedFile = file || null;

  if (!file) {
    if (btn) btn.disabled = true;
    if (compareWrap) compareWrap.style.display = 'none';
    return;
  }
  if (btn) btn.disabled = false;
  if (originalImg) originalImg.src = URL.createObjectURL(file);
  if (resultImg) { resultImg.style.display = 'none'; resultImg.src = ''; }
  if (downloadBtn) downloadBtn.style.display = 'none';
  if (compareWrap) compareWrap.style.display = 'block';
  setStatus('bgr-status', '');
}
async function removeImageBg() {
  if (!bgrSelectedFile) return;
  const btn = document.getElementById('bgr-remove-btn');
  const model = document.getElementById('bgr-model')?.value || 'small';
  const resultImg = document.getElementById('bgr-result-img');
  const downloadBtn = document.getElementById('bgr-download-btn');
  if (btn) btn.disabled = true;
  setStatus('bgr-status', 'Memuat model AI (pertama kali agak lama)...');

  try {
    if (!bgrRemovalModule) {
      bgrRemovalModule = await import('https://esm.sh/@imgly/background-removal@1.5.5');
    }
    setStatus('bgr-status', 'Menghapus background...');
    const resultBlob = await bgrRemovalModule.removeBackground(bgrSelectedFile, {
      model: model === 'medium' ? 'medium' : 'small',
    });
    const url = URL.createObjectURL(resultBlob);
    if (resultImg) { resultImg.src = url; resultImg.style.display = 'block'; }
    if (downloadBtn) {
      downloadBtn.href = url;
      downloadBtn.style.display = 'block';
    }
    setStatus('bgr-status', 'Selesai. Klik tombol download di bawah.', 'success');
  } catch (err) {
    setStatus('bgr-status', err.message || 'Gagal menghapus background.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

let i2pFiles = [];
function i2pRenderPreview() {
  const grid = document.getElementById('i2p-preview-grid');
  const countLabel = document.getElementById('i2p-count-label');
  const fileCount = document.getElementById('i2p-file-count');
  const previewSection = document.getElementById('i2p-preview-section');
  const actionBar = document.getElementById('i2p-action-bar');
  if (grid) grid.innerHTML = '';

  i2pFiles.forEach((file, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'preview-item';
    wrap.style.cssText = 'position:relative; width:100px; height:100px;';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:8px;';
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.style.cssText = 'position:absolute; top:-6px; right:-6px; width:22px; height:22px; border-radius:50%; border:none; background:#e5484d; color:#fff; cursor:pointer;';
    removeBtn.addEventListener('click', () => {
      i2pFiles.splice(idx, 1);
      i2pRenderPreview();
    });
    wrap.appendChild(img);
    wrap.appendChild(removeBtn);
    grid.appendChild(wrap);
  });

  if (countLabel) countLabel.textContent = `${i2pFiles.length} gambar dipilih`;
  if (fileCount) fileCount.textContent = String(i2pFiles.length);
  if (previewSection) previewSection.style.display = i2pFiles.length ? 'block' : 'none';
  if (actionBar) actionBar.style.display = i2pFiles.length ? 'flex' : 'none';
}
function i2pAddFiles(fileList) {
  const newFiles = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
  i2pFiles = i2pFiles.concat(newFiles);
  i2pRenderPreview();
}
let i2pPdfBlob = null;
function i2pClearAll() {
  i2pFiles = [];
  i2pPdfBlob = null;
  const dlBtn = document.getElementById('i2p-download-btn');
  if (dlBtn) dlBtn.style.display = 'none';
  i2pRenderPreview();
  setStatus('i2p-status', '');
}
(function initI2p() {
  const uploadArea = document.getElementById('i2p-upload-area');
  const input = document.getElementById('i2p-files');
  if (!uploadArea || !input) return;
  uploadArea.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => i2pAddFiles(e.target.files));
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    i2pAddFiles(e.dataTransfer.files);
  });
})();
async function imagesToPdf() {
  if (!i2pFiles.length) return;
  const btn = document.getElementById('i2p-btn');
  const progressWrap = document.getElementById('i2p-progress-wrap');
  const progressBar = document.getElementById('i2p-progress-bar');
  const progressLabel = document.getElementById('i2p-progress-label');
  const dlBtn = document.getElementById('i2p-download-btn');
  if (btn) btn.disabled = true;
  if (dlBtn) dlBtn.style.display = 'none';
  if (progressWrap) progressWrap.style.display = 'block';
  setStatus('i2p-status', '');

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'px' });
    for (let i = 0; i < i2pFiles.length; i++) {
      const img = await loadImageFromFile(i2pFiles[i]);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / img.naturalWidth, pageH / img.naturalHeight);
      const w = img.naturalWidth * ratio;
      const h = img.naturalHeight * ratio;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      if (i > 0) pdf.addPage();
      pdf.addImage(img, 'JPEG', x, y, w, h);
      if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / i2pFiles.length) * 100)}%`;
      if (progressLabel) progressLabel.textContent = `Memproses gambar ${i + 1}/${i2pFiles.length}...`;
    }
    i2pPdfBlob = pdf.output('blob');
    if (dlBtn) dlBtn.style.display = 'inline-block';
    setStatus('i2p-status', 'PDF siap. Klik "Download PDF" untuk menyimpan.', 'success');
  } catch (err) {
    setStatus('i2p-status', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (progressWrap) progressWrap.style.display = 'none';
  }
}
function downloadI2pPdf() {
  if (!i2pPdfBlob) return;
  const rawName = window.prompt('Nama file PDF:', 'gambar-gabungan');
  if (rawName === null) return;
  const safeName = rawName.replace(/[\\/:*?"<>|]/g, '').trim() || 'gambar-gabungan';
  triggerBlobDownload(i2pPdfBlob, `${safeName}.pdf`);
  setStatus('i2p-status', 'PDF terdownload.', 'success');
}

let pdfcSelectedFile = null;
let pdfcCompressedBlob = null;

const PDFC_LEVELS = {
  ringan: { scale: 2.0, quality: 0.85 },
  sedang: { scale: 1.5, quality: 0.7 },
  kuat: { scale: 1.0, quality: 0.5 },
};

function handlePdfCompressPreview(event) {
  const file = event.target.files?.[0];
  const label = document.getElementById('pdfc-label');
  const btn = document.getElementById('pdfc-btn');
  const resultWrap = document.getElementById('pdfc-result-wrap');
  pdfcSelectedFile = file || null;
  pdfcCompressedBlob = null;
  if (resultWrap) resultWrap.style.display = 'none';
  if (label) label.textContent = file ? file.name : 'Klik untuk pilih file PDF';
  if (btn) btn.disabled = !file;
  setStatus('pdfc-status', '');
}

function formatFileSizeReadable(bytes) {
  if (!bytes && bytes !== 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

async function compressPdf() {
  if (!pdfcSelectedFile) return;
  const btn = document.getElementById('pdfc-btn');
  const resultWrap = document.getElementById('pdfc-result-wrap');
  const levelKey = document.getElementById('pdfc-level')?.value || 'sedang';
  const level = PDFC_LEVELS[levelKey];
  if (btn) btn.disabled = true;
  if (resultWrap) resultWrap.style.display = 'none';
  pdfcCompressedBlob = null;
  setStatus('pdfc-status', 'Memproses PDF...');

  try {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const arrayBuffer = await pdfcSelectedFile.arrayBuffer();
    const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const { jsPDF } = window.jspdf;
    let outputPdf = null;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      setStatus('pdfc-status', `Mengompres halaman ${pageNum}/${pdfDoc.numPages}...`);
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: level.scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const jpegDataUrl = canvas.toDataURL('image/jpeg', level.quality);

      const baseViewport = page.getViewport({ scale: 1 });
      const pageWmm = (baseViewport.width / 72) * 25.4;
      const pageHmm = (baseViewport.height / 72) * 25.4;
      const orientation = pageWmm > pageHmm ? 'l' : 'p';

      if (!outputPdf) {
        outputPdf = new jsPDF({ unit: 'mm', format: [pageWmm, pageHmm], orientation });
      } else {
        outputPdf.addPage([pageWmm, pageHmm], orientation);
      }
      outputPdf.addImage(jpegDataUrl, 'JPEG', 0, 0, pageWmm, pageHmm);
    }

    pdfcCompressedBlob = outputPdf.output('blob');

    const beforeEl = document.getElementById('pdfc-size-before');
    const afterEl = document.getElementById('pdfc-size-after');
    const warnEl = document.getElementById('pdfc-warning');
    const downloadBtn = document.getElementById('pdfc-download-btn');
    const beforeSize = pdfcSelectedFile.size;
    const afterSize = pdfcCompressedBlob.size;
    const savedPct = beforeSize ? Math.round((1 - afterSize / beforeSize) * 100) : 0;
    const isBigger = afterSize >= beforeSize;

    if (beforeEl) beforeEl.textContent = `Ukuran asli: ${formatFileSizeReadable(beforeSize)}`;
    if (afterEl) afterEl.textContent = `Ukuran setelah kompres: ${formatFileSizeReadable(afterSize)} (${savedPct >= 0 ? '-' : '+'}${Math.abs(savedPct)}%)`;

    if (warnEl) {
      warnEl.style.display = isBigger ? 'block' : 'none';
      warnEl.textContent = isBigger
        ? '⚠️ Hasil kompresi malah lebih besar dari aslinya. Ini biasa terjadi kalau PDF kamu isinya teks asli (bukan hasil scan/foto) — teks vector emang udah ringan dari sononya, jadi gak perlu dikompres. Disarankan pakai file PDF yang asli aja.'
        : '';
    }
    if (downloadBtn) downloadBtn.style.background = isBigger ? '#e5484d' : '#28a745';

    if (resultWrap) resultWrap.style.display = 'block';
    setStatus('pdfc-status', 'Kompresi selesai.', isBigger ? 'error' : 'success');
  } catch (err) {
    setStatus('pdfc-status', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function downloadCompressedPdf() {
  if (!pdfcCompressedBlob) return;
  const defaultName = pdfcSelectedFile ? pdfcSelectedFile.name.replace(/\.[^.]+$/, '') + '-compressed' : 'compressed';
  const rawName = window.prompt('Nama file PDF:', defaultName);
  if (rawName === null) return;
  const safeName = rawName.replace(/[\\/:*?"<>|]/g, '').trim() || defaultName;
  triggerBlobDownload(pdfcCompressedBlob, `${safeName}.pdf`);
  setStatus('pdfc-status', 'PDF terdownload.', 'success');
}

let p2iSelectedFile = null;
let p2iImages = [];
function handleP2IPreview(event) {
  const file = event.target.files?.[0];
  const label = document.getElementById('p2i-label');
  const btn = document.getElementById('p2i-btn');
  const previewSection = document.getElementById('p2i-preview-section');
  const grid = document.getElementById('p2i-preview-grid');
  p2iSelectedFile = file || null;
  p2iImages = [];
  if (grid) grid.innerHTML = '';
  if (previewSection) previewSection.style.display = 'none';
  if (label) label.textContent = file ? file.name : 'Klik untuk pilih file PDF';
  if (btn) btn.disabled = !file;
  setStatus('p2i-status', '');
}
async function pdfToImages() {
  if (!p2iSelectedFile) return;
  const btn = document.getElementById('p2i-btn');
  const grid = document.getElementById('p2i-preview-grid');
  const previewSection = document.getElementById('p2i-preview-section');
  const countLabel = document.getElementById('p2i-count-label');
  if (btn) btn.disabled = true;
  if (grid) grid.innerHTML = '';
  if (previewSection) previewSection.style.display = 'none';
  p2iImages = [];
  setStatus('p2i-status', 'Memproses PDF...');

  try {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const arrayBuffer = await p2iSelectedFile.arrayBuffer();
    const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const baseName = p2iSelectedFile.name.replace(/\.[^.]+$/, '');

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      setStatus('p2i-status', `Merender halaman ${pageNum}/${pdfDoc.numPages}...`);
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const filename = `${baseName}-halaman-${String(pageNum).padStart(2, '0')}.png`;
      p2iImages.push({ blob, filename });

      if (grid) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:6px; width:120px;';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        img.alt = filename;
        img.style.cssText = 'width:120px; height:150px; object-fit:cover; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,.25);';
        const label = document.createElement('span');
        label.textContent = `Halaman ${pageNum}`;
        label.style.cssText = 'font-size:11px; color:var(--text-muted, #9aa0a6);';
        const dlBtn = document.createElement('button');
        dlBtn.className = 'ghost';
        dlBtn.textContent = '⬇ Download';
        dlBtn.style.cssText = 'font-size:12px; padding:5px 10px;';
        dlBtn.addEventListener('click', () => triggerBlobDownload(blob, filename));
        wrap.appendChild(img);
        wrap.appendChild(label);
        wrap.appendChild(dlBtn);
        grid.appendChild(wrap);
      }
    }

    if (countLabel) countLabel.textContent = `${p2iImages.length} halaman`;
    if (previewSection) previewSection.style.display = 'block';
    setStatus('p2i-status', 'Selesai. Download satu-satu atau semua sekaligus.', 'success');
  } catch (err) {
    setStatus('p2i-status', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function downloadAllP2iImages() {
  if (!p2iImages.length) return;
  setStatus('p2i-status', 'Menyiapkan ZIP...');
  try {
    const zip = new JSZip();
    p2iImages.forEach((item) => zip.file(item.filename, item.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const baseName = p2iSelectedFile ? p2iSelectedFile.name.replace(/\.[^.]+$/, '') : 'pdf-images';
    triggerBlobDownload(zipBlob, `${baseName}-images.zip`);
    setStatus('p2i-status', 'ZIP terdownload.', 'success');
  } catch (err) {
    setStatus('p2i-status', err.message, 'error');
  }
}
let qrInstance = null;
const QR_DOWNLOAD_SIZE = 900;
const QR_PREVIEW_SIZE = 300;
let qrDebounceTimer = null;
let qrLogoDataUrl = null;

function handleQrInput() {
  clearTimeout(qrDebounceTimer);
  qrDebounceTimer = setTimeout(renderQrPreview, 300);
}

function toggleQrColorMode() {
  const mode = document.getElementById('qr-color-mode')?.value;
  const gradWrap = document.getElementById('qr-fg-color2-wrap');
  const fgLabel = document.getElementById('qr-fg-color-label');
  if (gradWrap) gradWrap.style.display = mode === 'gradient' ? 'block' : 'none';
  if (fgLabel) fgLabel.textContent = mode === 'gradient' ? 'Warna QR (Gradient dari)' : 'Warna QR';
}

function handleQrLogoChange(event) {
  const file = event.target.files?.[0];
  const label = document.getElementById('qr-logo-label');
  const clearBtn = document.getElementById('qr-logo-clear-btn');
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    qrLogoDataUrl = reader.result;
    if (label) label.textContent = file.name;
    if (clearBtn) clearBtn.style.display = 'inline-block';
    renderQrPreview();
  };
  reader.readAsDataURL(file);
}
function clearQrLogo() {
  qrLogoDataUrl = null;
  const input = document.getElementById('qr-logo-file');
  const label = document.getElementById('qr-logo-label');
  const clearBtn = document.getElementById('qr-logo-clear-btn');
  if (input) input.value = '';
  if (label) label.textContent = 'Klik untuk pilih logo (PNG/JPG, background transparan disarankan)';
  if (clearBtn) clearBtn.style.display = 'none';
  renderQrPreview();
}

function buildQrOptions(overrideSize) {
  const text = document.getElementById('qr-text')?.value.trim();
  const size = overrideSize || QR_PREVIEW_SIZE;
  const dotsType = document.getElementById('qr-dots-type')?.value || 'rounded';
  const cornerSquareType = document.getElementById('qr-corner-square-type')?.value || 'extra-rounded';
  const cornerDotType = document.getElementById('qr-corner-dot-type')?.value || 'dot';
  const colorMode = document.getElementById('qr-color-mode')?.value || 'solid';
  const fgColor = document.getElementById('qr-fg-color')?.value || '#4f46e5';
  const fgColor2 = document.getElementById('qr-fg-color2')?.value || '#9333ea';
  const bgColor = document.getElementById('qr-bg-color')?.value || '#ffffff';

  const dotsOptions = colorMode === 'gradient'
    ? { type: dotsType, gradient: { type: 'linear', rotation: 0.78, colorStops: [{ offset: 0, color: fgColor }, { offset: 1, color: fgColor2 }] } }
    : { type: dotsType, color: fgColor };

  return {
    width: size,
    height: size,
    type: 'svg',
    data: text,
    margin: 8,
    qrOptions: { errorCorrectionLevel: qrLogoDataUrl ? 'H' : 'Q' },
    dotsOptions,
    cornersSquareOptions: { type: cornerSquareType, color: fgColor },
    cornersDotOptions: { type: cornerDotType, color: fgColor },
    backgroundOptions: { color: bgColor },
    image: qrLogoDataUrl || undefined,
    imageOptions: { crossOrigin: 'anonymous', margin: 6, imageSize: 0.4 },
    _bgColor: bgColor,
  };
}

function renderQrPreview() {
  const text = document.getElementById('qr-text')?.value.trim();
  const previewWrap = document.getElementById('qr-preview-wrap');
  const container = document.getElementById('qr-canvas-container');
  if (!container) return;

  if (!text) {
    if (previewWrap) previewWrap.style.display = 'none';
    setStatus('qr-status', '');
    return;
  }

  container.innerHTML = '';
  try {
    const options = buildQrOptions();
    const { _bgColor, ...qrOptions } = options;
    qrInstance = new QRCodeStyling(qrOptions);
    container.style.background = _bgColor;
    qrInstance.append(container);
    if (previewWrap) previewWrap.style.display = 'block';
    setStatus('qr-status', '');
  } catch (err) {
    setStatus('qr-status', 'Gagal membuat QR Code: ' + err.message, 'error');
  }
}

function downloadQrCode(extension) {
  const text = document.getElementById('qr-text')?.value.trim();
  if (!text) return setStatus('qr-status', 'QR Code belum siap.', 'error');
  const safeName = `qrcodedap_${Math.floor(1000000 + Math.random() * 9000000)}`;

  const options = buildQrOptions(QR_DOWNLOAD_SIZE);
  const { _bgColor, ...qrOptions } = options;
  const downloadInstance = new QRCodeStyling(qrOptions);
  downloadInstance.download({ name: safeName, extension: extension || 'png' });
  setStatus('qr-status', `QR Code terdownload (${QR_DOWNLOAD_SIZE}px).`, 'success');
}

const FONTGEN_EXCEPTIONS = {
  italic: { upper: {}, lower: { h: 'ℎ' } },
  script: { upper: { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ' }, lower: { e: 'ℯ', g: 'ℊ', o: 'ℴ' } },
  fraktur: { upper: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }, lower: {} },
  doublestruck: { upper: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }, lower: {} },
};

function fontgenOffsetMap(text, upperBase, lowerBase, digitBase, exceptionKey) {
  const ex = exceptionKey ? FONTGEN_EXCEPTIONS[exceptionKey] : null;
  return Array.from(text).map((ch) => {
    if (ch >= 'A' && ch <= 'Z') {
      if (ex && ex.upper[ch]) return ex.upper[ch];
      if (upperBase == null) return ch;
      return String.fromCodePoint(upperBase + (ch.charCodeAt(0) - 65));
    }
    if (ch >= 'a' && ch <= 'z') {
      if (ex && ex.lower[ch]) return ex.lower[ch];
      if (lowerBase == null) return ch;
      return String.fromCodePoint(lowerBase + (ch.charCodeAt(0) - 97));
    }
    if (ch >= '0' && ch <= '9') {
      if (digitBase == null) return ch;
      return String.fromCodePoint(digitBase + (ch.charCodeAt(0) - 48));
    }
    return ch;
  }).join('');
}

function fontgenFullwidth(text) {
  return Array.from(text).map((ch) => {
    if (ch === ' ') return '\u3000';
    if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(0xFF21 + (ch.charCodeAt(0) - 65));
    if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(0xFF41 + (ch.charCodeAt(0) - 97));
    if (ch >= '0' && ch <= '9') return String.fromCodePoint(0xFF10 + (ch.charCodeAt(0) - 48));
    return ch;
  }).join('');
}

function fontgenCircled(text) {
  return Array.from(text).map((ch) => {
    if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(0x24B6 + (ch.charCodeAt(0) - 65));
    if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(0x24D0 + (ch.charCodeAt(0) - 97));
    if (ch === '0') return '\u24EA';
    if (ch >= '1' && ch <= '9') return String.fromCodePoint(0x2460 + (ch.charCodeAt(0) - 49));
    return ch;
  }).join('');
}

function fontgenCircledNegative(text) {
  return Array.from(text).map((ch) => {
    if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(0x1F150 + (ch.charCodeAt(0) - 65));
    if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(0x1F150 + (ch.charCodeAt(0) - 97));
    return ch;
  }).join('');
}

function fontgenSquared(text) {
  return Array.from(text).map((ch) => {
    if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(0x1F130 + (ch.charCodeAt(0) - 65));
    if (ch >= 'a' && ch <= 'z') return String.fromCodePoint(0x1F130 + (ch.charCodeAt(0) - 97));
    return ch;
  }).join('');
}

const FONTGEN_SMALLCAPS_MAP = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};
function fontgenSmallCaps(text) {
  return Array.from(text).map((ch) => FONTGEN_SMALLCAPS_MAP[ch.toLowerCase()] || ch).join('');
}

const FONTGEN_UPSIDEDOWN_MAP = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ',
  k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ',
  u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: 'ɐ', B: 'q', C: 'ɔ', D: 'p', E: 'ǝ', F: 'ɟ', G: 'ƃ', H: 'ɥ', I: 'ᴉ', J: 'ɾ',
  K: 'ʞ', L: '˥', M: 'ɯ', N: 'u', O: 'o', P: 'd', Q: 'b', R: 'ɹ', S: 's', T: 'ʇ',
  U: 'n', V: 'ʌ', W: 'ʍ', X: 'x', Y: 'ʎ', Z: 'z',
  '0': '0', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ', '8': '8', '9': '6',
  '.': '˙', ',': "'", '?': '¿', '!': '¡', '(': ')', ')': '(', '[': ']', ']': '[', '<': '>', '>': '<', '_': '‾',
};
function fontgenUpsideDown(text) {
  return Array.from(text).map((ch) => FONTGEN_UPSIDEDOWN_MAP[ch] || ch).reverse().join('');
}

function fontgenStrikethrough(text) {
  return Array.from(text).map((ch) => ch + '\u0336').join('');
}
function fontgenUnderline(text) {
  return Array.from(text).map((ch) => ch + '\u0332').join('');
}

const FONTGEN_STYLES = [
  { label: 'Bold', fn: (t) => fontgenOffsetMap(t, 0x1D400, 0x1D41A, 0x1D7CE) },
  { label: 'Italic', fn: (t) => fontgenOffsetMap(t, 0x1D434, 0x1D44E, null, 'italic') },
  { label: 'Bold Italic', fn: (t) => fontgenOffsetMap(t, 0x1D468, 0x1D482, null) },
  { label: 'Script', fn: (t) => fontgenOffsetMap(t, 0x1D49C, 0x1D4B6, null, 'script') },
  { label: 'Bold Script', fn: (t) => fontgenOffsetMap(t, 0x1D4D0, 0x1D4EA, null) },
  { label: 'Fraktur / Gothic', fn: (t) => fontgenOffsetMap(t, 0x1D504, 0x1D51E, null, 'fraktur') },
  { label: 'Bold Fraktur', fn: (t) => fontgenOffsetMap(t, 0x1D56C, 0x1D586, null) },
  { label: 'Double-Struck', fn: (t) => fontgenOffsetMap(t, 0x1D538, 0x1D552, 0x1D7D8, 'doublestruck') },
  { label: 'Sans-Serif', fn: (t) => fontgenOffsetMap(t, 0x1D5A0, 0x1D5BA, 0x1D7E2) },
  { label: 'Sans-Serif Bold', fn: (t) => fontgenOffsetMap(t, 0x1D5D4, 0x1D5EE, 0x1D7EC) },
  { label: 'Sans-Serif Italic', fn: (t) => fontgenOffsetMap(t, 0x1D608, 0x1D622, null) },
  { label: 'Sans-Serif Bold Italic', fn: (t) => fontgenOffsetMap(t, 0x1D63C, 0x1D656, null) },
  { label: 'Monospace', fn: (t) => fontgenOffsetMap(t, 0x1D670, 0x1D68A, 0x1D7F6) },
  { label: 'Fullwidth', fn: fontgenFullwidth },
  { label: 'Bubble (Circled)', fn: fontgenCircled },
  { label: 'Bubble Solid', fn: fontgenCircledNegative },
  { label: 'Squared', fn: fontgenSquared },
  { label: 'Small Caps', fn: fontgenSmallCaps },
  { label: 'Upside Down', fn: fontgenUpsideDown },
  { label: 'Strikethrough', fn: fontgenStrikethrough },
  { label: 'Underline', fn: fontgenUnderline },
  { label: 'Wide Spaced', fn: (t) => Array.from(t).join(' ') },
  { label: 'Cute Heart ♡', fn: (t) => `♡ ${t} ♡` },
  { label: 'Kawaii Sparkle', fn: (t) => `✧･ﾟ: *✧･ﾟ:* ${t} *:･ﾟ✧*:･ﾟ✧` },
  { label: 'Soft Stars', fn: (t) => `⋆｡°✩ ${t} ✩°｡⋆` },
  { label: 'Bunga', fn: (t) => `✿ ${t} ✿` },
  { label: 'Bracket Jepang', fn: (t) => `「${t}」` },
  { label: 'Bracket Jepang Ganda', fn: (t) => `『${t}』` },
  { label: 'Bintang Anime', fn: (t) => `☆*: .｡. ${t} .｡.:*☆` },
  { label: 'Kaomoji Cute', fn: (t) => `(｡♥‿♥｡) ${t} (｡♥‿♥｡)` },
  { label: 'Pita Cute', fn: (t) => `((( ${t} )))` },
  { label: 'Bubble + Hati', fn: (t) => `♡${fontgenCircled(t)}♡` },
  { label: 'Cute Cursive', fn: (t) => `~*${fontgenOffsetMap(t, 0x1D4D0, 0x1D4EA, null)}*~` },
];

function renderFontGenResults() {
  const text = document.getElementById('fontgen-input')?.value;
  const container = document.getElementById('fontgen-results');
  if (!container) return;

  if (!text) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = FONTGEN_STYLES.map((style, idx) => {
    let output = '';
    try {
      output = style.fn(text);
    } catch {
      output = text;
    }
    return `
      <div class="fontgen-row">
        <div class="fontgen-row-text">
          <div class="hint" style="margin-bottom:2px;">${escapeHtml(style.label)}</div>
          <div class="fontgen-output" id="fontgen-output-${idx}">${escapeHtml(output)}</div>
        </div>
        <button class="ghost fontgen-copy-btn" onclick="copyFontGenResult(${idx}, this)">Salin</button>
      </div>
    `;
  }).join('');
}

const SIGNATURE_FONTS = [
  { name: 'Great Vibes', family: "'Great Vibes', cursive" },
  { name: 'Dancing Script', family: "'Dancing Script', cursive" },
  { name: 'Sacramento', family: "'Sacramento', cursive" },
  { name: 'Alex Brush', family: "'Alex Brush', cursive" },
  { name: 'Allura', family: "'Allura', cursive" },
  { name: 'Satisfy', family: "'Satisfy', cursive" },
  { name: 'Pacifico', family: "'Pacifico', cursive" },
  { name: 'Caveat', family: "'Caveat', cursive" },
  { name: 'Yellowtail', family: "'Yellowtail', cursive" },
  { name: 'Marck Script', family: "'Marck Script', cursive" },
  { name: 'Herr Von Muellerhoff', family: "'Herr Von Muellerhoff', cursive" },
  { name: 'Mrs Saint Delafield', family: "'Mrs Saint Delafield', cursive" },
];
let sigSelectedFontIdx = 0;

function renderSignatureStyles() {
  const text = document.getElementById('sig-input')?.value.trim();
  const grid = document.getElementById('sig-style-grid');
  const editor = document.getElementById('sig-editor');
  if (!grid) return;

  if (!text) {
    grid.innerHTML = '';
    if (editor) editor.style.display = 'none';
    setStatus('sig-status', '');
    return;
  }

  grid.innerHTML = SIGNATURE_FONTS.map((f, idx) => `
    <button type="button" class="signature-style-card${idx === sigSelectedFontIdx ? ' active' : ''}" onclick="selectSignatureFont(${idx})" style="font-family:${f.family};">
      ${escapeHtml(text)}
    </button>
  `).join('');

  if (editor) editor.style.display = 'block';
  renderSignaturePreview();
}

function selectSignatureFont(idx) {
  sigSelectedFontIdx = idx;
  document.querySelectorAll('.signature-style-card').forEach((el, i) => el.classList.toggle('active', i === idx));
  renderSignaturePreview();
}

async function renderSignaturePreview() {
  const text = document.getElementById('sig-input')?.value.trim();
  const canvas = document.getElementById('sig-canvas');
  if (!canvas || !text) return;
  const ctx = canvas.getContext('2d');
  const color = document.getElementById('sig-color')?.value || '#1a1a1a';
  const baseSize = Number(document.getElementById('sig-size')?.value || 90);
  const font = SIGNATURE_FONTS[sigSelectedFontIdx];

  setStatus('sig-status', 'Memuat font...');
  try {
    await document.fonts.load(`${baseSize}px "${font.name}"`, text);
    await document.fonts.ready;
  } catch {
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  let fontSize = baseSize;
  ctx.font = `${fontSize}px ${font.family}`;
  while (ctx.measureText(text).width > canvas.width - 40 && fontSize > 20) {
    fontSize -= 2;
    ctx.font = `${fontSize}px ${font.family}`;
  }

  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  setStatus('sig-status', '');
}

function downloadSignature(bg) {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas) return;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const octx = out.getContext('2d');
  if (bg === 'white') {
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, out.width, out.height);
  }
  octx.drawImage(canvas, 0, 0);
  const a = document.createElement('a');
  a.href = out.toDataURL('image/png');
  a.download = `signature_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

let currentEndecAction = 'encode';

function textToBytes(str) {
  return new TextEncoder().encode(str);
}
function bytesToText(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}
function hexToBytes(hex) {
  const clean = hex.trim().replace(/\s+/g, '');
  if (clean.length === 0 || clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new Error('Hex tidak valid');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}
function bytesToBinary(bytes) {
  return Array.from(bytes).map((b) => b.toString(2).padStart(8, '0')).join(' ');
}
function binaryToBytes(bin) {
  const parts = bin.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) throw new Error('Binary tidak valid');
  const bytes = new Uint8Array(parts.length);
  parts.forEach((p, i) => {
    if (!/^[01]{1,8}$/.test(p)) throw new Error('Binary tidak valid');
    bytes[i] = parseInt(p, 2);
  });
  return bytes;
}
function htmlEntityEncode(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function htmlEntityDecode(str) {
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}
function rot13(str) {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const start = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - start + 13) % 26) + start);
  });
}

function handleEndecInput() {
  const input = document.getElementById('endec-input');
  const output = document.getElementById('endec-output');
  if (!input.value.trim()) {
    output.value = '';
    setStatus('endec-status', '');
    return;
  }
  runEncodeDecode(currentEndecAction);
}

function runEncodeDecode(action) {
  currentEndecAction = action;
  const method = document.getElementById('endec-method')?.value;
  const input = document.getElementById('endec-input')?.value ?? '';
  const output = document.getElementById('endec-output');
  if (!output) return;

  setStatus('endec-status', '');
  if (!input.trim()) {
    output.value = '';
    return;
  }

  try {
    let result;
    switch (method) {
      case 'base64': {
        if (action === 'encode') {
          const bytes = textToBytes(input);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          result = btoa(binary);
        } else {
          const binary = atob(input);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          result = bytesToText(bytes);
        }
        break;
      }
      case 'url':
        result = action === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input);
        break;
      case 'hex':
        result = action === 'encode' ? bytesToHex(textToBytes(input)) : bytesToText(hexToBytes(input));
        break;
      case 'binary':
        result = action === 'encode' ? bytesToBinary(textToBytes(input)) : bytesToText(binaryToBytes(input));
        break;
      case 'html':
        result = action === 'encode' ? htmlEntityEncode(input) : htmlEntityDecode(input);
        break;
      case 'rot13':
        result = rot13(input);
        break;
      default:
        result = '';
    }
    output.value = result;
  } catch (err) {
    output.value = '';
    setStatus('endec-status', `Gagal ${action === 'encode' ? 'meng-encode' : 'men-decode'}: format input tidak valid untuk mode ini.`, 'error');
  }
}

function swapEndec() {
  const input = document.getElementById('endec-input');
  const output = document.getElementById('endec-output');
  if (!input || !output) return;
  const tmp = input.value;
  input.value = output.value;
  output.value = tmp;
  currentEndecAction = currentEndecAction === 'encode' ? 'decode' : 'encode';
}

function copyEndecOutput(btn) {
  const output = document.getElementById('endec-output');
  if (!output || !output.value) return;
  const showCopied = () => {
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = 'Tersalin!';
    setTimeout(() => { btn.textContent = original; }, 1200);
  };
  navigator.clipboard.writeText(output.value).then(showCopied).catch(() => {
    output.select();
    document.execCommand('copy');
    showCopied();
  });
}

function copyFontGenResult(idx, btn) {
  const el = document.getElementById(`fontgen-output-${idx}`);
  if (!el) return;
  const text = el.textContent;
  const showCopied = () => {
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = 'Tersalin!';
    setTimeout(() => { btn.textContent = original; }, 1200);
  };
  navigator.clipboard.writeText(text).then(showCopied).catch(() => {
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    showCopied();
  });
}