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

api.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    api.storage.local.set({ sync_stats: true });
  }
});

api.runtime.onMessage.addListener(handleMessage);

function handleMessage(request, sender, sendResponse) {
  if (request.type === 'auth_success') {
    console.log('Authentication successful:', request.token);
    api.storage.local.remove('device_code_data');
    const urlOnboarding = api.runtime.getURL('welcome.html');
    api.tabs.create({ url: urlOnboarding, active: true });
    // You might want to update your UI or perform other actions here
  } else if (request.type === 'show_user_code') {
    api.storage.local.set({ 'device_code_data': request.response });
    api.runtime.sendMessage(request);
  }
}