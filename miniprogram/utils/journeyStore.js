const STORAGE_KEY = 'outdoor-mini-journey-v1';
const SESSION_KEY = 'outdoor-mini-anonymous-session-id';
let memorySessionId = '';

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateText(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeText(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDepartureTime() {
  const now = new Date();
  return {
    mode: 'NOW',
    date: dateText(now),
    time: timeText(now),
    timezone: 'Asia/Shanghai',
    iso: now.toISOString(),
    label: '现在出发'
  };
}

function buildRelativeDepartureTime(mode = 'NOW') {
  const now = new Date();
  if (mode === 'TODAY_PM') {
    const value = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0, 0);
    if (value.getTime() <= now.getTime()) {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 15, 0, 0, 0);
      return {
        mode,
        date: dateText(tomorrow),
        time: timeText(tomorrow),
        timezone: 'Asia/Shanghai',
        iso: tomorrow.toISOString(),
        label: '明天 15:00 出发'
      };
    }
    return {
      mode,
      date: dateText(value),
      time: timeText(value),
      timezone: 'Asia/Shanghai',
      iso: value.toISOString(),
      label: '今天 15:00 出发'
    };
  }
  if (mode === 'TOMORROW_AM') {
    const value = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
    return {
      mode,
      date: dateText(value),
      time: timeText(value),
      timezone: 'Asia/Shanghai',
      iso: value.toISOString(),
      label: '明天 09:00 出发'
    };
  }
  return defaultDepartureTime();
}

function isLegacyFixedRelativeDeparture(value = {}) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (value.userSelected === true) {
    return false;
  }
  if (['NOW', 'TODAY_PM', 'TOMORROW_AM'].includes(value.mode)) {
    return false;
  }
  const label = String(value.label || '');
  if (value.mode === 'CUSTOM' && /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s*出发/.test(label)) {
    return true;
  }
  return Boolean(value.iso || value.date || value.time) && (
    label === '现在出发'
    || label.includes('今天')
    || label.includes('明天')
    || /\d{4}-\d{2}-\d{2}/.test(label)
  );
}

function normalizeDepartureTime(value = {}) {
  const fallback = defaultDepartureTime();
  if (isLegacyFixedRelativeDeparture(value)) {
    return fallback;
  }
  const mode = value?.mode || fallback.mode;
  if (mode === 'NOW' || mode === 'TODAY_PM' || mode === 'TOMORROW_AM') {
    return buildRelativeDepartureTime(mode);
  }
  return {
    ...fallback,
    ...(value || {}),
    mode,
    label: value?.label || fallback.label
  };
}

const defaultForm = {
  intent: 'FAMILY_OUTDOOR_SEARCH',
  query: '亲子绿道',
  origin: '',
  originPoint: null,
  originSource: 'FALLBACK',
  destinationHint: '',
  ageRange: '6-10岁',
  duration: '半天',
  difficulty: '轻松',
  transport: '自驾',
  driveLimit: '45分钟内',
  scenePreferences: ['公园', '绿道'],
  safetyNeeds: ['停车方便', '厕所方便', '可随时折返'],
  departureTime: defaultDepartureTime()
};

function loadJourney() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function saveJourney(journey) {
  wx.setStorageSync(STORAGE_KEY, journey);
  return journey;
}

function getAnonymousSessionId() {
  try {
    const existing = wx.getStorageSync(SESSION_KEY);
    if (existing) {
      return existing;
    }
    const next = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    wx.setStorageSync(SESSION_KEY, next);
    return next;
  } catch {
    if (!memorySessionId) memorySessionId = createClientRequestId('anon');
    return memorySessionId;
  }
}

function createClientRequestId(prefix = 'client') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function preparePendingRequest(scope, payload) {
  const current = loadJourney() || {};
  const pendingRequests = { ...(current.pendingRequests || {}) };
  const { clientRequestId: suppliedId, ...content } = payload;
  const fingerprint = stableSerialize(content);
  const previous = pendingRequests[scope];
  if (previous && previous.fingerprint === fingerprint && (!suppliedId || suppliedId === previous.clientRequestId)) {
    return previous;
  }
  const clientRequestId = suppliedId || createClientRequestId();
  const operation = { clientRequestId, fingerprint, payload: { ...content, clientRequestId } };
  pendingRequests[scope] = operation;
  saveJourney({ ...current, pendingRequests });
  return operation;
}

