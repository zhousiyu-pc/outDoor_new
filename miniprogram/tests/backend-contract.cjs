const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const miniRoot = path.resolve(__dirname, '..');
const clone = (value) => JSON.parse(JSON.stringify(value));
const exampleForm = () => ({ query: '亲子绿道', sessionId: 'anon_test', originPoint: { lng: 114.1, lat: 22.7 },
  departureTime: { mode: 'CUSTOM', iso: '2026-10-01T01:00:00Z', userSelected: true }, safetyNeeds: ['厕所方便'] });
const candidate = (extra = {}) => ({ id: 'cand_a', candidateId: 'cand_a', requestId: 'req_a', title: '真实绿道',
  sourceType: 'SYSTEM_SEED', difficulty: '轻松', sourceEvidence: [{ type: 'SYSTEM_SEED', label: '来源证据' }],
  routeStats: { driveTimeText: '25分钟', walkDistanceText: '2公里' }, geo: { lng: 114.1, lat: 22.7 },
  travelPlan: { timeline: [{ time: '09:00', title: '出发' }] }, ...extra });

function harness({ respond, globalData = {}, storage = new Map(), environment = 'develop' } = {}) {
  const requests = [];
  const toasts = [];
  const deadlines = [];
  const cache = new Map();
  let pageDefinition;
  const send = (options) => {
    requests.push(options);
    const reply = respond ? respond(options, requests.length) : { data: { ok: true } };
    if (reply.fail) options.fail({ errMsg: reply.fail });
    else options.success({ statusCode: reply.statusCode || 200, data: reply.data });
  };
  const wx = {
    cloud: { callContainer: send }, request: send,
    getStorageSync: (key) => storage.has(key) ? clone(storage.get(key)) : '',
    setStorageSync: (key, value) => storage.set(key, clone(value)),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: environment } }),
    getSystemInfoSync: () => ({ platform: 'devtools' }),
    showToast: (toast) => toasts.push(toast), showShareMenu() {}, setNavigationBarTitle() {},
    navigateBack() {}, navigateTo() {}, redirectTo() {}
  };
  const context = vm.createContext({ wx, getApp: () => ({ globalData }), console: { log() {}, warn() {}, error() {} },
    setTimeout(fn, ms) {
      deadlines.push(ms);
      if (ms === 600) return 0;
      return setTimeout(fn, ms);
    }, clearTimeout,
    Page(definition) { pageDefinition = definition; }
  });
  function load(relative) {
    const file = path.resolve(miniRoot, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const wrapper = vm.runInContext(`(function(require,module,exports){${fs.readFileSync(file, 'utf8')}\n})`, context, { filename: file });
    wrapper((name) => load(path.relative(miniRoot, path.resolve(path.dirname(file), `${name}.js`))), module, module.exports);
    return module.exports;
  }
  function page(relative) {
    load(relative);
    const result = { ...pageDefinition, data: clone(pageDefinition.data) };
    result.setData = (update) => Object.assign(result.data, update);
    return result;
  }
  return { load, page, requests, toasts, storage, wx, deadlines };
}

test('search uses one canonical write path and never replays HTTP failures through aliases', async () => {
  for (const statusCode of [404, 409, 500]) {
    const h = harness({ respond: () => ({ statusCode, data: { ok: false, code: 'REJECTED' } }) });
    await assert.rejects(h.load('utils/apiClient.js').generateRecommendations(exampleForm()), { statusCode });
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].path, '/api/v1/user/search/recommendations');
  }
});

