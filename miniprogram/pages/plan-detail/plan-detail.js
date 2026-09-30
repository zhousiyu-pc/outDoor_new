const { getPlanById, savePlanDetail, savePlanFavorite } = require('../../utils/journeyStore');
const { getRecommendationDetail, decodePlanId } = require('../../utils/apiClient');

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateText(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeText(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDepartureTime(mode = 'NOW', baseDate = new Date()) {
  const now = new Date();
  let value = new Date(baseDate.getTime());
  let label = '现在出发';

  if (mode === 'TODAY_PM') {
    value = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0, 0);
    if (value.getTime() <= now.getTime()) {
      value = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 15, 0, 0, 0);
      label = '明天 15:00 出发';
    } else {
      label = '今天 15:00 出发';
    }
  } else if (mode === 'TOMORROW_AM') {
    value = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
    label = '明天 09:00 出发';
  } else if (mode === 'CUSTOM') {
    label = `${dateText(value)} ${timeText(value)} 出发`;
  } else {
    value = now;
  }

  return {
    mode,
    date: dateText(value),
    time: timeText(value),
    timezone: 'Asia/Shanghai',
    iso: value.toISOString(),
    label
  };
}

function firstText(items = [], fallback = '出发前请看天气、开放状态、停车和厕所。') {
  return Array.isArray(items) && items.length ? items[0] : fallback;
}

function rawRefOf(plan = {}) {
  return plan.rawItem?.rawRef || plan.rawRef || {};
}

function statusTextOf(status = '') {
  if (['READY', 'FOUND'].includes(status)) return '已知可参考';
  if (status === 'NEEDS_REPAIR') return '待补地图点';
  if (status === 'API_FAILED') return '待确认';
  if (status === 'NOT_FOUND') return '待确认';
  return '待确认';
}

function toneOf(status = '') {
  if (['READY', 'FOUND'].includes(status)) return 'ready';
  if (status === 'NEEDS_REPAIR') return 'neutral';
  return 'warn';
}

function preflightItem(rawRef = {}, key, label, fallback) {
  const source = rawRef[key] || {};
  const status = source.status || 'NEEDS_CONFIRMATION';
  return {
    key,
    label,
    status,
    statusText: statusTextOf(status),
    text: source.message || fallback,
    tone: toneOf(status)
  };
}

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildScheduleItems(travelPlan = {}, plan = {}) {
  const rawTimeline = Array.isArray(travelPlan.schedule) && travelPlan.schedule.length
    ? travelPlan.schedule
    : Array.isArray(travelPlan.timeline) && travelPlan.timeline.length
      ? travelPlan.timeline.map((item) => ({
        time: item.timeText || item.time || '',
        title: item.titleText || item.title || item.label || '节点',
        value: item.contentText || item.description || item.text || ''
      }))
      : [];

  if (rawTimeline.length) {
    return rawTimeline.slice(0, 5).map((item, index) => ({
      key: `${item.title || item.label || item.time || 'schedule'}-${index}`,
      timeText: normalizeText(item.time, ''),
      titleText: normalizeText(item.title, '行程节点'),
      contentText: normalizeText(item.value || item.text || item.description, '')
    }));
  }

  const departureLabel = normalizeText(travelPlan.departureLabel, '现在出发');
  const arrivalEstimate = normalizeText(travelPlan.arrivalEstimate, '到达时间待确认');
  const returnTime = normalizeText(travelPlan.returnTime, '');
  const stayDuration = normalizeText(travelPlan.stayDuration, '建议停留待确认');
  return [
    { key: 'schedule-1', timeText: departureLabel.split(' ')[0] || '', titleText: '出发', contentText: '从当前出发点出发' },
    { key: 'schedule-2', timeText: arrivalEstimate.split(' ')[0] || '', titleText: '到达', contentText: '到达入口附近' },
    { key: 'schedule-3', timeText: '', titleText: '停留', contentText: stayDuration },
    { key: 'schedule-4', timeText: returnTime.split(' ')[0] || '', titleText: '返程', contentText: returnTime || '建议提前返程' }
  ];
}

