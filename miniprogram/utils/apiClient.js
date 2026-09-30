const {
  getAnonymousSessionId,
  preparePendingRequest,
  completePendingRequest
} = require('./journeyStore');

const SEARCH_PATH = '/api/v1/user/search/recommendations';
const REQUEST_TIMEOUT = 12000;

function getRuntimeConfig() {
  const app = typeof getApp === 'function' ? getApp() : null;
  return app?.globalData || {};
}

function searchDeadlineMs() {
  const configured = Number(getRuntimeConfig().searchDeadlineMs);
  return Number.isFinite(configured) && configured > 0 ? configured : 5000;
}

function canUsePreviewMode() {
  if (getRuntimeConfig().previewMode !== true) return false;
  try {
    const envVersion = wx.getAccountInfoSync?.()?.miniProgram?.envVersion;
    if (envVersion === 'release') return false;
    return envVersion === 'develop' || envVersion === 'trial' || wx.getSystemInfoSync?.()?.platform === 'devtools';
  } catch {
    return false;
  }
}

function callContainer({ path, method = 'GET', data, header = {}, timeout = REQUEST_TIMEOUT }) {
  const { cloudEnvId, cloudServiceName, apiBaseUrl } = getRuntimeConfig();
  return new Promise((resolve, reject) => {
    const options = {
      method,
      data,
      timeout,
      header: {
        'content-type': 'application/json',
        'X-Anonymous-Session-Id': data?.anonymousSessionId || getAnonymousSessionId(),
        ...header
      },
      success(response) {
        const statusCode = response?.statusCode || 0;
        const payload = parseResponseData(response.data);
        if (statusCode >= 200 && statusCode < 300 && payload?.ok !== false) {
          resolve(payload);
          return;
        }
        const error = new Error(payload?.message || `API_HTTP_${statusCode || 'UNKNOWN'}`);
        error.statusCode = statusCode;
        error.code = payload?.error?.code || payload?.code || '';
        reject(error);
      },
      fail(cause) {
        const error = new Error(cause?.errMsg || cause?.message || 'API_NETWORK_ERROR');
        error.retryable = true;
        reject(error);
      }
    };
    try {
      // Only an explicitly configured base URL selects HTTP. The deployed
      // Mini Program continues using its existing cloud container config.
      if (apiBaseUrl) {
        wx.request({ ...options, url: `${apiBaseUrl.replace(/\/$/, '')}${path}` });
      } else if (wx.cloud?.callContainer) {
        wx.cloud.callContainer({
          ...options,
          config: { env: cloudEnvId },
          path,
          header: { ...options.header, 'X-WX-SERVICE': cloudServiceName }
        });
      } else {
        reject(new Error('CONTAINER_CALL_UNAVAILABLE'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

function parseResponseData(data) {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function unwrapResponseData(response = {}) {
  let payload = parseResponseData(response);
  for (let depth = 0; depth < 2; depth += 1) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !payload.data) break;
    const nested = parseResponseData(payload.data);
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) break;
    payload = nested;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

function requestWrite(path, payload = {}, operationScope = path, timeout = REQUEST_TIMEOUT) {
  const data = {
    ...payload,
    anonymousSessionId: payload.anonymousSessionId || getAnonymousSessionId()
  };
  const operation = preparePendingRequest(operationScope, data);
  const startedAt = Date.now();
  const options = {
    path,
    timeout,
    method: 'POST',
    data: operation.payload,
    header: {
      'Idempotency-Key': operation.clientRequestId,
      'X-Request-ID': operation.clientRequestId
    }
  };
  // Retry a transport failure once against the same endpoint and exact body.
  // HTTP failures (including 409) are never replayed or sent to an alias.
  return callContainer(options)
    .catch((error) => {
      const remainingMs = timeout - (Date.now() - startedAt);
      if (!error.retryable || remainingMs <= 0) throw error;
      return callContainer({ ...options, timeout: remainingMs });
    })
    .then((response) => {
      const result = unwrapResponseData(response);
      if (result.ok === false) throw new Error(result.message || 'API_REJECTED');
      const requiredId = {
        '/api/v1/user/routes/adoptions': 'routeAssetId',
        '/api/v1/user/route-feedback': 'feedbackId',
        '/api/v1/user/route-submissions': 'submissionId'
      }[path];
      if (requiredId && !result[requiredId]) throw new Error('API_RESPONSE_MALFORMED');
      completePendingRequest(operationScope, operation.clientRequestId);
      return result;
    });
}

function driveLimitToMinutes(value = '') {
  if (value.includes('30')) return 30;
  if (value.includes('45')) return 45;
  if (value.includes('60') || value.includes('1小时')) return 60;
  if (value.includes('90') || value.includes('1.5')) return 90;
  return 45;
}

function normalizeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function isSupportedOriginPoint(point = {}) {
  point = point || {};
  const lng = Number(point.lng ?? point.longitude);
  const lat = Number(point.lat ?? point.latitude);
  return Number.isFinite(lng) && Number.isFinite(lat)
    && lng >= 73 && lng <= 135
    && lat >= 3 && lat <= 54;
}

function buildSearchRecommendationRequest(form = {}) {
  const originPoint = isSupportedOriginPoint(form.originPoint) ? form.originPoint : null;
  return {
    query: form.query || form.destinationHint || '亲子户外',
    originLabel: form.origin || form.originLabel || '深圳龙岗坪地',
    originPoint,
    city: form.city || '深圳',
    destinationHint: form.destinationHint || '',
    ageRange: form.ageRange || '6-10岁',
    duration: form.duration || '半天',
    difficulty: form.difficulty || '轻松',
    transport: form.transport || '自驾',
    driveLimitMinutes: driveLimitToMinutes(form.driveLimit),
    safetyNeeds: normalizeArray(form.safetyNeeds, ['厕所方便', '停车方便', '可随时折返']),
    scenePreferences: normalizeArray(form.scenePreferences, ['公园', '绿道']),
    anonymousSessionId: form.sessionId || getAnonymousSessionId(),
    ...(form.clientRequestId ? { clientRequestId: form.clientRequestId } : {}),
    departureTime: form.departureTime || null,
    sourcePolicy: {
      includeSystem: true,
      includeMap: true,
      includeGuide: true,
      includeUserShared: true,
      limit: 10,
      ...(form.sourcePolicy || {})
    }
  };
}

function reverseGeocodeLocation(point = {}) {
  if (!point || point.lng === undefined || point.lat === undefined) {
    return Promise.reject(new Error('LOCATION_COORDINATES_REQUIRED'));
  }
  return requestWrite('/api/v1/map/reverse-geocode', {
    lng: Number(point.lng),
    lat: Number(point.lat),
    name: point.name || ''
  });
}

function buildLegacyRecommendationRequest(form = {}) {
  const safetyNeeds = normalizeArray(form.safetyNeeds, ['厕所方便', '可随时折返', '车程可控']);

  return {
    intent: form.intent || 'WEEKEND_FAMILY_OUTDOOR',
    origin: form.origin || '',
    ageRange: form.ageRange || '',
    duration: form.duration || '',
    difficulty: form.difficulty || '',
    transport: form.transport || '',
    driveLimit: form.driveLimit || '',
    profile: {
      ageRange: form.ageRange || '',
      transport: form.transport || '',
      driveLimit: form.driveLimit || '',
      difficulty: form.difficulty || '',
      duration: form.duration || '',
      safetyNeeds
    }
  };
}

function friendlyStatusLabel(status, resultType = '') {
  if (status === 'DEGRADED' || resultType === 'DEGRADED') return '服务暂时受限';
  if (resultType === 'EXTERNAL_FALLBACK') return '可参考';
  if (resultType === 'MIXED') return '综合结果';
  if (resultType === 'SYSTEM_ONLY') return '精选路线';
  if (status === 'READY') return '已找到';
  if (status === 'NO_MATCH' || status === 'NO_SEARCH_RESULTS') return '暂无匹配';
  if (status === 'INSUFFICIENT_POOL') return '可参考';
  if (status === 'PENDING') return '正在找路线';
  if (status === 'NO_FORM') return '还没说你的想法';
  if (status === 'ERROR') return '暂时不可用';
  return '已找到';
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined && item !== '');
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function sourceLabel(sourceType = '') {
  if (sourceType === 'AMAP_POI') return '地图上的去处';
  if (sourceType === 'GUIDE_PUBLIC') return '攻略发现';
  if (sourceType === 'USER_SHARED') return '用户分享';
  if (String(sourceType).startsWith('SYSTEM')) return '精选路线';
  return '可参考结果';
}

function isExternalSource(sourceType = '') {
  return ['AMAP_POI', 'GUIDE_PUBLIC', 'USER_SHARED', 'EXTERNAL_MERGED'].includes(sourceType);
}

function hasKeyword(items = [], keyword) {
  return normalizeList(items).some((item) => String(item).includes(keyword));
}

function buildFacilityCards({ routeStats = {}, missingItems = [], riskWarnings = [], mapAction = {} } = {}) {
  const warnings = [...normalizeList(missingItems), ...normalizeList(riskWarnings)];
  const driveText = routeStats.driveTimeText || '以当天导航为准';
  const walkText = routeStats.walkDistanceText || routeStats.childDurationText || '按现场情况灵活调整';
  return [
    { key: 'distance', label: '距离/车程', value: driveText, tone: routeStats.driveTimeText ? 'ready' : 'warn' },
    { key: 'parking', label: '停车', value: hasKeyword(warnings, '停车') ? '出发前再看一眼' : '可结合地图查看', tone: hasKeyword(warnings, '停车') ? 'warn' : 'ready' },
    { key: 'toilet', label: '厕所', value: hasKeyword(warnings, '厕所') ? '出发前再看一眼' : '到场后先看位置', tone: hasKeyword(warnings, '厕所') ? 'warn' : 'ready' },
    { key: 'weather', label: '天气', value: hasKeyword(warnings, '天气') ? '当天再看变化' : '出发前看当天变化', tone: 'warn' },
    { key: 'place', label: '地点', value: mapAction.available ? '可打开地图' : '可按名称搜索', tone: mapAction.available ? 'ready' : 'warn' },
    { key: 'walk', label: '活动量', value: walkText, tone: routeStats.walkDistanceText || routeStats.childDurationText ? 'ready' : 'neutral' }
  ];
}


function mapActionFromItem(item = {}) {
  const rawRef = item.rawRef || {};
  const geo = item.geo || rawRef.geo || {};
  const mapAction = item.mapAction || rawRef.mapAction || {};
  const lng = mapAction.lng ?? mapAction.longitude ?? geo.lng ?? geo.longitude ?? item.lng ?? item.longitude ?? '';
  const lat = mapAction.lat ?? mapAction.latitude ?? geo.lat ?? geo.latitude ?? item.lat ?? item.latitude ?? '';
  const coordinateReady = lng !== '' && lat !== '' && Number.isFinite(Number(lng)) && Number.isFinite(Number(lat));
  return {
    ...mapAction,
    lng,
    lat,
    name: mapAction.name || geo.name || item.title || '',
    address: mapAction.address || geo.address || item.address || '',
    available: coordinateReady
  };
}

function coverImageFromItem(item = {}) {
  const rawRef = item.rawRef || {};
  const direct = [
    rawRef.coverImageUrl,
    rawRef.coverUrl,
    rawRef.imageUrl,
    rawRef.photoUrl
  ].find((value) => typeof value === 'string' && /^https?:\/\//.test(value));
  if (direct) {
    return direct;
  }
  const photos = Array.isArray(rawRef.photos) ? rawRef.photos : [];
  const firstPhoto = photos.find((photo) => {
    const url = photo?.url || photo?.imageUrl || photo?.photoUrl || '';
    return /^https?:\/\//.test(url);
  });
  return firstPhoto?.url || firstPhoto?.imageUrl || firstPhoto?.photoUrl || '';
}

function buildDecisionFacts(facilityCards = []) {
  const preferredOrder = ['distance', 'parking', 'toilet', 'weather'];
  const picked = [];
  preferredOrder.forEach((key) => {
    const fact = facilityCards.find((item) => item.key === key);
    if (!fact) {
      return;
    }
    if (key === 'weather' && picked.some((item) => item.key === 'toilet')) {
      return;
    }
    picked.push(fact);
  });
  return picked.slice(0, 3);
}

function normalizeSearchItem(item = {}, index = 0, requestId = '') {
  const rawRef = item.rawRef || {};
  const evidence = item.sourceEvidence || rawRef.sourceEvidence || rawRef.sources || [];
  const sourceEvidence = Array.isArray(evidence) ? evidence[0] || {} : evidence;
  const sourceType = item.sourceType || rawRef.sourceType || sourceEvidence.type || '';
  const source = item.sourceLabel || rawRef.sourceLabel || sourceEvidence.label || sourceLabel(sourceType);
  const routeStats = item.routeStats || rawRef.routeStats || {};
  const missingItems = normalizeList(item.missingItems).slice(0, 4);
  const riskWarnings = normalizeList(item.riskWarnings).slice(0, 2);
  const external = isExternalSource(sourceType);
  const mapAction = mapActionFromItem(item);
  const facilityCards = buildFacilityCards({ routeStats, missingItems, riskWarnings, mapAction });
  const coverImageUrl = coverImageFromItem(item);
  return {
    ...item,
    id: item.id || item.candidateId || item.routeAssetId || `search-${index + 1}`,
    shortlineId: rawRef.shortlineId || rawRef.routeId || '',
    stableKey: item.stableKey || '',
    requestId: item.requestId || requestId,
    rawItem: item,
    rawRef,
    sourceEvidence: evidence,
    routeStats,
    geo: item.geo || rawRef.geo || {},
    candidateId: item.candidateId || rawRef.candidateId || (String(item.id || '').startsWith('route_') ? '' : item.id) || '',
    adoptionRequired: item.adoptionRequired ?? (rawRef.adoptionRequired !== false),
    collectedAt: item.collectedAt || sourceEvidence.collectedAt || '',
    isAdopted: item.isAdopted === true,
    routeAssetId: item.routeAssetId || rawRef.routeAssetId || '',
    previewOnly: item.previewOnly === true || rawRef.previewOnly === true,
    rank: item.rank || index + 1,
    title: item.title || '待命名路线',
    summary: item.subtitle || item.confidenceLabel || '可作为亲子户外搜索结果。',
    sourceType,
    sourceLabel: source,
    sourceTone: external ? 'external' : 'system',
    trustLabel: external ? '出发前参考' : (item.trustLevel || '可参考'),
    confidenceLabel: item.confidenceLabel || (external ? '出发前参考' : '可参考'),
    driveTime: routeStats.driveTimeText || '以当天导航为准',
    activity: routeStats.walkDistanceText || routeStats.childDurationText || '按现场情况灵活调整',
    difficulty: item.difficulty || routeStats.difficulty || routeStats.difficultyLabel || (external ? '现场判断' : '可参考'),
    reasons: normalizeList(item.matchReasons).slice(0, 3),
    missingItems,
    riskWarnings,
    warningText: [...missingItems, ...riskWarnings].slice(0, 3).join('、') || '天气、开放、停车和厕所建议出发前再看一眼',
    mapAction,
    coverImageUrl,
    hasCoverImage: Boolean(coverImageUrl),
    travelPlan: item.travelPlan || rawRef.travelPlan || null,
    facilityCards,
    decisionFacts: buildDecisionFacts(facilityCards),
    audience: '亲子家庭｜出发前参考',
    uncertainties: [...riskWarnings, ...missingItems, external ? '停车、厕所、天气和开放情况建议出发前再看一眼。' : '出发前看当天现场情况。'].filter(Boolean),
    checklist: [
      '出发前看天气、开放状态和临时封闭信息。',
      '看导航入口、停车、厕所和补给点。'
    ],
    timeline: normalizeList(item.travelPlan?.timeline || rawRef.travelPlan?.timeline).length ? normalizeList(item.travelPlan?.timeline || rawRef.travelPlan.timeline).map(normalizeTimelineItem) : [
      { time: '到达后', title: '现场确认', description: '这条路线还没有完整走法，先按地图点到场确认。' }
    ],
    pointNotes: [
      { point: '位置', note: item.geo?.address || item.geo?.name || '位置出发前再看一眼。' },
      { point: '参考来源', note: source },
      { point: '出发前确认', note: [...missingItems, ...riskWarnings].slice(0, 2).join('；') || '开放、停车、厕所建议再看一眼。' }
    ],
    isSearchResult: true
  };
}

function normalizeLegacyPlan(plan = {}, index = 0) {
  const reasons = normalizeList(plan.reasons || plan.matchedReasons || plan.personalizedReasons);
  const riskWarnings = normalizeList(plan.riskWarnings || plan.uncertainties);
  return {
    ...plan,
    id: plan.id || plan.recommendationId || `legacy-${index + 1}`,
    shortlineId: plan.shortlineId || '',
    rank: index + 1,
    roleLabel: plan.roleLabel || (index === 0 ? '优先结果' : '备选结果'),
    title: plan.title || plan.displayTitle || '亲子户外路线',
    summary: plan.summary || plan.familyFitExplanation || '已为你整理适合亲子出发的路线信息。',
    sourceLabel: '精选路线',
    sourceTone: 'system',
    trustLabel: '可参考',
    confidenceLabel: plan.confidenceLabel || '出发前参考',
    audience: plan.audience || plan.suitableAgeText || '亲子家庭',
    driveTime: plan.driveTime || plan.driveTimeText || '以当天导航为准',
    activity: plan.activity || plan.activityType || '亲子户外',
    difficulty: plan.difficulty || plan.difficultyLabel || '亲子友好',
    reasons,
    uncertainties: riskWarnings,
    missingItems: riskWarnings.slice(0, 3),
    warningText: riskWarnings[0] || '出发前看天气、停车和厕所',
    facilityCards: buildFacilityCards({ routeStats: {}, missingItems: [], riskWarnings }),
    checklist: normalizeList(plan.checklist || plan.preparationTips),
    timeline: normalizeList(plan.timeline),
    travelPlan: plan.travelPlan || null,
    pointNotes: normalizeList(plan.pointNotes)
  };
}



function normalizeSearchRecommendationResponse(response = {}) {
  const payload = unwrapResponseData(response);
  const items = normalizeList(payload.items || payload.results || payload.candidates || (Array.isArray(payload.data) ? payload.data : []));
  const plans = items.map((item, index) => normalizeSearchItem(item, index, payload.requestId || ''));
  return {
    ok: payload.ok !== false,
    status: payload.status || (plans.length ? 'READY' : 'NO_SEARCH_RESULTS'),
    resultType: payload.resultType || '',
    message: payload.message || (plans.length ? '已经帮你找到一些可以参考的路线。' : '暂时没有找到合适的路线，可以换个地方或换个说法试试。'),
    requestId: payload.requestId || '',
    sourceSummary: payload.sourceSummary || {},
    warnings: normalizeList(payload.warnings),
    plans,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    nextActions: normalizeList(payload.nextActions).length
      ? normalizeList(payload.nextActions)
      : nextActionsByStatus(plans.length ? 'READY' : 'NO_SEARCH_RESULTS')
  };
}

function normalizeLegacyRecommendationResponse(response = {}) {
  const payload = unwrapResponseData(response);
  const plans = normalizeList(payload.plans || payload.items || (Array.isArray(payload.data) ? payload.data : [])).map(normalizeLegacyPlan);
  const status = payload.status || (plans.length ? 'READY' : 'NO_MATCH');
  return {
    ok: payload.ok !== false,
    status,
    resultType: plans.length ? 'SYSTEM_ONLY' : 'NO_SEARCH_RESULTS',
    message: statusMessage(status, payload.message, plans.length > 0),
    requestId: '',
    sourceSummary: { systemCount: plans.length, mapCount: 0, userSharedCount: 0 },
    warnings: normalizeList(payload.warnings),
    pool: normalizePoolForUser(payload.pool, status),
    plans,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    nextActions: nextActionsByStatus(status)
  };
}

function statusMessage(status, serverMessage, hasPlans) {
  if (status === 'NO_MATCH') {
    return '当前条件暂时没有匹配路线，可以调整出发位置、车程或活动强度后再试。';
  }
  if (status === 'INSUFFICIENT_POOL') {
    return '当前可直接参考的路线还不够稳定，请稍后再试。';
  }
  if (status === 'ERROR') {
    return '暂时没有拿到路线结果，请稍后重试；也可以先调整条件后再次搜索。';
  }
  return serverMessage || (hasPlans
    ? '已根据当前出发条件找到亲子户外路线。'
    : '当前条件暂时没有匹配路线，可以调整出发位置、车程或活动强度后再试。');
}

function nextActionsByStatus(status) {
  if (status === 'NO_MATCH' || status === 'NO_SEARCH_RESULTS') {
    return ['换个关键词或区域后再试。', '放宽车程或难度后再试。'];
  }
  if (status === 'INSUFFICIENT_POOL') {
    return ['稍后重新搜索。', '出发前看天气、开放状态、停车和厕所。'];
  }
  if (status === 'ERROR') {
    return ['稍后重新搜索。', '出发前看天气、开放状态、停车和厕所。'];
  }
  return [];
}

function normalizePoolForUser(pool, status) {
  if (!pool) {
    return null;
  }
  if (status === 'NO_MATCH') {
    return {
      ...pool,
      message: '当前条件下暂时没有合适路线。'
    };
  }
  if (status === 'INSUFFICIENT_POOL') {
    return {
      ...pool,
      message: '当前可直接参考的路线还不够稳定。'
    };
  }
  return pool;
}

function buildUnavailableResponse() {
  return {
    ok: false,
    status: 'ERROR',
    resultType: 'ERROR',
    message: '搜索服务暂时不可用，请稍后重试；也可以调整关键词后再试。',
    pool: null,
    plans: [],
    generatedAt: new Date().toISOString(),
    nextActions: ['稍后重新搜索。', '换个关键词或放宽车程后再试。']
  };
}

function generateRecommendations(form) {
  return requestWrite(SEARCH_PATH, buildSearchRecommendationRequest(form), SEARCH_PATH, searchDeadlineMs())
    .then(normalizeSearchRecommendationResponse);
}

function buildSearchEventPayload(journey = {}, plan = {}, eventType, context = {}) {
  const form = journey.form || {};
  return {
    requestId: plan.requestId || journey.searchRequestId || '',
    resultItemId: plan.id || '',
    candidateId: plan.candidateId || plan.rawItem?.rawRef?.candidateId || '',
    routeAssetId: plan.routeAssetId || '',
    stableKey: plan.stableKey || '',
    eventType,
    anonymousSessionId: form.sessionId || '',
    eventContext: {
      rank: plan.rank || 0,
      sourceType: plan.sourceType || '',
      query: form.query || '',
      title: plan.title || '',
      ...context
    },
    itemSnapshot: plan.rawItem || null
  };
}

function adoptRouteCandidate(plan = {}, journey = {}) {
  const candidateId = plan.candidateId || plan.rawItem?.rawRef?.candidateId || plan.id || '';
  if (!candidateId || plan.previewOnly) {
    return Promise.reject(new Error(plan.previewOnly ? 'PREVIEW_CANNOT_BE_ADOPTED' : 'CANDIDATE_ID_REQUIRED'));
  }
  const path = '/api/v1/user/routes/adoptions';
  return requestWrite(path, {
    requestId: plan.requestId || journey.searchRequestId || '',
    candidateId,
    anonymousSessionId: journey.form?.sessionId || getAnonymousSessionId(),
    adoptionContext: {
      title: plan.title || '',
      sourceType: plan.sourceType || '',
      sourceLabel: plan.sourceLabel || ''
    }
  }, `${path}:${candidateId}`).then((response) => {
    if (!response.routeAssetId) throw new Error('ADOPTION_MALFORMED');
    return response;
  });
}

function trackSearchEvent(journey, plan, eventType, context = {}) {
  if (!plan?.isSearchResult || plan.previewOnly) {
    return Promise.resolve({ ok: true, skipped: true });
  }
  return requestWrite('/api/v1/user/search/events', buildSearchEventPayload(journey, plan, eventType, context));
}

function normalizeTimelineItem(item = {}) {
  return {
    time: item.time || '',
    title: item.title || item.text || item.label || '行程节点',
    description: item.description || item.content || ''
  };
}

function compactJoin(values) {
  return normalizeList(values).join(' · ');
}

function normalizePlanDetail(response = {}, cachedPlan = null) {
  if (response?.ok === false) {
    throw new Error('DETAIL_NOT_READY');
  }
  const payload = unwrapResponseData(response);
  if (payload.ok === false) {
    throw new Error('DETAIL_NOT_READY');
  }
  const data = payload.plan || payload;
  if (!data.id && !data.candidateId && !data.routeAssetId && !data.recommendationId) {
    throw new Error('DETAIL_MALFORMED');
  }
  if (data.id || data.candidateId || data.routeAssetId) {
    const normalized = normalizeSearchItem(data, 0, data.requestId || cachedPlan?.requestId || '');
    return {
      ...cachedPlan,
      ...normalized,
      isFavorited: cachedPlan?.isFavorited === true,
      isAdopted: normalized.isAdopted || cachedPlan?.isAdopted === true,
      routeAssetId: normalized.routeAssetId || cachedPlan?.routeAssetId || ''
    };
  }
  const overview = data.overview || {};
  const pointNotes = [
    data.transportAndParking ? { point: '交通与停车', note: data.transportAndParking } : null,
    data.routeDescription ? { point: '路线说明', note: data.routeDescription } : null,
    data.toiletAndSupply ? { point: '厕所与补给', note: data.toiletAndSupply } : null
  ].filter(Boolean);

  const reasons = normalizeList([
    data.familyFitExplanation,
    data.sourceSummary
  ]);

  const plan = normalizeLegacyPlan({
    ...(cachedPlan || {}),
    id: data.recommendationId || cachedPlan?.id,
    shortlineId: data.shortlineId || cachedPlan?.shortlineId,
    title: data.displayTitle || cachedPlan?.title,
    summary: data.routeDescription || data.familyFitExplanation || cachedPlan?.summary,
    confidenceLabel: cachedPlan?.confidenceLabel || '可参考',
    audience: overview.suitableAgeText || cachedPlan?.audience,
    driveTime: overview.driveTimeText || cachedPlan?.driveTime,
    activity: compactJoin([overview.walkingDistanceText, overview.childDurationText]) || cachedPlan?.activity,
    difficulty: overview.difficultyLabel || cachedPlan?.difficulty,
    mapAction: mapActionFromItem({
      ...data,
      mapAction: data.mapAction || cachedPlan?.mapAction,
      rawRef: {
        ...(cachedPlan?.rawItem?.rawRef || {}),
        ...(data.rawRef || {})
      }
    }),
    reasons: reasons.length ? reasons : cachedPlan?.reasons,
    uncertainties: normalizeList(data.riskTips).length ? data.riskTips : cachedPlan?.uncertainties,
    checklist: normalizeList(data.preparationTips).length ? data.preparationTips : cachedPlan?.checklist,
    timeline: normalizeList(data.timeline).length ? normalizeList(data.timeline).map(normalizeTimelineItem) : cachedPlan?.timeline,
    pointNotes: pointNotes.length ? pointNotes : cachedPlan?.pointNotes,
    lastVerifiedAt: data.lastVerifiedAt || cachedPlan?.lastVerifiedAt
  });

  if (!plan.id && !cachedPlan) {
    throw new Error('DETAIL_MALFORMED');
  }

  return plan;
}

function decodePlanId(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

function getRecommendationDetail(planId, cachedPlan) {
  if (cachedPlan?.previewOnly) {
    return canUsePreviewMode() ? Promise.resolve(cachedPlan) : Promise.reject(new Error('PREVIEW_NOT_ENABLED'));
  }
  const id = decodePlanId(planId);
  if (!id) return Promise.reject(new Error('PLAN_ID_REQUIRED'));
  const isRoute = id.startsWith('route_') || id === cachedPlan?.routeAssetId;
  const candidateId = cachedPlan?.candidateId || (id.startsWith('cand_') ? id : '');
  const path = isRoute
    ? `/api/v1/user/routes/${encodeURIComponent(id)}`
    : candidateId
      ? `/api/v1/user/candidates/${encodeURIComponent(candidateId)}`
      : `/api/v1/user/recommendation/${encodeURIComponent(id)}`;
  return callContainer({ path }).then((response) => {
    const plan = normalizePlanDetail(response, cachedPlan);
    if (plan.previewOnly && !canUsePreviewMode()) throw new Error('PREVIEW_NOT_ENABLED');
    return plan;
  });
}

function submitUserRouteFeedback(target, payload = {}) {
  const reference = target && typeof target === 'object' ? target : {};
  const id = typeof target === 'string' ? target : '';
  const routeAssetId = payload.routeAssetId || reference.routeAssetId || (id.startsWith('route_') ? id : '');
  const candidateId = payload.candidateId || reference.candidateId || (id.startsWith('cand_') ? id : '');
  const { requestId: ignoredRequest, candidateId: ignoredCandidate, routeAssetId: ignoredRoute, ...contribution } = payload;
  const data = {
    ...contribution,
    ...(routeAssetId ? { routeAssetId } : { candidateId, requestId: payload.requestId || reference.requestId || '' })
  };
  if (!routeAssetId && !candidateId) return Promise.reject(new Error('FEEDBACK_TARGET_REQUIRED'));
  if (reference.previewOnly) return Promise.reject(new Error('PREVIEW_CANNOT_BE_SUBMITTED'));
  return requestWrite('/api/v1/user/route-feedback', data).then((response) => {
    if (!response.feedbackId) throw new Error('FEEDBACK_MALFORMED');
    return response;
  });
}

function submitUserRoute(payload = {}) {
  return requestWrite('/api/v1/user/route-submissions', payload).then((response) => {
    if (!response.submissionId) throw new Error('SUBMISSION_MALFORMED');
    return response;
  });
}

module.exports = {
  canUsePreviewMode,
  buildLegacyRecommendationRequest,
  buildSearchEventPayload,
  buildSearchRecommendationRequest,
  adoptRouteCandidate,
  buildUnavailableResponse,
  friendlyStatusLabel,
  generateRecommendations,
  getRecommendationDetail,
  decodePlanId,
  normalizeLegacyRecommendationResponse,
  normalizePlanDetail,
  normalizeSearchRecommendationResponse,
  reverseGeocodeLocation,
  submitUserRoute,
  submitUserRouteFeedback,
  trackSearchEvent
};
