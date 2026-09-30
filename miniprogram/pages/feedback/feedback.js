const {
  getPlanById, loadJourney, saveRouteFeedback, getAnonymousSessionId,
  getFeedbackDraft, preparePendingRequest, completePendingRequest, savePlanDetail
} = require('../../utils/journeyStore');
const {
  submitUserRoute, submitUserRouteFeedback, trackSearchEvent, getRecommendationDetail, decodePlanId
} = require('../../utils/apiClient');

const feedbackTags = [
  { value: 'ADDRESS_WRONG', label: '地址不准' },
  { value: 'DRIVE_TIME_WRONG', label: '车程不准' },
  { value: 'PARKING_WRONG', label: '停车不准' },
  { value: 'TOILET_WRONG', label: '厕所不准' },
  { value: 'ROUTE_CLOSED', label: '路线封闭' },
  { value: 'TOO_CROWDED', label: '人流太多' },
  { value: 'NOT_CHILD_FRIENDLY', label: '不适合孩子' },
  { value: 'WEATHER_UNSUITABLE', label: '天气不适合' }
];

const uploadSceneTags = [
  { value: 'PARK', label: '公园' },
  { value: 'GREENWAY', label: '绿道' },
  { value: 'HIKE', label: '徒步' },
  { value: 'RIDE', label: '骑行' },
  { value: 'TOILET', label: '有厕所' },
  { value: 'PARKING', label: '好停车' },
  { value: 'CHILD_FRIENDLY', label: '亲子友好' },
  { value: 'SHADE', label: '少晒可折返' }
];

function withActiveTags(tags = [], selectedTags = []) {
  return tags.map((item) => ({
    ...item,
    active: selectedTags.includes(item.value)
  }));
}

