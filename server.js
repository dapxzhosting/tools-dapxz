require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn, exec } = require('child_process');
const fetch = require('node-fetch');
const multer = require('multer');

const CAPCUT_USE_BROWSER = process.env.CAPCUT_USE_BROWSER === 'true';
const CAPCUT_AUTO_CROP = process.env.CAPCUT_AUTO_CROP === 'true';
let puppeteer = null;
if (CAPCUT_USE_BROWSER) {
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.warn('[capcut] CAPCUT_USE_BROWSER=true tapi package "puppeteer" belum ke-install. Jalankan: npm install puppeteer');
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';

const fs = require('fs');
const os = require('os');
let COOKIES_PATH = null;
if (process.env.YT_COOKIES) {
  try {
    COOKIES_PATH = path.join(os.tmpdir(), 'yt-cookies.txt');
    fs.writeFileSync(COOKIES_PATH, process.env.YT_COOKIES, 'utf8');
    console.log('Cookies YouTube berhasil dimuat dari environment variable.');
  } catch (err) {
    console.error('Gagal menulis file cookies:', err.message);
    COOKIES_PATH = null;
  }
}

const MP4_UPLOAD_DIR = path.join(os.tmpdir(), 'tools-dev-mp4-uploads');
if (!fs.existsSync(MP4_UPLOAD_DIR)) fs.mkdirSync(MP4_UPLOAD_DIR, { recursive: true });

const mp4Upload = multer({
  dest: MP4_UPLOAD_DIR,
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okMime = /^video\//.test(file.mimetype) || file.mimetype === 'application/octet-stream';
    if (!okMime) return cb(new Error('File yang diupload bukan file video.'));
    cb(null, true);
  },
});

function runYtDlp(args) {
  const clientArgs = ['--extractor-args', 'youtube:player_client=android'];
  const remoteComponentsArgs = ['--remote-components', 'ejs:github'];
  const finalArgs = [
    ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
    ...clientArgs,
    ...remoteComponentsArgs,
    ...args,
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_BIN, finalArgs);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    proc.on('error', (err) => {
      reject(new Error(
        `yt-dlp tidak ditemukan/tidak bisa dijalankan. Pastikan yt-dlp sudah diinstall dan ada di PATH. Detail: ${err.message}`
      ));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp keluar dengan kode ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

function isValidYouTubeUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtu.be'
    );
  } catch {
    return false;
  }
}

app.get('/api/info', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL tidak boleh kosong.' });
  }
  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Link ini bukan link YouTube. Gunakan menu yang sesuai (TikTok/Instagram Downloader).' });
  }

  try {
    const output = await runYtDlp(['-j', '--no-warnings', url]);
    const data = JSON.parse(output);

    const formats = (data.formats || [])
      .filter((f) => (f.vcodec && f.vcodec !== 'none') || (f.acodec && f.acodec !== 'none'))
      .filter((f) => f.format_id)
      .map((f) => {
        const hasVideo = f.vcodec && f.vcodec !== 'none';
        const hasAudio = f.acodec && f.acodec !== 'none';
        return {
          id: f.format_id,
          label: hasVideo
            ? `${f.height ? f.height + 'p' : f.format_note || '?'} • ${f.ext} ${hasAudio ? '(video+audio)' : '(video only)'}`
            : `Audio only • ${f.abr ? Math.round(f.abr) + 'kbps' : '?'} • ${f.ext}`,
          hasVideo,
          hasAudio,
          filesize: f.filesize || f.filesize_approx || null,
        };
      })
      .sort((a, b) => (b.hasVideo && b.hasAudio ? 1 : 0) - (a.hasVideo && a.hasAudio ? 1 : 0));

    res.json({
      title: data.title,
      author: data.uploader || data.channel || '-',
      thumbnail: data.thumbnail,
      duration: data.duration || 0,
      formats,
    });
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil info video: ' + err.message });
  }
});

app.get('/api/download', async (req, res) => {
  const { url, formatId, hasAudio } = req.query;

  if (!url) return res.status(400).json({ error: 'URL tidak boleh kosong.' });
  if (!formatId) return res.status(400).json({ error: 'Format tidak dikirim.' });
  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Link ini bukan link YouTube.' });
  }

  try {
    const infoOut = await runYtDlp(['-j', '--no-warnings', url]);
    const info = JSON.parse(infoOut);

    const rawTitle = info.title || 'video';
    const cleanedTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
    const asciiTitle = cleanedTitle.replace(/[^\x20-\x7E]/g, '').trim() || 'video';
    const encodedTitle = encodeURIComponent(cleanedTitle);

    const formatSelector = hasAudio === 'true' ? formatId : `${formatId}+bestaudio/best`;

    const args = [
      ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
      '--extractor-args', 'youtube:player_client=android',
      '--remote-components', 'ejs:github',
      '-f', formatSelector,
      '--merge-output-format', 'mp4',
      '-o', '-',
      '--no-warnings',
      url,
    ];

    const proc = spawn(YTDLP_BIN, args);
    let stderrBuf = '';
    let sentHeaders = false;

    res.setHeader('Content-Disposition', `attachment; filename="${asciiTitle}.mp4"; filename*=UTF-8''${encodedTitle}.mp4`);
    res.setHeader('Content-Type', 'video/mp4');

    proc.stdout.once('data', () => { sentHeaders = true; });
    proc.stdout.pipe(res);

    proc.stderr.on('data', (d) => (stderrBuf += d));

    proc.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'yt-dlp tidak ditemukan/gagal dijalankan: ' + err.message });
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp error:', stderrBuf);
        if (!sentHeaders && !res.headersSent) {
          res.status(500).json({ error: 'Gagal download: ' + (stderrBuf.trim().slice(0, 300) || `exit code ${code}`) });
        } else {
          res.destroy();
        }
      }
    });

    req.on('close', () => proc.kill());
  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gagal download: ' + err.message });
    }
  }
});


