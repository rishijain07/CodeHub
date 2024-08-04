import { getBrowser } from "./util.js";

const api = getBrowser();

const option = () => {
  return document.getElementById('type').value;
};

const repositoryName = () => {
  return document.getElementById('name').value.trim();
};

const createRepoDescription =
  'A collection of  questions to ace the coding interview! - Created using [codehub](https://github.com/)';

  const fetchStats = async (token, repo, path) => {
    const URL = `https://api.github.com/repos/${repo}/contents/${path}`;
    let options = {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    };
  
    try {
      let resp = await fetch(URL, options);
      if (!resp.ok && resp.status == 404) {
        console.log(`No stats found at ${path}; starting fresh`);
        return null;
      }
      let data = await resp.json();
      let statsJson = decodeURIComponent(escape(atob(data.content)));
      return JSON.parse(statsJson);
    } catch (error) {
      console.error(`Error fetching stats from ${path}:`, error);
      return null;
    }
  };
  
  const syncStats = async () => {
    let { codehub_hook, codehub_token, sync_stats } = await api.storage.local.get([
      'codehub_token',
      'codehub_hook',
      'sync_stats',
    ]);
  
    if (sync_stats === false) {
      console.log('Persistent stats already synced!');
      return;
    }
  
    try {
      const leetcodeStats = await fetchStats(codehub_token, codehub_hook, 'leetcode/stats.json');
      const gfgStats = await fetchStats(codehub_token, codehub_hook, 'geeksforgeeks/stats.json');
      if(gfgStats == null){
        api.storage.local.set({gfgstats: null})
      }else{
        api.storage.local.set({gfgstats: gfgStats.geeksforgeeks})
      }
      if(leetcodeStats == null){
        api.storage.local.set({stats: null})
      }else{
        api.storage.local.set({stats: leetcodeStats.leetcode})
      }
  
  
      api.storage.local.set(
        { 
          sync_stats: false 
        }, 
        () => console.log('Successfully synced local stats with GitHub stats')
      );
  
      return { stats: leetcodeStats, gfgstats: gfgStats };
    } catch (error) {
      console.error('Error syncing stats:', error);
      return {};
    }
  };

const getCreateErrorString = (statusCode, name) => {
  const errorStrings = {
    304: `Error creating ${name} - Unable to modify repository. Try again later!`,
    400: `Error creating ${name} - Bad POST request, make sure you're not overriding any existing scripts`,
    401: `Error creating ${name} - Unauthorized access to repo. Try again later!`,
    403: `Error creating ${name} - Forbidden access to repository. Try again later!`,
    422: `Error creating ${name} - Unprocessable Entity. Repository may have already been created. Try Linking instead (select 2nd option).`,
  };
  return errorStrings[statusCode];
};

const handleRepoCreateError = (statusCode, name) => {
  document.getElementById('success').classList.add('d-none');
  document.getElementById('error').textContent = getCreateErrorString(statusCode, name);
  document.getElementById('error').classList.remove('d-none');
};

const createRepo = async (token, name) => {
  const AUTHENTICATION_URL = 'https://api.github.com/user/repos';
  let data = {
    name,
    private: true,
    auto_init: true,
    description: createRepoDescription,
  };

  const options = {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(data),
  };

  try {
    let res = await fetch(AUTHENTICATION_URL, options);
    if (!res.ok) {
      return handleRepoCreateError(res.status, name);
    }
    res = await res.json();

    api.storage.local.set({ mode_type: 'commit', codehub_hook: res.full_name });
    await api.storage.local.remove('stats');
    document.getElementById('error').classList.add('d-none');
    document.getElementById('success').innerHTML =
      `Successfully created <a target="blank" href="${res.html_url}">${name}</a>. Start <a href="http://leetcode.com">LeetCoding</a>!`;
    document.getElementById('success').classList.remove('d-none');
    document.getElementById('unlink').classList.remove('d-none');
    document.getElementById('hook_mode').classList.add('d-none');
    document.getElementById('commit_mode').classList.remove('d-none');
  } catch (error) {
    console.error('Error creating repo:', error);
    handleRepoCreateError(500, name);
  }
};

const getLinkErrorString = (statusCode, name) => {
  const errorStrings = {
    301: `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to LeetHub. <br> This repository has been moved permanently. Try creating a new one.`,
    403: `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to LeetHub. <br> Forbidden action. Please make sure you have the right access to this repository.`,
    404: `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to LeetHub. <br> Resource not found. Make sure you enter the right repository name.`,
  };
  return errorStrings[statusCode];
};

const handleLinkRepoError = (statusCode, name) => {
  document.getElementById('success').classList.add('d-none');
  document.getElementById('error').innerHTML = getLinkErrorString(statusCode, name);
  document.getElementById('error').classList.remove('d-none');
  document.getElementById('unlink').classList.add('d-none');
};

