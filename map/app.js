const DATA_URL = './adventure-room-map.json';
const ROOM_DETAILS_URL = './assets/rooms.json';
const ALL_DECKS = [5,6,7,8,9,10,11,12,13,15,16,17,18,19];
let ROOM_MAP = null;
let ROOM_DETAILS = null;
let ROOM_DETAIL_LIST = [];
let CURRENT_FOUND = [];
let CURRENT_ACTIVE = null;
let CURRENT_FACILITY_QUERY = '';
let CURRENT_MODE = 'idle';
const DECK_ZOOM = {};
const ROOM_NOTES = {};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const sideName = {'port-left':'左舷 / 左側','starboard-right':'右舷 / 右側','center':'中線附近'};
const zoneName = {forward:'船頭側', midship:'船中', aft:'船尾側'};
const facilityAliases = {
  '餐廳':['restaurant','dining','eatery','kitchen','grill','cafe','café','market'],
  '吃':['restaurant','dining','eatery','kitchen','grill','cafe','café','market'],
  '廁所':['restroom'],
  '洗手間':['restroom'],
  '劇院':['theatre','theater'],
  '酒吧':['bar','lounge'],
  '泳池':['pool','splash'],
  '水療':['spa'],
  '健身':['fitness'],
  '商店':['shop','store','worldofdisney'],
  '小孩':['nursery','oceaneer','club','edge','vibe'],
  '兒童':['nursery','oceaneer','club','edge','vibe'],
  '客服':['guestservices','guestservice']
};

