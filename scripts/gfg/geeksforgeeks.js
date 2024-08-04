import { GeeksForGeeksV1 } from './versions.js';
import {
  delay,

  isEmptyObject,
  CodeHubError,
  mergeStats,
} from './utils.js';
import { appendProblemToReadme, sortTopicsInReadme } from './readmeTopics.js';

const readmeMsg = 'Create README - CodeHub';
const updateReadmeMsg = 'Update README - Topic Tags';
const updateStatsMsg = 'Updated stats';
const createNotesMsg = 'Attach NOTES - CodeHub';
const defaultRepoReadme =
  'A collection of GeeksForGeeks questions to ace the coding interview! - Created using [CodeHub](https://github.com/)';
const readmeFilename = 'README.md';
const statsFilename = 'stats.json';

const WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS = 500;

const api = chrome;

const getPath = (problem, filename) => {
  if (filename) {
    return `geeksforgeeks/${problem}/${filename}`;
  }
  return `geeksforgeeks/${problem}`;
};

const decode = data => decodeURIComponent(escape(atob(data)));
const encode = data => btoa(unescape(encodeURIComponent(data)));

const upload = async (token, hook, content, problem, filename, sha, message) => {
  const path = getPath(problem, filename);
  const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

  let data = {
    message,
    content,
    sha,
  };

  let options = {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(data),
  };

  const res = await fetch(URL, options);
  if (!res.ok) {
    throw new CodeHubError(res.status, { cause: res });
  }
  console.log(`Successfully committed ${getPath(problem, filename)} to github`);

  const body = await res.json();
  const gfgstats = await initializeStats();

  if (!gfgstats.shas[problem]) {
    gfgstats.shas[problem] = {};
  }

  gfgstats.shas[problem][filename] = body.content.sha;
  api.storage.local.set({ gfgstats });

  return body.content.sha;
};

const initializeStats = () => {
  return api.storage.local.get('gfgstats').then(({ gfgstats }) => {
    if (!gfgstats) {
      const initialStats = {
        solved: 0,
        school: 0,
        basic: 0,
        easy: 0,
        medium: 0,
        hard: 0,
        shas: {}
      };
      return api.storage.local.set({ gfgstats: initialStats }).then(() => initialStats);
    }
    return gfgstats;
  });
};

const incrementStats = (difficulty, problem) => {
  return api.storage.local.get('gfgstats').then(({ gfgstats }) => {
    gfgstats.solved += 1;
    gfgstats[difficulty.toLowerCase()] += 1;
    gfgstats.shas[problem].difficulty = difficulty.toLowerCase();
    api.storage.local.set({ gfgstats });
    return gfgstats;
  });
};

const setPersistentStats = async localStats => {
  let pStats = { geeksforgeeks: localStats };
  const pStatsEncoded = encode(JSON.stringify(pStats));
  const sha = localStats?.shas?.[readmeFilename]?.[''] || '';

  const { codehub_token: token, codehub_hook: hook } = await api.storage.local.get([
    'codehub_token',
    'codehub_hook',
  ]);

  try {
    return await upload(token, hook, pStatsEncoded, statsFilename, '', sha, updateStatsMsg);
  } catch (e) {
    if (e.message === '409') {
      const { content, sha } = await getGitHubFile(token, hook, statsFilename).then(res =>
        res.json()
      );
      pStats = JSON.parse(decode(content));
      const mergedStats = mergeStats(pStats.geeksforgeeks, localStats);
      const mergedStatsEncoded = encode(JSON.stringify({ geeksforgeeks: mergedStats }));

      await api.storage.local.set({ gfgstats: mergedStats });

      return await delay(
        () => upload(token, hook, mergedStatsEncoded, statsFilename, '', sha, updateStatsMsg),
        WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS
      );
    }
    throw e;
  }
};

const isCompleted = problemName => {
  return api.storage.local.get('gfgstats').then(data => {
    if (data?.gfgstats?.shas?.[problemName] == null) return false;

    for (let file of Object.keys(data?.gfgstats?.shas?.[problemName])) {
      if (file.includes(problemName)) return true;
    }

    return false;
  });
};

async function uploadGitWith409Retry(code, problemName, filename, commitMsg, optionals) {
  let token;
  let hook;

  const storageData = await api.storage.local.get([
    'codehub_token',
    'mode_type',
    'codehub_hook',
    'gfgstats',
  ]);

  token = storageData.codehub_token;
  if (!token) {
    throw new CodeHubError('CodehubTokenUndefined');
  }

  if (storageData.mode_type !== 'commit') {
    throw new CodeHubError('CodeHubNotAuthorizedByGit');
  }

  hook = storageData.codehub_hook;
  if (!hook) {
    throw new CodeHubError('NoRepoDefined');
  }

  const sha = optionals?.sha
    ? optionals.sha
    : storageData.gfgstats?.shas?.[problemName]?.[filename] !== undefined
    ? storageData.gfgstats.shas[problemName][filename]
    : '';

  try {
    return await upload(
      token,
      hook,
      code,
      problemName,
      filename,
      sha,
      commitMsg,
      optionals?.difficulty
    );
  } catch (err) {
    if (err.message === '409') {
      const data = await getGitHubFile(token, hook, problemName, filename).then(res => res.json());
      return upload(
        token,
        hook,
        code,
        problemName,
        filename,
        data.sha,
        commitMsg,
        optionals?.difficulty
      );
    }
    throw err;
  }
}