function buildRiskItems(travelPlan = {}) {
  const risks = Array.isArray(travelPlan.timeRisks) ? travelPlan.timeRisks : [];
  if (risks.length) {
    return risks.slice(0, 3).map((item, index) => ({
      key: `${item.title || item.name || index}-${index}`,
      titleText: normalizeText(item.title || item.name, '时间风险'),
      contentText: normalizeText(item.advice || item.text || item.value, ''),
      tone: item.level === 'HIGH' ? 'warn' : item.level === 'MEDIUM' ? 'neutral' : 'ready'
    }));
  }

  const trafficRisk = travelPlan.trafficRisk || '';
  const trafficSummary = normalizeText(travelPlan.trafficSummary, '');
  if (!trafficRisk && !trafficSummary) {
    return [];
  }

  return [{
    key: 'risk-1',
    titleText: trafficRisk === 'HIGH'
      ? '高峰风险较高'
      : trafficRisk === 'MEDIUM'
        ? '需要预留一点时间'
        : '当前风险较低',
    contentText: trafficSummary || '出发前再确认一次时间安排',
    tone: trafficRisk === 'HIGH' ? 'warn' : trafficRisk === 'MEDIUM' ? 'neutral' : 'ready'
  }];
}

function buildDetailViewModel(plan = {}) {
  const uncertainties = Array.isArray(plan.uncertainties) ? plan.uncertainties : [];
  const pointNotes = Array.isArray(plan.pointNotes) ? plan.pointNotes : [];
  const rawRef = rawRefOf(plan);
  const mapAction = plan.mapAction || rawRef.mapAction || {};
  const travelPlan = plan.travelPlan || rawRef.travelPlan || {};
  const mapReady = Boolean(mapAction.available && mapAction.lng && mapAction.lat);
  const primaryRisk = firstText(uncertainties);
  const facilityCards = Array.isArray(plan.facilityCards) && plan.facilityCards.length ? plan.facilityCards : [];
  const riskLevel = uncertainties.length > 1 ? 'medium' : 'low';
  const departureLabel = normalizeText(travelPlan.departureLabel, '现在出发');
  const arrivalEstimate = normalizeText(travelPlan.arrivalEstimate, '到达时间待确认');
  const stayDuration = normalizeText(travelPlan.stayDuration, '建议停留待确认');
  const returnTime = normalizeText(travelPlan.returnTime, '返程时间待确认');
  const travelHeadline = normalizeText(travelPlan.headline, departureLabel === '现在出发' ? '按现在出发估算' : departureLabel);
  const travelReason = normalizeText(travelPlan.reason, travelPlan.suggestion || travelPlan.trafficSummary || '我们已按路线和时间，帮你估了一下行程。');
  const scheduleItems = buildScheduleItems(travelPlan, plan);
  const riskItems = buildRiskItems(travelPlan);
  const routeRhythmItems = Array.isArray(travelPlan.routeRhythm) && travelPlan.routeRhythm.length
    ? travelPlan.routeRhythm.slice(0, 3).map((item, index) => ({
      key: `rhythm-${index}`,
      titleText: `建议 ${index + 1}`,
      contentText: normalizeText(item, '')
    }))
    : [];
  const carryItems = Array.isArray(plan.checklist) ? plan.checklist.slice(0, 2) : [];
  const timePlanCards = [
    { key: 'dep', label: '建议出发', value: departureLabel || '现在出发' },
    { key: 'arr', label: '预计到达', value: arrivalEstimate || '待确认' },
    { key: 'stay', label: '建议停留', value: stayDuration || '待确认' },
    { key: 'ret', label: '建议返程', value: returnTime || '待确认' }
  ];
  const routeSummary = travelPlan.dataLimit || (riskItems.length ? '时间风险已提示，出发前可换时间重算。' : '当前计划基于路线和出发时间生成。');
  const routeRhythmCopy = routeRhythmItems.length
    ? routeRhythmItems
    : [{
      key: 'rhythm-empty',
      titleText: '建议 1',
      contentText: '从主入口进入，先走平缓段，按孩子状态决定是否继续。'
    }];
  const travelPlanView = {
    status: travelPlan.status || (mapReady ? 'READY' : 'NEEDS_CONFIRMATION'),
    headline: travelHeadline,
    reason: travelReason,
    departureWindow: departureLabel,
    arrivalEstimate,
    stayDuration,
    returnTime,
    scheduleItems,
    routeRhythmItems: routeRhythmCopy,
    riskItems,
    dataLimit: routeSummary,
    supportText: travelPlan.trafficSource === 'AMAP_DRIVING_CURRENT'
      ? '基于高德驾车规划与交通态势'
      : travelPlan.trafficSource === 'AMAP_TRAFFIC_STATUS'
        ? '基于高德交通态势'
        : travelPlan.trafficSource === 'RULE_ESTIMATE'
          ? '按时间规则估算'
          : '路况待确认',
    mapHint: mapReady ? (mapAction.name || '地图位置可打开') : '地图点待补充',
    timePlanCards
  };
  const decisionTitle = mapReady ? travelPlanView.headline : '信息不足，不建议直接出发';

  return {
    decisionTitle,
    decisionSummary: travelPlanView.reason,
    primaryRisk,
    riskLevel,
    facilityCards,
    mapReady,
    mustConfirmItems: ['天气和开放状态', '停车和入口位置', '厕所、补给和折返点'],
    carryItems,
    travelPlanView,
    statusText: travelPlanView.headline,
    favoriteText: plan.isFavorited ? '已想去' : '想去',
    errorMessageText: ''
  };
}