test('network retries preserve one body, session, correlation and idempotency key', async () => {
  const h = harness({ respond: (req, count) => count === 1 ? { fail: 'network interrupted' } :
    { data: { ok: true, requestId: 'req_a', items: [candidate()] } } });
  const response = await h.load('utils/apiClient.js').generateRecommendations(exampleForm());
  assert.equal(h.requests.length, 2);
  const [first, second] = h.requests;
  assert.equal(first.path, second.path);
  assert.deepEqual(clone(first.data), clone(second.data));
  assert.equal(first.header['Idempotency-Key'], second.header['Idempotency-Key']);
  assert.equal(first.data.clientRequestId, first.header['Idempotency-Key']);
  assert.equal(first.header['X-Request-ID'], first.data.clientRequestId);
  assert.equal(first.header['X-Anonymous-Session-Id'], 'anon_test');
  assert.deepEqual(clone(first.data.safetyNeeds), ['厕所方便']);
  assert.equal(response.plans[0].difficulty, '轻松');
  assert.equal(response.plans[0].sourceEvidence[0].label, '来源证据');
});

test('a failed logical write keeps its idempotency key across a new JS runtime', async () => {
  const storage = new Map();
  const first = harness({ storage, respond: () => ({ fail: 'timeout' }) });
  await assert.rejects(first.load('utils/apiClient.js').generateRecommendations(exampleForm()));
  const previous = first.requests[0];
  const retry = harness({ storage, respond: () => ({ data: { ok: true, requestId: 'req_a', items: [] } }) });
  await retry.load('utils/apiClient.js').generateRecommendations(exampleForm());
  assert.equal(retry.requests[0].header['Idempotency-Key'], previous.header['Idempotency-Key']);
  assert.deepEqual(clone(retry.requests[0].data), clone(previous.data));
  await retry.load('utils/apiClient.js').generateRecommendations(exampleForm());
  assert.notEqual(retry.requests[1].header['Idempotency-Key'], previous.header['Idempotency-Key']);
});

test('all canonical POST operations carry matching session and idempotency metadata', async () => {
  const h = harness({ respond: () => ({ data: { ok: true, routeAssetId: 'route_a', feedbackId: 'fb_a', submissionId: 'sub_a' } }) });
  const api = h.load('utils/apiClient.js');
  const plan = { ...candidate(), isSearchResult: true };
  await api.reverseGeocodeLocation({ lng: 114, lat: 22 });
  await api.adoptRouteCandidate(plan, { form: { sessionId: 'anon_test' } });
  await api.trackSearchEvent({ form: { sessionId: 'anon_test' } }, plan, 'RESULT_CLICKED');
  await api.submitUserRouteFeedback(plan, { tags: ['TOILET_WRONG'], shareExperience: false });
  await api.submitUserRoute({ title: '步道', startPoint: '公园', tags: [], shareExperience: true });
  assert.deepEqual(h.requests.map((r) => r.path), [
    '/api/v1/map/reverse-geocode', '/api/v1/user/routes/adoptions', '/api/v1/user/search/events',
    '/api/v1/user/route-feedback', '/api/v1/user/route-submissions'
  ]);
  h.requests.forEach((r) => {
    assert.equal(r.header['Idempotency-Key'], r.data.clientRequestId);
    assert.equal(r.header['X-Anonymous-Session-Id'], r.data.anonymousSessionId);
  });
});

test('explicit local base URL selects wx.request without changing cloud configuration', async () => {
  const h = harness({ globalData: { apiBaseUrl: 'http://127.0.0.1:8080/' }, respond: () => ({ data: { ok: true, items: [] } }) });
  await h.load('utils/apiClient.js').generateRecommendations(exampleForm());
  assert.equal(h.requests[0].url, 'http://127.0.0.1:8080/api/v1/user/search/recommendations');
  assert.equal(h.requests[0].config, undefined);
});

