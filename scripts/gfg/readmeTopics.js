import { CodeHubError } from "./utils.js";

const geeksForGeeksSectionStart = `<!---GeeksForGeeks Topics Start-->`;
const geeksForGeeksSectionHeader = `# GeeksForGeeks Topics`;
const geeksForGeeksSectionEnd = `<!---GeeksForGeeks Topics End-->`;

function appendProblemToReadme(topic, markdownFile, hook, problem) {
  const url = `https://github.com/${hook}/tree/master/geeksforgeeks/${problem}`;
  const topicHeader = `## ${topic}`;
  const topicTableHeader = `\n${topicHeader}\n|  |\n| ------- |\n`;
  const newRow = `| [${problem}](${url}) |`;

  // Check if the GeeksForGeeks Section exists, or add it
  let geeksForGeeksSectionStartIndex = markdownFile.indexOf(geeksForGeeksSectionStart);
  if (geeksForGeeksSectionStartIndex === -1) {
    markdownFile +=
      '\n' + [geeksForGeeksSectionStart, geeksForGeeksSectionHeader, geeksForGeeksSectionEnd].join('\n');
    geeksForGeeksSectionStartIndex = markdownFile.indexOf(geeksForGeeksSectionStart);
  }

  // Get GeeksForGeeks section and the Before & After sections
  const beforeSection = markdownFile.slice(0, markdownFile.indexOf(geeksForGeeksSectionStart));
  const afterSection = markdownFile.slice(
    markdownFile.indexOf(geeksForGeeksSectionEnd) + geeksForGeeksSectionEnd.length,
  );

  let geeksForGeeksSection = markdownFile.slice(
    markdownFile.indexOf(geeksForGeeksSectionStart) + geeksForGeeksSectionStart.length,
    markdownFile.indexOf(geeksForGeeksSectionEnd),
  );

  // Check if topic table exists, or add it
  let topicTableIndex = geeksForGeeksSection.indexOf(topicHeader);
  if (topicTableIndex === -1) {
    geeksForGeeksSection += topicTableHeader;
    topicTableIndex = geeksForGeeksSection.indexOf(topicHeader);
  }

  // Get the Topic table. If topic table was just added, then its end === GeeksForGeeks Section end
  const endTopicString = geeksForGeeksSection.slice(topicTableIndex).match(/\|\n[^|]/)?.[0];
  const endTopicIndex = (endTopicString != null) ? geeksForGeeksSection.indexOf(endTopicString, topicTableIndex + 1) : -1;
  let topicTable =
    endTopicIndex === -1
      ? geeksForGeeksSection.slice(topicTableIndex)
      : geeksForGeeksSection.slice(topicTableIndex, endTopicIndex + 1);
  topicTable = topicTable.trim();

  // Check if the problem exists in topic table, prevent duplicate add
  const problemIndex = topicTable.indexOf(problem);
  if (problemIndex !== -1) {
    return markdownFile;
  }

  // Append problem to the Topic
  topicTable = [topicTable, newRow, '\n'].join('\n');

  // Replace the old Topic table with the updated one in the markdown file
  geeksForGeeksSection =
    geeksForGeeksSection.slice(0, topicTableIndex) +
    topicTable +
    (endTopicIndex === -1 ? '' : geeksForGeeksSection.slice(endTopicIndex + 1));

  markdownFile = [
    beforeSection,
    geeksForGeeksSectionStart,
    geeksForGeeksSection,
    geeksForGeeksSectionEnd,
    afterSection,
  ].join('');

  return markdownFile;
}

// Sorts each Topic table alphabetically by problem name
function sortTopicsInReadme(markdownFile) {
  let beforeSection = markdownFile.slice(0, markdownFile.indexOf(geeksForGeeksSectionStart));
  const afterSection = markdownFile.slice(
    markdownFile.indexOf(geeksForGeeksSectionEnd) + geeksForGeeksSectionEnd.length,
  );

  // Matches any text between the start and end tags. Should never fail to match.
  const geeksForGeeksSection = markdownFile.match(
    new RegExp(`${geeksForGeeksSectionStart}([\\s\\S]*)${geeksForGeeksSectionEnd}`),
  )?.[1];
  if (geeksForGeeksSection == null) throw new CodeHubError('GeeksForGeeksTopicSectionNotFound');

  // Remove the header
  let topics = geeksForGeeksSection.trim().split('## ');
  topics.shift();

  // Get Array<sorted-topic>
  topics = topics.map(section => {
    let lines = section.trim().split('\n');

    // Get the problem topic
    const topic = lines.shift();

    // Check if topic exists elsewhere
    let topicHeaderIndex = markdownFile.indexOf(`## ${topic}`);
    let geeksForGeeksSectionStartIndex = markdownFile.indexOf(geeksForGeeksSectionStart);
    if (topicHeaderIndex < geeksForGeeksSectionStartIndex) {
      // matches the next '|\n' that doesn't precede a '|'. Typically this is '|\n#. Should always match if topic existed elsewhere.
      const endTopicString = markdownFile.slice(topicHeaderIndex).match(/\|\n[^|]/)?.[0];
      if (endTopicString == null) throw new CodeHubError('EndOfTopicNotFound');

      // Get the old problems for merge
      const endTopicIndex = markdownFile.indexOf(endTopicString, topicHeaderIndex + 1);
      const topicSection = markdownFile.slice(topicHeaderIndex, endTopicIndex + 1);
      const problemsToMerge = topicSection.trim().split('\n').slice(3);

      // Merge previously solved problems and removes duplicates
      lines = lines.concat(problemsToMerge).reduce((array, element) => {
        if (!array.includes(element)) {
          array.push(element);
        }
        return array;
      }, []);

      // Delete the old topic section after merging
      beforeSection =
        markdownFile.slice(0, topicHeaderIndex) +
        markdownFile.slice(endTopicIndex + 1, markdownFile.indexOf(geeksForGeeksSectionStart));
    }

    // Remove the header and header separator
    lines = lines.slice(2);

    // Sort alphabetically by problem name
    lines.sort((a, b) => {
      let nameA = a.match(/\[(.*?)\]/)[1];
      let nameB = b.match(/\[(.*?)\]/)[1];
      return nameA.localeCompare(nameB);
    });

    // Reconstruct the topic
    return ['## ' + topic].concat('|  |', '| ------- |', lines).join('\n');
  });

  // Reconstruct the file
  markdownFile =
    beforeSection +
    [geeksForGeeksSectionStart, geeksForGeeksSectionHeader, ...topics, geeksForGeeksSectionEnd].join('\n') +
    afterSection;

  return markdownFile;
}

export { appendProblemToReadme, sortTopicsInReadme };