async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isValidTikTokUrl(url) {
  const clean = url.split('?')[0];
  return (
    /tiktok\.com\/@[\w.]+\/(video|photo)\/\d+/.test(clean) ||
    /vm\.tiktok\.com\/\w+/.test(clean) ||
    /vt\.tiktok\.com\/\w+/.test(clean) ||
    /tiktok\.com\/t\/\w+/.test(clean)
  );
}
function isValidInstagramUrl(url) {
  const clean = url.split('?')[0];
  return (
    /instagram\.com\/(p|reel|tv|reels)\/[\w-]+/.test(clean) ||
    /instagram\.com\/stories\/[\w.]+\/\d+/.test(clean) ||
    /instagram\.com\/stories\/highlights\/\d+/.test(clean) ||
    /instagram\.com\/share\/[\w-]+/.test(clean) ||
    /instagram\.com\/s\/[\w-]+/.test(clean)
  );
}
function isValidTwitterUrl(url) {
  const clean = url.split('?')[0];
  return /(twitter\.com|x\.com)\/[\w]+\/status\/\d+/.test(clean);
}
function detectSocialPlatform(url) {
  if (isValidTikTokUrl(url)) return 'tiktok';
  if (isValidInstagramUrl(url)) return 'instagram';
  if (isValidTwitterUrl(url)) return 'twitter';
  return null;
}
function socialPlatformLabel(p) {
  return { tiktok: 'TikTok', instagram: 'Instagram', twitter: 'Twitter/X' }[p] || p;
}
function isTikTokShortUrl(url) {
  return /vm\.tiktok\.com|vt\.tiktok\.com|tiktok\.com\/t\//.test(url);
}
async function resolveShortUrl(url) {
  if (!isTikTokShortUrl(url)) return url;
  try {
    const resp = await fetchWithTimeout(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
    }, 8000);
    return resp.url || url;
  } catch {
    return url;
  }
}
async function tikwmFetch(url) {
  const clean = url.split('?')[0];
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(clean)}&hd=1`;
  const resp = await fetchWithTimeout(apiUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  }, 15000);
  if (!resp.ok) throw new Error(`tikwm HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json || json.code !== 0) throw new Error(json?.msg || 'tikwm error');
  return json.data;
}
async function cobaltFetch(url) {
  const apiUrl = process.env.COBALT_API_URL || 'https://api.cobalt.tools';
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.COBALT_API_KEY) headers['Authorization'] = `Api-Key ${process.env.COBALT_API_KEY}`;

  const resp = await fetchWithTimeout(`${apiUrl}/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, videoQuality: 'max', audioFormat: 'mp3', filenameStyle: 'basic' }),
  }, 20000);
  const json = await resp.json();
  if (!resp.ok || !json || !['stream', 'redirect', 'tunnel', 'picker'].includes(json.status)) {
    const reason = json?.error?.code || json?.text || `HTTP ${resp.status} (status: ${json?.status || 'unknown'})`;
    console.error('[cobaltFetch] raw response:', JSON.stringify(json));
    throw new Error(reason);
  }
  return json;
}

async function ytdlpTwitterInfo(url) {
  const output = await runYtDlp(['-j', '--no-warnings', url]);
  return JSON.parse(output);
}
function checkYtDlp() {
  return new Promise((resolve) => exec('yt-dlp --version', (err) => resolve(!err)));
}

function generateFileName(platform, ext) {
  const randomNum = Math.floor(1000000 + Math.random() * 9000000);
  return `${platform}dap_${randomNum}.${ext}`;
}

const IG_COOKIES_PATH = process.env.IG_COOKIES_PATH || path.join(__dirname, 'ig_cookies.json');
const IG_WEB_APP_ID = '936619743392459';

function igParseNetscapeCookies(raw) {
  const cookies = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('\t');
    if (parts.length !== 7) continue;
    const [domain, , cookiePath, , , name, value] = parts;
    cookies.push({ domain: domain.replace(/^\./, ''), path: cookiePath, name, value });
  }
  return cookies;
}

function igLoadCookiesRaw() {
  const raw = process.env.IG_COOKIES_JSON || (require('fs').existsSync(IG_COOKIES_PATH) ? require('fs').readFileSync(IG_COOKIES_PATH, 'utf-8') : null);
  if (!raw) return null;

  const trimmed = raw.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  return igParseNetscapeCookies(trimmed);
}

function igHasCookies() {
  try {
    const cookies = igLoadCookiesRaw();
    return Array.isArray(cookies) && cookies.length > 0;
  } catch {
    return false;
  }
}

function igFindCookie(cookies, name) {
  const found = cookies.find((c) => c.name === name);
  return found ? found.value : null;
}

function igBuildRequestContext() {
  const cookies = igLoadCookiesRaw();
  if (!Array.isArray(cookies)) {
    throw new Error('IG_COOKIES_JSON / ig_cookies.json harus berupa array cookie hasil export browser.');
  }
  const sessionId = igFindCookie(cookies, 'sessionid');
  const csrfToken = igFindCookie(cookies, 'csrftoken');
  const dsUserId = igFindCookie(cookies, 'ds_user_id');
  if (!sessionId || !csrfToken || !dsUserId) {
    throw new Error('Cookie wajib (sessionid, csrftoken, ds_user_id) tidak lengkap. Export ulang dari browser.');
  }
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  return {
    cookieHeader,
    headers: {
      'Cookie': cookieHeader,
      'X-CSRFToken': csrfToken,
      'X-IG-App-ID': IG_WEB_APP_ID,
      'X-Requested-With': 'XMLHttpRequest',
      'X-IG-WWW-Claim': '0',
      'X-ASBD-ID': '129477',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': 'https://www.instagram.com/',
      'Origin': 'https://www.instagram.com',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Ch-Ua': '"Chromium";v="126", "Not.A/Brand";v="8"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    },
  };
}

let igValidated = false;
async function igEnsureReady() {
  if (igValidated) return;
  if (!igHasCookies()) {
    throw new Error('Cookie Instagram belum di-set. Isi env var IG_COOKIES_JSON (lihat komentar di atas).');
  }
  const { headers } = igBuildRequestContext();
  const r = await fetchWithTimeout('https://www.instagram.com/api/v1/web/accounts/current_user/?edit=true', { headers }, 15000);
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Cookie kemungkinan expired/kena checkpoint — respons bukan JSON (mungkin halaman error/login Instagram). Snippet: ${text.slice(0, 150)}`);
  }
  if (!r.ok || !json.user) {
    throw new Error(`Validasi cookie gagal (status ${r.status}): ${JSON.stringify(json).slice(0, 200)}`);
  }
  igValidated = true;
  console.log('[igSession] cookie valid, siap dipakai (user:', json.user.username, ')');
}

async function igFetchHighlightItems(highlightId) {
  await igEnsureReady();
  const { headers } = igBuildRequestContext();
  const url = `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=highlight:${highlightId}`;
  const r = await fetchWithTimeout(url, { headers }, 20000);
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Respons bukan JSON (kemungkinan cookie invalid/checkpoint). Snippet: ${text.slice(0, 150)}`);
  }
  if (!r.ok) {
    throw new Error(`Gagal ambil highlight (status ${r.status}): ${JSON.stringify(data).slice(0, 200)}`);
  }

  const reelsMedia = data.reels_media || [];
  const items = reelsMedia.flatMap((reel) => reel.items || []);

  return items
    .map((it) => {
      const isVideo = !!it.video_versions?.length;
      const mediaUrl = isVideo ? it.video_versions[0].url : it.image_versions2?.candidates?.[0]?.url;
      const thumb = it.image_versions2?.candidates?.[0]?.url || null;
      return { type: isVideo ? 'video' : 'image', url: mediaUrl, thumb, taken_at: it.taken_at };
    })
    .filter((it) => it.url);
}

function igExtractHighlightId(url) {
  const direct = url.match(/stories\/highlights\/(\d+)/);
  if (direct) return direct[1];

  const shareMatch = url.match(/instagram\.com\/s\/([\w-]+)/);
  if (shareMatch) {
    try {
      const b64 = shareMatch[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      const idMatch = decoded.match(/highlight:(\d+)/);
      if (idMatch) return idMatch[1];
    } catch {
    }
  }
  return null;
}

function igExtractStoryUsername(url) {
  const m = url.match(/instagram\.com\/stories\/([\w.]+)\/\d+/);
  return m ? m[1] : null;
}

async function igFetchUserId(username) {
  await igEnsureReady();
  const { headers } = igBuildRequestContext();
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const r = await fetchWithTimeout(url, { headers }, 15000);
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Respons profil bukan JSON (kemungkinan cookie invalid/checkpoint). Snippet: ${text.slice(0, 150)}`);
  }
  const userId = data?.data?.user?.id;
  if (!r.ok || !userId) {
    throw new Error(`User "${username}" tidak ditemukan atau gagal ambil user_id (status ${r.status}).`);
  }
  return userId;
}