test('real cached candidates fetch detail; encoded cold candidate and route links load without cache', async () => {
  const h = harness({ globalData: { previewMode: true }, respond: (req) => ({ data: { ok: true, plan: candidate({
    title: '更新的路线', id: req.path.includes('/routes/') ? 'route_a' : 'cand_a',
    routeAssetId: req.path.includes('/routes/') ? 'route_a' : '', isAdopted: true
  }) } }) });
  const api = h.load('utils/apiClient.js');
  const fresh = await api.getRecommendationDetail('cand_a', { ...candidate(), isSearchResult: true });
  assert.equal(fresh.title, '更新的路线');
  assert.equal(fresh.isAdopted, true);
  assert.equal(fresh.sourceEvidence.length, 1);
  assert.equal(fresh.mapAction.available, true);
  await api.getRecommendationDetail('cand%5Fa');
  const route = await api.getRecommendationDetail('route%5Fa');
  assert.equal(route.routeAssetId, 'route_a');
  assert.deepEqual(h.requests.map((r) => r.path), [
    '/api/v1/user/candidates/cand_a', '/api/v1/user/candidates/cand_a', '/api/v1/user/routes/route_a'
  ]);
  const preview = { ...candidate(), previewOnly: true };
  assert.equal(await api.getRecommendationDetail('cand_a', preview), preview);
  assert.equal(h.requests.length, 3);
});

test('detail fallback is visibly marked and malformed detail is rejected', async () => {
  const h = harness({ respond: () => ({ statusCode: 503, data: { ok: false } }) });
  const store = h.load('utils/journeyStore.js');
  store.savePlanDetail(candidate());
  const page = h.page('pages/plan-detail/plan-detail.js');
  await page.loadPlan('cand_a');
  assert.equal(page.data.plan.title, '真实绿道');
  assert.match(page.data.fallbackNotice, /上次保存/);
  assert.throws(() => h.load('utils/apiClient.js').normalizePlanDetail({ ok: true, plan: {} }), /DETAIL_MALFORMED/);
});

test('adoption survives page reentry and later searches; local favorite is separate', async () => {
  const h = harness();
  const store = h.load('utils/journeyStore.js');
  store.saveForm(exampleForm());
  const normalized = h.load('utils/apiClient.js').normalizeSearchRecommendationResponse({ ok: true, requestId: 'req_a', items: [candidate()] });
  store.saveRecommendation(normalized);
  const plan = store.getPlanById('cand_a');
  store.savePlanFavorite(plan, true);
  assert.equal(store.getPlanById('cand_a').isAdopted, false);
  store.savePlanAdoption(plan, { routeAssetId: 'route_a' });
  assert.equal(store.getPlanById('cand_a').isAdopted, true);
  const results = h.page('pages/results/results.js');
  await results.loadRecommendations();
  assert.equal(results.data.plans[0].routeAssetId, 'route_a');
  assert.equal(h.requests.length, 0);
  store.saveForm(exampleForm());
  assert.equal(store.getPlanById('route_a').isAdopted, true);
});

test('failed unadopted-candidate feedback stays a draft, reopens, and retries with the same key', async () => {
  let failFeedback = true;
  const h = harness({ respond: (req) => {
    if (req.path.endsWith('/route-feedback')) return failFeedback
      ? { statusCode: 500, data: { ok: false } } : { data: { ok: true, feedbackId: 'fb_a' } };
    return { statusCode: 500, data: { ok: false } };
  } });
  const store = h.load('utils/journeyStore.js');
  store.savePlanDetail({ ...candidate(), isSearchResult: true });
  let page = h.page('pages/feedback/feedback.js');
  page.onLoad({ id: 'cand_a' });
  page.setData({ selectedTags: ['TOILET_WRONG'], note: '厕所已关闭', shareExperience: false });
  await page.submitCorrectionFeedback();
  assert.equal(h.toasts.at(-1).title, '仅保存在本机，请重试');
  assert.equal(h.requests.length, 1);
  const failed = h.requests[0];
  assert.equal(failed.path, '/api/v1/user/route-feedback');
  assert.equal(failed.data.candidateId, 'cand_a');
  assert.equal(failed.data.shareExperience, false);
  assert.equal(failed.data.visitedStatus, undefined);
  assert.equal(store.getFeedbackDraft('feedback', 'cand_a').status, 'DRAFT');
  page = h.page('pages/feedback/feedback.js');
  page.onLoad({ id: 'cand_a' });
  assert.equal(page.data.note, '厕所已关闭');
  assert.equal(page.data.shareExperience, false);
  failFeedback = false;
  await page.submitCorrectionFeedback();
  assert.equal(h.requests[1].header['Idempotency-Key'], failed.header['Idempotency-Key']);
  assert.deepEqual(clone(h.requests[1].data), clone(failed.data));
  assert.equal(h.toasts.at(-1).title, '已收到纠错');
  assert.equal(store.getFeedbackDraft('feedback', 'cand_a'), null);
  assert.equal(store.loadJourney().feedbacks[0].feedbackId, 'fb_a');
});

