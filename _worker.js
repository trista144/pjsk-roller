/**
 * Cloudflare Pages 高级模式（Advanced Mode）。
 *
 * 作用：
 *   1) 本站 /audio/* 的请求，转去公共资产库取音频，再原样回来。
 *      这样浏览器永远只连 pjsk-playbox.pages.dev，不碰跨域，也不依赖 workers.dev 的连通性。
 *   2) 其他所有请求交给静态资源（index.html / quiz.html）。
 *
 * 放在仓库根目录，文件名必须是 _worker.js。
 */
const AUDIO_HOST = 'https://storage.sekai.best/sekai-jp-assets/music/short';
const AUDIO_PREFIX = '/audio/';

// 曲子封面（方图）：/image/jacket_s_001/jacket_s_001.webp
const IMAGE_HOST = 'https://storage.sekai.best/sekai-jp-assets/music/jacket';
const IMAGE_PREFIX = '/image/';

function audioResponse(status, message) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function handleAudio(request, url) {
  const rest = url.pathname.slice(AUDIO_PREFIX.length);
  // 只允许 music/short 下的音频文件名，挡住路径穿越
  if (!/^[A-Za-z0-9_]+\/[A-Za-z0-9_]+\.(mp3|flac)$/.test(rest)) {
    return audioResponse(400, 'bad audio path');
  }

  const target = `${AUDIO_HOST}/${rest}`;
  const range = request.headers.get('Range');

  let upstream;
  try {
    upstream = await fetch(target, {
      headers: {
        // 源站按来源判断，转成它自己的站点
        Referer: 'https://sekai.best/',
        Origin: 'https://sekai.best',
        ...(range ? { Range: range } : {}),
      },
      // 不要跟随 HTML 错误页
      redirect: 'follow',
    });
  } catch (error) {
    return audioResponse(502, `upstream fetch failed: ${error && error.message}`);
  }

  if (!upstream.ok && upstream.status !== 206) {
    return audioResponse(upstream.status, `upstream status ${upstream.status}`);
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'audio/mpeg');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=86400');
  // 本站同源请求，其实不需要 CORS，但带上更方便以后换域名
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  const length = upstream.headers.get('Content-Length');
  if (length) headers.set('Content-Length', length);
  const contentRange = upstream.headers.get('Content-Range');
  if (contentRange) headers.set('Content-Range', contentRange);

  return new Response(upstream.body, { status: upstream.status, headers });
}

async function handleImage(request, url) {
  const rest = url.pathname.slice(IMAGE_PREFIX.length);
  // 只允许 jacket 目录下的图片文件
  if (!/^[A-Za-z0-9_]+\/[A-Za-z0-9_]+\.(webp|png|jpg|jpeg)$/.test(rest)) {
    return new Response('bad image path', { status: 400 });
  }

  const target = `${IMAGE_HOST}/${rest}`;
  let upstream;
  try {
    upstream = await fetch(target, {
      headers: { Referer: 'https://sekai.best/', Origin: 'https://sekai.best' },
    });
  } catch (error) {
    return new Response(`upstream fetch failed: ${error && error.message}`, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (!upstream.ok) {
    return new Response(`upstream status ${upstream.status}`, {
      status: upstream.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'image/webp');
  // 封面不会变，长缓存能省掉大量请求
  headers.set('Cache-Control', 'public, max-age=604800, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  const length = upstream.headers.get('Content-Length');
  if (length) headers.set('Content-Length', length);

  return new Response(upstream.body, { status: upstream.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(AUDIO_PREFIX)) {
      return handleAudio(request, url);
    }
    if (url.pathname.startsWith(IMAGE_PREFIX)) {
      return handleImage(request, url);
    }

    // 静态资源交给 Pages
    return env.ASSETS.fetch(request);
  },
};