function esc(s){return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function deckNo(deck){return String(deck).padStart(2,'0');}
function parseRooms(text){return [...new Set((text.match(/\d{3,5}/g) || []).map(String))];}
function roomSelector(prefix, room){return `#${CSS.escape(prefix + room)}`;}
function flatPathForDeck(deck){return `assets/flat/DCL_DeckPlans_Adventure_Flat_Deck${deckNo(deck)}.svg`;}
function normalizeSearchText(text){return String(text || '').toLowerCase().replace(/&amp;/g,'&').replace(/[^a-z0-9\u4e00-\u9fff]+/g,'');}
function searchTermsFor(query){
  const base = normalizeSearchText(query);
  const aliases = facilityAliases[base] || [];
  return [base, ...aliases.map(normalizeSearchText)].filter(Boolean);
}
function yesNo(value){return value ? '是' : '否';}
function detailForRoom(room){return ROOM_DETAILS ? ROOM_DETAILS[String(room)] : null;}
function mergeRoomData(roomData){
  const detail = detailForRoom(roomData.room);
  return detail ? {...roomData, detail} : roomData;
}
function roomDetailLine(roomData){
  const detail = roomData.detail;
  if (!detail) return '';
  const parts = [detail.roomType, detail.category, detail.occupancy ? `${detail.occupancy}人` : '', detail.theme].filter(Boolean);
  if (detail.isConcierge) parts.push('Concierge');
  return parts.join(' / ');
}
function roomChipLabel(roomData){
  const detail = roomData.detail;
  return detail ? `${roomData.room} · ${detail.category}` : roomData.room;
}

async function loadMap(){
  if (ROOM_MAP) return ROOM_MAP;
  const res = await fetch(DATA_URL, {cache:'no-store'});
  if (!res.ok) throw new Error('無法載入 adventure-room-map.json。請確認 JSON 與 index.html 位於同一層。');
  ROOM_MAP = await res.json();
  await loadRoomDetails();
  const decks = Object.keys(ROOM_MAP.deckStats || {}).sort((a,b)=>Number(a)-Number(b));
  $('#statRooms').textContent = Object.keys(ROOM_MAP.rooms || {}).length.toLocaleString();
  $('#statDecks').textContent = ALL_DECKS.join(', ');
  const deckSelect = $('#deckSelect');
  if (deckSelect && !deckSelect.options.length) {
    deckSelect.innerHTML = ALL_DECKS.map(deck => `<option value="${deck}">Deck ${deck}</option>`).join('');
    deckSelect.value = '9';
  }
  return ROOM_MAP;
}

async function loadRoomDetails(){
  if (ROOM_DETAILS) return ROOM_DETAILS;
  try {
    const res = await fetch(ROOM_DETAILS_URL, {cache:'no-store'});
    if (!res.ok) throw new Error(`無法載入 ${ROOM_DETAILS_URL}`);
    const list = await res.json();
    ROOM_DETAIL_LIST = Array.isArray(list) ? list : [];
    ROOM_DETAILS = Object.fromEntries(ROOM_DETAIL_LIST.map(item => [String(item.stateroom), item]));
  } catch (err) {
    console.warn(err);
    ROOM_DETAIL_LIST = [];
    ROOM_DETAILS = {};
  }
  const typeCount = new Set(ROOM_DETAIL_LIST.map(item => item.roomType).filter(Boolean)).size;
  $('#statDetails').textContent = ROOM_DETAIL_LIST.length ? ROOM_DETAIL_LIST.length.toLocaleString() : '—';
  $('#statTypes').textContent = typeCount || '—';
  return ROOM_DETAILS;
}

function renderSummary(requested, found, missing){
  const decks = [...new Set(found.map(r => r.deck))].sort((a,b)=>a-b);
  const roomTypes = [...new Set(found.map(r => r.detail && r.detail.roomType).filter(Boolean))];
  const conciergeCount = found.filter(r => r.detail && r.detail.isConcierge).length;
  $('#summary').innerHTML =
    `<span class="pill neutral">輸入 ${requested.length} 間</span>` +
    `<span class="pill ok">找到 ${found.length} 間</span>` +
    `<span class="pill neutral">Deck：${decks.length ? decks.join(', ') : '—'}</span>` +
    (roomTypes.length ? `<span class="pill neutral">房型 ${roomTypes.length} 種</span>` : '') +
    (conciergeCount ? `<span class="pill ok">Concierge ${conciergeCount} 間</span>` : '') +
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

function renderDeckTabs(decks){
  $('#deckTabs').innerHTML = decks.map((d,i)=>`<button class="deck-tab ${i===0?'active':''}" data-target="deck-${d}">Deck ${d}</button>`).join('');
  $$('.deck-tab').forEach(btn => btn.addEventListener('click', () => {
    $$('.deck-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.target);
    if (target) target.scrollIntoView({behavior:'smooth', block:'start'});
  }));
}

function renderModeSummary(html, decks){
  $('#summary').innerHTML = html;
  $('#missingBox').style.display = 'none';
  $('#missingBox').textContent = '';
  renderDeckTabs(decks);
}

function renderTable(found){
  $('#tableCount').textContent = `${found.length} 筆`;
  const body = $('#resultBody');
  if (!found.length){
    body.innerHTML = '<tr><td colspan="12" class="muted center">沒有找到可顯示的房號</td></tr>';
    return;
  }
  body.innerHTML = found.slice().sort((a,b)=>a.deck-b.deck || a.room.localeCompare(b.room)).map(r => `
    <tr data-room="${esc(r.room)}" data-deck="${esc(r.deck)}">
      <td data-label="房號"><b>${esc(r.room)}</b></td><td data-label="Deck">${esc(r.deck)}</td>
      <td data-label="房型">${esc(r.detail && r.detail.roomType || '—')}</td>
      <td data-label="分類">${esc(r.detail && r.detail.category || '—')}</td>
      <td data-label="可住">${r.detail && r.detail.occupancy ? `${esc(r.detail.occupancy)} 人` : '—'}</td>
      <td data-label="主題">${esc(r.detail && r.detail.theme || '—')}</td>
      <td data-label="Concierge">${r.detail ? yesNo(r.detail.isConcierge) : '—'}</td>
      <td data-label="區域">${zoneName[r.zone] || esc(r.zone || '')}</td><td data-label="左右舷">${sideName[r.side] || esc(r.side || '')}</td>
      <td data-label="備註"><input class="note-input" data-note-room="${esc(r.room)}" type="text" value="${esc(ROOM_NOTES[r.room] || '')}" placeholder="例如：爸媽房、靠近電梯"></td>
      <td data-label="SVG 房間框"><code>room-${esc(r.room)}</code></td><td data-label="SVG 房號"><code>number-${esc(r.room)}</code></td>
    </tr>`).join('');
  $$('tr[data-room]', body).forEach(row => row.addEventListener('click', () => activateRoom(row.dataset.room, row.dataset.deck)));
  $$('.note-input', body).forEach(input => {
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('input', () => {
      const room = input.dataset.noteRoom;
      const value = input.value.trim();
      if (value) ROOM_NOTES[room] = value; else delete ROOM_NOTES[room];
      updateRoomNoteLabels();
      updateUrlNotesOnly();
    });
  });
}

async function fetchSvg(path){
  const res = await fetch(path, {cache:'no-store'});
  if (!res.ok) throw new Error(`無法載入 SVG：${path}`);
  const text = await res.text();
  if (!text.includes('<svg')) throw new Error(`不是有效 SVG：${path}`);
  return text;
}

async function renderDecks(found, options={}){
  const area = $('#viewerArea');
  const mode = options.mode || 'rooms';
  if (mode === 'rooms' && !found.length){ area.innerHTML = '<div class="empty">沒有可標記的房號。</div>'; return; }
  const byDeck = found.reduce((acc,r)=>{
    if (!acc[r.deck]) acc[r.deck] = [];
    acc[r.deck].push(r);
    return acc;
  }, {});
  const decks = options.decks || Object.keys(byDeck).sort((a,b)=>Number(a)-Number(b));
  if (!decks.length){ area.innerHTML = '<div class="empty">沒有可顯示的 Deck。</div>'; return; }
  area.innerHTML = '';
  for (const deck of decks){
    const rooms = (byDeck[deck] || []).slice().sort((a,b)=>a.room.localeCompare(b.room));
    const flatPath = flatPathForDeck(deck);
    const title = mode === 'facility' ? `Deck ${esc(deck)} 設施搜尋` : `Deck ${esc(deck)}`;
    const description = mode === 'overview'
      ? 'Deck 全覽模式：可縮放、拖曳檢視，並下載目前甲板圖。'
      : mode === 'facility'
        ? `搜尋「${esc(options.facilityQuery || '')}」的設施文字；點下方標籤可定位到圖面文字。`
        : '完整甲板圖：保留所有房間匡線，黃色為搜尋命中房間。點房號可跳到該房間。';
    const chipHtml = rooms.length
      ? rooms.map(r => `<button class="room-chip" data-room="${esc(r.room)}" data-deck="${esc(deck)}" title="${esc(roomDetailLine(r))}">${esc(roomChipLabel(r))}</button>`).join('')
      : '<span class="muted mini-note">載入圖面後顯示可定位項目</span>';
    const section = document.createElement('section');
    section.className = 'deck-section';
    section.id = `deck-${deck}`;
    section.innerHTML = `
      <div class="deck-head">
        <div><h2>${title}</h2><p>${description}</p></div>
        <div class="room-list">${chipHtml}</div>
      </div>
      <div class="svg-tools">
        <small>來源：<code>${esc(flatPath)}</code></small>
        <div class="tool-group" data-deck="${esc(deck)}">
          <button class="icon-btn zoom-out" type="button" aria-label="縮小 Deck ${esc(deck)}" title="縮小">−</button>
          <span class="zoom-label">100%</span>
          <button class="icon-btn zoom-in" type="button" aria-label="放大 Deck ${esc(deck)}" title="放大">＋</button>
          <button class="icon-btn recenter" type="button" aria-label="回到目前房間" title="回到目前房間">⌖</button>
          <button class="icon-btn reset-zoom" type="button" aria-label="重設縮放" title="重設縮放">↺</button>
          <button class="download-map" type="button">下載標記圖</button>
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
      svg.setAttribute('aria-label',`Deck ${deck} full deck plan`);
      if (rooms.length) {
        highlightRoomsInSvg(svg, rooms.map(r => r.room));
        renderRoomNoteLabels(svg, rooms);
      }
      if (mode === 'facility') renderFacilityMatches(section, svg, options.facilityQuery || '');
      initDeckTools(section, deck);
      $$('.room-chip', section).forEach(btn => btn.addEventListener('click', () => activateRoom(btn.dataset.room, btn.dataset.deck)));
    } catch (err) {
      $('.svg-stage', section).innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }
  const first = mode === 'rooms' ? found[0] : null;
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

function renderFacilityMatches(section, svg, query){
  const terms = searchTermsFor(query);
  const matches = [];
  $$('text', svg).forEach(textEl => {
    const label = textEl.textContent.replace(/\s+/g, ' ').trim();
    const normalizedLabel = normalizeSearchText(label);
    if (!label || !terms.some(term => normalizedLabel.includes(term))) return;
    textEl.classList.add('facility-highlight');
    textEl.dataset.facilityIndex = String(matches.length);
    matches.push({label, el:textEl});
  });
  const list = $('.room-list', section);
  if (!list) return;
  if (!matches.length) {
    list.innerHTML = '<span class="muted mini-note">此 Deck 沒有符合的設施文字</span>';
    return;
  }
  list.innerHTML = matches.slice(0, 24).map((match, index) =>
    `<button class="facility-chip" data-facility-index="${index}" type="button">${esc(match.label)}</button>`
  ).join('');
  if (matches.length > 24) list.insertAdjacentHTML('beforeend', `<span class="muted mini-note">另有 ${matches.length - 24} 筆</span>`);
  $$('.facility-chip', list).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.facility-chip.active', section).forEach(el => el.classList.remove('active'));
      $$('.facility-active', section).forEach(el => el.classList.remove('facility-active'));
      btn.classList.add('active');
      const match = matches[Number(btn.dataset.facilityIndex)];
      const target = match ? match.el : null;
      if (target) {
        target.classList.add('facility-active');
        scrollSvgWrapToElement(section, target);
      }
    });
  });
}

async function findFacilityDecks(query){
  const terms = searchTermsFor(query);
  if (!terms.length) return [];
  const matchedDecks = [];
  for (const deck of ALL_DECKS) {
    try {
      const svgText = await fetchSvg(flatPathForDeck(deck));
      const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const hasMatch = $$('text', doc).some(el => {
        const text = normalizeSearchText(el.textContent);
        return terms.some(term => text.includes(term));
      });
      if (hasMatch) matchedDecks.push(deck);
    } catch {}
  }
  return matchedDecks;
}

function renderRoomNoteLabels(svg, rooms){
  $$('.room-note-label', svg).forEach(el => el.remove());
  rooms.forEach(roomData => {
    const note = ROOM_NOTES[roomData.room];
    if (!note) return;
    const roomEl = svg.querySelector(roomSelector('room-', roomData.room));
    if (!roomEl || !roomEl.getBBox) return;
    const box = roomEl.getBBox();
    const label = createSvgNoteLabel(roomData.room, note, box);
    svg.appendChild(label);
  });
}

function createSvgNoteLabel(room, note, box){
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.classList.add('room-note-label');
  group.dataset.room = room;
  const text = trimNote(note);
  const charWidth = 8;
  const width = Math.max(58, Math.min(230, text.length * charWidth + 24));
  const height = 30;
  const x = box.x + box.width / 2 - width / 2;
  const y = Math.max(4, box.y - height - 6);
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', width);
  rect.setAttribute('height', height);
  rect.setAttribute('rx', 5);
  rect.setAttribute('ry', 5);
  const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textEl.setAttribute('x', x + width / 2);
  textEl.setAttribute('y', y + 20);
  textEl.setAttribute('text-anchor', 'middle');
  textEl.textContent = text;
  group.appendChild(rect);
  group.appendChild(textEl);
  return group;
}

function trimNote(note){
  const text = String(note || '').trim();
  return text.length > 24 ? text.slice(0, 23) + '…' : text;
}

function updateRoomNoteLabels(){
  $$('.deck-section').forEach(section => {
    const svg = $('svg', section);
    if (!svg) return;
    const rooms = $$('.room-chip', section).map(btn => {
      const room = btn.dataset.room;
      return CURRENT_FOUND.find(r => r.room === room);
    }).filter(Boolean);
    renderRoomNoteLabels(svg, rooms);
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
  const download = $('.download-map', section);
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
  if (download) download.addEventListener('click', () => downloadDeckImage(section, deck));
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

async function downloadDeckImage(section, deck){
  const svg = $('svg', section);
  if (!svg) return;
  const button = $('.download-map', section);
  const originalText = button ? button.textContent : '';
  try {
    if (button) {
      button.disabled = true;
      button.textContent = '產生中';
    }
    const blob = await svgToPngBlob(svg);
    const filename = buildDeckImageName(deck);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    if (button) button.textContent = '已下載';
  } catch (err) {
    console.error(err);
    const svgBlob = svgToSvgBlob(svg);
    const url = URL.createObjectURL(svgBlob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    if (button) button.textContent = '已開啟圖檔';
  } finally {
    if (button) {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
      }, 1400);
    }
  }
}

function buildDeckImageName(deck){
  const rooms = CURRENT_FOUND
    .filter(r => String(r.deck) === String(deck))
    .map(r => r.room)
    .join('-');
  return `disney-adventure-deck-${deck}${rooms ? '-' + rooms : ''}.png`;
}

function cloneSvgForExport(svg){
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.style.width = '';
  clone.style.maxWidth = '';
  clone.style.height = '';
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    .room-highlight{fill:#fff176!important;stroke:#d91f45!important;stroke-width:5!important;filter:drop-shadow(0 0 4px rgba(217,31,69,.7))}
    .room-active{fill:#67e8f9!important;stroke:#0e7490!important;stroke-width:6!important;filter:drop-shadow(0 0 5px rgba(14,116,144,.8))}
    .number-highlight,.number-active{fill:#991b1b!important;font-weight:900!important;paint-order:stroke;stroke:#fff!important;stroke-width:2.5px!important}
    .number-active{fill:#0e7490!important}
    .facility-highlight{fill:#0e7490!important;font-weight:950!important;paint-order:stroke;stroke:#fff!important;stroke-width:3px!important;filter:drop-shadow(0 0 4px rgba(14,116,144,.65))}
    .facility-active{fill:#d91f45!important;stroke:#fff!important;stroke-width:4px!important;filter:drop-shadow(0 0 6px rgba(217,31,69,.82))}
    .room-note-label rect{fill:#111827;stroke:#fff;stroke-width:2;filter:drop-shadow(0 1px 2px rgba(15,23,42,.35))}
    .room-note-label text{fill:#fff;font:700 13px sans-serif;paint-order:stroke;stroke:#111827;stroke-width:1px}
  `;
  clone.insertBefore(style, clone.firstChild);
  return clone;
}

function svgToSvgBlob(svg){
  const clone = cloneSvgForExport(svg);
  const markup = new XMLSerializer().serializeToString(clone);
  return new Blob([markup], {type:'image/svg+xml;charset=utf-8'});
}

function svgToPngBlob(svg){
  return new Promise((resolve, reject) => {
    const clone = cloneSvgForExport(svg);
    const vb = clone.viewBox.baseVal;
    const width = Math.max(1, Math.round(vb && vb.width ? vb.width : svg.getBoundingClientRect().width));
    const height = Math.max(1, Math.round(vb && vb.height ? vb.height : svg.getBoundingClientRect().height));
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    const markup = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([markup], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法建立 PNG。')), 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法載入匯出的 SVG。'));
    };
    img.src = url;
  });
}

function encodeNotesParam(){
  const entries = Object.entries(ROOM_NOTES).filter(([,value]) => String(value || '').trim());
  if (!entries.length) return '';
  const json = JSON.stringify(Object.fromEntries(entries));
  return btoa(unescape(encodeURIComponent(json)));
}

function restoreNotesFromUrl(){
  const encoded = new URLSearchParams(location.search).get('notes');
  if (!encoded) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    Object.keys(parsed || {}).forEach(room => {
      const value = String(parsed[room] || '').trim();
      if (value) ROOM_NOTES[room] = value;
    });
  } catch {}
}

function updateUrlForRooms(requested){
  const url = new URL(window.location.href);
  if (requested.length) url.searchParams.set('rooms', requested.join(',')); else url.searchParams.delete('rooms');
  const notes = encodeNotesParam();
  if (notes) url.searchParams.set('notes', notes); else url.searchParams.delete('notes');
  url.searchParams.delete('facility');
  url.searchParams.delete('deck');
  history.replaceState(null, '', url);
}

function updateUrlNotesOnly(){
  const url = new URL(window.location.href);
  const notes = encodeNotesParam();
  if (notes) url.searchParams.set('notes', notes); else url.searchParams.delete('notes');
  history.replaceState(null, '', url);
}

async function markRooms(pushState=true){
  const data = await loadMap();
  const requested = parseRooms($('#roomsInput').value);
  const found = [], missing = [];
  requested.forEach(room => data.rooms[room] ? found.push(mergeRoomData(data.rooms[room])) : missing.push(room));
  CURRENT_FOUND = found;
  CURRENT_FACILITY_QUERY = '';
  CURRENT_MODE = 'rooms';
  if (pushState) updateUrlForRooms(requested);
  renderSummary(requested, found, missing);
  renderTable(found);
  await renderDecks(found);
}

async function searchFacilities(pushState=true){
  const query = $('#facilityInput').value.trim();
  if (!query) return;
  CURRENT_FOUND = [];
  CURRENT_ACTIVE = null;
  CURRENT_FACILITY_QUERY = query;
  CURRENT_MODE = 'facility';
  $('#resultBody').innerHTML = '<tr><td colspan="12" class="muted center">設施搜尋不會列入房號明細</td></tr>';
  $('#tableCount').textContent = '設施模式';
  $('#summary').innerHTML = '<span class="pill neutral">搜尋設施中...</span>';
  $('#deckTabs').innerHTML = '';
  const decks = await findFacilityDecks(query);
  if (pushState) {
    const url = new URL(window.location.href);
    url.searchParams.set('facility', query);
    url.searchParams.delete('rooms');
    url.searchParams.delete('deck');
    history.replaceState(null, '', url);
  }
  if (!decks.length) {
    renderModeSummary(`<span class="pill warn">找不到「${esc(query)}」</span>`, []);
    $('#viewerArea').innerHTML = '<div class="empty">沒有找到符合的公共設施文字；可以試試英文關鍵字，例如 Restroom、Spa、Theatre。</div>';
    return;
  }
  renderModeSummary(
    `<span class="pill neutral">設施：${esc(query)}</span><span class="pill ok">找到 ${decks.length} 個 Deck</span>`,
    decks
  );
  await renderDecks([], {mode:'facility', decks, facilityQuery:query});
}

async function viewDecks(decks, pushState=true){
  CURRENT_FOUND = [];
  CURRENT_ACTIVE = null;
  CURRENT_FACILITY_QUERY = '';
  CURRENT_MODE = 'overview';
  const normalizedDecks = decks.map(Number).filter(deck => ALL_DECKS.includes(deck));
  if (!normalizedDecks.length) return;
  $('#resultBody').innerHTML = '<tr><td colspan="12" class="muted center">Deck 全覽模式不會列入房號明細</td></tr>';
  $('#tableCount').textContent = 'Deck 全覽';
  renderModeSummary(
    `<span class="pill neutral">Deck 全覽</span><span class="pill ok">${normalizedDecks.length} 張甲板圖</span>`,
    normalizedDecks
  );
  if (pushState) {
    const url = new URL(window.location.href);
    url.searchParams.set('deck', normalizedDecks.join(','));
    url.searchParams.delete('rooms');
    url.searchParams.delete('facility');
    history.replaceState(null, '', url);
  }
  await renderDecks([], {mode:'overview', decks:normalizedDecks});
}

function clearAll(){
  $('#roomsInput').value = '';
  $('#facilityInput').value = '';
  $('#viewerArea').innerHTML = '<div class="empty">輸入房號、搜尋設施，或開啟 Deck 全覽後，會在這裡載入完整 deck plan。</div>';
  $('#summary').innerHTML = '<span class="pill neutral">尚未查詢</span>';
  $('#missingBox').style.display = 'none'; $('#missingBox').textContent = '';
  $('#deckTabs').innerHTML = '';
  $('#resultBody').innerHTML = '<tr><td colspan="12" class="muted center">尚未查詢</td></tr>';
  $('#tableCount').textContent = '0 筆';
  CURRENT_FOUND = [];
  CURRENT_ACTIVE = null;
  CURRENT_FACILITY_QUERY = '';
  CURRENT_MODE = 'idle';
  Object.keys(ROOM_NOTES).forEach(room => delete ROOM_NOTES[room]);
  history.replaceState(null, '', location.pathname);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadMap();
  restoreNotesFromUrl();
  $('#markBtn').addEventListener('click', () => markRooms(true));
  $('#roomsInput').addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') markRooms(true); });
  $('#facilityInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchFacilities(true); });
  $('#facilityBtn').addEventListener('click', () => searchFacilities(true));
  $('#viewDeckBtn').addEventListener('click', () => viewDecks([Number($('#deckSelect').value)], true));
  $('#viewAllDecksBtn').addEventListener('click', () => viewDecks(ALL_DECKS, true));
  $('#demoBtn').addEventListener('click', () => { $('#roomsInput').value = '17096, 12259, 15110, 18100'; markRooms(true); });
  $('#clearBtn').addEventListener('click', clearAll);
  $('#jumpResultsBtn').addEventListener('click', () => $('#resultsCard').scrollIntoView({behavior:'smooth', block:'start'}));
  $('#copyLinkBtn').addEventListener('click', async () => {
    if (CURRENT_MODE === 'rooms' || (CURRENT_MODE === 'idle' && parseRooms($('#roomsInput').value).length)) await markRooms(true);
    else updateUrlNotesOnly();
    try { await navigator.clipboard.writeText(location.href); $('#copyLinkBtn').textContent = '已複製'; setTimeout(()=>$('#copyLinkBtn').textContent='複製查詢連結',1200); }
    catch { alert(location.href); }
  });
  const params = new URLSearchParams(location.search);
  const initialRooms = params.get('rooms');
  const initialFacility = params.get('facility');
  const initialDecks = params.get('deck');
  if (initialRooms){
    $('#roomsInput').value = initialRooms;
    await markRooms(false);
  } else if (initialFacility) {
    $('#facilityInput').value = initialFacility;
    await searchFacilities(false);
  } else if (initialDecks) {
    const decks = initialDecks.split(',').map(Number);
    await viewDecks(decks, false);
  }
});
