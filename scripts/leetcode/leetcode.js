import { LeetCodeV1, LeetCodeV2 } from './versions.js';
import setupManualSubmitBtn from './submitBtn.js';
import {
  debounce,
  delay,
  DIFFICULTY,
  getBrowser,
  getDifficulty,
  isEmptyObject,
  CodeHubError,
  mergeStats,
} from './util.js';
import { appendProblemToReadme, sortTopicsInReadme } from './readmeTopics.js';

/* Commit messages */
const readmeMsg = 'Create README - CodeHub';
const updateReadmeMsg = 'Update README - Topic Tags';
const updateStatsMsg = 'Updated stats';
const discussionMsg = 'Prepend discussion post - CodeHub';
const createNotesMsg = 'Attach NOTES - CodeHub';
const defaultRepoReadme =
  'A collection of LeetCode questions to ace the coding interview! - Created using [CodeHub](https://github.com/)';
const readmeFilename = 'README.md';
const statsFilename = 'stats.json';

// problem types
const NORMAL_PROBLEM = 0;
const EXPLORE_SECTION_PROBLEM = 1;

const WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS = 500;

const api = getBrowser();

/**
 * Constructs a file path by appending the given filename to the problem directory.
 * If no filename is provided, it returns the problem name as the path.
 *
 * @param {string} problem - The base problem directory or the entire file path if no filename is provided.
 * @param {string} [filename] - Optional parameter for the filename to be appended to the problem directory.
 * @returns {string} - Returns a string representing the complete file path, either with or without the appended filename.
 */
const getPath = (problem, filename) => {
  if (filename) {
    return `leetcode/${problem}/${filename}`;
  }
  return `leetcode/${problem}`;
};

// https://web.archive.org/web/20190623091645/https://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
// In order to preserve mutation of the data, we have to encode it, which is usually done in base64.
// But btoa only accepts ASCII 7 bit chars (0-127) while Javascript uses 16-bit minimum chars (0-65535).
// EncodeURIComponent converts the Unicode Points UTF-8 bits to hex UTF-8.
// Unescape converts percent-encoded hex values into regular ASCII (optional; it shrinks string size).
// btoa converts ASCII to base64.
/** Decodes a base64 encoded string into UTF-8 format using URI encoding.*/
const decode = data => decodeURIComponent(escape(atob(data)));
/** Encodes a given string into base64 format.*/
const encode = data => btoa(unescape(encodeURIComponent(data)));

/**
 * Uploads content to a specified GitHub repository and updates local stats with the sha of the updated file.
 * @async
 * @param {string} token - The authentication token used to authorize the request.
 * @param {string} hook - The owner and repository name in the format 'owner/repo'.
 * @param {string} content - The content to be uploaded, typically a string encoded in base64.
 * @param {string} problem - The problem slug, which is a combination of problem ID and name, and acts as a folder.
 * @param {string} filename - The name of the file, typically the problem slug + file extension.
 * @param {string} sha - The SHA of the existing file.
 * @param {string} message - A commit message describing the change.
 * @param {string} [difficulty] - The difficulty level of the problem.
 *
 * @returns {Promise<string>} - A promise that resolves with the new SHA of the content after successful upload.
 *
 * @throws {CodeHubError} - Throws an error if the response is not OK (e.g., HTTP status code is not `200-299`).
 */
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
  //TODO: Think, should we be setting stats state here?
  const stats = await getAndInitializeStats(problem);
  stats.shas[problem][filename] = body.content.sha;
  api.storage.local.set({ stats });

  return body.content.sha;
};

// Returns stats object. If it didn't exist, initializes stats with default difficulty values and initializes the sha object for problem
const getAndInitializeStats = problem => {
  return api.storage.local.get('stats').then(({ stats }) => {
    if (stats == null || isEmptyObject(stats)) {
      stats = {};
      stats.shas = {};
      stats.solved = 0;
      stats.easy = 0;
      stats.medium = 0;
      stats.hard = 0;
    }

    if (stats.shas[problem] == null) {
      stats.shas[problem] = {};
    }

    return stats;
  });
};

/**
 * Increment the statistics for a given problem based on its difficulty.
 * @param {DIFFICULTY} difficulty - The difficulty level of the problem, which can be `easy`, `medium`, or `hard`.
 * @param {string} problem - The slug problem name, e.g. `0001-two-sum`
 * @returns {Promise<Object>} A promise that resolves to the updated statistics object.
 */