test('route submissions retain explicit tags, note and share choice; failed submissions do not report received', async () => {
  const h = harness({ respond: () => ({ statusCode: 409, data: { ok: false } }) });
  const page = h.page('pages/feedback/feedback.js');
  page.onLoad({ mode: 'upload' });
  page.setData({ uploadTitle: '公园环线', uploadStartPoint: '东门', selectedTags: ['PARK'], note: '可折返', shareExperience: true });
  await page.submitUploadRoute();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].path, '/api/v1/user/route-submissions');
  assert.equal(h.requests[0].data.note, '可折返');
  assert.deepEqual(clone(h.requests[0].data.tags), ['PARK']);
  assert.equal(h.requests[0].data.shareExperience, true);
  assert.equal(h.requests[0].data.visitedStatus, undefined);
  assert.equal(h.toasts.at(-1).title, '仅保存在本机，请重试');
  assert.equal(h.load('utils/journeyStore.js').getFeedbackDraft('upload').payload.title, '公园环线');
});

test('preview fallback requires explicit opt-in and always fails closed for release', async () => {
  for (const [globalData, environment, expectedPreview] of [
    [{}, 'develop', false], [{ previewMode: true }, 'release', false], [{ previewMode: true }, 'develop', true]
  ]) {
    const h = harness({ globalData, environment, respond: () => ({ statusCode: 503, data: { ok: false } }) });
    h.load('utils/journeyStore.js').saveForm(exampleForm());
    const page = h.page('pages/results/results.js');
    await page.loadRecommendations();
    assert.equal(page.data.previewMode, expectedPreview);
    assert.equal(page.data.plans.length > 0, expectedPreview);
    assert.equal(h.requests[0].timeout, 5000);
    if (expectedPreview) {
      await page.adoptPlan({ currentTarget: { dataset: { id: page.data.plans[0].id } } });
      assert.equal(h.requests.length, 1);
      assert.equal(h.toasts.at(-1).title, '预览路线暂不能加入');
      assert.equal(page.data.plans[0].isAdopted, undefined);
    }
  }
});


test('textual origin, city and source policy are preserved without coordinates, degraded labels are honest', () => {
  const api = harness().load('utils/apiClient.js');
  const request = api.buildSearchRecommendationRequest({ ...exampleForm(), originPoint: null, origin: '广州天河', city: '广州', sourcePolicy: { includeGuide: false, limit: 3 } });
  assert.equal(request.originLabel, '广州天河');
  assert.equal(request.city, '广州');
  assert.equal(request.originPoint, null);
  assert.equal(request.sourcePolicy.includeGuide, false);
  assert.equal(request.sourcePolicy.limit, 3);
  assert.equal(api.friendlyStatusLabel('DEGRADED', 'MIXED'), '服务暂时受限');
});

test('server preview data is blocked without opt-in and marked when explicitly enabled', async () => {
  for (const previewMode of [false, true]) {
    const h = harness({ globalData: { previewMode, searchDeadlineMs: 6500 }, respond: () => ({
      data: { ok: true, requestId: 'req_a', items: [candidate({ previewOnly: true })] }
    }) });
    h.load('utils/journeyStore.js').saveForm(exampleForm());
    const page = h.page('pages/results/results.js');
    await page.loadRecommendations();
    assert.equal(page.data.previewMode, previewMode);
    assert.equal(page.data.plans.length, previewMode ? 1 : 0);
    assert.equal(h.requests[0].timeout, 6500);
    if (previewMode) assert.equal(page.data.plans[0].sourceLabel, '预览路线');
  }
});