async function igFetchActiveStoryItems(userId) {
  await igEnsureReady();
  const { headers } = igBuildRequestContext();
  const url = `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`;
  const r = await fetchWithTimeout(url, { headers }, 20000);
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Respons bukan JSON (kemungkinan cookie invalid/checkpoint). Snippet: ${text.slice(0, 150)}`);
  }
  if (!r.ok) {
    throw new Error(`Gagal ambil story (status ${r.status}): ${JSON.stringify(data).slice(0, 200)}`);
  }

  const reelsMedia = data.reels_media || [];
  const items = reelsMedia.flatMap((reel) => reel.items || []);

  return items
    .map((it) => {
      const isVideo = !!it.video_versions?.length;
      const mediaUrl = isVideo ? it.video_versions[0].url : it.image_versions2?.candidates?.[0]?.url;
      const thumb = it.image_versions2?.candidates?.[0]?.url || null;
      return { type: isVideo ? 'video' : 'image', url: mediaUrl, thumb, taken_at: it.taken_at };
    })
    .filter((it) => it.url);
}

async function igFetchActiveStoryItemsFromUrl(url) {
  const username = igExtractStoryUsername(url);
  if (!username) throw new Error('URL bukan format Story aktif yang valid.');
  const userId = await igFetchUserId(username);
  const items = await igFetchActiveStoryItems(userId);
  if (!items.length) {
    throw new Error(`@${username} sedang tidak punya Story aktif (story mungkin sudah lewat 24 jam / dihapus).`);
  }
  return items;
}

const igSession = {
  hasCredentials: igHasCookies,
  ensureLoggedIn: igEnsureReady,
  fetchHighlightItems: igFetchHighlightItems,
  extractHighlightId: igExtractHighlightId,
  extractStoryUsername: igExtractStoryUsername,
  fetchActiveStoryItems: igFetchActiveStoryItemsFromUrl,
};


app.get('/api/social/proxy-thumbnail', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');
  try {
    const r = await fetchWithTimeout(url, {
      headers: { Referer: 'https://www.tiktok.com/', 'User-Agent': 'Mozilla/5.0' },
    }, 10000);
    if (!r.ok) return res.status(r.status).send('Fetch failed');
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    r.body.pipe(res);
  } catch {
    res.status(500).send('Proxy error');
  }
});

function validateExpectedPlatform(url, expectedPlatform, res) {
  const detected = detectSocialPlatform(url);
  if (!detected) {
    res.status(400).json({ error: 'URL tidak valid. Gunakan link TikTok atau Instagram (Post/Reel).' });
    return null;
  }
  if (expectedPlatform && detected !== expectedPlatform) {
    res.status(400).json({
      error: `Link ini terdeteksi sebagai ${socialPlatformLabel(detected)}, bukan ${socialPlatformLabel(expectedPlatform)}. Gunakan menu ${socialPlatformLabel(detected)} Downloader.`,
    });
    return null;
  }
  return detected;
}

app.post('/api/social/info', async (req, res) => {
  const { url, platform: expectedPlatform } = req.body;
  if (!url) return res.status(400).json({ error: 'URL wajib diisi.' });

  const platform = validateExpectedPlatform(url, expectedPlatform, res);
  if (!platform) return;

  if (platform === 'tiktok') {
    try {
      const data = await tikwmFetch(url);
      const images = data.images || [];
      const isPhoto = images.length > 0;
      const rawThumb = data.cover || (isPhoto ? images[0] : null) || null;
      return res.json({
        platform: 'tiktok',
        title: data.title || (isPhoto ? 'TikTok Photo Post' : 'TikTok Video'),
        thumbnail: rawThumb ? `/api/social/proxy-thumbnail?url=${encodeURIComponent(rawThumb)}` : null,
        duration: isPhoto ? null : data.duration || null,
        uploader: data.author?.nickname || data.author?.unique_id || null,
        view_count: data.play_count || null,
        like_count: data.digg_count || null,
        content_type: isPhoto ? (images.length > 1 ? 'carousel' : 'image') : 'video',
        image_count: isPhoto ? images.length : 0,
      });
    } catch (err) {
      console.error('[social/info/tiktok] tikwm gagal:', err.message);
      return res.status(500).json({ error: 'Gagal mengambil info TikTok. Pastikan postingan publik.' });
    }
  }

  if (platform === 'instagram') {
    const highlightId = igSession.extractHighlightId(url);
    if (highlightId) {
      if (!igSession.hasCredentials()) {
        return res.status(500).json({
          error: 'Fitur Sorotan (Highlight) butuh cookie akun Instagram khusus scraping. Set env var IG_COOKIES_JSON di server (lihat komentar di server.js).',
        });
      }
      try {
        const items = await igSession.fetchHighlightItems(highlightId);
        if (!items.length) {
          return res.status(404).json({ error: 'Highlight tidak ditemukan atau kosong.' });
        }
        const photoItems = items.filter((it) => it.type !== 'video');
        const contentType = items.length > 1 ? 'carousel' : (photoItems.length === 1 ? 'image' : 'video');
        return res.json({
          platform: 'instagram',
          title: 'Instagram Highlight',
          thumbnail: items[0].thumb ? `/api/social/proxy-thumbnail?url=${encodeURIComponent(items[0].thumb)}` : null,
          duration: null,
          uploader: null,
          view_count: null,
          like_count: null,
          content_type: contentType,
          image_count: items.length,
        });
      } catch (err) {
        console.error('[social/info/instagram] highlight via session gagal:', err.message);
        return res.status(500).json({
          error: 'Gagal mengambil Highlight. Kemungkinan session akun scraper expired/kena checkpoint — cek log server.',
        });
      }
    }

    const storyUsername = igSession.extractStoryUsername(url);
    if (storyUsername) {
      if (!igSession.hasCredentials()) {
        return res.status(500).json({
          error: 'Fitur Story butuh cookie akun Instagram khusus scraping. Set env var IG_COOKIES_JSON di server (lihat komentar di server.js).',
        });
      }
      try {
        const items = await igSession.fetchActiveStoryItems(url);
        const photoItems = items.filter((it) => it.type !== 'video');
        const contentType = items.length > 1 ? 'carousel' : (photoItems.length === 1 ? 'image' : 'video');
        return res.json({
          platform: 'instagram',
          title: `Instagram Story @${storyUsername}`,
          thumbnail: items[0].thumb ? `/api/social/proxy-thumbnail?url=${encodeURIComponent(items[0].thumb)}` : null,
          duration: null,
          uploader: `@${storyUsername}`,
          view_count: null,
          like_count: null,
          content_type: contentType,
          image_count: items.length,
        });
      } catch (err) {
        console.error('[social/info/instagram] story via session gagal:', err.message);
        return res.status(500).json({ error: err.message || 'Gagal mengambil Story. Kemungkinan session akun scraper expired/kena checkpoint.' });
      }
    }

    try {
      const data = await cobaltFetch(url);
      const isPicker = data.status === 'picker';
      const items = data.picker || [];

      let contentType = 'video';
      let thumbnail = null;

      if (isPicker) {
        const photoItems = items.filter((it) => it.type !== 'video');
        contentType = photoItems.length > 1 ? 'carousel' : (photoItems.length === 1 && items.length === 1 ? 'image' : 'carousel');
        thumbnail = items[0]?.thumb ? `/api/social/proxy-thumbnail?url=${encodeURIComponent(items[0].thumb)}` : null;
      } else if (data.url) {
        try {
          const headResp = await fetchWithTimeout(data.url, { method: 'HEAD' }, 8000);
          const ct = headResp.headers.get('content-type') || '';
          contentType = ct.startsWith('image/') ? 'image' : 'video';
        } catch {
          contentType = 'video';
        }
        thumbnail = contentType === 'image' ? `/api/social/proxy-thumbnail?url=${encodeURIComponent(data.url)}` : null;
      }

      return res.json({
        platform: 'instagram',
        title: 'Instagram Post',
        thumbnail,
        duration: null,
        uploader: null,
        view_count: null,
        like_count: null,
        content_type: contentType,
        image_count: isPicker ? items.length : (contentType === 'image' ? 1 : 0),
      });
    } catch (err) {
      console.error('[social/info/instagram] cobalt gagal:', err.message);
      const isHighlight = /stories\/highlights\//.test(url) || /instagram\.com\/s\//.test(url);
      return res.status(500).json({
        error: isHighlight
          ? 'Sorotan (Highlight) Instagram tidak didukung tanpa cookie akun scraping. Set env var IG_COOKIES_JSON di server.'
          : 'Gagal mengambil info dari Instagram. Pastikan URL publik dan valid.',
      });
    }
  }

  if (platform === 'twitter') {
    try {
      const data = await cobaltFetch(url);
      const isPicker = data.status === 'picker';
      const items = data.picker || [];

      let contentType = 'video';
      let thumbnail = null;

      if (isPicker) {
        const photoItems = items.filter((it) => it.type !== 'video');
        contentType = photoItems.length > 1 ? 'carousel' : (photoItems.length === 1 && items.length === 1 ? 'image' : 'carousel');
        thumbnail = items[0]?.thumb ? `/api/social/proxy-thumbnail?url=${encodeURIComponent(items[0].thumb)}` : null;
      } else if (data.url) {
        try {
          const headResp = await fetchWithTimeout(data.url, { method: 'HEAD' }, 8000);
          const ct = headResp.headers.get('content-type') || '';
          contentType = ct.startsWith('image/') ? 'image' : 'video';
        } catch {
          contentType = 'video';
        }
        thumbnail = contentType === 'image' ? `/api/social/proxy-thumbnail?url=${encodeURIComponent(data.url)}` : null;
      }

      const usernameMatch = url.match(/(?:twitter\.com|x\.com)\/([\w]+)\/status/);

      let title = 'Twitter/X Post';

      if (contentType === 'video' && !thumbnail) {
        try {
          const info = await ytdlpTwitterInfo(url);
          if (info.thumbnail) thumbnail = info.thumbnail;
          if (info.title) title = info.title;
        } catch (thumbErr) {
          console.warn('[social/info/twitter] gagal ambil thumbnail via yt-dlp:', thumbErr.message);
        }
      }

      return res.json({
        platform: 'twitter',
        title,
        thumbnail,
        duration: null,
        uploader: usernameMatch ? `@${usernameMatch[1]}` : null,
        view_count: null,
        like_count: null,
        content_type: contentType,
        image_count: isPicker ? items.length : (contentType === 'image' ? 1 : 0),
      });
    } catch (err) {
      console.warn('[social/info/twitter] cobalt gagal, coba yt-dlp:', err.message);
      try {
        const info = await ytdlpTwitterInfo(url);
        return res.json({
          platform: 'twitter',
          title: info.title || info.description || 'Twitter/X Post',
          thumbnail: info.thumbnail || null,
          duration: info.duration || null,
          uploader: info.uploader ? (info.uploader.startsWith('@') ? info.uploader : `@${info.uploader_id || info.uploader}`) : null,
          view_count: info.view_count || null,
          like_count: info.like_count || null,
          content_type: 'video',
          image_count: 0,
        });
      } catch (err2) {
        console.error('[social/info/twitter] yt-dlp juga gagal:', err2.message);
        return res.status(500).json({ error: 'Gagal mengambil info dari Twitter/X. Pastikan tweet publik dan mengandung media.' });
      }
    }
  }
});

app.post('/api/social/download', async (req, res) => {
  const { url, platform: expectedPlatform } = req.body;
  if (!url) return res.status(400).json({ error: 'URL wajib diisi.' });

  const platform = validateExpectedPlatform(url, expectedPlatform, res);
  if (!platform) return;

  if (platform === 'tiktok') {
    try {
      const data = await tikwmFetch(url);
      if ((data.images || []).length > 0) {
        return res.status(400).json({ error: 'Ini postingan foto. Gunakan tombol Download Foto.', content_type: 'carousel' });
      }
      const videoUrl = data.hdplay || data.play;
      if (!videoUrl) throw new Error('No video URL from tikwm');
      const r = await fetchWithTimeout(videoUrl, { headers: { Referer: 'https://www.tiktok.com/' } }, 60000);
      if (!r.ok) throw new Error(`tikwm video fetch ${r.status}`);
      res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('tiktok', 'mp4')}"`);
      res.setHeader('Content-Type', 'video/mp4');
      r.body.pipe(res);
      return;
    } catch (err) {
      console.warn('[social/download/tiktok] tikwm gagal, coba yt-dlp:', err.message);
    }

    const hasYtDlp = await checkYtDlp();
    if (!hasYtDlp) return res.status(500).json({ error: 'Gagal download & yt-dlp tidak ditemukan sebagai cadangan.' });
    const resolved = await resolveShortUrl(url);
    const proc = spawn(YTDLP_BIN, [
      ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
      '-f', 'best[ext=mp4]/best', '-o', '-', '--no-warnings', resolved,
    ]);
    let stderrBuf = '';
    let sentHeaders = false;
    res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('tiktok', 'mp4')}"`);
    res.setHeader('Content-Type', 'video/mp4');
    proc.stdout.once('data', () => { sentHeaders = true; });
    proc.stdout.pipe(res);
    proc.stderr.on('data', (d) => (stderrBuf += d));
    proc.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: 'yt-dlp gagal dijalankan: ' + err.message });
    });
    proc.on('close', (code) => {
      if (code !== 0 && !sentHeaders && !res.headersSent) {
        res.status(500).json({ error: 'Gagal download TikTok: ' + (stderrBuf.trim().slice(0, 300) || `exit ${code}`) });
      }
    });
    return;
  }

  if (platform === 'instagram') {
    const highlightId = igSession.extractHighlightId(url);
    if (highlightId) {
      if (!igSession.hasCredentials()) {
        return res.status(500).json({ error: 'Fitur Sorotan (Highlight) butuh cookie akun Instagram khusus scraping. Set env var IG_COOKIES_JSON di server (lihat komentar di server.js).' });
      }
      try {
        const items = await igSession.fetchHighlightItems(highlightId);
        if (!items.length) return res.status(404).json({ error: 'Highlight tidak ditemukan atau kosong.' });
        if (items.length > 1) {
          return res.status(400).json({ error: 'Highlight ini berisi beberapa item. Gunakan tombol Download Foto/Video (multi-item) kalau tersedia.' });
        }
        const item = items[0];
        const r = await fetchWithTimeout(item.url, {}, 60000);
        if (!r.ok) throw new Error(`highlight media fetch ${r.status}`);
        const ext = item.type === 'video' ? 'mp4' : 'jpg';
        res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('instagram-highlight', ext)}"`);
        res.setHeader('Content-Type', r.headers.get('content-type') || (item.type === 'video' ? 'video/mp4' : 'image/jpeg'));
        r.body.pipe(res);
      } catch (err) {
        console.error('[social/download/instagram] highlight via session gagal:', err.message);
        return res.status(500).json({ error: 'Gagal mendownload Highlight. Kemungkinan session akun scraper expired/kena checkpoint — cek log server.' });
      }
      return;
    }

    const storyUsername = igSession.extractStoryUsername(url);
    if (storyUsername) {
      if (!igSession.hasCredentials()) {
        return res.status(500).json({ error: 'Fitur Story butuh cookie akun Instagram khusus scraping. Set env var IG_COOKIES_JSON di server (lihat komentar di server.js).' });
      }
      try {
        const items = await igSession.fetchActiveStoryItems(url);
        if (items.length > 1) {
          return res.status(400).json({ error: 'Story ini berisi beberapa item. Gunakan tombol Download Foto/Video (multi-item) kalau tersedia.' });
        }
        const item = items[0];
        const r = await fetchWithTimeout(item.url, {}, 60000);
        if (!r.ok) throw new Error(`story media fetch ${r.status}`);
        const ext = item.type === 'video' ? 'mp4' : 'jpg';
        res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('instagram-story', ext)}"`);
        res.setHeader('Content-Type', r.headers.get('content-type') || (item.type === 'video' ? 'video/mp4' : 'image/jpeg'));
        r.body.pipe(res);
      } catch (err) {
        console.error('[social/download/instagram] story via session gagal:', err.message);
        return res.status(500).json({ error: err.message || 'Gagal mendownload Story. Kemungkinan session akun scraper expired/kena checkpoint.' });
      }
      return;
    }

    try {
      const data = await cobaltFetch(url);
      if (data.status === 'picker') {
        return res.status(400).json({ error: 'Ini postingan carousel. Gunakan tombol Download Foto/Video.' });
      }
      const videoUrl = data.url;
      if (!videoUrl) throw new Error('No URL from cobalt');
      const r = await fetchWithTimeout(videoUrl, {}, 60000);
      if (!r.ok) throw new Error(`cobalt stream ${r.status}`);
      res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('instagram', 'mp4')}"`);
      res.setHeader('Content-Type', r.headers.get('content-type') || 'video/mp4');
      r.body.pipe(res);
    } catch (err) {
      console.error('[social/download/instagram] error:', err.message);
      const isHighlight = /stories\/highlights\//.test(url) || /instagram\.com\/s\//.test(url);
      return res.status(500).json({
        error: isHighlight
          ? 'Sorotan (Highlight) Instagram tidak didukung tanpa cookie akun scraping. Set env var IG_COOKIES_JSON di server.'
          : 'Gagal mendownload dari Instagram. Pastikan postingan publik.',
      });
    }
    return;
  }

  if (platform === 'twitter') {
    try {
      const data = await cobaltFetch(url);
      if (data.status === 'picker') {
        return res.status(400).json({ error: 'Tweet ini berisi beberapa media. Gunakan tombol Download Foto/Video.' });
      }
      const videoUrl = data.url;
      if (!videoUrl) throw new Error('No URL from cobalt');
      const r = await fetchWithTimeout(videoUrl, {}, 60000);
      if (!r.ok) throw new Error(`cobalt stream ${r.status}`);
      res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('twitter', 'mp4')}"`);
      res.setHeader('Content-Type', r.headers.get('content-type') || 'video/mp4');
      r.body.pipe(res);
      return;
    } catch (err) {
      console.warn('[social/download/twitter] cobalt gagal, coba yt-dlp:', err.message);
    }

    const hasYtDlp = await checkYtDlp();
    if (!hasYtDlp) return res.status(500).json({ error: 'Gagal download & yt-dlp tidak ditemukan sebagai cadangan.' });
    const proc = spawn(YTDLP_BIN, [
      ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
      '-f', 'best[ext=mp4]/best', '-o', '-', '--no-warnings', url,
    ]);
    let stderrBuf = '';
    let sentHeaders = false;
    res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('twitter', 'mp4')}"`);
    res.setHeader('Content-Type', 'video/mp4');
    proc.stdout.once('data', () => { sentHeaders = true; });
    proc.stdout.pipe(res);
    proc.stderr.on('data', (d) => (stderrBuf += d));
    proc.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: 'yt-dlp gagal dijalankan: ' + err.message });
    });
    proc.on('close', (code) => {
      if (code !== 0 && !sentHeaders && !res.headersSent) {
        res.status(500).json({ error: 'Gagal download Twitter/X: ' + (stderrBuf.trim().slice(0, 300) || `exit ${code}`) });
      }
    });
    req.on('close', () => proc.kill());
    return;
  }

  return res.status(400).json({ error: 'Platform tidak didukung.' });
});

