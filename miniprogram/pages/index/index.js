// 银河星辰小程序首页
const app = getApp();

Page({
  data: {
    userInfo: null,
    features: [
      {
        id: 'finance',
        name: '财务软件',
        icon: '📊',
        description: '专业财务工具'
      },
      {
        id: 'tax',
        name: '一键报税',
        icon: '📝',
        description: '智能税务申报'
      },
      {
        id: 'analysis',
        name: '数据分析',
        icon: '📈',
        description: '深度财务分析'
      },
      {
        id: 'academy',
        name: '财务学堂',
        icon: '🎓',
        description: '在线学习课程'
      },
      {
        id: 'templates',
        name: '模板专区',
        icon: '📋',
        description: '实用财务模板'
      },
      {
        id: 'store',
        name: '在线商城',
        icon: '🛒',
        description: '精选财务商品'
      },
      {
        id: 'cloud',
        name: '云盘',
        icon: '☁️',
        description: '文件存储共享'
      },
      {
        id: 'assistant',
        name: '智能助手',
        icon: '🤖',
        description: 'AI财务助手'
      },
      {
        id: 'risk',
        name: '风险预警',
        icon: '⚠️',
        description: '智能风险监测'
      },
      {
        id: 'budget',
        name: '预算管理',
        icon: '💵',
        description: '财务预算规划'
      },
      {
        id: 'invoice',
        name: '发票管理',
        icon: '🧾',
        description: '智能发票处理'
      },
      {
        id: 'audit',
        name: '审计专区',
        icon: '🔍',
        description: '专业审计工具'
      },
      {
        id: 'bp',
        name: '财务BP',
        icon: '💼',
        description: '业务伙伴服务'
      }
    ]
  },

  onLoad() {
    console.log('首页加载');
    this.checkLogin();
    this.loadData();
  },

  onShow() {
    console.log('首页显示');
  },

  onReady() {
    console.log('首页渲染完成');
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.loadData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  onReachBottom() {
    console.log('触底加载更多');
  },

  // 检查登录状态
  checkLogin() {
    if (!app.globalData.userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      });
    } else {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    }
  },

  // 加载数据
  async loadData() {
    try {
      wx.showLoading({
        title: '加载中...'
      });

      // 这里可以加载首页数据
      // const result = await app.request('/api/home/data');
      
      setTimeout(() => {
        wx.hideLoading();
      }, 500);
    } catch (error) {
      wx.hideLoading();
      app.showToast('加载失败');
      console.error(error);
    }
  },

  // 点击功能卡片
  onFeatureTap(e) {
    const feature = e.currentTarget.dataset.feature;
    console.log('点击功能:', feature);

    // 根据功能id跳转到对应页面
    switch (feature.id) {
      case 'academy':
        wx.switchTab({
          url: '/pages/academy/academy'
        });
        break;
      case 'chat':
        wx.switchTab({
          url: '/pages/chat/chat'
        });
        break;
      case 'store':
        wx.navigateTo({
          url: '/pages/store/store'
        });
        break;
      default:
        app.showToast('功能开发中');
        break;
    }
  },

  // 跳转到会员中心
  goToMember() {
    wx.switchTab({
      url: '/pages/member/member'
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '银河星辰 - 专业财务服务平台',
      path: '/pages/index/index',
      imageUrl: '/images/share.png'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '银河星辰 - 专业财务服务平台',
      imageUrl: '/images/share.png'
    };
  }
});
