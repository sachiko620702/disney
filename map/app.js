const DATA_URL = './adventure-room-map.json';
let ROOM_MAP = null;
let CURRENT_FOUND = [];
let CURRENT_ACTIVE = null;
const DECK_ZOOM = {};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const sideName = {'port-left':'左舷 / 左側','starboard-right':'右舷 / 右側','center':'中線附近'};
const zoneName = {forward:'船頭側', midship:'船中', aft:'船尾側'};

function esc(s){return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function deckNo(deck){return String(deck).padStart(2,'0');}
function parseRooms(text){return [...new Set((text.match(/\d{3,5}/g) || []).map(String))];}
function roomSelector(prefix, room){return `#${CSS.escape(prefix + room)}`;}

async function loadMap(){
  if (ROOM_MAP) return ROOM_MAP;
  const res = await fetch(DATA_URL, {cache:'no-store'});
  if (!res.ok) throw new Error('無法載入 adventure-room-map.json。請確認 JSON 與 index.html 位於同一層。');
  ROOM_MAP = await res.json();
  const decks = Object.keys(ROOM_MAP.deckStats || {}).sort((a,b)=>Number(a)-Number(b));
  $('#statRooms').textContent = Object.keys(ROOM_MAP.rooms || {}).length.toLocaleString();
  $('#statDecks').textContent = decks.join(', ');
  return ROOM_MAP;
}

function renderSummary(requested, found, missing){
  const decks = [...new Set(found.map(r => r.deck))].sort((a,b)=>a-b);
  $('#summary').innerHTML =
    `<span class="pill neutral">輸入 ${requested.length} 間</span>` +
    `<span class="pill ok">找到 ${found.length} 間</span>` +
    `<span class="pill neutral">Deck：${decks.length ? decks.join(', ') : '—'}</span>` +
    (missing.length ? `<span class="pill warn">未找到 ${missing.length} 間</span>` : '');
  const box = $('#missingBox');
  if (missing.length){
    box.style.display = 'block';
    box.textContent = '找不到：' + missing.join(', ') + '。請確認房號，或該房號是否存在於目前資料集。';
  } else {
    box.style.display = 'none';
    box.textContent = '';
  }
  $('#deckTabs').innerHTML = decks.map((d,i)=>`<button class="deck-tab ${i===0?'active':''}" data-target="deck-${d}">Deck ${d}</button>`).join('');
  $$('.deck-tab').forEach(btn => btn.addEventListener('click', () => {
    $$('.deck-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.target);
    if (target) target.scrollIntoView({behavior:'smooth', block:'start'});
  }));
}

function renderTable(found){
  $('#tableCount').textContent = `${found.length} 筆`;
  const body = $('#resultBody');
  if (!found.length){
    body.innerHTML = '<tr><td colspan="6" class="muted center">沒有找到可顯示的房號</td></tr>';
    return;
  }
  body.innerHTML = found.slice().sort((a,b)=>a.deck-b.deck || a.room.localeCompare(b.room)).map(r => `
    <tr data-room="${esc(r.room)}" data-deck="${esc(r.deck)}">
      <td data-label="房號"><b>${esc(r.room)}</b></td><td data-label="Deck">${esc(r.deck)}</td>
      <td data-label="區域">${zoneName[r.zone] || esc(r.zone || '')}</td><td data-label="左右舷">${sideName[r.side] || esc(r.side || '')}</td>
      <td data-label="SVG 房間框"><code>room-${esc(r.room)}</code></td><td data-label="SVG 房號"><code>number-${esc(r.room)}</code></td>
    </tr>`).join('');
  $$('tr[data-room]', body).forEach(row => row.addEventListener('click', () => activateRoom(row.dataset.room, row.dataset.deck)));
}

async function fetchSvg(path){
  const res = await fetch(path, {cache:'no-store'});
  if (!res.ok) throw new Error(`無法載入 SVG：${path}`);
  const text = await res.text();
  if (!text.includes('<svg')) throw new Error(`不是有效 SVG：${path}`);
  return text;
}

async function renderDecks(found){
  const area = $('#viewerArea');
  if (!found.length){ area.innerHTML = '<div class="empty">沒有可標記的房號。</div>'; return; }
  const byDeck = found.reduce((acc,r)=>{
    if (!acc[r.deck]) acc[r.deck] = [];
    acc[r.deck].push(r);
    return acc;
  }, {});
  area.innerHTML = '';
  for (const deck of Object.keys(byDeck).sort((a,b)=>Number(a)-Number(b))){
    const rooms = byDeck[deck].slice().sort((a,b)=>a.room.localeCompare(b.room));
    const flatPath = `assets/flat/DCL_DeckPlans_Adventure_Flat_Deck${deckNo(deck)}.svg`;
    const section = document.createElement('section');
    section.className = 'deck-section';
    section.id = `deck-${deck}`;
    section.innerHTML = `
      <div class="deck-head">
        <div><h2>Deck ${esc(deck)}</h2><p>完整甲板圖：保留所有房間匡線，黃色為搜尋命中房間。點房號可跳到該房間。</p></div>
        <div class="room-list">${rooms.map(r => `<button class="room-chip" data-room="${esc(r.room)}" data-deck="${esc(deck)}">${esc(r.room)}</button>`).join('')}</div>
      </div>
      <div class="svg-tools">
        <small>來源：<code>${esc(flatPath)}</code></small>
        <div class="tool-group" data-deck="${esc(deck)}">
          <button class="icon-btn zoom-out" type="button" aria-label="縮小 Deck ${esc(deck)}" title="縮小">−</button>
          <span class="zoom-label">100%</span>
          <button class="icon-btn zoom-in" type="button" aria-label="放大 Deck ${esc(deck)}" title="放大">＋</button>
          <button class="icon-btn recenter" type="button" aria-label="回到目前房間" title="回到目前房間">⌖</button>
          <button class="icon-btn reset-zoom" type="button" aria-label="重設縮放" title="重設縮放">↺</button>
        </div>
      </div>
      <div class="svg-wrap"><div class="svg-stage"><div class="muted">載入 Deck ${esc(deck)}...</div></div></div>`;
    area.appendChild(section);
    try {
      const svgText = await fetchSvg(flatPath);
      const stage = $('.svg-stage', section);
      stage.innerHTML = svgText;
      const svg = $('svg', stage);
      svg.classList.add('deck-svg');
      svg.setAttribute('role','img');
      svg.setAttribute('aria-label',`Deck ${deck} full deck plan with highlighted cabins`);
      highlightRoomsInSvg(svg, rooms.map(r => r.room));
      initDeckTools(section, deck);
      $$('.room-chip', section).forEach(btn => btn.addEventListener('click', () => activateRoom(btn.dataset.room, btn.dataset.deck)));
    } catch (err) {
      $('.svg-stage', section).innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }
  const first = found[0];
  if (first) setTimeout(() => activateRoom(first.room, first.deck, {scroll:false}), 80);
}

function highlightRoomsInSvg(svg, rooms){
  rooms.forEach(room => {
    const roomEl = svg.querySelector(roomSelector('room-', room));
    const numberEl = svg.querySelector(roomSelector('number-', room));
    if (roomEl) roomEl.classList.add('room-highlight');
    if (numberEl) numberEl.classList.add('number-highlight');
  });
}

function activateRoom(room, deck, opts={scroll:true}){
  CURRENT_ACTIVE = {room, deck:String(deck)};
  $$('.room-active,.number-active').forEach(el => el.classList.remove('room-active','number-active'));
  $$('.room-chip.active,tr.active').forEach(el => el.classList.remove('active'));
  $$(`[data-room="${CSS.escape(room)}"]`).forEach(el => el.classList.add('active'));
  $$('.deck-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.target === `deck-${deck}`));
  const section = document.getElementById(`deck-${deck}`);
  if (!section) return;
  const svg = $('svg', section);
  if (!svg) return;
  const roomEl = svg.querySelector(roomSelector('room-', room));
  const numberEl = svg.querySelector(roomSelector('number-', room));
  if (roomEl) roomEl.classList.add('room-active');
  if (numberEl) numberEl.classList.add('number-active');
  if (opts.scroll && roomEl) scrollSvgWrapToElement(section, roomEl);
}

function initDeckTools(section, deck){
  DECK_ZOOM[deck] = DECK_ZOOM[deck] || 1;
  applyDeckZoom(section, deck);
  const zoomIn = $('.zoom-in', section);
  const zoomOut = $('.zoom-out', section);
  const resetZoom = $('.reset-zoom', section);
  const recenter = $('.recenter', section);
  if (zoomIn) zoomIn.addEventListener('click', () => setDeckZoom(section, deck, DECK_ZOOM[deck] + 0.18));
  if (zoomOut) zoomOut.addEventListener('click', () => setDeckZoom(section, deck, DECK_ZOOM[deck] - 0.18));
  if (resetZoom) resetZoom.addEventListener('click', () => setDeckZoom(section, deck, 1));
  if (recenter) recenter.addEventListener('click', () => {
    const firstChip = $('.room-chip', section);
    const active = CURRENT_ACTIVE && CURRENT_ACTIVE.deck === String(deck)
      ? CURRENT_ACTIVE
      : {room: firstChip ? firstChip.dataset.room : '', deck:String(deck)};
    if (active && active.room) activateRoom(active.room, active.deck);
  });
}

function setDeckZoom(section, deck, next){
  DECK_ZOOM[deck] = Math.min(2.2, Math.max(.72, Number(next.toFixed(2))));
  applyDeckZoom(section, deck);
  if (CURRENT_ACTIVE && CURRENT_ACTIVE.deck === String(deck)) {
    const svg = $('svg', section);
    const roomEl = svg ? svg.querySelector(roomSelector('room-', CURRENT_ACTIVE.room)) : null;
    if (roomEl) scrollSvgWrapToElement(section, roomEl, {sectionScroll:false});
  }
}

function applyDeckZoom(section, deck){
  const svg = $('svg', section);
  const label = $('.zoom-label', section);
  if (!svg) return;
  const zoom = DECK_ZOOM[deck] || 1;
  svg.style.setProperty('--svg-width', `${Math.round(760 * zoom)}px`);
  if (label) label.textContent = `${Math.round(zoom * 100)}%`;
}

function scrollSvgWrapToElement(section, el, opts={}) {
  const wrap = $('.svg-wrap', section);
  const svg = $('svg', section);
  if (!wrap || !svg || !el.getBBox) return;
  const box = el.getBBox();
  const vb = svg.viewBox.baseVal;
  const svgRect = svg.getBoundingClientRect();
  const scaleY = svgRect.height / vb.height;
  const scaleX = svgRect.width / vb.width;
  const targetTop = (box.y - vb.y) * scaleY - wrap.clientHeight * 0.42;
  const targetLeft = (box.x - vb.x) * scaleX - wrap.clientWidth * 0.45;
  wrap.scrollTo({top: Math.max(0, targetTop), left: Math.max(0, targetLeft), behavior:'smooth'});
  if (opts.sectionScroll !== false) section.scrollIntoView({behavior:'smooth', block:'start'});
}

async function markRooms(pushState=true){
  const data = await loadMap();
  const requested = parseRooms($('#roomsInput').value);
  const found = [], missing = [];
  requested.forEach(room => data.rooms[room] ? found.push(data.rooms[room]) : missing.push(room));
  CURRENT_FOUND = found;
  if (pushState){
    const url = new URL(window.location.href);
    if (requested.length) url.searchParams.set('rooms', requested.join(',')); else url.searchParams.delete('rooms');
    history.replaceState(null, '', url);
  }
  renderSummary(requested, found, missing);
  renderTable(found);
  await renderDecks(found);
}

function clearAll(){
  $('#roomsInput').value = '';
  $('#viewerArea').innerHTML = '<div class="empty">輸入房號後，會依照甲板載入完整 deck plan，並把該房間的外框高亮。</div>';
  $('#summary').innerHTML = '<span class="pill neutral">尚未查詢</span>';
  $('#missingBox').style.display = 'none'; $('#missingBox').textContent = '';
  $('#deckTabs').innerHTML = '';
  $('#resultBody').innerHTML = '<tr><td colspan="6" class="muted center">尚未查詢</td></tr>';
  $('#tableCount').textContent = '0 筆';
  CURRENT_FOUND = [];
  CURRENT_ACTIVE = null;
  history.replaceState(null, '', location.pathname);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadMap();
  $('#markBtn').addEventListener('click', () => markRooms(true));
  $('#roomsInput').addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') markRooms(true); });
  $('#demoBtn').addEventListener('click', () => { $('#roomsInput').value = '17096, 12259, 15110, 18100'; markRooms(true); });
  $('#clearBtn').addEventListener('click', clearAll);
  $('#jumpResultsBtn').addEventListener('click', () => $('#resultsCard').scrollIntoView({behavior:'smooth', block:'start'}));
  $('#copyLinkBtn').addEventListener('click', async () => {
    await markRooms(true);
    try { await navigator.clipboard.writeText(location.href); $('#copyLinkBtn').textContent = '已複製'; setTimeout(()=>$('#copyLinkBtn').textContent='複製查詢連結',1200); }
    catch { alert(location.href); }
  });
  const initial = new URLSearchParams(location.search).get('rooms');
  if (initial){ $('#roomsInput').value = initial; await markRooms(false); }
});