async function getGitHubFile(token, hook, directory, filename) {
  const path = getPath(directory, filename);
  const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

  let options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

  const res = await fetch(URL, options);
  if (!res.ok) {
    throw new Error(res.status);
  }

  return res;
}

function createRepoReadme() {
  const content = encode(defaultRepoReadme);
  return uploadGitWith409Retry(content, readmeFilename, '', readmeMsg);
}

async function updateReadmeTopicTagsWithProblem(topicTags, problemName) {
  if (topicTags == null) {
    console.log(new CodeHubError('TopicTagsNotFound'));
    return;
  }

  const { codehub_token, codehub_hook, stats } = await api.storage.local.get([
    'codehub_token',
    'codehub_hook',
    'gfgstats',
  ]);

  let readme;
  let newSha;
  let flag = false;

  try {
    const { content, sha } = await getGitHubFile(
      codehub_token,
      codehub_hook,
      readmeFilename
    ).then(resp => resp.json());
    readme = content;
    flag = true;
    stats.shas[readmeFilename] = { '': sha };
    await api.storage.local.set({ stats });
  } catch (err) {
    if (err.message === '404') {
      console.log('README not found. Creating a new one...');
      newSha = await createRepoReadme();
      readme = defaultRepoReadme;
    } else {
      console.error('Error fetching README:', err);
      throw err;
    }
  }
  if (flag) {
    readme = decode(readme);
  }
  for (let topic of topicTags) {
    readme = appendProblemToReadme(topic.name, readme, codehub_hook, problemName);
  }
  readme = sortTopicsInReadme(readme);
  readme = encode(readme);

  return delay(
    () => uploadGitWith409Retry(readme, readmeFilename, '', updateReadmeMsg, { sha: newSha }),
    WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS
  );
}

function loader(geeksForGeeks) {
  let iterations = 0;
  const intervalId = setInterval(async () => {
    try {
      const isSuccessfulSubmission = geeksForGeeks.getSuccessStateAndUpdate();
      if (!isSuccessfulSubmission) {
        iterations++;
        if (iterations > 9) {
          throw new CodeHubError('Could not find successful submission after 10 seconds.');
        }
        return;
      }
      geeksForGeeks.startSpinner();

      clearInterval(intervalId);

      await geeksForGeeks.init();
      document.querySelector('.problems_header_menu__items__BUrou').click();

      const probStats = geeksForGeeks.parseStats();
      if (!probStats) {
        throw new CodeHubError('SubmissionStatsNotFound');
      }

      const probStatement = geeksForGeeks.parseQuestion();
      if (!probStatement) {
        throw new CodeHubError('ProblemStatementNotFound');
      }

      const problemName = geeksForGeeks.getProblemTitle();
      const alreadyCompleted = await isCompleted(problemName);
      const language = geeksForGeeks.getLanguageExtension();
      if (!language) {
        throw new CodeHubError('LanguageNotFound');
      }
      const filename = problemName + language;

      const uploadReadMe = await api.storage.local.get('gfgstats').then(({ stats }) => {
        const shaExists = stats?.shas?.[problemName]?.[readmeFilename] !== undefined;

        if (!shaExists) {
          return uploadGitWith409Retry(
            encode(probStatement),
            problemName,
            readmeFilename,
            readmeMsg
          );
        }
      });

      const code = await geeksForGeeks.findCode();
      const uploadCode = uploadGitWith409Retry(encode(code), problemName, filename, probStats);

      // const updateRepoReadMe = updateReadmeTopicTagsWithProblem(
      //   geeksForGeeks.getTopicTags(),
      //   problemName
      // );

      const newSHAs = await Promise.all([uploadReadMe, uploadCode]);

      geeksForGeeks.markUploaded();

      if (!alreadyCompleted) {
        incrementStats(geeksForGeeks.difficulty, problemName).then(setPersistentStats);
      }
    } catch (err) {
      geeksForGeeks.markUploadFailed();
      clearInterval(intervalId);

      if (!(err instanceof CodeHubError)) {
        console.error(err);
        return;
      }
    }
  }, 1000);
}

const submitBtnObserver = new MutationObserver(function (_mutations, observer) {
  const submitBtn = document.querySelector('[class^="ui button problems_submit_button"]');

  if (submitBtn) {
    observer.disconnect();

    const geeksForGeeks = new GeeksForGeeksV1();
    submitBtn.addEventListener('click', () => loader(geeksForGeeks));
  }
});

submitBtnObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

api.storage.local.get('isSync', data => {
  const keys = [
    'codehub_token',
    'codehub_username',
    'pipe_codehub',
    'gfgstats',
    'codehub_hook',
    'mode_type',
  ];
  if (!data || !data.isSync) {
    keys.forEach(key => {
      api.storage.sync.get(key, data => {
        api.storage.local.set({ [key]: data[key] });
      });
    });
    api.storage.local.set({ isSync: true }, () => {
      console.log('CodeHub Synced to local values');
    });
  } else {
    console.log('CodeHub Local storage already synced!');
  }
});

class CodeHubNetworkError extends CodeHubError {
  constructor(response) {
    super(response.statusText);
    this.status = response.status;
  }
}