function completePendingRequest(scope, clientRequestId) {
  const current = loadJourney() || {};
  const pendingRequests = { ...(current.pendingRequests || {}) };
  if (pendingRequests[scope]?.clientRequestId !== clientRequestId) return;
  delete pendingRequests[scope];
  saveJourney({ ...current, pendingRequests });
}

function withAdoptionFlag(plan, journey) {
  const adopted = journey.adoptedPlans?.[plan.candidateId || plan.id];
  return adopted ? { ...plan, isAdopted: true, routeAssetId: adopted.routeAssetId } : plan;
}

function savePlanAdoption(plan, response) {
  if (!plan?.id || !response?.routeAssetId || plan.previewOnly) return loadJourney();
  const current = loadJourney() || {};
  const adoptedPlan = { ...plan, isAdopted: true, routeAssetId: response.routeAssetId };
  const adoptedPlans = {
    ...(current.adoptedPlans || {}),
    [plan.candidateId || plan.id]: adoptedPlan
  };
  const plans = (current.plans || []).map((item) => item.id === plan.id ? { ...item, ...adoptedPlan } : item);
  return saveJourney({
    ...current,
    adoptedPlans,
    plans,
    recommendation: current.recommendation ? { ...current.recommendation, plans } : null,
    updatedAt: new Date().toISOString()
  });
}

function getFeedbackDraft(mode, planId = '') {
  const feedbacks = loadJourney()?.feedbacks || [];
  return feedbacks.find((item) => item.status === 'DRAFT' && item.mode === mode && (mode === 'upload' || item.planId === planId)) || null;
}

function normalizeForm(form = {}) {
  return {
    ...defaultForm,
    ...form,
    scenePreferences: Array.isArray(form.scenePreferences)
      ? form.scenePreferences
      : defaultForm.scenePreferences,
    safetyNeeds: Array.isArray(form.safetyNeeds)
      ? form.safetyNeeds
      : defaultForm.safetyNeeds,
    departureTime: normalizeDepartureTime(form.departureTime || defaultForm.departureTime),
    sessionId: form.sessionId || getAnonymousSessionId(),
    originPoint: form.originPoint || null,
    originSource: form.originSource || (form.originPoint ? 'CURRENT_LOCATION' : 'FALLBACK')
  };
}

function saveForm(form) {
  const current = loadJourney() || {};
  return saveJourney({
    ...current,
    form: normalizeForm(form),
    recommendation: null,
    plans: [],
    searchRequestId: '',
    sourceSummary: {},
    warnings: [],
    updatedAt: new Date().toISOString()
  });
}

function saveRecommendation(response) {
  const current = loadJourney() || {};
  return saveJourney({
    ...current,
    recommendation: { ...response, plans: (response?.plans || []).map((plan) => withAdoptionFlag(plan, current)) },
    plans: (response?.plans || []).map((plan) => withAdoptionFlag(plan, current)),
    searchRequestId: response?.requestId || '',
    sourceSummary: response?.sourceSummary || {},
    warnings: response?.warnings || [],
    updatedAt: new Date().toISOString()
  });
}

function favoritePlanIdsFromJourney(journey = {}) {
  if (Array.isArray(journey.favoritePlanIds)) {
    return journey.favoritePlanIds;
  }
  return Object.keys(journey.favoritePlans || {});
}

function isPlanFavorited(planId) {
  if (!planId) {
    return false;
  }
  return favoritePlanIdsFromJourney(loadJourney() || {}).includes(planId);
}

function withFavoriteFlags(plans = []) {
  const journey = loadJourney() || {};
  const favoriteIds = favoritePlanIdsFromJourney(journey);
  return (Array.isArray(plans) ? plans : []).map((plan) => ({
    ...withAdoptionFlag(plan, journey),
    isFavorited: favoriteIds.includes(plan.id)
  }));
}