app.post('/api/social/download-mp3', async (req, res) => {
  const { url, platform: expectedPlatform } = req.body;
  if (!url) return res.status(400).json({ error: 'URL wajib diisi.' });

  const platform = validateExpectedPlatform(url, expectedPlatform, res);
  if (!platform) return;

  const os = require('os');
  const fs = require('fs');
  const TEMP_DIR = path.join(os.tmpdir(), 'tools-dev-temp');
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  async function convertToMp3(videoUrl, extraHeaders = {}) {
    const ts = Date.now();
    const mp4Path = path.join(TEMP_DIR, `social_${ts}.mp4`);
    const mp3Path = path.join(TEMP_DIR, `social_${ts}.mp3`);
    const r = await fetchWithTimeout(videoUrl, { headers: extraHeaders }, 60000);
    if (!r.ok) throw new Error(`fetch video ${r.status}`);
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(mp4Path);
      r.body.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
    });
    await new Promise((resolve, reject) => {
      exec(`ffmpeg -i "${mp4Path}" -vn -ab 192k -ar 44100 -y "${mp3Path}"`, { timeout: 60000 }, (err) => {
        fs.unlink(mp4Path, () => {});
        if (err) return reject(err);
        resolve();
      });
    });
    return mp3Path;
  }

  if (platform === 'tiktok') {
    try {
      const data = await tikwmFetch(url);
      if ((data.images || []).length > 0) return res.status(400).json({ error: 'Postingan foto tidak memiliki audio.' });
      const videoUrl = data.hdplay || data.play;
      if (!videoUrl) throw new Error('No video URL from tikwm');
      const mp3Path = await convertToMp3(videoUrl, { Referer: 'https://www.tiktok.com/' });
      return res.download(mp3Path, generateFileName('tiktok', 'mp3'), () => fs.unlink(mp3Path, () => {}));
    } catch (err) {
      console.error('[social/mp3/tiktok] error:', err.message);
      return res.status(500).json({ error: 'Gagal mengonversi audio TikTok: ' + err.message });
    }
  }

  if (platform === 'instagram') {
    try {
      const data = await cobaltFetch(url);
      if (data.status === 'picker') return res.status(400).json({ error: 'Carousel tidak bisa dikonversi ke MP3 langsung.' });
      const videoUrl = data.url;
      if (!videoUrl) throw new Error('No URL from cobalt');
      const mp3Path = await convertToMp3(videoUrl);
      return res.download(mp3Path, generateFileName('instagram', 'mp3'), () => fs.unlink(mp3Path, () => {}));
    } catch (err) {
      console.error('[social/mp3/instagram] error:', err.message);
      return res.status(500).json({ error: 'Gagal mengonversi audio Instagram: ' + err.message });
    }
  }

  if (platform === 'twitter') {
    try {
      const data = await cobaltFetch(url);
      if (data.status === 'picker') return res.status(400).json({ error: 'Tweet dengan beberapa media tidak bisa dikonversi ke MP3 langsung.' });
      const videoUrl = data.url;
      if (!videoUrl) throw new Error('No URL from cobalt');
      const mp3Path = await convertToMp3(videoUrl);
      return res.download(mp3Path, generateFileName('twitter', 'mp3'), () => fs.unlink(mp3Path, () => {}));
    } catch (err) {
      console.error('[social/mp3/twitter] error:', err.message);
      return res.status(500).json({ error: 'Gagal mengonversi audio Twitter/X: ' + err.message });
    }
  }
});