test('release rejects cached preview detail and does not render it as a stale fallback', async () => {
  const h = harness({ globalData: { previewMode: true }, environment: 'release' });
  h.load('utils/journeyStore.js').savePlanDetail(candidate({ previewOnly: true }));
  const page = h.page('pages/plan-detail/plan-detail.js');
  await page.loadPlan('cand_a');
  assert.equal(page.data.notFound, true);
  assert.equal(page.data.plan, null);
  assert.equal(h.requests.length, 0);
});

test('a malformed successful feedback response remains a draft with a stable retry key', async () => {
  const h = harness({ respond: () => ({ data: { ok: true } }) });
  h.load('utils/journeyStore.js').savePlanDetail(candidate());
  const page = h.page('pages/feedback/feedback.js');
  page.onLoad({ id: 'cand_a' });
  page.setData({ note: '入口改了' });
  await page.submitCorrectionFeedback();
  await page.submitCorrectionFeedback();
  assert.equal(h.toasts.at(-1).title, '仅保存在本机，请重试');
  assert.equal(h.requests[0].header['Idempotency-Key'], h.requests[1].header['Idempotency-Key']);
  assert.ok(h.load('utils/journeyStore.js').getFeedbackDraft('feedback', 'cand_a'));
});


test('events identify targets; asset feedback omits request ownership while candidate feedback retains it', async () => {
  const h = harness({ respond: () => ({ data: { ok: true, feedbackId: 'fb_a' } }) });
  const api = h.load('utils/apiClient.js');
  const plan = { ...candidate(), routeAssetId: 'route_a', isSearchResult: true };
  const event = api.buildSearchEventPayload({ form: { sessionId: 'anon_test' } }, plan, 'ROUTE_ADOPTED');
  assert.equal(event.candidateId, 'cand_a');
  assert.equal(event.routeAssetId, 'route_a');
  await api.submitUserRouteFeedback(plan, { requestId: 'req_from_other_session', candidateId: 'cand_a', routeAssetId: 'route_a', tags: ['TOILET_WRONG'] });
  const assetBody = h.requests[0].data;
  assert.equal(assetBody.routeAssetId, 'route_a');
  assert.equal(assetBody.candidateId, undefined);
  assert.equal(assetBody.requestId, undefined);
  await api.submitUserRouteFeedback(candidate(), { requestId: 'req_from_other_session', tags: ['TOILET_WRONG'] });
  const candidateBody = h.requests[1].data;
  assert.equal(candidateBody.candidateId, 'cand_a');
  assert.equal(candidateBody.routeAssetId, undefined);
  assert.equal(candidateBody.requestId, 'req_from_other_session');
  assert.equal(assetBody.requestId, undefined);
});