const incrementStats = (difficulty, problem) => {
  const diff = getDifficulty(difficulty);
  return api.storage.local.get('stats').then(({ stats }) => {
    stats.solved += 1;
    stats.easy += diff === DIFFICULTY.EASY ? 1 : 0;
    stats.medium += diff === DIFFICULTY.MEDIUM ? 1 : 0;
    stats.hard += diff === DIFFICULTY.HARD ? 1 : 0;
    stats.shas[problem].difficulty = diff.toLowerCase();
    api.storage.local.set({ stats });
    return stats;
  });
};

/**
 * Sets persistent stats and merges any cloud updates into local stats
 * @async
 * @param {Object} localStats - Local statistics about LeetCode problems.
 * @returns {Promise<void>} A promise that resolves to the sha of the newly updated `stats.json` file.
 *
 * @throws {Error} - If the upload operation fails for any reason other than 409 Conflict
 */
const setPersistentStats = async localStats => {
  let pStats = { leetcode: localStats };
  const pStatsEncoded = encode(JSON.stringify(pStats));
  const sha = localStats?.shas?.[readmeFilename]?.[''] || '';

  const { codehub_token: token, codehub_hook: hook } = await api.storage.local.get([
    'codehub_token',
    'codehub_hook',
  ]);

  try {
    return await upload(token, hook, pStatsEncoded, statsFilename, '',sha, updateStatsMsg);
  } catch (e) {
    if (e.message === '409') {
      // Stats were updated on GitHub since last submission
      const { content, sha } = await getGitHubFile(token, hook, statsFilename).then(res =>
        res.json()
      );
      pStats = JSON.parse(decode(content));
      const mergedStats = mergeStats(pStats.leetcode, localStats);
      const mergedStatsEncoded = encode(JSON.stringify({ leetcode: mergedStats }));

      // Update local stats with the changes from GitHub
      await api.storage.local.set({ stats: mergedStats });

      return await delay(
        () => upload(token, hook, mergedStatsEncoded, statsFilename, '', sha, updateStatsMsg),
        WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS
      );
    }
    throw e;
  }
};

const isCompleted = problemName => {
  return api.storage.local.get('stats').then(data => {
    if (data?.stats?.shas?.[problemName] == null) return false;

    for (let file of Object.keys(data?.stats?.shas?.[problemName])) {
      if (file.includes(problemName)) return true;
    }

    return false;
  });
};

/* Discussion posts prepended at top of README */
/* Future implementations may require appending to bottom of file */
const updateReadmeWithDiscussionPost = async (
  addition,
  directory,
  filename,
  commitMsg,
  shouldPreprendDiscussionPosts
) => {
  let responseSHA;
  const { codehub_token, codehub_hook } = await api.storage.local.get([
    'codehub_token',
    'codehub_hook',
  ]);

  return getGitHubFile(codehub_token, codehub_hook, directory, filename)
    .then(resp => resp.json())
    .then(data => {
      responseSHA = data.sha;
      return decode(data.content);
    })
    .then(existingContent =>
      shouldPreprendDiscussionPosts ? encode(addition + existingContent) : encode(existingContent)
    )
    .then(newContent =>
      upload(codehub_token, codehub_hook, newContent, directory, filename, responseSHA, commitMsg)
    );
};

/**
 * Wrapper func to upload code to a specific GitHub repository and handle 409 errors (conflict)
 * @async
 * @function uploadGitWith409Retry
 * @param {string} code - The code content that needs to be uploaded.
 * @param {string} problemName - The name of the problem or file where the code is related to.
 * @param {string} filename - The target filename in the repository where the code will be stored.
 * @param {string} commitMsg - The commit message that describes the changes being made.
 * @param {Object} [optionals] - Optional parameters for updating stats
 * @param {string} optionals.sha - The SHA value of the existing content to be updated (optional).
 * @param {DIFFICULTY} optionals.difficulty - The difficulty level of the problem (optional).
 *
 * @returns {Promise<string>} A promise that resolves with the new SHA of the content after successful upload.
 *
 * @throws {CodeHubError} If there's no token defined, the mode type is not `commit`, or if no repository hook is defined.
 */
