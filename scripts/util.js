
function getBrowser() {
    if (typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined') {
      return chrome;
    } else if (typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined') {
      return browser;
    } else {
      throw new LeetHubError('BrowserNotSupported');
    }
  }
  

export {
    getBrowser
}