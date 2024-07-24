function getBrowser() {
  if (typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined') {
    return chrome;
  } else if (typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined') {
    return browser;
  } else {
    throw new Error('BrowserNotSupported');
  }
}

let api = getBrowser();

const localauth = {
  init() {
    this.KEY = 'codehub_token';
    this.ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
    this.CLIENT_ID = 'Ov23livPRlJDBsv27Jei';
  },

  checkStatus(url) {
    if (url.match(/\/login\/device\/failure($|\?)/)) {
      api.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tab = tabs[0];
        api.tabs.remove(tab.id, function() {});
      });
    } else if (url.match(/\/login\/device\/success/)) {
      alert('fefiuhi')
      this.requestToken();
    }
  },

  requestToken() {
    api.storage.local.get('device_code_data', data => {
      const deviceCodeResponse = data.device_code_data;
      if (deviceCodeResponse === null || deviceCodeResponse === undefined) {
        console.error('No device code data found');
      } else {
        // alert(deviceCodeResponse)
        this.pollForAccessToken(deviceCodeResponse);
      }
    });
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

  finishAuth(token) {
    api.storage.local.set({ [this.KEY]: token }, () => {
      api.runtime.sendMessage({
        type: 'auth_success',
        token: token
      });
    });
  }
};

localauth.init(); // load params.
const link = window.location.href;

if (window.location.host === 'github.com') {
  api.storage.local.get('device_code_data', (data) => {
    if (data && data.device_code_data) {
      localauth.checkStatus(link);
    }
  });
}