Page({
  data: {
    mode: 'feedback',
    isUploadMode: false,
    planId: '',
    plan: null,
    planTitle: '',
    feedbackTags: withActiveTags(feedbackTags),
    uploadSceneTags: withActiveTags(uploadSceneTags),
    selectedTags: [],
    note: '',
    photoPaths: [],
    shareExperience: true,
    submitting: false,
    uploadTitle: '',
    uploadStartPoint: '',
    uploadEndPoint: '',
    uploadDuration: '',
    uploadDifficulty: '',
    uploadSuitableAge: '',
    locationText: '深圳'
  },

  onLoad(options) {
    this.enableShareMenu();
    const mode = options?.mode === 'upload' ? 'upload' : 'feedback';
    const isUploadMode = mode === 'upload';
    const planId = decodePlanId(options?.id);
    const plan = !isUploadMode && planId ? getPlanById(planId) : null;
    const journey = loadJourney() || {};
    const form = journey.form || {};
    const draft = getFeedbackDraft(mode, planId);
    const draftPayload = draft?.payload || {};
    if (typeof wx.setNavigationBarTitle === 'function') {
      wx.setNavigationBarTitle({ title: isUploadMode ? '补充路线' : '信息纠错' });
    }
    this.setData({
      mode,
      isUploadMode,
      planId,
      plan,
      planTitle: plan?.title || (isUploadMode ? '补充一条路线' : '当前路线'),
      uploadSuitableAge: draftPayload.suitableAge ?? form.ageRange ?? '',
      uploadDuration: draftPayload.duration ?? form.duration ?? '',
      uploadDifficulty: draftPayload.difficulty ?? form.difficulty ?? '',
      locationText: form.originPoint?.name || '深圳',
      selectedTags: draftPayload.tags || [],
      feedbackTags: withActiveTags(feedbackTags, draftPayload.tags || []),
      uploadSceneTags: withActiveTags(uploadSceneTags, draftPayload.tags || []),
      note: draftPayload.note || '',
      shareExperience: draftPayload.shareExperience !== false,
      uploadTitle: draftPayload.title || '',
      uploadStartPoint: draftPayload.startPoint || '',
      uploadEndPoint: draftPayload.endPoint || ''
    });
    if (!isUploadMode && !plan && planId) {
      return getRecommendationDetail(planId).then((loadedPlan) => {
        savePlanDetail(loadedPlan);
        this.setData({ plan: loadedPlan, planTitle: loadedPlan.title });
      }).catch(() => wx.showToast({ title: '路线加载失败，请返回重试', icon: 'none' }));
    }
  },

  enableShareMenu() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onShareAppMessage() {
    const plan = this.data.plan || {};
    return {
      title: this.data.isUploadMode ? '周末户外路｜补充一条路线' : (plan.title ? `周末户外路｜${plan.title}` : '周末户外路｜亲子户外路线'),
      path: (plan.routeAssetId || plan.id)
        ? `/pages/plan-detail/plan-detail?id=${encodeURIComponent(plan.routeAssetId || plan.id)}`
        : '/pages/index/index'
    };
  },

  onShareTimeline() {
    const plan = this.data.plan || {};
    return {
      title: this.data.isUploadMode ? '周末户外路｜补充一条路线' : (plan.title ? `周末户外路｜${plan.title}` : '周末户外路｜亲子户外路线'),
      query: (plan.routeAssetId || plan.id) ? `id=${encodeURIComponent(plan.routeAssetId || plan.id)}` : ''
    };
  },

  toggleTag(event) {
    const value = event.currentTarget.dataset.value;
    const selectedTags = this.data.selectedTags.includes(value)
      ? this.data.selectedTags.filter((item) => item !== value)
      : [...this.data.selectedTags, value];
    this.setData({
      selectedTags,
      feedbackTags: withActiveTags(feedbackTags, selectedTags),
      uploadSceneTags: withActiveTags(uploadSceneTags, selectedTags)
    });
  },

  onNoteInput(event) {
    this.setData({ note: event.detail.value || '' });
  },

  onUploadTitleInput(event) {
    this.setData({ uploadTitle: event.detail.value || '' });
  },

  onUploadStartPointInput(event) {
    this.setData({ uploadStartPoint: event.detail.value || '' });
  },

  onUploadEndPointInput(event) {
    this.setData({ uploadEndPoint: event.detail.value || '' });
  },

  toggleShare() {
    this.setData({ shareExperience: !this.data.shareExperience });
  },

  noop() {},

  goHome() {
    wx.redirectTo({ url: '/pages/index/index' });
  },

  goResults() {
    wx.redirectTo({ url: '/pages/results/results' });
  },

  submitFeedback() {
    if (this.data.isUploadMode) {
      return this.submitUploadRoute();
    }
    return this.submitCorrectionFeedback();
  },

  submitCorrectionFeedback() {
    if (this.data.submitting) return;
    const note = this.data.note.trim();
    if (!this.data.selectedTags.length && !note) {
      wx.showToast({ title: '请选择一个问题或写一句说明', icon: 'none' });
      return;
    }
    const plan = this.data.plan || {};
    const journey = loadJourney() || {};
    const payload = {
      requestId: plan.requestId || journey.searchRequestId || '',
      ...(plan.routeAssetId ? { routeAssetId: plan.routeAssetId } : { candidateId: plan.candidateId || '' }),
      tags: this.data.selectedTags,
      note,
      shareExperience: this.data.shareExperience === true,
      anonymousSessionId: journey.form?.sessionId || getAnonymousSessionId()
    };
    return this.submitContribution(payload, {
      mode: 'feedback',
      planId: this.data.planId,
      planTitle: plan.title || this.data.planTitle
    }, (data) => submitUserRouteFeedback(plan, data));
  },

  submitUploadRoute() {
    if (this.data.submitting) return;
    const title = this.data.uploadTitle.trim();
    const startPoint = this.data.uploadStartPoint.trim();
    if (!title || !startPoint) {
      wx.showToast({ title: '请至少填写路线名称和大致区域', icon: 'none' });
      return;
    }
    const journey = loadJourney() || {};
    const payload = {
      title,
      startPoint,
      endPoint: this.data.uploadEndPoint.trim(),
      duration: this.data.uploadDuration || '',
      difficulty: this.data.uploadDifficulty || '',
      suitableAge: this.data.uploadSuitableAge || '',
      tags: this.data.selectedTags,
      note: this.data.note.trim(),
      shareExperience: this.data.shareExperience === true,
      anonymousSessionId: journey.form?.sessionId || getAnonymousSessionId()
    };
    return this.submitContribution(payload, { mode: 'upload', planTitle: title }, submitUserRoute);
  },

  submitContribution(payload, record, submit) {
    const scope = `contribution:${record.mode}:${record.planId || ''}`;
    const operation = preparePendingRequest(scope, payload);
    const draft = {
      ...record,
      ...payload,
      id: operation.clientRequestId,
      clientRequestId: operation.clientRequestId,
      payload: operation.payload,
      status: 'DRAFT'
    };
    saveRouteFeedback(draft);
    this.setData({ submitting: true });
    return submit(operation.payload)
      .then((response) => {
        saveRouteFeedback({
          ...draft,
          status: 'RECEIVED',
          feedbackId: response.feedbackId || '',
          submissionId: response.submissionId || '',
          receivedAt: new Date().toISOString()
        });
        completePendingRequest(scope, operation.clientRequestId);
        this.setData({ submitting: false });
        wx.showToast({ title: record.mode === 'upload' ? '已收到路线线索' : '已收到纠错', icon: 'success' });
        if (record.mode === 'feedback') {
          Promise.resolve().then(() => trackSearchEvent(loadJourney() || {}, this.data.plan, 'ROUTE_FEEDBACK_SUBMITTED', {
            feedbackId: response.feedbackId,
            tags: payload.tags,
            shareExperience: payload.shareExperience
          })).catch(() => {});
        }
        setTimeout(() => this.goBack(), 600);
        return response;
      })
      .catch((error) => {
        saveRouteFeedback({ ...draft, lastError: error.code || error.message || 'SUBMIT_FAILED' });
        this.setData({ submitting: false });
        wx.showToast({ title: '仅保存在本机，请重试', icon: 'none' });
        return null;
      });
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.redirectTo({ url: '/pages/index/index' })
    });
  }
});
