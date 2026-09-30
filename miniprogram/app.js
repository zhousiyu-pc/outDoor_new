const CLOUD_ENV_ID = 'prod-d3gtq4wc6451c535a';
const CLOUD_SERVICE_NAME = 'springboot-syk5';

App({
  globalData: {
    cloudEnvId: CLOUD_ENV_ID,
    cloudServiceName: CLOUD_SERVICE_NAME
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用支持云开发能力的微信开发者工具或基础库');
      return;
    }

    console.log('[cloud-init] start', {
      env: CLOUD_ENV_ID,
      service: CLOUD_SERVICE_NAME,
      hasCallContainer: typeof wx.cloud.callContainer === 'function'
    });

    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    });

    console.log('[cloud-init] completed', {
      env: CLOUD_ENV_ID,
      service: CLOUD_SERVICE_NAME
    });
  }
});