function savePlanFavorite(plan, favorited = true) {
  if (!plan?.id) {
    return loadJourney();
  }
  const current = loadJourney() || {};
  const favoritePlans = { ...(current.favoritePlans || {}) };

  if (favorited) {
    favoritePlans[plan.id] = {
      id: plan.id,
      title: plan.title || '',
      sourceLabel: plan.sourceLabel || '',
      trustLabel: plan.trustLabel || '',
      savedAt: new Date().toISOString()
    };
  } else {
    delete favoritePlans[plan.id];
  }

  const favoritePlanIds = Object.keys(favoritePlans);
  const plans = (current.plans || []).map((item) => (item.id === plan.id
    ? { ...item, isFavorited: favorited }
    : item));

  return saveJourney({
    ...current,
    favoritePlans,
    favoritePlanIds,
    plans,
    updatedAt: new Date().toISOString()
  });
}

function savePlanDetail(plan) {
  if (!plan?.id) {
    return loadJourney();
  }
  const current = loadJourney() || {};
  const favoriteIds = favoritePlanIdsFromJourney(current);
  const planWithFavorite = {
    ...withAdoptionFlag(plan, current),
    isFavorited: favoriteIds.includes(plan.id)
  };
  const plans = current.plans || [];
  const nextPlans = plans.some((item) => item.id === plan.id)
    ? plans.map((item) => (item.id === plan.id ? { ...item, ...planWithFavorite } : item))
    : [...plans, planWithFavorite];

  return saveJourney({
    ...current,
    plans: nextPlans,
    updatedAt: new Date().toISOString()
  });
}

function getPlanById(planId) {
  const journey = loadJourney();
  const plans = withFavoriteFlags([...(journey?.plans || []), ...Object.values(journey?.adoptedPlans || {})]);
  return plans.find((plan) => plan.id === planId || plan.candidateId === planId || plan.routeAssetId === planId) || null;
}

function saveRouteFeedback(feedback = {}) {
  const current = loadJourney() || {};
  const feedbacks = Array.isArray(current.feedbacks) ? current.feedbacks : [];
  const nextFeedback = {
    id: feedback.id || `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...feedback
  };

  return saveJourney({
    ...current,
    feedbacks: [nextFeedback, ...feedbacks.filter((item) => item.id !== nextFeedback.id
      && !(item.status === 'DRAFT' && item.mode === nextFeedback.mode && item.planId === nextFeedback.planId))].slice(0, 50),
    updatedAt: new Date().toISOString()
  });
}

function buildConditionSummary(form) {
  const data = normalizeForm(form || {});
  return [
    data.destinationHint || data.query || '附近',
    data.ageRange,
    data.duration,
    data.driveLimit,
    data.difficulty,
    data.departureTime?.label || '现在出发'
  ].filter(Boolean).join(' · ');
}

function buildConditionHighlights(form) {
  const data = normalizeForm(form || {});
  return [
    data.destinationHint || data.query || '附近',
    data.ageRange,
    data.duration
  ].filter(Boolean).slice(0, 3);
}

function buildDepartureSummary(form) {
  const data = normalizeForm(form || {});
  return data.departureTime?.label || '现在出发';
}

function toggleListValue(values = [], value) {
  const current = Array.isArray(values) ? values : [];
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }
  return [...current, value];
}

module.exports = {
  defaultForm,
  createClientRequestId,
  preparePendingRequest,
  completePendingRequest,
  getFeedbackDraft,
  savePlanAdoption,
  loadJourney,
  saveForm,
  saveRecommendation,
  savePlanDetail,
  savePlanFavorite,
  saveRouteFeedback,
  getPlanById,
  buildConditionSummary,
  buildConditionHighlights,
  buildDepartureSummary,
  getAnonymousSessionId,
  isPlanFavorited,
  normalizeForm,
  toggleListValue,
  withFavoriteFlags,
  defaultDepartureTime,
  normalizeDepartureTime
};