app.post('/api/social/download-images', async (req, res) => {
  const { url, platform: expectedPlatform } = req.body;
  if (!url) return res.status(400).json({ error: 'URL wajib diisi.' });

  const platform = validateExpectedPlatform(url, expectedPlatform, res);
  if (!platform) return;

  if (platform === 'tiktok') {
    try {
      const data = await tikwmFetch(url);
      const imageUrls = data.images || [];
      if (imageUrls.length === 0) return res.status(400).json({ error: 'Ini bukan postingan foto. Gunakan Download Video.' });

      const settled = await Promise.allSettled(
        imageUrls.map(async (imgUrl, i) => {
          const r = await fetchWithTimeout(imgUrl, { headers: { Referer: 'https://www.tiktok.com/' } }, 15000);
          if (!r.ok) throw new Error(`Gagal download gambar ${i + 1}`);
          const buf = await r.buffer();
          return { index: i + 1, mime: 'image/jpeg', data: buf.toString('base64'), filename: generateFileName('tiktok', 'jpg') };
        })
      );
      settled.filter((s) => s.status === 'rejected').forEach((s) => console.error('[social/images/tiktok] item gagal:', s.reason?.message));
      const images = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
      if (images.length === 0) return res.status(500).json({ error: 'Semua foto gagal didownload. Coba lagi.' });
      return res.json({ images, count: images.length, failed: settled.length - images.length });
    } catch (err) {
      console.error('[social/images/tiktok] error:', err.message);
      return res.status(500).json({ error: 'Gagal mendownload gambar TikTok. Coba lagi.' });
    }
  }

  if (platform === 'instagram') {
    const highlightId = igSession.extractHighlightId(url);
    if (highlightId) {
      if (!igSession.hasCredentials()) {
        return res.status(500).json({ error: 'Fitur Sorotan (Highlight) butuh cookie akun Instagram khusus scraping. Set env var IG_COOKIES_JSON di server (lihat komentar di server.js).' });
      }
      try {
        const items = await igSession.fetchHighlightItems(highlightId);
        if (!items.length) return res.status(404).json({ error: 'Highlight tidak ditemukan atau kosong.' });
        const settled = await Promise.allSettled(
          items.map(async (item, i) => {
            const r = await fetchWithTimeout(item.url, {}, 30000);
            if (!r.ok) throw new Error(`Gagal download item ${i + 1}`);
            const buf = await r.buffer();
            const ct = r.headers.get('content-type') || (item.type === 'video' ? 'video/mp4' : 'image/jpeg');
            const ext = item.type === 'video' ? 'mp4' : 'jpg';
            return { index: i + 1, mime: ct, data: buf.toString('base64'), filename: generateFileName('instagram-highlight', ext) };
          })
        );
        settled.filter((s) => s.status === 'rejected').forEach((s) => console.error('[social/images/instagram] highlight item gagal:', s.reason?.message));
        const images = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
        if (images.length === 0) return res.status(500).json({ error: 'Semua item Highlight gagal didownload. Coba lagi.' });
        return res.json({ images, count: images.length, failed: settled.length - images.length });
      } catch (err) {
        console.error('[social/images/instagram] highlight via session gagal:', err.message);
        return res.status(500).json({ error: 'Gagal mendownload Highlight. Kemungkinan session akun scraper expired/kena checkpoint — cek log server.' });
      }
    }

    const storyUsername = igSession.extractStoryUsername(url);
    if (storyUsername) {
      if (!igSession.hasCredentials()) {
        return res.status(500).json({ error: 'Fitur Story butuh cookie akun Instagram khusus scraping. Set env var IG_COOKIES_JSON di server (lihat komentar di server.js).' });
      }
      try {
        const items = await igSession.fetchActiveStoryItems(url);
        const settled = await Promise.allSettled(
          items.map(async (item, i) => {
            const r = await fetchWithTimeout(item.url, {}, 30000);
            if (!r.ok) throw new Error(`Gagal download item ${i + 1}`);
            const buf = await r.buffer();
            const ct = r.headers.get('content-type') || (item.type === 'video' ? 'video/mp4' : 'image/jpeg');
            const ext = item.type === 'video' ? 'mp4' : 'jpg';
            return { index: i + 1, mime: ct, data: buf.toString('base64'), filename: generateFileName('instagram-story', ext) };
          })
        );
        settled.filter((s) => s.status === 'rejected').forEach((s) => console.error('[social/images/instagram] story item gagal:', s.reason?.message));
        const images = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
        if (images.length === 0) return res.status(500).json({ error: 'Semua item Story gagal didownload. Coba lagi.' });
        return res.json({ images, count: images.length, failed: settled.length - images.length });
      } catch (err) {
        console.error('[social/images/instagram] story via session gagal:', err.message);
        return res.status(500).json({ error: err.message || 'Gagal mendownload Story. Kemungkinan session akun scraper expired/kena checkpoint.' });
      }
    }

    try {
      const data = await cobaltFetch(url);
      if (data.status !== 'picker') {
        const mediaUrl = data.url;
        if (!mediaUrl) throw new Error('No URL from cobalt');
        const r = await fetchWithTimeout(mediaUrl, {}, 30000);
        if (!r.ok) throw new Error(`cobalt fetch ${r.status}`);
        const buf = await r.buffer();
        const ct = r.headers.get('content-type') || 'image/jpeg';
        const ext = ct.includes('video') ? 'mp4' : 'jpg';
        return res.json({ images: [{ index: 1, mime: ct, data: buf.toString('base64'), filename: generateFileName('instagram', ext) }], count: 1 });
      }
      const items = data.picker || [];
      const settled = await Promise.allSettled(
        items.map(async (item, i) => {
          const r = await fetchWithTimeout(item.url, {}, 30000);
          if (!r.ok) throw new Error(`Gagal download item ${i + 1}`);
          const buf = await r.buffer();
          const ct = r.headers.get('content-type') || 'image/jpeg';
          const ext = ct.includes('video') ? 'mp4' : 'jpg';
          return { index: i + 1, mime: ct, data: buf.toString('base64'), filename: generateFileName('instagram', ext) };
        })
      );
      settled.filter((s) => s.status === 'rejected').forEach((s) => console.error('[social/images/instagram] item gagal:', s.reason?.message));
      const images = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
      if (images.length === 0) return res.status(500).json({ error: 'Semua foto/video gagal didownload. Coba lagi.' });
      return res.json({ images, count: images.length, failed: settled.length - images.length });
    } catch (err) {
      console.error('[social/images/instagram] error:', err.message);
      return res.status(500).json({ error: 'Gagal mendownload media Instagram. Pastikan postingan publik.' });
    }
  }

  if (platform === 'twitter') {
    try {
      const data = await cobaltFetch(url);
      if (data.status !== 'picker') {
        const mediaUrl = data.url;
        if (!mediaUrl) throw new Error('No URL from cobalt');
        const r = await fetchWithTimeout(mediaUrl, {}, 30000);
        if (!r.ok) throw new Error(`cobalt fetch ${r.status}`);
        const buf = await r.buffer();
        const ct = r.headers.get('content-type') || 'image/jpeg';
        const ext = ct.includes('video') ? 'mp4' : 'jpg';
        return res.json({ images: [{ index: 1, mime: ct, data: buf.toString('base64'), filename: generateFileName('twitter', ext) }], count: 1 });
      }
      const items = data.picker || [];
      const settled = await Promise.allSettled(
        items.map(async (item, i) => {
          const r = await fetchWithTimeout(item.url, {}, 30000);
          if (!r.ok) throw new Error(`Gagal download item ${i + 1}`);
          const buf = await r.buffer();
          const ct = r.headers.get('content-type') || 'image/jpeg';
          const ext = ct.includes('video') ? 'mp4' : 'jpg';
          return { index: i + 1, mime: ct, data: buf.toString('base64'), filename: generateFileName('twitter', ext) };
        })
      );
      settled.filter((s) => s.status === 'rejected').forEach((s) => console.error('[social/images/twitter] item gagal:', s.reason?.message));
      const images = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
      if (images.length === 0) return res.status(500).json({ error: 'Semua foto/video gagal didownload. Coba lagi.' });
      return res.json({ images, count: images.length, failed: settled.length - images.length });
    } catch (err) {
      console.error('[social/images/twitter] error:', err.message);
      return res.status(500).json({ error: 'Gagal mendownload media Twitter/X. Pastikan tweet publik.' });
    }
  }
});

