import { getBrowser } from "./util.js";

let api = getBrowser();
let action = false;

function checkAuthentication(token) {
  const AUTHENTICATION_URL = 'https://api.github.com/user';

  fetch(AUTHENTICATION_URL, {
    headers: {
      'Authorization': `token ${token}`
    }
  })
  .then(response => {
    if (response.status === 200) {
      return response.json();
    } else if (response.status === 401) {
      throw new Error('Unauthorized');
    } else {
      throw new Error('Request failed');
    }
  })
  .then(() => {
    // Show MAIN FEATURES
    api.storage.local.get('mode_type', data2 => {
      if (data2 && data2.mode_type === 'commit') {
        document.getElementById('commit_mode').classList.remove('d-none');
        // Get problem stats and repo link
        api.storage.local.get(['stats', 'codehub_hook'], data3 => {
          const stats = data3?.stats;
          document.getElementById('leetcode_solved').textContent = stats?.solved ?? 0;
          document.getElementById('leetcode_easy').textContent = stats?.easy ?? 0;
          document.getElementById('leetcode_medium').textContent = stats?.medium ?? 0;
          document.getElementById('leetcode_hard').textContent = stats?.hard ?? 0;
          const codehubHook = data3?.codehub_hook;
          if (codehubHook) {
            document.getElementById('repo_url').innerHTML = `
              <a target="blank" style="color: cadetblue !important; font-size:0.8em;" href="https://github.com/${codehubHook}">
                ${codehubHook}
              </a>
            `;
          }
        });
        api.storage.local.get(['gfgstats'], data3 => {
          const stats = data3?.gfgstats;
          document.getElementById('gfg_solved').textContent = stats?.solved ?? 0;
          document.getElementById('gfg_easy').textContent = stats?.easy ?? 0;
          document.getElementById('gfg_medium').textContent = stats?.medium ?? 0;
          document.getElementById('gfg_hard').textContent = stats?.hard ?? 0;
          document.getElementById('gfg_basic').textContent = stats?.basic ?? 0;
          document.getElementById('gfg_school').textContent = stats?.school ?? 0;
          
        });
        api.storage.local.get(['stats', 'gfgstats'], data3 => {
          const stats = data3?.stats;
          const stats1 = data3?.gfgstats;
          let solve1 = stats?.solved ?? 0
          let solve2 = stats1?.solved ?? 0
          document.getElementById('solved').textContent = solve1+solve2;
          
        });
      } else {
        document.getElementById('hook_mode').classList.remove('d-none');
      }
    });
  })
  .catch(error => {
    if (error.message === 'Unauthorized') {
      // bad oAuth
      // reset token and redirect to authorization process again!
      api.storage.local.set({ leethub_token: null }, () => {
        console.log('BAD oAuth!!! Redirecting back to oAuth process');
        action = true;
        document.getElementById('auth_mode').classList.remove('d-none');
      });
    } else {
      console.error('Error:', error);
    }
  });
}

document.getElementById('authenticate').addEventListener('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

document.getElementById('welcome_URL').setAttribute('href', api.runtime.getURL('welcome.html'));
document.getElementById('hook_URL').setAttribute('href', api.runtime.getURL('welcome.html'));

document.getElementById('reset_stats').addEventListener('click', () => {
  document.getElementById('reset_confirmation').classList.remove('d-none');
});

document.getElementById('reset_yes').addEventListener('click', () => {
  api.storage.local.set({ stats: null, gfgstats: null }, () => {
    document.getElementById('leetcode_solved').textContent = '0';
    document.getElementById('leetcode_easy').textContent = '0';
    document.getElementById('leetcode_medium').textContent = '0';
    document.getElementById('leetcode_hard').textContent = '0';
    document.getElementById('gfg_solved').textContent = '0';
    document.getElementById('gfg_easy').textContent = '0';
    document.getElementById('gfg_medium').textContent = '0';
    document.getElementById('gfg_hard').textContent = '0';
    document.getElementById('gfg_basic').textContent = '0';
    document.getElementById('gfg_school').textContent = '0';
    document.getElementById('solved').textContent = '0';
    
    document.getElementById('reset_confirmation').classList.add('d-none');
  });
});

document.getElementById('reset_no').addEventListener('click', () => {
  document.getElementById('reset_confirmation').classList.add('d-none');
});

api.storage.local.get('codehub_token', data => {
  const token = data. codehub_token;
  if (token === null || token === undefined) {
    action = true;
    document.getElementById('auth').classList.remove('d-none');
  } else {
    checkAuthentication(token);
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