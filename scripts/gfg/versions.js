import { CodeHubError, convertToSlug, getDifficulty} from "./utils.js";

function GeeksForGeeksV1() {
    this.difficulty;
    this.progressSpinnerElementId = 'codehub_progress_elem';
    this.progressSpinnerElementClass = 'codehub_progress';
    this.injectSpinnerStyle();
  }

  GeeksForGeeksV1.prototype.init = async function () {
    // This method could be used for any initialization if needed
  };

  GeeksForGeeksV1.prototype.findCode = async function () {
    return new Promise((resolve, reject) => {
      // First, try to find the code directly in the page
      const codeElement = document.querySelector('textarea.ace_text-input');
      if (codeElement) {
        resolve(codeElement.value);
        return;
      }
  
      // If direct access fails, try using the message passing system
      chrome.runtime.sendMessage({ type: 'getUserSolution' }, () => {
        console.log("getUserSolution - Message Sent.");
        setTimeout(() => {
          const solutionElement = document.getElementById('extractedUserSolution');
          if (solutionElement) {
            const solution = solutionElement.innerText;
            if (solution !== '') {
              resolve(solution);
            } else {
              reject(new Error('Solution is empty'));
            }
          } else {
            reject(new Error('Solution element not found'));
          }
          
          // Clean up the injected element
          chrome.runtime.sendMessage({ type: 'deleteNode' }, () => {
            console.log("deleteNode - Message Sent.");
          });
        }, 1000);
      });
    });
  };


  GeeksForGeeksV1.prototype.getSuccessStateAndUpdate = function () {
    const submissionResult = document.querySelectorAll('[class^="problems_content"]')[0];
    if (submissionResult && submissionResult.innerText.includes('Problem Solved Successfully')) {
      submissionResult.classList.add('marked_as_success');
      return true;
    }
    return false;
  };

  GeeksForGeeksV1.prototype.parseStats = function () {
    // GeeksForGeeks doesn't provide detailed stats, so we'll return a simple object
    return 'Solution submitted successfully';
  };
  GeeksForGeeksV1.prototype.getProblemTitle = function () {
    const titleElement = document.querySelector('[class^="problems_header_content__title"] > h3');
    if (!titleElement) {
      throw new CodeHubError('ProblemTitleNotFound');
    }
    console.log(convertToSlug(titleElement.innerText));
    return convertToSlug( titleElement.innerText);
  };

  GeeksForGeeksV1.prototype.getSuccessStateAndUpdate = function () {
    const submissionResult = document.querySelectorAll('[class^="problems_content"]')[0];
    if (submissionResult && submissionResult.innerText.includes('Problem Solved Successfully')) {
      submissionResult.classList.add('marked_as_success');
      return true;
    }
    return false;
  };

  GeeksForGeeksV1.prototype.parseQuestion = function () {
    const titleElement = document.querySelector('[class^="problems_header_content__title"] > h3');
    const difficultyElement = document.querySelectorAll('[class^="problems_header_description"]')[0].children[0];
    const contentElement = document.querySelector('[class^="problems_problem_content"]');
    
    if (!titleElement || !difficultyElement || !contentElement) {
      throw new CodeHubError('QuestionElementsNotFound');
    }
  
    const title = titleElement.innerText;
    this.difficulty = getDifficulty(difficultyElement.innerText);
    const content = contentElement.outerHTML;
    
    const questionUrl = window.location.href;
    const markdown = `<h2><a href="${questionUrl}">${title}</a></h2><h3>${difficultyElement.innerText}</h3><hr>${content}`;
    console.log(markdown)
    
    return this.addTags(markdown);
  };
  
  GeeksForGeeksV1.prototype.addTags = function (problemStatement) {
    let tagHeading = document.querySelectorAll('.problems_tag_container__kWANg');
  let tagContent = document.querySelectorAll(".content");

  for (let i = 0; i < tagHeading.length; i++) {
    if(tagHeading[i].innerText === 'Company Tags'){
      tagContent[i].classList.add("active");
      problemStatement = problemStatement.concat("<p><span style=font-size:18px><strong>Company Tags : </strong><br>");
      let numOfTags = tagContent[i].childNodes[0].children.length;
      for (let j = 0; j < numOfTags; j++) {
        if (tagContent[i].childNodes[0].children[j].innerText !== null) {
          const company = tagContent[i].childNodes[0].children[j].innerText;
          problemStatement = problemStatement.concat("<code>" + company + "</code>&nbsp;");  
        }
      }
      tagContent[i].classList.remove("active");
    }
    else if(tagHeading[i].innerText === 'Topic Tags'){
      tagContent[i].classList.add("active");
      problemStatement = problemStatement.concat("<br><p><span style=font-size:18px><strong>Topic Tags : </strong><br>");
      let numOfTags = tagContent[i].childNodes[0].children.length;
      for (let j = 0; j < numOfTags; j++) {
        if (tagContent[i].childNodes[0].children[j].innerText !== null) {
          const company = tagContent[i].childNodes[0].children[j].innerText;
          problemStatement = problemStatement.concat("<code>" + company + "</code>&nbsp;");  
        }
      }
      tagContent[i].classList.remove("active");
    }
    

  }
  console.log(problemStatement);
  return problemStatement;
  };

  GeeksForGeeksV1.prototype.getLanguageExtension = function () {
    const languageElement = document.getElementsByClassName('divider text')[0];
    if (!languageElement) {
      throw new CodeHubError('LanguageNotFound');
    }
    const lang = languageElement.innerText.split('(')[0].trim();
    const extensions = {
      C: '.c',
      'C++': '.cpp',
      'C#': '.cs',
      Java: '.java',
      Python: '.py',
      Python3: '.py',
      JavaScript: '.js',
      Javascript: '.js'
    };
    return extensions[lang] || '.txt';
  };
  

  GeeksForGeeksV1.prototype.startSpinner = function () {
    let elem = document.getElementById('codehub_progress_anchor_element');
    if (!elem) {
      elem = document.createElement('span');
      elem.id = 'codehub_progress_anchor_element';
      elem.style = 'margin-right: 20px;padding-top: 2px;';
    }
    elem.innerHTML = `<div id="${this.progressSpinnerElementId}" class="${this.progressSpinnerElementClass}"></div>`;
    this.insertToAnchorElement(elem);
  };

  GeeksForGeeksV1.prototype.injectSpinnerStyle = function () {
    const style = document.createElement('style');
    style.textContent = `.${this.progressSpinnerElementClass} {pointer-events: none;width: 2.0em;height: 2.0em;border: 0.4em solid transparent;border-color: #eee;border-top-color: #3E67EC;border-radius: 50%;animation: loadingspin 1s linear infinite;} @keyframes loadingspin { 100% { transform: rotate(360deg) }}`;
    document.head.append(style);
  };
  
  GeeksForGeeksV1.prototype.insertToAnchorElement = function (elem) {
    const submitButton = document.querySelector('[class^="ui button problems_submit_button"]');
    if (submitButton) {
      submitButton.parentNode.insertBefore(elem, submitButton);
    }
  };
  
  GeeksForGeeksV1.prototype.markUploaded = function () {
    let elem = document.getElementById(this.progressSpinnerElementId);
    if (elem) {
      elem.className = '';
      elem.style = 'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid #78b13f;border-right:7px solid #78b13f;';
    }
  };
  
  GeeksForGeeksV1.prototype.markUploadFailed = function () {
    let elem = document.getElementById(this.progressSpinnerElementId);
    if (elem) {
      elem.className = '';
      elem.style = 'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid red;border-right:7px solid red;';
    }
  };

export {GeeksForGeeksV1};