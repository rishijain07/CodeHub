(function() {
  let code = '';
  const codeElement = document.querySelector('textarea.ace_text-input');
  if (codeElement) {
      code = codeElement.value;
  } else {
      // Fallback method if the textarea is not found
      const preElement = document.querySelector('pre.ace_editor');
      if (preElement) {
          code = preElement.innerText;
      }
  }

  if (code) {
      const solutionElement = document.createElement('div');
      solutionElement.id = 'extractedUserSolution';
      solutionElement.style.display = 'none';
      solutionElement.innerText = code;
      document.body.appendChild(solutionElement);
  }
})();