async function uploadGitWith409Retry(code, problemName, filename, commitMsg, optionals) {
  let token;
  let hook;

  const storageData = await api.storage.local.get([
    'codehub_token',
    'mode_type',
    'codehub_hook',
    'stats',
  ]);

  token = storageData.codehub_token;
  if (!token) {
    throw new CodeHubError('LeethubTokenUndefined');
  }

  if (storageData.mode_type !== 'commit') {
    throw new CodeHubError('LeetHubNotAuthorizedByGit');
  }

  hook = storageData.codehub_hook;
  if (!hook) {
    throw new CodeHubError('NoRepoDefined');
  }

  /* Get SHA, if it exists */
  const sha = optionals?.sha
    ? optionals.sha
    : storageData.stats?.shas?.[problemName]?.[filename] !== undefined
    ? storageData.stats.shas[problemName][filename]
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

/** Returns GitHub data for the file specified by `${directory}/${filename}` path
 * @async
 * @function getGitHubFile
 * @param {string} token - The personal access token for authentication with GitHub.
 * @param {string} hook - The owner and repository name in the format "owner/repository".
 * @param {string} directory - The directory within the repository where the file is located.
 * @param {string} filename - The name of the file to be fetched.
 * @returns {Promise<Response>} A promise that resolves with the response from the GitHub API request.
 * @throws {Error} Throws an error if the response is not OK (e.g., HTTP status code is not 200-299).
 */
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

/* Discussion Link - When a user makes a new post, the link is prepended to the README for that problem.*/
document.addEventListener('click', event => {
  const element = event.target;
  const oldPath = window.location.pathname;

  /* Act on Post button click */
  /* Complex since "New" button shares many of the same properties as "Post button */
  if (
    element &&
    (element.classList.contains('icon__3Su4') ||
      element.parentElement?.classList.contains('icon__3Su4') ||
      element.parentElement?.classList.contains('btn-content-container__214G') ||
      element.parentElement?.classList.contains('header-right__2UzF'))
  ) {
    setTimeout(function () {
      /* Only post if post button was clicked and url changed */
      if (
        oldPath !== window.location.pathname &&
        oldPath === window.location.pathname.substring(0, oldPath.length) &&
        !Number.isNaN(window.location.pathname.charAt(oldPath.length))
      ) {
        const date = new Date();
        const currentDate = `${date.getDate()}/${date.getMonth()}/${date.getFullYear()} at ${date.getHours()}:${date.getMinutes()}`;
        const addition = `[Discussion Post (created on ${currentDate})](${window.location})  \n`;
        const problemName = window.location.pathname.split('/')[2]; // must be true.
        updateReadmeWithDiscussionPost(addition, problemName, readmeFilename, discussionMsg, true);
      }
    }, 1000);
  }
});

function createRepoReadme() {
  const content = encode(defaultRepoReadme);
  return uploadGitWith409Retry(content,readmeFilename,'',  readmeMsg);
}

async function updateReadmeTopicTagsWithProblem(topicTags, problemName) {
  if (topicTags == null) {
    console.log(new CodeHubError('TopicTagsNotFound'));
    return;
  }

  const { codehub_token, codehub_hook, stats } = await api.storage.local.get([
    'codehub_token',
    'codehub_hook',
    'stats',
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
    flag = true
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
   if(flag){
     readme = decode(readme);
   }
   console.log(readme)
  for (let topic of topicTags) {
    readme = appendProblemToReadme(topic.name, readme, codehub_hook, problemName);
  }
  readme = sortTopicsInReadme(readme);
    readme = encode(readme);

  return delay(
    () => uploadGitWith409Retry(readme,  readmeFilename,'' ,updateReadmeMsg, { sha: newSha }),
    WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS
  );
}

/** @param {LeetCodeV1 | LeetCodeV2} leetCode */
function loader(leetCode) {
  let iterations = 0;
  const intervalId = setInterval(async () => {
    try {
      const isSuccessfulSubmission = leetCode.getSuccessStateAndUpdate();
      if (!isSuccessfulSubmission) {
        iterations++;
        if (iterations > 9) {
          // poll for max 10 attempts (10 seconds)
          throw new CodeHubError('Could not find successful submission after 10 seconds.');
        }
        return;
      }
      leetCode.startSpinner();

      // If successful, stop polling
      clearInterval(intervalId);

      // For v2, query LeetCode API for submission results
      await leetCode.init();

      const probStats = leetCode.parseStats();
      if (!probStats) {
        throw new CodeHubError('SubmissionStatsNotFound');
      }

      const probStatement = leetCode.parseQuestion();
      if (!probStatement) {
        throw new CodeHubError('ProblemStatementNotFound');
      }

      const problemName = leetCode.getProblemNameSlug();
      const alreadyCompleted = await isCompleted(problemName);
      const language = leetCode.getLanguageExtension();
      if (!language) {
        throw new CodeHubError('LanguageNotFound');
      }
      const filename = problemName + language;

      /* Upload README */
      const uploadReadMe = await api.storage.local.get('stats').then(({ stats }) => {
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

      /* Upload Notes if any*/
      const notes = leetCode.getNotesIfAny();
      let uploadNotes;
      if (notes != undefined && notes.length > 0) {
        uploadNotes = uploadGitWith409Retry(encode(notes), problemName, 'NOTES.md', createNotesMsg);
      }

      /* Upload code to Git */
      const code = leetCode.findCode(probStats);
      const uploadCode = uploadGitWith409Retry(encode(code), problemName, filename, probStats);

      /* Group problem into its relevant topics */
      const updateRepoReadMe = updateReadmeTopicTagsWithProblem(
        leetCode.submissionData?.question?.topicTags,
        problemName
      );

      const newSHAs = await Promise.all([uploadReadMe, uploadNotes, uploadCode, updateRepoReadMe]);

      leetCode.markUploaded();

      if (!alreadyCompleted) {
        // Increments local and persistent stats
        incrementStats(leetCode.difficulty, problemName).then(setPersistentStats);
      }
    } catch (err) {
      leetCode.markUploadFailed();
      clearInterval(intervalId);

      if (!(err instanceof CodeHubError)) {
        console.error(err);
        return;
      }
    }
  }, 1000);
}

/**
 * Submit by Keyboard Shortcuts (only supported on LeetCode v2)
 * @param {Event} event
 * @returns
 */
function wasSubmittedByKeyboard(event) {
  const isEnterKey = event.key === 'Enter';
  const isMacOS = window.navigator.userAgent.includes('Mac');

  // Adapt to MacOS operating system
  return isEnterKey && ((isMacOS && event.metaKey) || (!isMacOS && event.ctrlKey));
}

/**
 * Get SubmissionID by listening for URL changes to `/submissions/(d+)` format
 * @returns {string} submissionId
 */
async function listenForSubmissionId() {
  const { submissionId } = await api.runtime.sendMessage({
    type: 'LEETCODE_SUBMISSION',
  });
  if (submissionId == null) {
    console.log(new CodeHubError('SubmissionIdNotFound'));
    return;
  }
  return submissionId;
}

/**
 * @param {Event} event
 * @param {LeetCodeV2} leetCode
 * @returns {void}
 */
async function v2SubmissionHandler(event, leetCode) {
  if (event.type !== 'click' && !wasSubmittedByKeyboard(event)) {
    return;
  }

  const authenticated =
    !isEmptyObject(await api.storage.local.get(['codehub_token'])) &&
    !isEmptyObject(await api.storage.local.get(['codehub_hook']));
  if (!authenticated) {
    throw new CodeHubError('UserNotAuthenticated');
  }

  // is click or is ctrl enter
  const submissionId = await listenForSubmissionId();
  leetCode.submissionId = submissionId;
  loader(leetCode);
  return true;
}

// Use MutationObserver to determine when the submit button elements are loaded
const submitBtnObserver = new MutationObserver(function (_mutations, observer) {
  const v1SubmitBtn = document.querySelector('[data-cy="submit-code-btn"]');
  const v2SubmitBtn = document.querySelector('[data-e2e-locator="console-submit-button"]');
  const textareaList = document.getElementsByTagName('textarea');
  const textarea =
    textareaList.length === 4
      ? textareaList[2]
      : textareaList.length === 2
      ? textareaList[0]
      : textareaList[1];

  if (v1SubmitBtn) {
    observer.disconnect();

    const leetCode = new LeetCodeV1();
    v1SubmitBtn.addEventListener('click', () => loader(leetCode));
    return;
  }

  if (v2SubmitBtn && textarea) {
    observer.disconnect();

    const leetCode = new LeetCodeV2();
    if (!!!v2SubmitBtn.onclick) {
      textarea.addEventListener('keydown', e => v2SubmissionHandler(e, leetCode));
      v2SubmitBtn.onclick = e => v2SubmissionHandler(e, leetCode);
    }
  }
});

submitBtnObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

/* Sync to local storage */
api.storage.local.get('isSync', data => {
  const keys = [
    'codehub_token',
    'codehub_username',
    'pipe_codehub',
    'stats',
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
      console.log('LeetHub Synced to local values');
    });
  } else {
    console.log('LeetHub Local storage already synced!');
  }
});

setupManualSubmitBtn(
  debounce(
    () => {
      const leetCode = new LeetCodeV2();
      // Manual submission event can only fire when we have submissionId. Simply retrieve it.
      const submissionId = window.location.href.match(/leetcode\.com\/.*\/submissions\/(\d+)/)[1];
      leetCode.submissionId = submissionId;
      loader(leetCode);
      return;
    },
    5000,
    true
  )
);

class LeetHubNetworkError extends CodeHubError {
  constructor(response) {
    super(response.statusText);
    this.status = response.status;
  }
}
