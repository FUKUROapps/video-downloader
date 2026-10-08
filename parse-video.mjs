const json = (obj, status = 200) => Response.json(obj, { status });

function extractUrl(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s"'<>]+/ig) || [];
  for (const raw of matches) {
    const u = raw.replace(/[),，。；;]+$/g, '');
    try {
      const p = new URL(u);
      if (isTaobaoHost(p.hostname) || isFacebookHost(p.hostname) || /\.(?:mp4|m3u8)(?:$)/i.test(p.pathname)) return p.href;
    } catch {}
  }
  return null;
}
function isTaobaoHost(host) {
  host = host.toLowerCase();
  return ['taobao.com','tb.cn','tmall.com','tmall.hk','taobao.hk'].some(d => host === d || host.endsWith('.' + d));
}
function isFacebookHost(host) {
  host = host.toLowerCase();
  return ['facebook.com','fb.watch','fb.com'].some(d => host === d || host.endsWith('.' + d));
}
function isAllowedPage(url, platform) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return platform === 'facebook' ? isFacebookHost(u.hostname) : isTaobaoHost(u.hostname);
  } catch { return false; }
}
function getItemId(text) {
  const s = String(text || '');
  const patterns = [/[?&]id=(\d{6,20})/i, /[?&]item_id=(\d{6,20})/i, /item(?:\.htm)?[^\d]{0,20}(\d{6,20})/i];
  for (const p of patterns) { const m = s.match(p); if (m) return m[1]; }
  return null;
}
function decodeLoose(s) {
  let out = String(s || '');
  for (let i=0; i<3; i++) {
    out = out.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x2F;/gi,'/')
      .replace(/&#47;/g,'/').replace(/\\u002[fF]/g,'/').replace(/\\u003[aA]/g,':')
      .replace(/\\u003[dD]/g,'=').replace(/\\u0026/g,'&').replace(/\\\//g,'/');
  }
  try { const decoded = decodeURIComponent(out); if (decoded.length > out.length) out += '\n' + decoded; } catch {}
  return out;
}
function mediaHostAllowed(host, platform) {
  host = host.toLowerCase();
  if (platform === 'facebook') {
    return ['fbcdn.net','fbsbx.com','facebook.com'].some(d => host === d || host.endsWith('.' + d));
  }
  return ['alicdn.com','tbcdn.cn','taobao.com','tmall.com','youku.com'].some(d => host === d || host.endsWith('.' + d));
}
function score(url) {
  if (/\.mp4(?:[?#]|$)/i.test(url)) return 10;
  if (/\.m3u8(?:[?#]|$)/i.test(url)) return 7;
  if (/\.mpd(?:[?#]|$)/i.test(url)) return 4;
  return 1;
}
function collectVideoUrls(html, platform) {
  const text = decodeLoose(html);
  const urls = new Set();
  const add = raw => {
    if (!raw) return;
    let u = String(raw).trim().replace(/\\u0026/gi,'&').replace(/&amp;/g,'&');
    try { u = decodeURIComponent(u); } catch {}
    if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:\/\//i.test(u)) return;
    try {
      const p = new URL(u);
      if (!mediaHostAllowed(p.hostname, platform)) return;
      const path = p.pathname.toLowerCase();
      const ext = /\.(?:mp4|m3u8|mpd|webm|mov|flv)$/.test(path);
      const taobaoPlayer = platform === 'taobao' && /(?:video|cloud\.video)\./i.test(p.hostname) && /(?:play|video|stream|player|download)/i.test(path);
      if (ext || taobaoPlayer) urls.add(p.href);
    } catch {}
  };
  // Standard media tags and Open Graph metadata.
  for (const m of text.matchAll(/<(?:video|source|meta)\b[^>]*(?:src|content|data-src|data-video-url)\s*=\s*["']([^"']+)["'][^>]*>/ig)) add(m[1]);
  // Common Facebook public-page fields and generic video URL keys.
  const fields = platform === 'facebook'
    ? /"(?:browser_native_hd_url|browser_native_sd_url|playable_url_quality_hd|playable_url|video_url|hd_src|sd_src|playable_url_quality_sd)"\s*:\s*"((?:\\.|[^"])*)"/ig
    : /"(?:videoUrl|video_url|playUrl|play_url|url|src|videoSrc|video_src)"\s*:\s*"((?:\\.|[^"])*)"/ig;
  for (const m of text.matchAll(fields)) add(m[1].replace(/\\u0026/gi,'&').replace(/\\\//g,'/').replace(/\\"/g,'"'));
  // Generic URLs that survive HTML/JSON/URI decoding.
  for (const m of text.matchAll(/(?:https?:)?\/\/[^\s"'<>\\]+/ig)) add(m[0]);
  return [...urls].sort((a,b)=>score(b)-score(a));
}
async function fetchPublicPage(startUrl, platform) {
  let current = startUrl;
  const agents = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  ];
  let lastResponse, html = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    // Follow redirects manually so a supplied link cannot redirect the function to an unrelated host.
    for (let hop=0; hop<6; hop++) {
      if (!isAllowedPage(current, platform)) throw new Error('链接跳转到了不支持的域名，已停止请求。请粘贴官方平台分享链接。');
      let moved = false;
      for (const ua of agents) {
        lastResponse = await fetch(current, { redirect:'manual', signal:controller.signal, headers:{
          'user-agent':ua,
          'accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'accept-language':'zh-CN,zh;q=0.9,en;q=0.8',
          'cache-control':'no-cache'
        }});
        if ([301,302,303,307,308].includes(lastResponse.status)) {
          const loc = lastResponse.headers.get('location');
          if (!loc) break;
          current = new URL(loc,current).href;
          if (!isAllowedPage(current,platform)) throw new Error('分享链接重定向到非官方页面，已停止请求。');
          moved = true; break;
        }
        html = await lastResponse.text();
        if (lastResponse.ok && collectVideoUrls(html,platform).length) return { html, finalUrl:current, response:lastResponse };
        // Try second user agent if first got a blocking page or no visible media URL.
      }
      if (!moved) return { html, finalUrl:current, response:lastResponse };
    }
    throw new Error('分享链接重定向次数过多。');
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('读取页面超时。请稍后重试，或使用公开可访问的完整链接。');
    throw e;
  } finally { clearTimeout(timer); }
}
function isDirectMedia(url) {
  try { const u = new URL(url); return ['http:','https:'].includes(u.protocol) && /\.(?:mp4|m3u8|mpd|webm|mov|flv)$/i.test(u.pathname); } catch { return false; }
}
async function parse(source) {
  const direct = String(source).match(/https?:\/\/[^\s"'<>]+/i);
  const initial = direct ? direct[0].replace(/[),，。；;]+$/g,'') : String(source).trim();
  if (isDirectMedia(initial)) {
    return { platform:'direct', title:'直接视频链接', videoUrl:initial, sourceUrl:initial, format:initial.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1] || 'video', note:'识别到直接视频链接。请确认你有权保存该视频。' };
  }
  let url;
  try { url = new URL(initial); } catch { throw new Error('没有识别到有效链接。请粘贴淘宝/天猫或 Facebook 的完整分享链接。'); }
  const platform = isFacebookHost(url.hostname) ? 'facebook' : (isTaobaoHost(url.hostname) ? 'taobao' : null);
  if (!platform) throw new Error('当前版本只处理淘宝/天猫、Facebook 分享链接，或直接 MP4/M3U8 视频地址。');
  const {html,finalUrl,response} = await fetchPublicPage(url.href,platform);
  if (!response?.ok) {
    if (response?.status === 403 || response?.status === 429) throw new Error(`${platform==='facebook'?'Facebook':'淘宝/天猫'}拒绝了服务器请求（HTTP ${response.status}）。页面可能需要登录、验证或限制自动访问；此工具不会绕过这些限制。`);
    throw new Error(`来源页面暂时无法访问（HTTP ${response?.status || '未知'}）。请检查分享链接是否公开可访问。`);
  }
  const candidates = collectVideoUrls(html.slice(0,8_000_000),platform);
  if (!candidates.length) {
    const itemId = platform==='taobao' ? (getItemId(source)||getItemId(finalUrl)||'') : '';
    if (platform==='facebook') throw new Error('没有在 Facebook 公开页面 HTML 中找到可直接访问的视频地址。很多视频需要登录或通过动态页面加载；请确认视频是公开的，并且你有权保存。此工具不会绕过登录或隐私限制。');
    throw new Error(`没有在淘宝/天猫公开商品页 HTML 中找到可直接访问的视频地址${itemId ? `（商品 ID：${itemId}）` : ''}。商品视频可能由脚本动态加载，或需要登录/临时签名；无需支付宝不代表所有商品都能自动解析。`);
  }
  const videoUrl = candidates[0];
  return {
    platform,
    itemId:platform==='taobao' ? (getItemId(source)||getItemId(finalUrl)||'') : '',
    title:platform==='facebook'?'Facebook 视频':`淘宝商品视频${getItemId(source)||getItemId(finalUrl)?' · '+(getItemId(source)||getItemId(finalUrl)):''}`,
    videoUrl, sourceUrl:finalUrl,
    format:/\.m3u8(?:[?#]|$)/i.test(videoUrl)?'m3u8':(/\.mp4(?:[?#]|$)/i.test(videoUrl)?'mp4':'stream'),
    note:`从公开页面中找到 ${candidates.length} 个候选地址。若预览失败，链接可能临时过期或需要平台授权。`
  };
}
export default async (req) => {
  try {
    if (req.method !== 'POST') return json({error:'只接受 POST 请求。'},405);
    let body; try { body=await req.json(); } catch { return json({error:'请求格式无效。'},400); }
    const source=String(body?.source||body?.videoUrl||'').trim();
    if (!source) return json({error:'请先粘贴视频或商品链接。'},400);
    return json(await parse(source));
  } catch (e) {
    return json({error:e?.message||'解析失败，请稍后重试。'},422);
  }
};
export const config = { path: "/api/parse-video" };