Page({
  data: {
    loading: false,
    plan: null,
    decisionTitle: '',
    decisionSummary: '',
    mapReady: false,
    mustConfirmItems: [],
    carryItems: [],
    travelPlanView: {},
    primaryRisk: '',
    riskLevel: 'low',
    statusText: '',
    errorMessageText: '',
    notFound: false,
    errorMessage: '',
    fallbackNotice: '',
    favoriteText: '想去',
    showDeparturePicker: false,
    customDepartureDate: dateText(new Date()),
    customDepartureTime: timeText(new Date())
  },

  onLoad(options) {
    this.enableShareMenu();
    const planId = decodePlanId(options?.id);
    return this.loadPlan(planId);
  },

  enableShareMenu() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onShareAppMessage() {
    const plan = this.data.plan || {};
    const planId = plan.routeAssetId || plan.id || '';
    return {
      title: plan.title ? `周末户外路｜${plan.title}` : '周末户外路｜亲子户外路线详情',
      path: planId ? `/pages/plan-detail/plan-detail?id=${encodeURIComponent(planId)}` : '/pages/index/index'
    };
  },

  onShareTimeline() {
    const plan = this.data.plan || {};
    const planId = plan.routeAssetId || plan.id || '';
    return {
      title: plan.title ? `周末户外路｜${plan.title}` : '周末户外路｜亲子户外路线详情',
      query: planId ? `id=${encodeURIComponent(planId)}` : ''
    };
  },

  loadPlan(planId) {
    if (!planId) {
      this.setData({
        loading: false,
        plan: null,
        notFound: true,
        errorMessage: '请返回列表选择路线。',
        errorMessageText: '请返回列表选择路线。',
        fallbackNotice: '',
        favoriteText: '想去'
      });
      return;
    }

    const cachedPlan = getPlanById(planId);
    this.setData({
      loading: true,
      plan: cachedPlan || null,
      ...(cachedPlan ? buildDetailViewModel(cachedPlan) : { favoriteText: '想去' }),
      notFound: false,
      errorMessage: '',
      fallbackNotice: ''
    });

    return getRecommendationDetail(planId, cachedPlan)
      .then((plan) => {
        savePlanDetail(plan);
        plan = getPlanById(plan.id) || plan;
        this.setData({
          loading: false,
          plan,
          ...buildDetailViewModel(plan),
          notFound: !plan,
          errorMessage: '',
          fallbackNotice: ''
        });
      })
      .catch((error) => {
        if (cachedPlan && error.message !== 'PREVIEW_NOT_ENABLED') {
          this.setData({
            loading: false,
            plan: cachedPlan,
            ...buildDetailViewModel(cachedPlan),
            notFound: false,
            errorMessage: '',
            fallbackNotice: '当前展示的是上次保存的路线信息，出发前请再看一眼当天现场情况。'
          });
          return;
        }

        this.setData({
          loading: false,
          plan: null,
          notFound: true,
          errorMessage: '暂时无法加载这条路线，请返回路线列表后重试。',
          errorMessageText: '暂时无法加载这条路线，请返回路线列表后重试。',
          fallbackNotice: '',
          favoriteText: '想去'
        });
      });
  },

  toggleFavorite() {
    const plan = this.data.plan;
    if (!plan?.id) {
      wx.showToast({ title: '暂时无法记录', icon: 'none' });
      return;
    }
    const nextFavorited = !plan.isFavorited;
    const nextPlan = { ...plan, isFavorited: nextFavorited };
    savePlanFavorite(nextPlan, nextFavorited);
    this.setData({
      plan: nextPlan,
      favoriteText: nextFavorited ? '已想去' : '想去'
    });
    wx.showToast({
      title: nextFavorited ? '已记录想去' : '已取消想去',
      icon: nextFavorited ? 'success' : 'none'
    });
  },

  openFeedback() {
    const plan = this.data.plan || {};
    if (!plan.id) {
      wx.showToast({ title: '请先选择路线', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/feedback/feedback?id=${encodeURIComponent(plan.id)}`
    });
  },

  openMap() {
    const plan = this.data.plan || {};
    const mapAction = plan.mapAction || {};
    const latitude = Number(mapAction.lat);
    const longitude = Number(mapAction.lng);
    if (!mapAction.available || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      wx.showToast({ title: '位置还需要出发前再看一眼', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude,
      longitude,
      name: mapAction.name || plan.title || '路线位置',
      address: mapAction.address || plan.summary || '',
      fail: () => wx.showToast({ title: '暂时无法打开地图', icon: 'none' })
    });
  },

  backResults() {
    wx.navigateBack({
      fail: () => wx.redirectTo({ url: '/pages/results/results' })
    });
  },

  goHome() {
    wx.redirectTo({ url: '/pages/index/index' });
  },

  goResults() {
    wx.redirectTo({ url: '/pages/results/results' });
  },

  openUploadRoute() {
    wx.navigateTo({ url: '/pages/feedback/feedback?mode=upload' });
  },

  noop() {},

  openDeparturePicker() {
    const plan = this.data.plan || {};
    const travelPlan = plan.travelPlan || rawRefOf(plan).travelPlan || {};
    const raw = String(travelPlan.departureTime || '').trim();
    let date = new Date();
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    this.setData({
      showDeparturePicker: true,
      customDepartureDate: dateText(date),
      customDepartureTime: timeText(date)
    });
  },

  closeDeparturePicker() {
    this.setData({ showDeparturePicker: false });
  },

  selectQuickDeparture(event) {
    const next = buildDepartureTime(event.currentTarget.dataset.value || 'NOW');
    this.applyLocalDepartureTime(next);
  },

  onDepartureDateChange(event) {
    this.setData({ customDepartureDate: event.detail.value });
  },

  onDepartureTimeChange(event) {
    this.setData({ customDepartureTime: event.detail.value });
  },

  confirmCustomDeparture() {
    const date = this.data.customDepartureDate || dateText(new Date());
    const time = this.data.customDepartureTime || timeText(new Date());
    const value = new Date(`${date}T${time}:00+08:00`);
    this.applyLocalDepartureTime(buildDepartureTime('CUSTOM', Number.isNaN(value.getTime()) ? new Date() : value));
  },

  applyLocalDepartureTime(departureTime) {
    const plan = this.data.plan || {};
    const rawRef = rawRefOf(plan);
    const travelPlan = {
      ...(plan.travelPlan || rawRef.travelPlan || {}),
      departureTime: departureTime.iso,
      departureLabel: departureTime.label,
      headline: departureTime.label === '现在出发' ? '按现在出发估算' : `${departureTime.label}更适合重看计划`,
      reason: '已按新的出发时间更新页面计划，实际路况建议出发前再打开地图确认。'
    };
    const nextPlan = {
      ...plan,
      travelPlan,
      rawRef: {
        ...rawRef,
        travelPlan
      }
    };
    this.setData({
      plan: nextPlan,
      ...buildDetailViewModel(nextPlan),
      showDeparturePicker: false
    });
  }
});
