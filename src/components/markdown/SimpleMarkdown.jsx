// Simple Markdown Component with Table Support
const SimpleMarkdown = ({ text, className = '' }) => {
  // Convert markdown to HTML-safe React elements with table support
  const renderMarkdown = (content) => {
    const lines = content.split('\n');
    const elements = [];
    let inList = false;
    let listItems = [];
    let tableHeaders = [];
    let tableRows = [];
    let inTable = false;

    const processInlineMarkdown = (text) => {
      const parts = [];
      let remaining = text;
      let key = 0;

      const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)|(_(.+?)_)/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }

        if (match[2]) {
          parts.push(<strong key={key++}>{match[2]}</strong>);
        } else if (match[4]) {
          parts.push(<em key={key++}>{match[4]}</em>);
        } else if (match[6]) {
          parts.push(<strong key={key++}>{match[6]}</strong>);
        } else if (match[8]) {
          parts.push(<em key={key++}>{match[8]}</em>);
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }

      return parts.length > 0 ? parts : [text];
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside my-2 space-y-1">
            {listItems.map((item, i) => <li key={i}>{processInlineMarkdown(item)}</li>)}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    const flushTable = () => {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        elements.push(
          <div key={elements.length} className="overflow-x-auto my-3">
            <table className="min-w-full text-sm border-collapse">
              {tableHeaders.length > 0 && (
                <thead>
                  <tr className="bg-slate-100">
                    {tableHeaders.map((cell, i) => (
                      <th key={i} className="border border-slate-300 px-3 py-2 text-left font-semibold whitespace-nowrap">{processInlineMarkdown(cell.trim())}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="border border-slate-300 px-3 py-2 whitespace-nowrap">{processInlineMarkdown(cell.trim())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeaders = [];
        tableRows = [];
        inTable = false;
      }
    };

    const isTableRow = (line) => line.includes('|') && line.trim().startsWith('|');
    const isTableSeparator = (line) => /^\|[\s\-:|]+\|$/.test(line.trim());
    const parseTableRow = (line) => line.split('|').slice(1, -1);

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Check for table
      if (isTableRow(line)) {
        if (inList) flushList();
        if (isTableSeparator(line)) {
          inTable = true;
          return;
        }
        const cells = parseTableRow(line);
        if (!inTable && tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        inTable = true;
        return;
      } else if (inTable) {
        flushTable();
      }

      // Bullet points
      if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true;
        listItems.push(trimmed.slice(2));
        return;
      }

      if (inList && trimmed !== '') {
        flushList();
      }

      if (trimmed === '') {
        if (inList) flushList();
        elements.push(<br key={elements.length} />);
        return;
      }

      if (trimmed === '---') {
        elements.push(<hr key={elements.length} className="my-3 border-gray-300" />);
        return;
      }

      elements.push(
        <p key={elements.length} className={idx > 0 ? 'mt-2' : ''}>
          {processInlineMarkdown(line)}
        </p>
      );
    });

    if (inList) flushList();
    flushTable();

    return elements;
  };

  return <div className={className}>{renderMarkdown(text)}</div>;
};

export default SimpleMarkdown;
