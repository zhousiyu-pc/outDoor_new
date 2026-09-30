const routes = [
  {
    id: 'wetland',
    title: '坝光银叶树湿地',
    area: '坪山 · 海边湿地',
    tags: ['easy', 'family', 'water'],
    tagLabels: ['轻松', '亲子', '看水'],
    art: 'wetland',
    score: '98%',
    distance: '3.6 km',
    duration: '约 2 小时',
    difficulty: '轻松',
    summary: '平路多、风景开阔，适合想轻松走一段的家庭下午。',
    reason: '符合你想要的轻松节奏，路面和折返点比较容易判断。',
    source: '公开路线资料',
    verified: '3 天前核验',
    sourceTone: 'verified',
    notes: ['停车入口清晰', '厕所位置已标注', '海风较大，带一件薄外套'],
    schedule: [['09:30', '到达入口', '先看停车、厕所和返程点'], ['10:00', '轻量步行', '沿湿地栈道走一段，按孩子状态折返'], ['11:30', '结束返程', '不追求走完全程，留一点余量给午餐']],
  },
  {
    id: 'forest',
    title: '梧桐山小环线',
    area: '罗湖 · 林间缓坡',
    tags: ['easy'],
    tagLabels: ['林间', '轻松'],
    art: 'forest',
    score: '91%',
    distance: '4.8 km',
    duration: '约 2.5 小时',
    difficulty: '轻松/适中',
    summary: '不用登顶也能进入林间，适合想避开人群的一小段山路。',
    reason: '林荫覆盖较多，步道节奏舒缓，适合想进山但不想挑战全程。',
    source: '近期用户分享',
    verified: '12 位用户近期走过',
    sourceTone: 'community',
    notes: ['入口有缓坡', '中途补给较少', '雨后台阶可能湿滑'],
    schedule: [['10:00', '到达入口', '先确认台阶和孩子状态'], ['10:20', '林间小环线', '走到第一个休息点即可决定是否继续'], ['12:00', '原路折返', '雨后优先缩短路线']],
  },
  {
    id: 'coast',
    title: '大梅沙海滨栈道',
    area: '盐田 · 看海散步',
    tags: ['family', 'water'],
    tagLabels: ['看水', '亲子'],
    art: 'coast',
    score: '87%',
    distance: '2.4 km',
    duration: '约 1.5 小时',
    difficulty: '轻松',
    summary: '路程短、视野开阔，适合只想看海不想高强度运动。',
    reason: '距离短、退出点多，适合今天只想换换空气的轻量出发。',
    source: '地图公开信息',
    verified: '停车待确认',
    sourceTone: 'pending',
    notes: ['停车信息待确认', '公厕已标注', '周末人流可能增加'],
    schedule: [['14:00', '到达海边', '先确认停车和人流'], ['14:20', '沿栈道散步', '走到视野开阔处即可折返'], ['15:30', '看天气结束', '海边风大，注意孩子保暖']],
  },
];

