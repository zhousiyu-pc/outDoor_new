function buildRecommendationPlans(form = {}) {
  const origin = form.origin || '深圳龙岗坪地';
  const ageRange = form.ageRange || '6-10岁';
  const driveLimit = form.driveLimit || '45分钟内';

  return [
    {
      id: 'family-greenway-halfday',
      roleLabel: '优先结果',
      title: '近郊绿道亲子半日方案',
      summary: `从${origin}出发，优先选择车程可控、路面平缓、便于随时折返的城市绿道型路线。`,
      confidenceLabel: '亲子适合',
      audience: `${ageRange}亲子家庭`,
      driveTime: driveLimit,
      driveMinutes: 45,
      activity: '轻徒步 / 亲子散步',
      difficulty: '轻松优先',
      reasons: [
        '路面和补给更容易判断，适合作为第一次亲子户外尝试。',
        '半日节奏更稳，可以根据孩子状态随时缩短。',
        '优先选择停车、厕所和入口清晰的候选路线。'
      ],
      timeline: [
        { time: '09:00', title: '从家出发', description: '检查天气、饮水、防晒、防蚊和备用衣物。' },
        { time: '09:45', title: '到达入口', description: '先看停车、厕所和返回点，不急于开始走完全程。' },
        { time: '10:00', title: '轻量步行', description: '以 30-60 分钟为第一段目标，观察孩子体力和兴趣。' },
        { time: '11:15', title: '折返或结束', description: '如果天气热、孩子疲惫或现场拥挤，优先结束。' }
      ],
      pointNotes: [
        { point: '入口', note: '优先选择可导航、可停车、能快速找到厕所的入口。' },
        { point: '折返点', note: '不以路线终点为目标，以孩子状态决定折返。' },
        { point: '补给', note: '优先选择有明确补给和休息条件的位置，出发前再看一眼现场状态。' }
      ],
      uncertainties: [
        '开放状态、停车、厕所和临时施工需要出发前再看一眼。',
        '如果天气炎热、孩子疲惫或现场拥挤，建议缩短路线或取消。'
      ],
      checklist: ['饮水和小零食', '防晒帽/防蚊', '备用衣物', '先看厕所和折返点']
    },
    {
      id: 'park-loop-easy',
      roleLabel: '备选结果',
      title: '城市公园轻量环线方案',
      summary: '如果天气不稳定或孩子体力一般，优先选择城市公园内短环线。',
      confidenceLabel: '轻松备选',
      audience: `${ageRange}亲子家庭`,
      driveTime: '30分钟内优先',
      driveMinutes: 30,
      activity: '公园环线 / 低风险活动',
      difficulty: '轻松',
      reasons: ['更容易中途退出。', '补给和厕所通常更可控。', '适合把户外变成半日轻体验。'],
      timeline: [
        { time: '09:30', title: '到达公园', description: '先看洗手间和阴凉休息点。' },
        { time: '10:00', title: '短环线体验', description: '控制在 1 小时以内，不追求距离。' },
        { time: '11:00', title: '休息观察', description: '根据孩子状态决定是否追加一小段。' }
      ],
      pointNotes: [
        { point: '入口', note: '选择人流稳定、停车明确的公园入口。' },
        { point: '休息点', note: '优先选择阴凉、可坐下、靠近厕所的位置。' }
      ],
      uncertainties: ['周末停车和人流可能影响体验。', '若孩子状态一般，建议只完成短环线后结束。'],
      checklist: ['轻便鞋', '水杯', '纸巾', '儿童防晒']
    }
  ];
}

function buildRecommendationResponse(form) {
  const plans = buildRecommendationPlans(form);
  return {
    ok: true,
    status: 'READY',
    message: '已根据当前出发条件找到亲子户外路线。',
    pool: {
      minimumStableCount: 3,
      activeCount: plans.length,
      status: 'READY',
      message: '已找到可用于出发判断的路线。',
      nextActions: ['可调整出发条件后重新搜索。', '出发前请再看一眼天气、开放状态、停车和厕所。']
    },
    plans,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildRecommendationPlans,
  buildRecommendationResponse
};
