// 银河星辰小程序入口文件
App({
  globalData: {
    userInfo: null,
    token: null,
    apiBase: 'https://your-domain.com/api' // 生产环境地址
  },

  onLaunch() {
    console.log('银河星辰小程序启动');
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 获取系统信息
    this.getSystemInfo();
  },

  onShow() {
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  },

  // 获取系统信息
  getSystemInfo() {
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
      }
    });
  },

  // 登录
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            // 发送code到后端换取token
            this.request('/api/wx/login', {
              code: res.code
            }).then(result => {
              if (result.success) {
                // 保存token和用户信息
                wx.setStorageSync('token', result.data.token);
                wx.setStorageSync('userInfo', result.data.userInfo);
                this.globalData.token = result.data.token;
                this.globalData.userInfo = result.data.userInfo;
                resolve(result.data);
              } else {
                reject(new Error(result.message));
              }
            }).catch(err => {
              reject(err);
            });
          } else {
            reject(new Error('获取登录code失败'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 退出登录
  logout() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.globalData.token = null;
    this.globalData.userInfo = null;
  },

  // 统一请求封装
  request(url, data = {}, method = 'POST') {
    return new Promise((resolve, reject) => {
      const header = {
        'content-type': 'application/json'
      };

      if (this.globalData.token) {
        header['Authorization'] = `Bearer ${this.globalData.token}`;
      }

      wx.request({
        url: this.globalData.apiBase + url,
        method: method,
        data: data,
        header: header,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 显示Toast提示
  showToast(title, icon = 'none', duration = 2000) {
    wx.showToast({
      title: title,
      icon: icon,
      duration: duration
    });
  },

  // 显示加载提示
  showLoading(title = '加载中...') {
    wx.showLoading({
      title: title,
      mask: true
    });
  },

  // 隐藏加载提示
  hideLoading() {
    wx.hideLoading();
  },

  // 跳转页面
  navigateTo(url) {
    wx.navigateTo({
      url: url
    });
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack();
  }
});
