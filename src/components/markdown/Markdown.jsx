// Full Markdown Renderer Component
const Markdown = ({ children, className = '' }) => {
  if (!children) return null;

  // Sanitize href to prevent XSS via javascript:, data:, etc.
  const sanitizeHref = (url) => {
    try {
      const parsed = new URL(url, window.location.origin);
      return ['http:', 'https:'].includes(parsed.protocol) ? url : null;
    } catch {
      return null;
    }
  };

  const renderMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let listType = null;
    let key = 0;

    const flushList = () => {
      if (currentList.length > 0) {
        if (listType === 'ul') {
          elements.push(<ul key={key++} className="list-disc list-inside my-2 space-y-1">{currentList}</ul>);
        } else {
          elements.push(<ol key={key++} className="list-decimal list-inside my-2 space-y-1">{currentList}</ol>);
        }
        currentList = [];
        listType = null;
      }
    };

    const parseInline = (text) => {
      const parts = [];
      let remaining = text;
      let partKey = 0;

      while (remaining.length > 0) {
        // Bold: **text** or __text__
        let match = remaining.match(/^(\*\*|__)(.+?)\1/);
        if (match) {
          parts.push(<strong key={partKey++} className="font-semibold">{parseInline(match[2])}</strong>);
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Italic: *text* or _text_
        match = remaining.match(/^(\*|_)(.+?)\1/);
        if (match) {
          parts.push(<em key={partKey++} className="italic">{parseInline(match[2])}</em>);
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Inline code: `code`
        match = remaining.match(/^`([^`]+)`/);
        if (match) {
          parts.push(<code key={partKey++} className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{match[1]}</code>);
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Links: [text](url)
        match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
          const safeHref = sanitizeHref(match[2]);
          if (safeHref) {
            parts.push(<a key={partKey++} href={safeHref} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-700">{match[1]}</a>);
          } else {
            parts.push(<span key={partKey++} className="text-gray-500">{match[1]}</span>);
          }
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Plain text up to next special char
        match = remaining.match(/^[^*_`\[]+/);
        if (match) {
          parts.push(match[0]);
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Single special char that didn't match
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      }

      return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
    };

    // Helper to parse table cells from a row
    const parseTableRow = (line) => {
      return line
        .split('|')
        .map(cell => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || (arr[0] !== '' && idx === 0) || (arr[arr.length-1] !== '' && idx === arr.length - 1))
        .filter(cell => cell !== '');
    };

    // Check if a line is a table separator (|---|---|)
    const isTableSeparator = (line) => {
      return /^\|?[\s\-:|]+\|?$/.test(line) && line.includes('-');
    };

    // Check if a line looks like a table row
    const isTableRow = (line) => {
      return line.includes('|') && !isTableSeparator(line);
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Table detection: look for pattern of row, separator, rows
      if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        flushList();

        // Parse header
        const headerCells = parseTableRow(line);

        // Skip separator
        i += 2;

        // Parse body rows
        const bodyRows = [];
        while (i < lines.length && isTableRow(lines[i])) {
          bodyRows.push(parseTableRow(lines[i]));
          i++;
        }

        // Render table
        elements.push(
          <div key={key++} className="overflow-x-auto my-2 -mx-4 w-[calc(100%+2rem)]" style={{ minWidth: 'max-content', maxWidth: 'calc(100vw - 4rem)' }}>
            <table className="w-full text-sm border-collapse table-auto">
              <thead>
                <tr className="bg-gray-100">
                  {headerCells.map((cell, idx) => (
                    <th key={idx} className="border border-gray-300 px-3 py-1.5 text-left font-semibold text-gray-700">
                      {parseInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="border border-gray-300 px-3 py-1.5 text-gray-600">
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        flushList();
        const level = headerMatch[1].length;
        const content = parseInline(headerMatch[2]);
        const headerClasses = {
          1: 'text-lg font-bold mt-3 mb-2',
          2: 'text-base font-bold mt-3 mb-1.5',
          3: 'text-sm font-semibold mt-2 mb-1',
          4: 'text-sm font-semibold mt-2 mb-1',
          5: 'text-sm font-medium mt-1 mb-1',
          6: 'text-sm font-medium mt-1 mb-1'
        };
        const Tag = `h${level}`;
        elements.push(<Tag key={key++} className={headerClasses[level]}>{content}</Tag>);
        i++;
        continue;
      }

      // Unordered list
      const ulMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
      if (ulMatch) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        currentList.push(<li key={key++}>{parseInline(ulMatch[1])}</li>);
        i++;
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
      if (olMatch) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        currentList.push(<li key={key++}>{parseInline(olMatch[1])}</li>);
        i++;
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        flushList();
        i++;
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(<p key={key++} className="my-1">{parseInline(line)}</p>);
      i++;
    }

    flushList();
    return elements;
  };

  return <div className={className}>{renderMarkdown(children)}</div>;
};

export default Markdown;