app.post('/api/convert/mp4-to-mp3', mp4Upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File video wajib diupload.' });
  }

  const inputPath = req.file.path;
  const outputPath = `${inputPath}.mp3`;

  const rawName = (req.file.originalname || 'audio').replace(/\.[^.]+$/, '');
  const cleanedName = rawName.replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
  const asciiName = cleanedName.replace(/[^\x20-\x7E]/g, '').trim() || 'audio';
  const encodedName = encodeURIComponent(cleanedName || 'audio');

  const ffArgs = ['-y', '-i', inputPath, '-vn', '-ab', '192k', '-ar', '44100', outputPath];
  const proc = spawn('ffmpeg', ffArgs);
  let stderrBuf = '';

  proc.stderr.on('data', (d) => (stderrBuf += d));

  proc.on('error', (err) => {
    fs.unlink(inputPath, () => {});
    if (!res.headersSent) {
      res.status(500).json({ error: 'ffmpeg tidak ditemukan/tidak bisa dijalankan. Pastikan ffmpeg sudah diinstall: ' + err.message });
    }
  });

  proc.on('close', (code) => {
    fs.unlink(inputPath, () => {});

    if (code !== 0) {
      console.error('ffmpeg mp4->mp3 error:', stderrBuf);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Gagal mengonversi video ke MP3: ' + (stderrBuf.trim().slice(-300) || `exit code ${code}`) });
      }
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}.mp3"; filename*=UTF-8''${encodedName}.mp3`);
    res.setHeader('Content-Type', 'audio/mpeg');

    const readStream = fs.createReadStream(outputPath);
    readStream.pipe(res);
    readStream.on('close', () => fs.unlink(outputPath, () => {}));
    readStream.on('error', (err) => {
      console.error('Gagal mengirim file mp3:', err.message);
      fs.unlink(outputPath, () => {});
      if (!res.headersSent) res.status(500).json({ error: 'Gagal mengirim file MP3.' });
    });
  });

  req.on('close', () => {
    if (!proc.killed) proc.kill();
  });
});