test('adopted route sharing prefers routeAssetId and a fresh session can feedback by asset only', async () => {
  const adopted = { ...candidate({ id: 'cand_a', routeAssetId: 'route_a', isAdopted: true }), isSearchResult: true };
  const source = harness();
  const detailPage = source.page('pages/plan-detail/plan-detail.js');
  detailPage.setData({ plan: adopted });
  const shared = detailPage.onShareAppMessage();
  assert.match(shared.path, /id=route_a$/);
  assert.doesNotMatch(shared.path, /cand_a/);
  assert.equal(detailPage.onShareTimeline().query, 'id=route_a');
  const sharedId = new URLSearchParams(shared.path.split('?')[1]).get('id');
  const feedbackSource = source.page('pages/feedback/feedback.js');
  feedbackSource.setData({ plan: adopted });
  assert.equal(feedbackSource.onShareAppMessage().path, shared.path);
  assert.equal(feedbackSource.onShareTimeline().query, 'id=route_a');

  const cold = harness({ respond: (req) => {
    if (req.method === 'GET' && req.path === '/api/v1/user/routes/route_a') {
      return { data: { ok: true, plan: candidate({ id: 'route_a', routeAssetId: 'route_a', isAdopted: true }) } };
    }
    if (req.path === '/api/v1/user/route-feedback') return { data: { ok: true, feedbackId: 'fb_shared' } };
    return { statusCode: 404, data: { ok: false } };
  } });
  const coldDetail = cold.page('pages/plan-detail/plan-detail.js');
  await coldDetail.onLoad({ id: sharedId });
  assert.equal(cold.requests[0].path, '/api/v1/user/routes/route_a');
  assert.equal(coldDetail.data.plan.routeAssetId, 'route_a');

  const viewer = harness({ respond: (req) => {
    if (req.method === 'GET' && req.path === '/api/v1/user/routes/route_a') {
      return { data: { ok: true, plan: candidate({ id: 'route_a', routeAssetId: 'route_a', isAdopted: true }) } };
    }
    if (req.path === '/api/v1/user/route-feedback') return { data: { ok: true, feedbackId: 'fb_shared' } };
    return { statusCode: 404, data: { ok: false } };
  } });
  const feedback = viewer.page('pages/feedback/feedback.js');
  await feedback.onLoad({ id: sharedId });
  feedback.setData({ note: '入口有变化' });
  await feedback.submitCorrectionFeedback();
  const getRequest = viewer.requests.find((item) => item.method === 'GET');
  const postRequest = viewer.requests.find((item) => item.path === '/api/v1/user/route-feedback');
  assert.equal(getRequest.path, '/api/v1/user/routes/route_a');
  assert.equal(postRequest.data.routeAssetId, 'route_a');
  assert.equal(postRequest.data.candidateId, undefined);
  assert.equal(postRequest.data.requestId, undefined);
  assert.equal(viewer.toasts.at(-1).title, '已收到纠错');
});
test('clearing every scene and safety choice survives saveForm and the search request', () => {
  const h = harness();
  const store = h.load('utils/journeyStore.js');
  const api = h.load('utils/apiClient.js');
  const form = store.normalizeForm(exampleForm());
  form.scenePreferences = form.scenePreferences.reduce((selected, value) => store.toggleListValue(selected, value), form.scenePreferences);
  form.safetyNeeds = form.safetyNeeds.reduce((selected, value) => store.toggleListValue(selected, value), form.safetyNeeds);
  assert.deepEqual(clone(form.scenePreferences), []);
  assert.deepEqual(clone(form.safetyNeeds), []);
  store.saveForm(form);
  const saved = store.loadJourney().form;
  assert.deepEqual(clone(saved.scenePreferences), []);
  assert.deepEqual(clone(saved.safetyNeeds), []);
  const request = api.buildSearchRecommendationRequest(saved);
  assert.deepEqual(clone(request.scenePreferences), []);
  assert.deepEqual(clone(request.safetyNeeds), []);
});

test('missing or non-array preferences still use defaults', () => {
  const h = harness();
  const store = h.load('utils/journeyStore.js');
  const api = h.load('utils/apiClient.js');
  for (const invalid of [undefined, null, 'PARK', {}, false]) {
    const form = { ...exampleForm(), scenePreferences: invalid, safetyNeeds: invalid };
    const normalized = store.normalizeForm(form);
    assert.deepEqual(clone(normalized.scenePreferences), clone(store.defaultForm.scenePreferences));
    assert.deepEqual(clone(normalized.safetyNeeds), clone(store.defaultForm.safetyNeeds));
    const request = api.buildSearchRecommendationRequest(form);
    assert.deepEqual(clone(request.scenePreferences), ['公园', '绿道']);
    assert.deepEqual(clone(request.safetyNeeds), ['厕所方便', '停车方便', '可随时折返']);
  }
});