const linkRepo = async (token, name) => {
  const AUTHENTICATION_URL = `https://api.github.com/repos/${name}`;

  const options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

  try {
    const response = await fetch(AUTHENTICATION_URL, options);
    if (!response.ok) {
      handleLinkRepoError(response.status, name);
      api.storage.local.set({ mode_type: 'hook', codehub_hook: null }, () => {
        console.log(`Error linking ${name} to LeetHub`);
        console.log('Defaulted repo hook to NONE');
      });

      document.getElementById('hook_mode').classList.remove('d-none');
      document.getElementById('commit_mode').classList.add('d-none');
      return;
    }

    const res = await response.json();
    api.storage.local.set(
      { mode_type: 'commit', repo: res.html_url, codehub_hook: res.full_name },
      () => {
        document.getElementById('error').classList.add('d-none');
        document.getElementById('success').innerHTML =
          `Successfully linked <a target="blank" href="${res.html_url}">${name}</a> to Codehub. Start Coding now!`;
        document.getElementById('success').classList.remove('d-none');
        document.getElementById('unlink').classList.remove('d-none');
        console.log('Successfully set new repo hook');
      }
    );

    const data = await api.storage.local.get('sync_stats');
    const { stats, gfgstats } = data?.sync_stats ? await syncStats() : await api.storage.local.get(['stats', 'gfgstats']);

    // Update LeetCode stats
    document.getElementById('leetcode_solved').textContent = stats?.solved ?? 0;
    document.getElementById('leetcode_easy').textContent = stats?.easy ?? 0;
    document.getElementById('leetcode_medium').textContent = stats?.medium ?? 0;
    document.getElementById('leetcode_hard').textContent = stats?.hard ?? 0;

    // Update GeeksforGeeks stats
    document.getElementById('gfg_solved').textContent = gfgstats?.solved ?? 0;
    document.getElementById('gfg_school').textContent = gfgstats?.school ?? 0;
    document.getElementById('gfg_basic').textContent = gfgstats?.basic ?? 0;
    document.getElementById('gfg_easy').textContent = gfgstats?.easy ?? 0;
    document.getElementById('gfg_medium').textContent = gfgstats?.medium ?? 0;
    document.getElementById('gfg_hard').textContent = gfgstats?.hard ?? 0;

    // Update total solved problems
    const totalSolved = (stats?.solved ?? 0) + (gfgstats?.solved ?? 0);
    document.getElementById('solved').textContent = totalSolved;

    document.getElementById('hook_mode').classList.add('d-none');
    document.getElementById('commit_mode').classList.remove('d-none');
  } catch (error) {
    console.error('Error linking repo:', error);
    handleLinkRepoError(500, name);
  }
};

const unlinkRepo = () => {
  api.storage.local.set(
    { mode_type: 'hook', codehub_hook: null, sync_stats: true, stats: null },
    () => {
      console.log(`Unlinked repo`);
      console.log('Cleared local stats');
    }
  );

  document.getElementById('hook_mode').classList.remove('d-none');
  document.getElementById('commit_mode').classList.add('d-none');
};

document.getElementById('type').addEventListener('change', function () {
  const valueSelected = this.value;
  if (valueSelected) {
    document.getElementById('hook_button').disabled = false;
  } else {
    document.getElementById('hook_button').disabled = true;
  }
});

document.getElementById('hook_button').addEventListener('click', () => {
  if (!option()) {
    document.getElementById('error').textContent =
      'No option selected - Pick an option from dropdown menu below that best suits you!';
    document.getElementById('error').classList.remove('d-none');
  } else if (!repositoryName()) {
    document.getElementById('error').textContent = 'No repository name added - Enter the name of your repository!';
    document.getElementById('name').focus();
    document.getElementById('error').classList.remove('d-none');
  } else {
    document.getElementById('error').classList.add('d-none');
    document.getElementById('success').textContent = 'Attempting to create Hook... Please wait.';
    document.getElementById('success').classList.remove('d-none');

    api.storage.local.get('codehub_token', data => {
      const token = data.codehub_token;
      if (token === null || token === undefined) {
        document.getElementById('error').textContent =
          'Authorization error - Grant LeetHub access to your GitHub account to continue (launch extension to proceed)';
        document.getElementById('error').classList.remove('d-none');
        document.getElementById('success').classList.add('d-none');
      } else if (option() === 'new') {
        createRepo(token, repositoryName());
      } else {
        api.storage.local.get('codehub_username', data2 => {
          const username = data2.codehub_username;
          if (!username) {
            document.getElementById('error').textContent =
              'Improper Authorization error - Grant CodeHub access to your GitHub account to continue (launch extension to proceed)';
            document.getElementById('error').classList.remove('d-none');
            document.getElementById('success').classList.add('d-none');
          } else {
            linkRepo(token, `${username}/${repositoryName()}`, false);
          }
        });
      }
    });
  }
});

document.getElementById('unlink').addEventListener('click', () => {
  unlinkRepo();
  document.getElementById('unlink').classList.add('d-none');
  document.getElementById('success').textContent = 'Successfully unlinked your current git repo. Please create/link a new hook.';
});

api.storage.local.get('mode_type', data => {
  const mode = data.mode_type;

  if (mode && mode === 'commit') {
    api.storage.local.get('codehub_token', data2 => {
      const token = data2.codehub_token;
      if (token === null || token === undefined) {
        document.getElementById('error').textContent =
          'Authorization error - Grant LeetHub access to your GitHub account to continue (click LeetHub extension on the top right to proceed)';
        document.getElementById('error').classList.remove('d-none');
        document.getElementById('success').classList.add('d-none');
        document.getElementById('hook_mode').classList.remove('d-none');
        document.getElementById('commit_mode').classList.add('d-none');
      } else {
        api.storage.local.get('codehub_hook', repoName => {
          const hook = repoName.codehub_hook;
          if (!hook) {
            document.getElementById('error').textContent =
              'Improper Authorization error - Grant LeetHub access to your GitHub account to continue (click LeetHub extension on the top right to proceed)';
            document.getElementById('error').classList.remove('d-none');
            document.getElementById('success').classList.add('d-none');
            document.getElementById('hook_mode').classList.remove('d-none');
            document.getElementById('commit_mode').classList.add('d-none');
          } else {
            linkRepo(token, hook);
          }
        });
      }
    });

    document.getElementById('hook_mode').classList.add('d-none');
    document.getElementById('commit_mode').classList.remove('d-none');
  } else {
    document.getElementById('hook_mode').classList.remove('d-none');
    document.getElementById('commit_mode').classList.add('d-none');
  }
});
