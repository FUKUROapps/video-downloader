const $ = s => document.querySelector(s);
const bookmarkletCode = "javascript:(()=>{try{const old=document.getElementById('__vd_assist');if(old){old.remove();return}const decode=s=>String(s||'').replace(/\\\\u002f/gi,'/').replace(/\\\\u003a/gi,':').replace(/\\\\\\//g,'/').replace(/&amp;/g,'&').replace(/\\\\u0026/gi,'&');const html=decode(document.documentElement.outerHTML);const found=new Set();const add=x=>{if(!x)return;let u=decode(x).trim().replace(/[),;]+$/g,'');if(u.startsWith('//'))u='https:'+u;try{const p=new URL(u,location.href);if(!/^https?:$/.test(p.protocol))return;const h=p.hostname.toLowerCase(),path=p.pathname.toLowerCase();const media=/\\.(mp4|m3u8|mpd|mov|webm|flv)(?:$)/i.test(path);const cdn=/(alicdn\\.com|tbcdn\\.cn|fbcdn\\.net|fbsbx\\.com|video.*\\.taobao\\.com)/i.test(h);const hint=/(video|play|stream|download|player)/i.test(path+u.slice(0,180));if(media||(cdn&&hint))found.add(p.href)}catch{}};document.querySelectorAll('video,source').forEach(e=>{add(e.currentSrc);add(e.src);add(e.getAttribute('data-src'));add(e.getAttribute('data-video-url'))});document.querySelectorAll('meta[property*=\"video\"],meta[name*=\"video\"],meta[property=\"og:video\"],meta[property=\"og:video:url\"]').forEach(e=>add(e.content));performance.getEntriesByType('resource').forEach(e=>add(e.name));for(const m of html.matchAll(/(?:https?:)?\\\\?\\/\\\\?\\/[A-Za-z0-9._~:/?#\\[\\]@!$&'()*+,;=%-]{8,}/g))add(m[0].replace(/\\\\\\//g,'/'));const arr=[...found].sort((a,b)=>(/\\.mp4(?:[?#]|$)/i.test(b)?3:0)-(/\\.mp4(?:[?#]|$)/i.test(a)?3:0));const panel=document.createElement('div');panel.id='__vd_assist';panel.style='position:fixed;z-index:2147483647;inset:12px 8px auto 8px;max-height:85vh;overflow:auto;background:#15151d;color:white;border:2px solid #ff2d86;border-radius:16px;padding:16px;font:14px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 10px 40px #000b';const title=document.createElement('div');title.textContent='VideoDL 页面辅助提取';title.style='font-size:18px;font-weight:800;margin-bottom:8px';panel.appendChild(title);const note=document.createElement('p');note.textContent=arr.length?'找到 '+arr.length+' 个候选地址。请复制一个地址，回到 VideoDL 网站粘贴并解析。':'当前页面没有发现可直接访问的视频地址。先在商品页点播放，等待视频加载后再运行一次；若仍没有，可能是 blob/加密/临时签名或平台限制。';note.style='line-height:1.5;color:#ff91bd';panel.appendChild(note);arr.slice(0,15).forEach((u,i)=>{const row=document.createElement('div');row.style='padding:8px 0;border-top:1px solid #383844;overflow-wrap:anywhere';const a=document.createElement('a');a.href=u;a.textContent=(i+1)+'. '+u;a.target='_blank';a.rel='noopener';a.style='color:#9ed7ff;display:block;font-size:12px;overflow-wrap:anywhere';row.appendChild(a);const b=document.createElement('button');b.textContent='复制地址';b.style='margin-top:6px;background:#ff2d86;color:white;border:0;border-radius:8px;padding:7px 12px;font-weight:700';b.onclick=()=>{const ta=document.createElement('textarea');ta.value=u;ta.style='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');b.textContent='已尝试复制'}catch(e){b.textContent='请长按上方链接复制'}ta.remove()};row.appendChild(b);panel.appendChild(row)});const close=document.createElement('button');close.textContent='关闭';close.style='margin-top:12px;background:#343442;color:white;border:0;border-radius:8px;padding:9px 14px;font-weight:700';close.onclick=()=>panel.remove();panel.appendChild(close);document.body.appendChild(panel)}catch(e){alert('VideoDL 辅助提取失败：'+e.message)}})()";
$('#bookmarklet').value = bookmarkletCode;
$('#copyBookmarklet').onclick = async () => {
 try { await navigator.clipboard.writeText(bookmarkletCode); status('辅助脚本已复制。请创建书签并把书签网址替换成该脚本。'); }
 catch { $('#bookmarklet').focus(); $('#bookmarklet').select(); status('自动复制受浏览器限制，请长按/复制文本框中的完整脚本。'); }
};

let current = null;
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function status(t, bad=false) { const el=$('#status'); el.textContent=t||''; el.style.color=bad?'#ff7aa9':'#b9b6c8'; }
function getHistory() { try { return JSON.parse(localStorage.getItem('vd_history_v8') || '[]'); } catch { return []; } }
function renderHistory() {
 const items=getHistory(), el=$('#history');
 if (!items.length) { el.innerHTML='<div class="empty">暂无记录</div>'; return; }
 el.innerHTML=items.slice(0,12).map(x=>`<div class="historyItem"><div class="historyDot">▶</div><div><b>${esc(x.title||'视频')}</b><span>${esc(x.time||'')}</span></div><button class="historyOpen" data-url="${esc(x.url)}">打开</button></div>`).join('');
 el.querySelectorAll('.historyOpen').forEach(b=>b.onclick=()=>window.open(b.dataset.url,'_blank','noopener'));
}
$('#resolve').onclick = async () => {
 const source=$('#source').value.trim(); if(!source){status('请先粘贴淘宝/天猫或 Facebook 链接。',true);return;}
 const btn=$('#resolve'); btn.disabled=true; btn.textContent='正在解析…'; status('正在读取公开页面并查找视频地址…'); $('#result').classList.add('hidden');
 try {
  const r=await fetch('/api/parse-video',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source})});
  const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{throw new Error(`服务器响应异常（HTTP ${r.status}）。请确认 Netlify 已部署完整项目。`)}
  if(!r.ok) throw new Error(data.error||`解析失败（HTTP ${r.status}）`);
  current=data; $('#title').textContent=data.title||'视频'; $('#itemId').textContent=data.itemId?`商品 ID：${data.itemId}`:(data.platform==='facebook'?'Facebook 视频':'已找到视频地址');
  $('#preview').src=data.videoUrl; $('#formatNote').textContent=`平台：${(data.platform||'direct').toUpperCase()} · 格式：${(data.format||'video').toUpperCase()}。${data.note||''}`; $('#result').classList.remove('hidden'); status(data.note||'解析完成。');
  const h=getHistory(); h.unshift({title:data.title,url:data.videoUrl,time:new Date().toLocaleString()}); try { localStorage.setItem('vd_history_v8',JSON.stringify(h.slice(0,12))); } catch {} renderHistory();
 } catch(e) { status(e.message||'发生错误，请重试。',true); }
 finally { btn.disabled=false; btn.textContent='解析视频'; }
};
$('#download').onclick=()=>{ if(!current?.videoUrl){status('还没有视频地址。',true);return;} window.open(current.videoUrl,'_blank','noopener'); status('已打开视频地址。若无法保存，可能是临时链接、流媒体格式或平台限制。'); };
$('#openSource').onclick=()=>{if(current?.sourceUrl)window.open(current.sourceUrl,'_blank','noopener');};
$('#clearHistory').onclick=()=>{localStorage.removeItem('vd_history_v8');renderHistory();status('记录已清除。');};
renderHistory();
