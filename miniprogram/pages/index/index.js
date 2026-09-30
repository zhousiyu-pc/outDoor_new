const {
  defaultForm,
  loadJourney,
  saveForm,
  buildConditionSummary,
  buildConditionHighlights,
  buildDepartureSummary,
  toggleListValue,
  normalizeForm,
  defaultDepartureTime,
  normalizeDepartureTime
} = require('../../utils/journeyStore');
const { reverseGeocodeLocation } = require('../../utils/apiClient');
const { buildRecommendationPlans } = require('../../utils/recommendationPlans');

const ageRangeOptions = ['3-5岁', '6-10岁', '10岁以上'];
const durationOptions = ['半天', '周末1天'];
const difficultyOptions = ['轻松', '轻松/适中', '有挑战'];
const transportOptions = ['自驾', '公共交通'];
const driveLimitOptions = ['30分钟内', '45分钟内', '60分钟内'];
const quickSearchOptions = ['带孩子走走', '少晒短线', '去看水'];
const quickSearchQueryMap = {
  '带孩子走走': '周末带孩子走一条轻松的自然步道',
  '少晒短线': '想找半天短线，最好少晒、可以随时折返',
  '去看水': '想去看水，路不要太累，停车方便',
  // Keep the earlier labels readable for journeys saved before this UI pass.
  '想走走': '亲子步道',
  '想骑行': '亲子绿道 骑行',
  '半天短线': '半天亲子短途',
  '好停车': '停车方便',
  '有厕所': '厕所方便',
  '少晒可折返': '少晒 可折返'
};
const scenePreferenceOptions = ['公园', '绿道', '步道', '骑行', '湿地', '湖边'];
const safetyNeedOptions = ['厕所方便', '停车方便', '可随时折返', '少晒阴凉', '低龄友好'];


function pad(value) {
  return String(value).padStart(2, '0');
}

