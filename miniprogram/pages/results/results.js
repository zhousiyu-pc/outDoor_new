const {
  loadJourney,
  saveRecommendation,
  buildConditionSummary,
  buildConditionHighlights,
  buildDepartureSummary,
  normalizeForm,
  savePlanAdoption,
  savePlanFavorite,
  withFavoriteFlags
} = require('../../utils/journeyStore');
const {
  buildUnavailableResponse,
  canUsePreviewMode,
  friendlyStatusLabel,
  adoptRouteCandidate,
  generateRecommendations,
  normalizeLegacyRecommendationResponse,
  trackSearchEvent
} = require('../../utils/apiClient');
const { buildRecommendationResponse } = require('../../utils/recommendationPlans');

function buildPreviewResponse(form) {
  const previewResponse = normalizeLegacyRecommendationResponse(buildRecommendationResponse(form));
  previewResponse.plans = previewResponse.plans.map((plan) => ({
    ...plan,
    previewOnly: true,
    sourceLabel: '预览路线'
  }));
  return {
    ...previewResponse,
    resultType: 'LOCAL_PREVIEW',
    message: '预览路线'
  };
}

function sourceCountText(sourceSummary = {}, plans = []) {
  const systemCount = sourceSummary.systemCount || plans.filter((item) => String(item.sourceType || '').startsWith('SYSTEM')).length;
  const mapCount = sourceSummary.mapCount || plans.filter((item) => item.sourceType === 'AMAP_POI').length;
  const guideCount = sourceSummary.guideCount || plans.filter((item) => item.sourceType === 'GUIDE_PUBLIC').length;
  const userSharedCount = sourceSummary.userSharedCount || plans.filter((item) => item.sourceType === 'USER_SHARED').length;
  const parts = [];
  if (systemCount) parts.push(`精选 ${systemCount}`);
  if (mapCount) parts.push(`地图 ${mapCount}`);
  if (guideCount) parts.push(`攻略 ${guideCount}`);
  if (userSharedCount) parts.push(`用户分享 ${userSharedCount}`);
  return parts.length ? parts.join(' · ') : '精选 · 地图 · 用户分享';
}


function friendlyTrustLabel(value = '') {
  const raw = String(value || '').trim();
  const map = {
    LOW_NEEDS_CONFIRMATION: '出发前确认',
    NEEDS_CONFIRMATION: '出发前确认',
    MEDIUM_NEEDS_CONFIRMATION: '信息待核实',
    HIGH_CONFIDENCE: '信息较完整',
    READY: '适合看看',
    EXPLORE: '先作参考',
    BLOCKED: '暂不建议'
  };
  if (!raw) return '出发前确认';
  if (map[raw]) return map[raw];
  if (/^[A-Z0-9_\-]+$/.test(raw)) return '出发前确认';
  return raw;
}

function friendlyPlans(plans = []) {
  return plans.map((item) => ({
    ...item,
    trustLabel: friendlyTrustLabel(item.trustLabel || item.displayStatus || item.status)
  }));
}

function hasExternal(plans = []) {
  return plans.some((item) => item.sourceTone === 'external');
}

