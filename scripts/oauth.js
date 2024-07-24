const oAuth2 = {
  init() {
    this.KEY = 'codehub_token';
    this.DEVICE_CODE_URL = 'https://github.com/login/device/code';
    this.ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
    this.CLIENT_ID = 'Ov23livPRlJDBsv27Jei';
    this.SCOPES = ['repo'];
  },

  async begin() {
    this.init();
    const deviceCodeResponse = await this.getDeviceCode();
    this.showUserCode(deviceCodeResponse.user_code, deviceCodeResponse.verification_uri, deviceCodeResponse);
    this.pollForAccessToken(deviceCodeResponse);
  },
  
  async getDeviceCode() {
    const response = await fetch(this.DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES.join(' ')
      })
    });
    return response.json();
  },

  async pollForAccessToken(deviceCodeResponse) {
    const pollInterval = deviceCodeResponse.interval || 5;
    const expiresIn = deviceCodeResponse.expires_in || 600;
    const startTime = Date.now();

    const poll = async () => {
      if (Date.now() - startTime >= expiresIn * 1000) {
        console.log('Device flow authorization timed out');
        return;
      }

      const response = await fetch(this.ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.CLIENT_ID,
          device_code: deviceCodeResponse.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      const data = await response.json();

      if (data.error === 'authorization_pending') {
        setTimeout(poll, pollInterval * 1000);
      } else if (data.access_token) {
        this.finishAuth(data.access_token);
      } else {
        console.log('Error in device flow:', data.error);
      }
    };

    poll();
  },

  showUserCode(userCode, verificationUri, res) {
    chrome.runtime.sendMessage({
      type: 'show_user_code',
      user_code: userCode,
      verification_uri: verificationUri,
      response: res
    });
  },

  finishAuth(token) {
    chrome.storage.local.set({ [this.KEY]: token }, () => {
      chrome.runtime.sendMessage({
        type: 'auth_success',
        token: token
      });
    });
  }
};