function extractCapcutUrlFromText(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/(?:www\.)?capcut\.com\/\S+/i);
  return match ? match[0].replace(/[),.]+$/, '') : null;
}

function isValidCapCutUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return host === 'capcut.com' && u.pathname.length > 1;
  } catch {
    return false;
  }
}

async function capcutFetchPage(url) {
  const resp = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  }, 15000);
  if (!resp.ok) throw new Error(`Gagal fetch halaman CapCut (HTTP ${resp.status})`);
  return await resp.text();
}

function extractCapcutTemplateId(url) {
  const m = url.match(/capcut\.com\/(?:tv2|t|template|sharevideo)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function capcutFetchRendered(url) {
  const templateId = extractCapcutTemplateId(url);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1440, height: 900 });

    const networkMp4Urls = [];
    const networkMediaUrls = [];

    const jsonEmbeddedVideoUrls = [];
    page.on('response', (response) => {
      try {
        const respUrl = response.url();
        const contentType = response.headers()['content-type'] || '';
        if (/\.mp4(\?|$)/i.test(respUrl)) networkMp4Urls.push(respUrl);
        if (contentType.startsWith('video/') && !networkMediaUrls.includes(respUrl)) {
          networkMediaUrls.push(respUrl);
        }
        if (templateId && contentType.includes('application/json')) {
          response.text().then((body) => {
            try {
              const parsed = JSON.parse(body);
              const found = [];
              function walk(node) {
                if (!node || typeof node !== 'object') return;
                if (Array.isArray(node)) {
                  node.forEach(walk);
                  return;
                }
                const selfStr = JSON.stringify(node);
                if (selfStr.includes(templateId)) {
                  const urlMatches = [...selfStr.matchAll(/https?:\\?\/\\?\/[^"'\\]*(?:capcutvod|tos-alisg|tos-useast)[^"'\\]*/gi)];
                  urlMatches.forEach((m) => {
                    const cleaned = m[0].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
                    found.push(cleaned);
                  });
                }
                Object.values(node).forEach(walk);
              }
              walk(parsed);
              found.forEach((f) => {
                if (!jsonEmbeddedVideoUrls.includes(f)) jsonEmbeddedVideoUrls.push(f);
              });
            } catch {}
          }).catch(() => {});
        }
      } catch {}
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const clicked = await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) { video.click(); return true; }
        const playBtn = document.querySelector(
          '[class*="play" i], [aria-label*="play" i], button[class*="Play"]'
        );
        if (playBtn) { playBtn.click(); return true; }
        return false;
      });
      if (clicked) await new Promise((r) => setTimeout(r, 3000));
    } catch {}

    const domVideoUrls = await page.evaluate(() => {
      const urls = [];
      document.querySelectorAll('video').forEach((v) => {
        if (v.currentSrc) urls.push(v.currentSrc);
        if (v.src) urls.push(v.src);
        v.querySelectorAll('source').forEach((s) => { if (s.src) urls.push(s.src); });
      });
      return [...new Set(urls)];
    }).catch(() => []);

    await new Promise((r) => setTimeout(r, 1500));

    const html = await page.content();
    return {
      html,
      networkMp4Urls: [...new Set(networkMp4Urls)],
      domVideoUrls: [...new Set([...domVideoUrls, ...networkMediaUrls])].filter((u) => !u.startsWith('blob:')),
      jsonEmbeddedVideoUrls: [...new Set(jsonEmbeddedVideoUrls)],
    };
  } finally {
    await browser.close();
  }
}

function extractCapcutData(html, networkMp4Urls = [], domVideoUrls = [], jsonEmbeddedVideoUrls = []) {
  let videoUrl = null;

  function extractUrlListForKey(keyNames) {
    for (const key of keyNames) {
      const re = new RegExp(`"${key}"\\s*:\\s*\\{[^{}]*?"url_?[Ll]ist"\\s*:\\s*\\[([^\\]]*)\\]`, 's');
      const match = html.match(re);
      if (match && match[1]) {
        const urls = [...match[1].matchAll(/"([^"]+)"/g)].map((m) =>
          m[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&')
        );
        if (urls.length > 0) return urls;
      }
    }
    return [];
  }
  
  const playAddrUrls = extractUrlListForKey(['play_addr', 'playAddr']);
  const downloadAddrUrls = extractUrlListForKey(['download_addr', 'downloadAddr']);

  const modernPlayUrlMatch = html.match(/"(?:playUrl|videoUrl|play_url)"\s*:\s*"(https?:\/\/[^"]+)"/i);
  if (modernPlayUrlMatch && modernPlayUrlMatch[1]) {
    const cleanUrl = modernPlayUrlMatch[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
    playAddrUrls.push(cleanUrl);
  }

  const cdnRegex = /https?:\\?\/\\?\/[^"'\s\\]*(?:capcutvod\.com|tos-alisg|tos-useast)[^"'\s\\]*/gi;
  const rawCdnMatches = html.match(cdnRegex);
  if (rawCdnMatches) {
    rawCdnMatches.forEach((m) => {
      const cleanUrl = m.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
      
      if (!jsonEmbeddedVideoUrls.includes(cleanUrl)) {
        jsonEmbeddedVideoUrls.unshift(cleanUrl);
      }
    });
  }

  const ogVideoMatch =
    html.match(/<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/i);
  if (ogVideoMatch) videoUrl = ogVideoMatch[1];

  if (!videoUrl) {
    const mp4Match = html.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/i);
    if (mp4Match) videoUrl = mp4Match[1];
  }

  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const thumbMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const ogDescMatch = html.match(/<meta[^>]+(?:property|name)=["']og:description["'][^>]+content=["']([^"']+)["']/i);

  let author = null;
  if (ogDescMatch) {
    const desc = ogDescMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    const authorMatch = desc.match(/Check out\s+(.+?)[\u2019']s template/i);
    if (authorMatch) author = authorMatch[1].trim();
  }

  let description = null;
  const descKeyMatch =
    html.match(/"desc":"((?:\\.|[^"\\])*)"/) ||
    html.match(/"videoDesc":"((?:\\.|[^"\\])*)"/) ||
    html.match(/"caption":"((?:\\.|[^"\\])*)"/);
  if (descKeyMatch && descKeyMatch[1]) {
    try {
      description = JSON.parse(`"${descKeyMatch[1]}"`);
    } catch {
      description = descKeyMatch[1];
    }
  }

  let title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&') : 'CapCut Template';
  title = title.replace(/^CapCut template:\s*/i, '');

  const cleanedVideoUrl = videoUrl ? videoUrl.replace(/&amp;/g, '&').replace(/\\u002F/g, '/').replace(/\\\//g, '/') : null;

  const videoCandidates = [
    ...jsonEmbeddedVideoUrls,
    ...playAddrUrls,
    ...(cleanedVideoUrl ? [cleanedVideoUrl] : []),
    ...domVideoUrls,
    ...networkMp4Urls,
    ...downloadAddrUrls,
  ];
  
  const finalVideoUrl = videoCandidates[0] || null;

  return {
    videoUrl: finalVideoUrl,
    videoCandidates,
    usedJsonEmbedded: jsonEmbeddedVideoUrls.length > 0 && finalVideoUrl === jsonEmbeddedVideoUrls[0],
    usedDomVideo: domVideoUrls.length > 0 && finalVideoUrl === domVideoUrls[0],
    usedPlayAddr: playAddrUrls.length > 0 && finalVideoUrl === playAddrUrls[0],
    usedNetworkSource: networkMp4Urls.length > 0 && finalVideoUrl === networkMp4Urls[0],
    title,
    thumbnail: thumbMatch ? thumbMatch[1].replace(/&amp;/g, '&') : null,
    author,
    description,
  };
}