function dateText(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeText(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isSupportedOriginPoint(point = {}) {
  point = point || {};
  const lng = Number(point.lng ?? point.longitude);
  const lat = Number(point.lat ?? point.latitude);
  // The product currently serves Shenzhen/China. Developer Tool's default
  // location can be a US simulator point (-77, 38), which must not be sent
  // as the user's real origin.
  return Number.isFinite(lng) && Number.isFinite(lat)
    && lng >= 73 && lng <= 135
    && lat >= 3 && lat <= 54;
}

function isDeveloperTool() {
  try {
    return wx.getSystemInfoSync?.()?.platform === 'devtools';
  } catch {
    return false;
  }
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

function buildQuickSearchOptions(form = {}) {
  return quickSearchOptions.map((label) => ({
    label,
    active: form.query === label || form.query === quickSearchQueryMap[label]
  }));
}

function buildSummaryHighlights(form = {}) {
  return buildConditionHighlights(form);
}

Page({
  data: {
    form: defaultForm,
    showAdvancedFilters: false,
    showDeparturePicker: false,
    customDepartureDate: dateText(new Date()),
    customDepartureTime: timeText(new Date()),
    ageRangeOptions,
    durationOptions,
    difficultyOptions,
    transportOptions,
    driveLimitOptions,
    quickSearchOptions: buildQuickSearchOptions(defaultForm),
    scenePreferenceOptions,
    safetyNeedOptions,
    conditionSummary: '',
    summaryHighlights: buildSummaryHighlights(defaultForm),
    departureSummary: buildDepartureSummary(defaultForm),
    advancedToggleText: '调整筛选',
    originStatus: 'locating',
    originDisplayName: '选择出发地',
    originActionText: '',
    locatingOrigin: false,
    previewPlan: buildRecommendationPlans(defaultForm)[0]
  },

  onLoad() {
    this.enableShareMenu();
    const journey = loadJourney();
    const form = normalizeForm({
      ...defaultForm,
      ...(journey?.form || {})
    });
    this.setData({
      form,
      quickSearchOptions: buildQuickSearchOptions(form),
      conditionSummary: buildConditionSummary(form),
      summaryHighlights: buildSummaryHighlights(form),
      departureSummary: buildDepartureSummary(form),
      customDepartureDate: form.departureTime?.date || dateText(new Date()),
      customDepartureTime: form.departureTime?.time || timeText(new Date()),
      previewPlan: buildRecommendationPlans(form)[0]
    });
    this.syncOriginDisplay(form);
    this.bootstrapOrigin();
  },

  enableShareMenu() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onShareAppMessage() {
    return {
      title: '周末户外路｜帮你找适合亲子的户外路线',
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    return {
      title: '周末户外路｜帮你找适合亲子的户外路线',
      query: ''
    };
  },


  noop() {},

  openDeparturePicker() {
    const departureTime = normalizeDepartureTime(this.data.form.departureTime || defaultDepartureTime());
    this.setData({
      showDeparturePicker: true,
      customDepartureDate: departureTime.date || dateText(new Date()),
      customDepartureTime: departureTime.time || timeText(new Date())
    });
  },

  closeDeparturePicker() {
    this.setData({ showDeparturePicker: false });
  },

  selectQuickDeparture(event) {
    const mode = event.currentTarget.dataset.value || 'NOW';
    this.updateForm('departureTime', buildDepartureTime(mode));
    this.closeDeparturePicker();
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
    this.updateForm('departureTime', {
      ...buildDepartureTime('CUSTOM', Number.isNaN(value.getTime()) ? new Date() : value),
      userSelected: true
    });
    this.closeDeparturePicker();
  },

  onSearchInput(event) {
    this.updateForm('query', event.detail.value);
  },


  bootstrapOrigin() {
    const form = this.data.form || {};
    if (isDeveloperTool()) {
      this.useDefaultOrigin();
      return;
    }
    if (isSupportedOriginPoint(form.originPoint)) {
      this.syncOriginDisplay(form);
      return;
    }
    this.locateCurrentOrigin();
  },

  useDefaultOrigin() {
    const form = {
      ...this.data.form,
      origin: '深圳',
      originPoint: null,
      originSource: 'FALLBACK'
    };
    this.setData({
      form,
      locatingOrigin: false,
      originStatus: 'fallback',
      originDisplayName: '深圳',
      originActionText: ''
    });
  },

  openOriginPicker() {
    if (!wx.chooseLocation) {
      wx.showToast({ title: '当前版本暂不支持选点', icon: 'none' });
      return;
    }
    wx.chooseLocation({
      success: (res) => {
        const point = {
          name: res.name || res.address || '自选地点',
          lng: res.longitude,
          lat: res.latitude,
          address: res.address || res.name || ''
        };
        this.applyOriginPoint(point, 'MAP_PICKER', '已选择出发地');
      },
      fail: () => {
        wx.showToast({ title: '未选择地点', icon: 'none' });
      }
    });
  },

  locateCurrentOrigin() {
    if (isDeveloperTool()) {
      this.useDefaultOrigin();
      return;
    }
    this.setData({
      locatingOrigin: true,
      originStatus: 'locating',
      originDisplayName: '定位中...'
    });
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const point = {
          name: '当前位置附近',
          lng: res.longitude,
          lat: res.latitude,
          address: ''
        };
        if (!isSupportedOriginPoint(point)) {
          const form = {
            ...this.data.form,
            origin: '',
            originPoint: null,
            originSource: 'FALLBACK'
          };
          this.setData({ form, locatingOrigin: false });
          this.syncOriginDisplay(form, { unavailable: true });
          return;
        }
        reverseGeocodeLocation(point)
          .then((result) => {
            this.applyOriginPoint({
              name: result.district || result.city || '当前位置附近',
              lng: Number(result.lng),
              lat: Number(result.lat),
              address: result.formattedAddress || '',
              adcode: result.adcode || ''
            }, 'CURRENT_LOCATION', '当前位置附近');
          })
          .catch(() => {
            this.applyOriginPoint(point, 'CURRENT_LOCATION', '当前位置附近');
          });
      },
      fail: () => {
        const form = {
          ...this.data.form,
          origin: '',
          originPoint: null,
          originSource: 'FALLBACK'
        };
        this.setData({ form, locatingOrigin: false });
        this.syncOriginDisplay(form, { unavailable: true });
      }
    });
  },

  applyOriginPoint(point, source = 'CURRENT_LOCATION', title = '当前位置附近') {
    const nextForm = {
      ...this.data.form,
      origin: point.address || point.name || '',
      originPoint: point,
      originSource: source
    };
    this.setData({
      form: nextForm,
      locatingOrigin: false
    });
    this.syncOriginDisplay(nextForm, { title });
  },

  syncOriginDisplay(form = {}, options = {}) {
    const point = form.originPoint || null;
    if (options.unavailable) {
      this.setData({
        originStatus: 'unavailable',
        originDisplayName: '选择出发地',
        originActionText: ''
      });
      return;
    }
    if (isSupportedOriginPoint(point)) {
      this.setData({
        originStatus: form.originSource === 'MAP_PICKER' ? 'picked' : 'located',
        originDisplayName: point.name || point.address || '当前位置附近',
        originActionText: ''
      });
      return;
    }
    this.setData({
      originStatus: this.data.locatingOrigin ? 'locating' : 'unavailable',
      originDisplayName: this.data.locatingOrigin ? '定位中...' : '选择出发地',
      originActionText: ''
    });
  },

  applyQuickSearch(event) {
    const value = event.currentTarget.dataset.value;
    const query = quickSearchQueryMap[value] || value.replace('附近', '').replace('半天', '').replace('轻松', '').replace('可折返', '').trim() || value;
    const nextForm = {
      ...this.data.form,
      query,
      destinationHint: '',
      duration: value.includes('短途') || value.includes('半天') ? '半天' : this.data.form.duration,
      difficulty: value.includes('轻松') || value.includes('短途') ? '轻松' : this.data.form.difficulty,
      safetyNeeds: this.nextSafetyNeeds(value)
    };
    this.setData({
      form: nextForm,
      quickSearchOptions: buildQuickSearchOptions(nextForm),
      conditionSummary: buildConditionSummary(nextForm),
      summaryHighlights: buildSummaryHighlights(nextForm),
      departureSummary: buildDepartureSummary(nextForm),
      previewPlan: buildRecommendationPlans(nextForm)[0]
    });
  },

  nextSafetyNeeds(value) {
    let needs = this.data.form.safetyNeeds || [];
    if (value.includes('厕所')) {
      needs = needs.includes('厕所方便') ? needs : [...needs, '厕所方便'];
    }
    if (value.includes('停车')) {
      needs = needs.includes('停车方便') ? needs : [...needs, '停车方便'];
    }
    if (value.includes('折返') || value.includes('短途')) {
      needs = needs.includes('可随时折返') ? needs : [...needs, '可随时折返'];
    }
    return needs;
  },

  selectAge(event) {
    this.updateForm('ageRange', event.currentTarget.dataset.value);
  },

  selectDuration(event) {
    this.updateForm('duration', event.currentTarget.dataset.value);
  },

  selectDifficulty(event) {
    this.updateForm('difficulty', event.currentTarget.dataset.value);
  },

  selectTransport(event) {
    this.updateForm('transport', event.currentTarget.dataset.value);
  },

  selectDriveLimit(event) {
    this.updateForm('driveLimit', event.currentTarget.dataset.value);
  },

  toggleScene(event) {
    this.updateForm('scenePreferences', toggleListValue(this.data.form.scenePreferences, event.currentTarget.dataset.value));
  },

  toggleSafety(event) {
    this.updateForm('safetyNeeds', toggleListValue(this.data.form.safetyNeeds, event.currentTarget.dataset.value));
  },

  updateForm(key, value) {
    const form = {
      ...this.data.form,
      [key]: value
    };
    this.setData({
      form,
      quickSearchOptions: buildQuickSearchOptions(form),
      conditionSummary: buildConditionSummary(form),
      summaryHighlights: buildSummaryHighlights(form),
      departureSummary: buildDepartureSummary(form),
      previewPlan: buildRecommendationPlans(form)[0],
      customDepartureDate: key === 'departureTime' ? value.date : this.data.customDepartureDate,
      customDepartureTime: key === 'departureTime' ? value.time : this.data.customDepartureTime
    });
  },

  toggleAdvancedFilters() {
    const next = !this.data.showAdvancedFilters;
    this.setData({
      showAdvancedFilters: next,
      advancedToggleText: next ? '收起筛选' : '调整筛选'
    });
  },

  searchRoutes() {
    const form = normalizeForm(this.data.form);
    saveForm(form);
    wx.navigateTo({
      url: '/pages/results/results'
    });
  },

  openUploadRoute() {
    wx.navigateTo({
      url: '/pages/feedback/feedback?mode=upload'
    });
  }
});