Page({
  data: {
    loading: false,
    status: 'PENDING',
    resultType: '',
    statusLabel: '帮你找路线中',
    message: '正在找路线…',
    previewMode: false,
    conditionSummary: '',
    conditionSummaryText: '',
    summaryHighlights: [],
    departureSummary: '',
    sourceCountText: '',
    plans: [],
    warnings: [],
    hasExternalResults: false,
    nextActions: [],
    error: '',
    adoptingPlanId: '',
    activeFilter: 'all',
    routeSearch: '',
    visiblePlans: [],
    locationText: '深圳'
  },

  onLoad() {
    this.enableShareMenu();
    this.loadRecommendations();
  },

  enableShareMenu() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onShareAppMessage() {
    return {
      title: '周末户外路｜看看这些亲子户外路线',
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    return {
      title: '周末户外路｜看看这些亲子户外路线',
      query: ''
    };
  },

  noop() {},

  loadRecommendations(options = {}) {
    const journey = loadJourney();
    if (!journey?.form) {
      this.setData({
        loading: false,
        status: 'NO_FORM',
        statusLabel: '缺少条件',
        message: '请先输入需求。',
        conditionSummary: '',
        conditionSummaryText: '还没有输入条件',
        plans: [],
        visiblePlans: [],
        locationText: '深圳'
      });
      return;
    }

    const form = { ...normalizeForm(journey.form), departureTime: journey.form.departureTime };
    const cachedPreview = (journey.plans || []).some((plan) => plan.previewOnly);
    if (!options.force && journey.recommendation?.ok === true && (!cachedPreview || canUsePreviewMode())) {
      this.applyRecommendationResponse({ ...journey.recommendation, plans: journey.plans }, form);
      return Promise.resolve();
    }

    this.setData({
      loading: true,
      status: 'PENDING',
      resultType: '',
      statusLabel: friendlyStatusLabel('PENDING'),
      message: '正在找路线…',
      previewMode: false,
      conditionSummary: buildConditionSummary(form),
      conditionSummaryText: buildConditionSummary(form),
      summaryHighlights: buildConditionHighlights(form),
      departureSummary: buildDepartureSummary(form),
      sourceCountText: '帮你找路线中',
      plans: [],
      visiblePlans: [],
      warnings: [],
      hasExternalResults: false,
      nextActions: [],
      error: '',
      adoptingPlanId: '',
      activeFilter: 'all',
      routeSearch: '',
      locationText: journey.form.originPoint?.name || '深圳'
    });

    console.log('[results] loadRecommendations', {
      hasOrigin: Boolean(form.origin),
      hasOriginPoint: Boolean(form.originPoint),
      queryPresent: Boolean(form.query)
    });

    // Let the transport own the same configurable deadline so a late response
    // cannot clear the idempotency record after a separate UI timer failed.
    return generateRecommendations(form)
      .then((response) => {
        if ((response.plans || []).some((plan) => plan.previewOnly) && !canUsePreviewMode()) {
          throw new Error('PREVIEW_NOT_ENABLED');
        }
        if (canUsePreviewMode() && !(response.plans || []).length) {
          this.applyRecommendationResponse(buildPreviewResponse(form), form, { preview: true });
          return;
        }
        this.applyRecommendationResponse(response, form);
      })
      .catch((error) => {
        console.error('[results] recommendations failed', error);
        this.applyRecommendationResponse(
          canUsePreviewMode() ? buildPreviewResponse(form) : buildUnavailableResponse(), form
        );
      });
  },

  applyRecommendationResponse(response, form, options = {}) {
    const plans = friendlyPlans(withFavoriteFlags(response.plans || [])).map((plan) => plan.previewOnly
      ? { ...plan, sourceLabel: '预览路线' } : plan);
    const normalizedForm = normalizeForm(form);
    saveRecommendation({ ...response, plans });
    this.setData({
      loading: false,
      status: response.status || 'READY',
      resultType: response.resultType || '',
      statusLabel: friendlyStatusLabel(response.status, response.resultType),
      message: response.message || '已找到路线。',
      previewMode: Boolean(options.preview || response.resultType === 'LOCAL_PREVIEW' || plans.some((plan) => plan.previewOnly)),
      conditionSummary: buildConditionSummary(normalizedForm),
      conditionSummaryText: buildConditionSummary(normalizedForm),
      summaryHighlights: buildConditionHighlights(normalizedForm),
      departureSummary: buildDepartureSummary(normalizedForm),
      sourceCountText: sourceCountText(response.sourceSummary, plans),
      plans,
      visiblePlans: plans,
      warnings: response.warnings || [],
      hasExternalResults: hasExternal(plans),
      nextActions: response.nextActions || [],
      error: ''
    });
  },

  filterPlans(plans = this.data.plans, filter = this.data.activeFilter, search = this.data.routeSearch) {
    const query = String(search || '').trim().toLowerCase();
    return plans.filter((item) => {
      const haystack = [item.title, item.summary, item.activity, item.difficulty, item.sourceLabel, ...(item.tags || [])]
        .filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      if (filter === 'all') return matchesSearch;
      const text = haystack;
      const matchesFilter = filter === 'easy'
        ? /轻松|平缓|低风险/.test(text)
        : filter === 'family'
          ? /亲子|孩子|家庭/.test(text)
          : /水|湿地|湖|海/.test(text);
      return matchesFilter && matchesSearch;
    });
  },

  setFilter(event) {
    const activeFilter = event.currentTarget.dataset.filter || 'all';
    this.setData({
      activeFilter,
      visiblePlans: this.filterPlans(this.data.plans, activeFilter, this.data.routeSearch)
    });
  },

  onRouteSearch(event) {
    const routeSearch = event.detail.value || '';
    this.setData({
      routeSearch,
      visiblePlans: this.filterPlans(this.data.plans, this.data.activeFilter, routeSearch)
    });
  },

  resetFilters() {
    this.setData({
      activeFilter: 'all',
      routeSearch: '',
      visiblePlans: this.data.plans
    });
  },

  openUploadRoute() {
    wx.navigateTo({ url: '/pages/feedback/feedback?mode=upload' });
  },

  goHome() {
    wx.navigateBack({
      fail: () => wx.redirectTo({ url: '/pages/index/index' })
    });
  },

  refresh() {
    if (this.data.loading) return;
    return this.loadRecommendations({ force: true });
  },

  openPlan(event) {
    const planId = event.currentTarget.dataset.id;
    const plan = this.data.plans.find((item) => item.id === planId);
    if (!planId) {
      wx.showToast({ title: '暂时无法打开详情', icon: 'none' });
      return;
    }
    this.trackPlan(plan, 'RESULT_CLICKED');
    wx.navigateTo({
      url: `/pages/plan-detail/plan-detail?id=${encodeURIComponent(planId)}`
    });
  },

  favoritePlan(event) {
    const planId = event.currentTarget.dataset.id;
    const plans = this.data.plans || [];
    const plan = plans.find((item) => item.id === planId);
    if (!plan) {
      wx.showToast({ title: '暂时无法记录', icon: 'none' });
      return;
    }
    const nextFavorited = !plan.isFavorited;
    savePlanFavorite(plan, nextFavorited);
    this.setData({
      plans: plans.map((item) => (item.id === planId ? { ...item, isFavorited: nextFavorited } : item)),
      visiblePlans: this.filterPlans(plans.map((item) => (item.id === planId ? { ...item, isFavorited: nextFavorited } : item)))
    });
    this.trackPlan(plan, nextFavorited ? 'ROUTE_FAVORITED' : 'ROUTE_UNFAVORITED');
    wx.showToast({
      title: nextFavorited ? '已记录想去' : '已取消想去',
      icon: nextFavorited ? 'success' : 'none'
    });
  },

  adoptPlan(event) {
    const planId = event.currentTarget.dataset.id;
    const plans = this.data.plans || [];
    const plan = plans.find((item) => item.id === planId);
    if (!plan) {
      wx.showToast({ title: '暂时无法加入', icon: 'none' });
      return;
    }
    if (plan.isAdopted) {
      wx.showToast({ title: '已经在你的路线里', icon: 'success' });
      return;
    }
    if (plan.previewOnly) {
      wx.showToast({ title: '预览路线暂不能加入', icon: 'none' });
      return;
    }
    if (this.data.adoptingPlanId) return;
    const journey = loadJourney() || {};
    this.setData({ adoptingPlanId: planId });
    return adoptRouteCandidate(plan, journey)
      .then((result) => {
        savePlanAdoption(plan, result);
        const nextPlans = (this.data.plans || []).map((item) => item.id === planId ? {
          ...item, isAdopted: true, routeAssetId: result.routeAssetId, trustLabel: '已加入'
        } : item);
        this.setData({
          adoptingPlanId: '',
          plans: nextPlans,
          visiblePlans: this.filterPlans(nextPlans)
        });
        this.trackPlan(plan, 'ROUTE_ADOPTED', { routeAssetId: result.routeAssetId || '' });
        wx.showToast({ title: '已加入你的路线', icon: 'success' });
      })
      .catch((error) => {
        console.error('[results] adoption failed', error);
        this.setData({ adoptingPlanId: '' });
        wx.showToast({ title: '暂时没加进去，请稍后再试', icon: 'none' });
      });
  },

  openMap(event) {
    const planId = event.currentTarget.dataset.id;
    const plan = this.data.plans.find((item) => item.id === planId);
    const mapAction = plan?.mapAction || {};
    const latitude = Number(mapAction.lat);
    const longitude = Number(mapAction.lng);
    if (!mapAction.available || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      wx.showToast({ title: '位置需要出发前再看一眼', icon: 'none' });
      return;
    }
    this.trackPlan(plan, 'MAP_OPENED');
    wx.openLocation({
      latitude,
      longitude,
      name: mapAction.name || plan.title || '路线位置',
      address: mapAction.address || plan.summary || '',
      fail: () => wx.showToast({ title: '暂时无法打开地图', icon: 'none' })
    });
  },

  trackPlan(plan, eventType, context = {}) {
    if (!plan) {
      return;
    }
    const journey = loadJourney() || {};
    trackSearchEvent(journey, plan, eventType, context).catch(() => {
      // 用户主路径不能因为记录失败而中断。
    });
  }
});
