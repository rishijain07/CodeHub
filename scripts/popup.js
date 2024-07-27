import { getBrowser } from "./util.js";

let api = getBrowser();
let action = false;

document.getElementById('authenticate').addEventListener('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

document.getElementById('welcome_URL').setAttribute('href', api.runtime.getURL('welcome.html'));
document.getElementById('hook_URL').setAttribute('href', api.runtime.getURL('welcome.html'));

api.storage.local.get('codehub_token', data => {
  const token = data.codehub_token;
  if (token === null || token === undefined) {
    action = true;
    document.getElementById('auth').classList.remove('d-none');
  } else {
    // Token exists, you might want to show a different UI here
    console.log('User is already authenticated');
    
    api.storage.local.get('codehub_token', res => {
      const hook = res.codehub_token
      if(hook === null || hook === undefined)
        document.getElementById('hook_mode').classList.remove('d-none');
      else 
       document.getElementById('commit_mode').classList.remove('d-none')
    })
  }
});

api.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'show_user_code') {
    document.getElementById('auth').classList.add('d-none');
    document.getElementById('device_code_mode').classList.remove('d-none');
    document.getElementById('user_code').textContent = request.user_code;
    document.getElementById('verification_uri').href = request.verification_uri;
  } else if (request.type === 'auth_success') {
    // Hide the authentication UI and show a success message
    document.getElementById('device_code_mode').classList.add('d-none');   
  }
});

document.getElementById('proceed_to_verification').addEventListener('click', () => {
  const verificationUri = document.getElementById('verification_uri').href;
  api.tabs.create({ url: verificationUri, active: true });
});