async function getCapcutData(url) {
  if (CAPCUT_USE_BROWSER && puppeteer) {
    try {
      const { html, networkMp4Urls, domVideoUrls, jsonEmbeddedVideoUrls } = await capcutFetchRendered(url);
      return extractCapcutData(html, networkMp4Urls, domVideoUrls, jsonEmbeddedVideoUrls);
    } catch (err) {
      console.warn('[capcut] render browser gagal, fallback ke fetch HTML biasa:', err.message);
    }
  }
  const html = await capcutFetchPage(url);
  return extractCapcutData(html);
}

app.post('/api/capcut/info', async (req, res) => {
  const raw = req.body.url;
  if (!raw) return res.status(400).json({ error: 'URL wajib diisi.' });
  const url = extractCapcutUrlFromText(raw) || raw;
  if (!isValidCapCutUrl(url)) {
    return res.status(400).json({ error: 'URL tidak valid. Tempel link/teks share template CapCut (contoh: https://www.capcut.com/tv2/...).' });
  }
  try {
    const data = await getCapcutData(url);
    if (!data.videoUrl) {
      return res.status(500).json({ error: 'Video preview template tidak ditemukan di halaman ini. Pastikan link template masih aktif dan publik.' });
    }
    res.json({
      title: data.title,
      thumbnail: data.thumbnail ? `/api/social/proxy-thumbnail?url=${encodeURIComponent(data.thumbnail)}` : null,
      author: data.author,
      description: data.description,
    });
  } catch (err) {
    console.error('[capcut/info] error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil info template CapCut: ' + err.message });
  }
});

async function detectLetterboxCrop(inputPath) {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', [
      '-i', inputPath,
      '-vf', 'cropdetect=24:16:0',
      '-frames:v', '50',
      '-f', 'null', '-',
    ]);
    let stderrBuf = '';
    proc.stderr.on('data', (d) => (stderrBuf += d));
    proc.on('error', () => resolve(null));
    proc.on('close', () => {
      const matches = [...stderrBuf.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
      if (matches.length === 0) return resolve(null);
      const last = matches[matches.length - 1];
      resolve({
        w: parseInt(last[1], 10),
        h: parseInt(last[2], 10),
        x: parseInt(last[3], 10),
        y: parseInt(last[4], 10),
      });
    });
  });
}

async function getVideoDimensions(inputPath) {
  return new Promise((resolve) => {
    exec(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${inputPath}"`,
      { timeout: 15000 },
      (err, stdout) => {
        if (err) return resolve(null);
        const [w, h] = stdout.trim().split(',').map((n) => parseInt(n, 10));
        if (!w || !h) return resolve(null);
        resolve({ w, h });
      }
    );
  });
}

async function cropLetterboxIfPresent(inputPath, outputPath) {
  const dims = await getVideoDimensions(inputPath);
  if (!dims) return false;

  const crop = await detectLetterboxCrop(inputPath);
  if (!crop) return false;

  const widthCutRatio = (dims.w - crop.w) / dims.w;
  const heightCutRatio = (dims.h - crop.h) / dims.h;
  if (widthCutRatio < 0.04 && heightCutRatio < 0.04) return false;

  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', [
      '-y', '-i', inputPath,
      '-vf', `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-c:a', 'copy',
      outputPath,
    ]);
    let stderrBuf = '';
    proc.stderr.on('data', (d) => (stderrBuf += d));
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => {
      if (code !== 0) {
        console.warn('[capcut] ffmpeg crop gagal:', stderrBuf.slice(-300));
        return resolve(false);
      }
      resolve(true);
    });
  });
}

app.post('/api/capcut/download', async (req, res) => {
  const raw = req.body.url;
  if (!raw) return res.status(400).json({ error: 'URL wajib diisi.' });
  const url = extractCapcutUrlFromText(raw) || raw;
  if (!isValidCapCutUrl(url)) {
    return res.status(400).json({ error: 'URL tidak valid. Tempel link/teks share template CapCut.' });
  }

  try {
    const data = await getCapcutData(url);
    if (!data.videoUrl) throw new Error('Video preview tidak ditemukan di halaman template.');

    const sortedCandidates = [...data.videoCandidates].sort((a, b) => {
      const aHasWatermark = a.toLowerCase().includes('watermark');
      const bHasWatermark = b.toLowerCase().includes('watermark');
      return aHasWatermark - bHasWatermark;
    });

    let lastErr = null;
    for (const candidateUrl of sortedCandidates) {
      try {
        const r = await fetchWithTimeout(candidateUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Referer': 'https://www.capcut.com/',
            'Cookie': process.env.CAPCUT_COOKIES || '',
            'Accept': 'video/webm,video/ogg,video/*;q=0.9,*/*;q=0.8',
            'Range': 'bytes=0-'
          }
        }, 60000);

        const contentType = r.headers.get('content-type') || '';
        if (!r.ok || !contentType.includes('video')) {
          continue; 
        }

        if (!CAPCUT_AUTO_CROP) {
          res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('capcut', 'mp4')}"`);
          res.setHeader('Content-Type', 'video/mp4');
          r.body.pipe(res);
          return;
        }

        const tmpDir = path.join(os.tmpdir(), 'tools-dap-capcut');
        fs.mkdirSync(tmpDir, { recursive: true });
        const rawPath = path.join(tmpDir, `raw-${Date.now()}.mp4`);
        const croppedPath = path.join(tmpDir, `cropped-${Date.now()}.mp4`);

        const fileStream = fs.createWriteStream(rawPath);
        await new Promise((resolve, reject) => {
          r.body.pipe(fileStream);
          fileStream.on('finish', resolve);
          fileStream.on('error', reject);
        });

        let finalPath = rawPath;
        let didCrop = false;
        try {
          didCrop = await cropLetterboxIfPresent(rawPath, croppedPath);
          if (didCrop) finalPath = croppedPath;
        } catch (cropErr) {
          console.warn('[capcut/download] auto-crop gagal, kirim video asli:', cropErr.message);
        }

        res.setHeader('Content-Disposition', `attachment; filename="${generateFileName('capcut', 'mp4')}"`);
        res.setHeader('Content-Type', 'video/mp4');
        const outStream = fs.createReadStream(finalPath);
        outStream.pipe(res);
        outStream.on('close', () => {
          fs.unlink(rawPath, () => {});
          if (didCrop) fs.unlink(croppedPath, () => {});
        });
        return;

      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Tidak ada link video bersih yang bisa diakses.');

  } catch (err) {
    console.error('[capcut/download] error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gagal mendownload: ' + err.message });
    }
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File terlalu besar (maksimal 300MB).' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Terjadi kesalahan saat memproses file.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});

process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));