const state = { view: 'home', filter: 'all', query: '', search: '', detailId: 'wetland', favorites: new Set(), adopted: new Set(), feedbackTags: new Set() };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function navigate(view) {
  state.view = view;
  $$('[data-page]').forEach((page) => {
    const active = page.dataset.page === view;
    page.hidden = !active;
    page.classList.toggle('is-active', active);
  });
  $$('.nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.view === view));
  if (view === 'results') renderRoutes();
  if (view === 'detail') renderDetail();
  if (view === 'feedback') syncFeedbackRoute();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function matchingRoutes() {
  const search = state.search.trim().toLowerCase();
  return routes.filter((route) => {
    const matchesFilter = state.filter === 'all' || route.tags.includes(state.filter);
    const matchesSearch = !search || `${route.title} ${route.area} ${route.tagLabels.join(' ')}`.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });
}

function routeArt(route) {
  return `<span class="route-number">${String(routes.indexOf(route) + 1).padStart(2, '0')} / 03</span><span class="art-stamp">${route.art === 'forest' ? 'INTO THE<br>GREEN' : route.art === 'coast' ? 'SLOW<br>TIDE' : 'COASTAL<br>WALK'}</span><span class="art-sun"></span><span class="art-shape art-shape-one"></span><span class="art-shape art-shape-two"></span><span class="art-path"></span>`;
}

function routeCard(route) {
  const saved = state.favorites.has(route.id);
  const adopted = state.adopted.has(route.id);
  return `<article class="route-card" data-route-card="${route.id}">
    <div class="route-art art-${route.art}">${routeArt(route)}<button class="save-button ${saved ? 'is-saved' : ''}" type="button" data-favorite="${route.id}" aria-label="${saved ? '取消收藏' : '收藏'}${escapeHtml(route.title)}" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button></div>
    <div class="route-content"><div class="route-card-top"><div><p class="route-area">${escapeHtml(route.area)}</p><h2>${escapeHtml(route.title)}</h2></div><span class="match-score">${route.score}<small>匹配</small></span></div>
      <p class="route-summary">${escapeHtml(route.summary)}</p><div class="route-stats"><span>↝ ${route.distance}</span><span>◷ ${route.duration}</span><span>● ${route.difficulty}</span></div>
      <div class="route-card-bottom"><span class="source-note ${route.sourceTone}"><span class="source-check">${route.sourceTone === 'pending' ? '◌' : '✓'}</span> ${escapeHtml(route.verified)} · ${escapeHtml(route.source)}</span><div class="route-actions"><button class="link-button" type="button" data-detail="${route.id}">详情 <span>→</span></button><button class="adopt-button ${adopted ? 'is-adopted' : ''}" type="button" data-adopt="${route.id}">${adopted ? '已加入' : '加入'}</button></div></div>
    </div></article>`;
}

function renderRoutes() {
  const items = matchingRoutes();
  $('#route-list').innerHTML = items.map(routeCard).join('');
  $('#result-total').textContent = items.length;
  $('#empty-state').hidden = items.length > 0;
  $$('#route-list [data-detail]').forEach((button) => button.addEventListener('click', () => { state.detailId = button.dataset.detail; navigate('detail'); }));
  $$('#route-list [data-favorite]').forEach((button) => button.addEventListener('click', () => toggleFavorite(button.dataset.favorite)));
  $$('#route-list [data-adopt]').forEach((button) => button.addEventListener('click', () => adoptRoute(button.dataset.adopt)));
}

function renderDetail() {
  const route = routes.find((item) => item.id === state.detailId) || routes[0];
  const adopted = state.adopted.has(route.id);
  $('#detail-root').innerHTML = `<div class="detail-hero"><div class="route-art art-${route.art}">${routeArt(route)}</div><div class="detail-hero-copy"><p class="eyebrow">${escapeHtml(route.area)}</p><h1 id="detail-title">${escapeHtml(route.title)}</h1><p>${escapeHtml(route.reason)}</p><div class="detail-source"><span class="source-check">${route.sourceTone === 'pending' ? '◌' : '✓'}</span>${escapeHtml(route.verified)} · ${escapeHtml(route.source)}</div></div></div>
    <div class="detail-grid"><section class="detail-panel detail-panel-main"><div class="panel-heading"><span class="panel-number">01</span><div><p class="eyebrow">适合今天吗</p><h2>先看三个事实</h2></div></div><div class="fact-grid"><div><span>距离</span><strong>${route.distance}</strong><small>从深圳出发</small></div><div><span>时间</span><strong>${route.duration}</strong><small>建议留出余量</small></div><div><span>难度</span><strong>${route.difficulty}</strong><small>按现场状态调整</small></div></div><p class="detail-reason">${escapeHtml(route.summary)} ${escapeHtml(route.reason)}</p></section>
      <section class="detail-panel"><div class="panel-heading"><span class="panel-number">02</span><div><p class="eyebrow">出发前确认</p><h2>有些信息会变化</h2></div></div><ul class="notice-list">${route.notes.map((note) => `<li><span class="notice-bullet">•</span>${escapeHtml(note)}</li>`).join('')}</ul></section></div>
    <section class="detail-panel schedule-panel"><div class="panel-heading"><span class="panel-number">03</span><div><p class="eyebrow">参考走法</p><h2>参考走法</h2></div></div><div class="schedule-list">${route.schedule.map(([time, title, copy]) => `<div class="schedule-item"><time>${time}</time><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div></div>`).join('')}</div></section>
    <div class="detail-actions"><button class="secondary-button" type="button" data-action="feedback">纠错</button><button class="primary-button" type="button" data-adopt-detail="${route.id}">${adopted ? '已加入' : '加入'} <span aria-hidden="true">→</span></button></div>`;
  $('#detail-root [data-action="feedback"]').addEventListener('click', () => navigate('feedback'));
  $('#detail-root [data-adopt-detail]').addEventListener('click', () => adoptRoute(route.id, true));
}

function syncFeedbackRoute() {
  const route = routes.find((item) => item.id === state.detailId) || routes[0];
  $('#feedback-route-title').textContent = route.title;
}

function toggleFavorite(routeId) {
  if (state.favorites.has(routeId)) { state.favorites.delete(routeId); showToast('已取消收藏'); } else { state.favorites.add(routeId); showToast('已收藏，这条路线会留在你的清单里'); }
  renderRoutes();
}

function adoptRoute(routeId, fromDetail = false) {
  state.adopted.add(routeId);
  showToast('已加入你的路线清单');
  if (fromDetail) renderDetail(); else renderRoutes();
}

function updateQuery(value) {
  state.query = value;
  $('#query-count').textContent = value.length;
}

function searchRoutes() {
  const value = $('#query-input').value.trim();
  state.query = value || '周末带孩子走一条轻松的自然步道';
  $('#results-query').textContent = state.query;
  state.filter = 'all';
  state.search = '';
  $('#route-search').value = '';
  $$('.filter-chip').forEach((chip) => chip.classList.toggle('is-selected', chip.dataset.filter === 'all'));
  navigate('results');
}

$$('[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
$('#query-input').addEventListener('input', (event) => updateQuery(event.target.value));
$$('[data-query]').forEach((button) => button.addEventListener('click', () => { $('#query-input').value = button.dataset.query; updateQuery(button.dataset.query); $('#query-input').focus(); }));
$$('[data-action="search"]').forEach((button) => button.addEventListener('click', searchRoutes));
$$('[data-route]').forEach((button) => button.addEventListener('click', () => { state.detailId = button.dataset.route; navigate('detail'); }));
$$('.filter-chip').forEach((chip) => chip.addEventListener('click', () => { state.filter = chip.dataset.filter; $$('.filter-chip').forEach((item) => item.classList.toggle('is-selected', item === chip)); renderRoutes(); }));
$('#route-search').addEventListener('input', (event) => { state.search = event.target.value; renderRoutes(); });
$('[data-reset-filters]').addEventListener('click', () => { state.filter = 'all'; state.search = ''; $('#route-search').value = ''; $$('.filter-chip').forEach((item) => item.classList.toggle('is-selected', item.dataset.filter === 'all')); renderRoutes(); });
$$('[data-feedback-tag]').forEach((button) => button.addEventListener('click', () => { const tag = button.dataset.feedbackTag; state.feedbackTags.has(tag) ? state.feedbackTags.delete(tag) : state.feedbackTags.add(tag); button.classList.toggle('is-selected', state.feedbackTags.has(tag)); }));
$('#feedback-note').addEventListener('input', (event) => { $('#feedback-count').textContent = event.target.value.length; });
$('#feedback-form').addEventListener('submit', (event) => { event.preventDefault(); if (!state.feedbackTags.size && !$('#feedback-note').value.trim()) { showToast('请选择一个问题或写一句说明'); return; } showToast('已收到纠错，谢谢你帮下一次出发的人'); event.target.reset(); state.feedbackTags.clear(); $$('.tag-button').forEach((button) => button.classList.remove('is-selected')); $('#feedback-count').textContent = '0'; window.setTimeout(() => navigate('detail'), 700); });

$('#results-query').textContent = state.query || '周末带孩子走一条轻松的自然步道';
renderRoutes();
