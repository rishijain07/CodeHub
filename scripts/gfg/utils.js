const codeLanguage = Object.freeze({
    C: '.c',
    'C++': '.cpp',
    'C#': '.cs',
    Java: '.java',
    Python: '.py',
    Python3: '.py',
    JavaScript: '.js',
    Javascript: '.js'
  });

  const DIFFICULTY = Object.freeze({
    BASIC : 'Basic',
    SCHOOL: 'School',
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
    UNKNOWN: 'Unknown',
  });

  class CodeHubError extends Error {
    constructor(message) {
      super(message);
      this.name = 'CodeHubErr';
    }
  }

  function convertToSlug(string) {
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;';
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------';
    const p = new RegExp(a.split('').join('|'), 'g');
  
    return string
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
      .replace(/&/g, '-and-') // Replace & with 'and'
      .replace(/[^\w\-]+/g, '') // Remove all non-word characters
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, ''); // Trim - from end of text
  }

  function getDifficulty(difficulty) {
    console.log(difficulty)
    difficulty = difficulty.replace(/^Difficulty:\s*/i, '');
    console.log(difficulty)
    difficulty &&= difficulty.toUpperCase().trim();
    console.log(difficulty)
    return DIFFICULTY[difficulty] ?? DIFFICULTY.UNKNOWN;
  }

  function isEmptyObject(obj) {
    for (const prop in obj) {
      if (Object.hasOwn(obj, prop)) {
        return false;
      }
    }
  
    return true;
  }

  function assert(truthy, msg) {
    if (!truthy) {
      throw new CodeHubError(msg);
    }
  }
  function debounce(func, wait, invokeBeforeTimeout) {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      const later = function () {
        timeout = null;
        if (!invokeBeforeTimeout) func.apply(context, args);
      };
      const callNow = invokeBeforeTimeout && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  function delay(func, wait, ...args) {
    return new Promise(resolve => setTimeout(() => resolve(func(...args)), wait));
  }

  function checkElem(elem) {
    return elem && elem.length > 0;
  }

  function isObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  }
  
  function mergeDeep(target, source) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  
  function mergeStats(obj1, obj2) {
    function countDifficulties(shas) {
      const difficulties = {school: 0, basic: 0,easy: 0, medium: 0, hard: 0, solved: 0 };
      for (const problem in shas) {
        if ('difficulty' in shas[problem]) {
          const difficulty = shas[problem].difficulty;
          if (difficulty in difficulties) {
            difficulties[difficulty]++;
          }
        }
      }
      for (let value of Object.values(difficulties)) {
        difficulties.solved += value;
      }
      return difficulties;
    }
  
    const merged = {};
    mergeDeep(merged, obj1);
    mergeDeep(merged, obj2);
  
    const shas = merged.shas || {};
    const difficulties = countDifficulties(shas);

    merged.school = difficulties.school;
    merged.basic = difficulties.basic;
    merged.easy = difficulties.easy;
    merged.medium = difficulties.medium;
    merged.hard = difficulties.hard;
    merged.solved = difficulties.solved;
  
    return merged;
  }

  function getBrowser() {
    if (typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined') {
      return chrome;
    } else if (typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined') {
      return browser;
    } else {
      throw new Error('BrowserNotSupported');
    }
  }
  //   GeeksForGeeksV1.prototype.init = async function () {};

// GeeksForGeeksV1.prototype.findCode = function () {
//   const code = document.getElementById('extractedUserSolution');
//   if (!code) {
//     throw new CodeHubError('SolutionCodeNotFound');
//   }
//   return code.innerText;
// };

  
export {
    codeLanguage,
    CodeHubError,
    mergeDeep,
    mergeStats,
    getDifficulty,
    isEmptyObject,
    isObject,
    assert,
    debounce,
    delay,
    checkElem,
    convertToSlug,
    getBrowser
}