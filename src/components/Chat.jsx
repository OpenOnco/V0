/**
 * OpenOnco Unified Chat Component
 * 
 * Based on patient chat (most feature-rich), parameterized for all personas.
 * Features: mode toggle, resizable, print, model selector, suggestions
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getSuggestedQuestions, getWelcomeMessage } from '../chatPrompts';
import { track } from '@vercel/analytics';

// Chat model options - matches App.jsx
const CHAT_MODELS = [
  { id: 'claude-haiku-4-5-20251001', name: 'More speed', description: 'Fast responses' },
  { id: 'claude-sonnet-4-5-20250929', name: 'More thinking', description: 'Deeper analysis' },
];

// Simple Markdown renderer with table support and test ID linking
const SimpleMarkdown = ({ text, className = '', onTestClick }) => {
  const renderMarkdown = (content) => {
    const lines = content.split('\n');
    const elements = [];
    let listItems = [];
    let listType = null;
    let tableRows = [];
    let tableHeaders = [];
    let inTable = false;
    
    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === 'ol') {
          elements.push(<ol key={`list-${elements.length}`} className="list-decimal list-inside my-2 space-y-1">{listItems}</ol>);
        } else {
          elements.push(<ul key={`list-${elements.length}`} className="list-disc list-inside my-2 space-y-1">{listItems}</ul>);
        }
        listItems = [];
        listType = null;
      }
    };

    const flushTable = () => {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} className="overflow-x-auto my-3">
            <table className="min-w-full text-sm border-collapse">
              {tableHeaders.length > 0 && (
                <thead>
                  <tr className="bg-slate-100">
                    {tableHeaders.map((cell, i) => (
                      <th key={i} className="border border-slate-300 px-3 py-2 text-left font-semibold whitespace-nowrap">{formatInline(cell.trim(), `th-${i}`)}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="border border-slate-300 px-3 py-2 whitespace-nowrap">{formatInline(cell.trim(), `td-${rowIdx}-${cellIdx}`)}</td>
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
    
    const formatInline = (text, keyPrefix = '') => {
      const parts = [];
      let remaining = text;
      let partIndex = 0;
      
      while (remaining) {
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
        const testIdMatch = remaining.match(/\[\[([a-z]+-\d+)\]\]/);
        
        // Find the earliest match
        let firstMatch = null;
        let matchType = null;
        let minIndex = Infinity;
        
        if (boldMatch && boldMatch.index < minIndex) {
          minIndex = boldMatch.index;
          firstMatch = boldMatch;
          matchType = 'bold';
        }
        if (linkMatch && linkMatch.index < minIndex) {
          minIndex = linkMatch.index;
          firstMatch = linkMatch;
          matchType = 'link';
        }
        if (testIdMatch && testIdMatch.index < minIndex) {
          minIndex = testIdMatch.index;
          firstMatch = testIdMatch;
          matchType = 'testId';
        }
        
        if (!firstMatch) {
          if (remaining) parts.push(<span key={`${keyPrefix}-${partIndex++}`}>{remaining}</span>);
          break;
        }
        
        if (firstMatch.index > 0) {
          parts.push(<span key={`${keyPrefix}-${partIndex++}`}>{remaining.slice(0, firstMatch.index)}</span>);
        }
        
        if (matchType === 'bold') {
          parts.push(<strong key={`${keyPrefix}-${partIndex++}`} className="font-semibold">{firstMatch[1]}</strong>);
        } else if (matchType === 'link') {
          parts.push(
            <a key={`${keyPrefix}-${partIndex++}`} href={firstMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
              {firstMatch[1]}
            </a>
          );
        } else if (matchType === 'testId') {
          const testId = firstMatch[1];
          if (onTestClick) {
            parts.push(
              <button
                key={`${keyPrefix}-${partIndex++}`}
                onClick={() => onTestClick([testId])}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                title="View test details"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            );
          } else {
            // No click handler, just remove the brackets
            parts.push(<span key={`${keyPrefix}-${partIndex++}`}></span>);
          }
        }
        
        remaining = remaining.slice(firstMatch.index + firstMatch[0].length);
      }
      
      return parts.length > 0 ? parts : text;
    };

    // Check if line is a table row (starts and ends with |, or just has |)
    const isTableRow = (line) => line.includes('|') && line.trim().startsWith('|');
    const isTableSeparator = (line) => /^\|[\s\-:|]+\|$/.test(line.trim());
    const parseTableRow = (line) => {
      return line.split('|').slice(1, -1); // Remove empty first and last from | split
    };
    
    lines.forEach((line, idx) => {
      // Check for table
      if (isTableRow(line)) {
        flushList();
        if (isTableSeparator(line)) {
          // This is the separator row, skip it but mark that we have headers
          inTable = true;
          return;
        }
        const cells = parseTableRow(line);
        if (!inTable && tableHeaders.length === 0) {
          // First row is headers
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        inTable = true;
        return;
      } else if (inTable) {
        flushTable();
      }

      const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
      const ulMatch = line.match(/^[-*]\s+(.+)$/);
      
      if (olMatch) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(<li key={`li-${idx}`}>{formatInline(olMatch[2], `li-${idx}`)}</li>);
      } else if (ulMatch) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(<li key={`li-${idx}`}>{formatInline(ulMatch[1], `li-${idx}`)}</li>);
      } else {
        flushList();
        // Check for headers
        const h1Match = line.match(/^#\s+(.+)$/);
        const h2Match = line.match(/^##\s+(.+)$/);
        const h3Match = line.match(/^###\s+(.+)$/);
        
        if (h3Match) {
          elements.push(<h4 key={`h3-${idx}`} className="text-sm font-semibold mt-3 mb-1">{formatInline(h3Match[1], `h3-${idx}`)}</h4>);
        } else if (h2Match) {
          elements.push(<h3 key={`h2-${idx}`} className="text-base font-semibold mt-4 mb-2">{formatInline(h2Match[1], `h2-${idx}`)}</h3>);
        } else if (h1Match) {
          elements.push(<h2 key={`h1-${idx}`} className="text-lg font-bold mt-4 mb-2">{formatInline(h1Match[1], `h1-${idx}`)}</h2>);
        } else if (line.trim() === '' || line.trim() === '---') {
          elements.push(<br key={`br-${idx}`} />);
        } else {
          elements.push(<p key={`p-${idx}`} className="my-1">{formatInline(line, `p-${idx}`)}</p>);
        }
      }
    });
    
    flushList();
    flushTable();
    return elements;
  };
  
  return <div className={`prose prose-sm max-w-none ${className}`}>{renderMarkdown(text)}</div>;
};

/**
 * Unified Chat Component
 * 
 * @param {string} persona - 'patient' | 'medical' | 'rnd'
 * @param {Object} testData - Test data for system prompt
 * @param {string} variant - 'full' (patient-style) | 'sidebar' (compact for R&D/Medical)
 * @param {boolean} showModeToggle - Show Learn/Find toggle (patient only)
 * @param {boolean} resizable - Allow height resize
 * @param {boolean} showTitle - Show header title
 * @param {number} initialHeight - Initial height in pixels
 * @param {string} className - Additional CSS classes
 * @param {Object} patientContext - { cancerType, journeyStage, journeyCode, chatMode } from intake flow
 * @param {Function} onModeChange - Callback when mode changes (for parent to handle)
 * @param {Function} onViewTests - Callback when user clicks test links, receives array of test IDs
 */
const Chat = ({
  persona = 'patient',
  testData = {},
  variant = 'full',
  showModeToggle = false,
  resizable = true,
  showTitle = true,
  initialHeight = 350,
  className = '',
  patientContext = null,
  onViewTests = null
}) => {
  // Initialize chatMode from patientContext if available
  const [chatMode, setChatMode] = useState(() => patientContext?.chatMode || 'learn');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);
  const [chatHeight, setChatHeight] = useState(initialHeight);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const scrollPositionBeforeSubmit = useRef(null);

  // Sync chatMode when patientContext.chatMode changes (from parent toggle)
  useEffect(() => {
    if (patientContext?.chatMode && patientContext.chatMode !== chatMode) {
      setChatMode(patientContext.chatMode);
      setMessages([]); // Reset chat on mode change
    }
  }, [patientContext?.chatMode]);

  // Theme configuration per persona
  const theme = useMemo(() => {
    if (persona === 'patient') {
      return {
        container: 'bg-gradient-to-br from-[#1a5276] to-[#2874a6] border-[#1a5276]',
        header: 'text-white',
        messageArea: 'bg-white/95',
        userBubble: 'bg-[#2874a6] text-white',
        assistantBubble: 'bg-gray-100 border border-gray-200 text-gray-700',
        loadingDot: 'bg-[#2874a6]',
        suggestionBtn: 'bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700',
        input: 'bg-white border-0 focus:ring-white/50',
        submitBtn: 'bg-white text-[#1a5276] hover:bg-blue-50',
        resizeHandle: 'bg-white/50 group-hover:bg-white/70',
        spinnerColor: 'text-white',
        modelSelect: 'bg-white/90 border-white/50'
      };
    }
    // R&D and Medical - matches 2x2 navigator styling
    return {
      container: 'bg-white border-slate-200',
      header: '',  // no special header background
      messageArea: 'bg-white',
      userBubble: 'bg-emerald-100 border border-emerald-400 text-emerald-900',
      assistantBubble: 'bg-slate-50 border border-slate-200 text-slate-700',
      loadingDot: 'bg-emerald-500',
      suggestionBtn: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700',
      input: 'border-slate-200 focus:ring-emerald-500',
      submitBtn: 'bg-emerald-600 text-white hover:bg-emerald-700',
      resizeHandle: 'bg-slate-300 group-hover:bg-slate-400',
      spinnerColor: 'text-emerald-600',
      modelSelect: 'bg-white border-slate-200 text-slate-600'
    };
  }, [persona]);

  // Get suggestions based on persona, mode, and patient context
  const suggestions = useMemo(() => {
    // For patient with context, provide personalized suggestions
    if (persona === 'patient' && patientContext?.cancerType && patientContext?.journeyCode) {
      const cancer = patientContext.cancerType;
      const journey = patientContext.journeyCode;
      
      if (chatMode === 'learn') {
        // Learn mode - educational questions tailored to cancer type and journey
        const journeySuggestions = {
          tds: [
            `What genomic tests are available for ${cancer}?`,
            `How do liquid biopsy tests help choose ${cancer} treatment?`,
            `What's the difference between tissue and blood-based testing?`,
            `Which treatment selection tests have the best insurance coverage?`
          ],
          trm: [
            `How do blood tests track ${cancer} treatment response?`,
            `How often should I get tested during treatment?`,
            `What does it mean if ctDNA levels go up or down?`,
            `Which monitoring tests work best for ${cancer}?`
          ],
          mrd: [
            `What MRD tests are available for ${cancer}?`,
            `How early can MRD tests detect ${cancer} recurrence?`,
            `What's the difference between Signatera and Guardant Reveal?`,
            `How often should I get MRD testing after treatment?`,
            `Which MRD tests have Medicare coverage for ${cancer}?`
          ]
        };
        return journeySuggestions[journey] || journeySuggestions.mrd;
      }
      // Find mode doesn't show suggestions - it's a guided flow
      return [];
    }
    return getSuggestedQuestions(persona);
  }, [persona, chatMode, patientContext]);

  // Welcome message based on persona, mode, and context
  const welcomeMessage = useMemo(() => {
    if (persona === 'patient') {
      // If we have patient context from intake flow, use personalized message
      if (patientContext?.cancerType && patientContext?.journeyStage) {
        if (chatMode === 'learn') {
          // Learn mode - educational focus
          const journeyMessages = {
            tds: `I can help you understand tests that guide treatment decisions for ${patientContext.cancerType}.`,
            trm: `I can help you understand tests that monitor how well your ${patientContext.cancerType} treatment is working.`,
            mrd: `I can help you understand tests that watch for ${patientContext.cancerType} returning after treatment.`
          };
          const journeyMsg = journeyMessages[patientContext.journeyCode] || `I can help you learn about tests for ${patientContext.cancerType}.`;
          return `Hi! 👋 Based on what you've told me, you're looking at tests for **${patientContext.cancerType}** related to **${patientContext.journeyStage}**.\n\n${journeyMsg}\n\n**What questions do you have?**`;
        } else {
          // Find mode - guided questionnaire to narrow down tests
          const journeyLabels = {
            tds: 'Choosing treatment',
            trm: 'Tracking treatment response',
            mrd: 'Monitoring after treatment'
          };
          const journeyLabel = journeyLabels[patientContext.journeyCode] || patientContext.journeyStage;
          
          // Journey-specific first question
          const firstQuestion = {
            mrd: 'Do you know if tumor tissue was saved from your surgery or biopsy?',
            trm: 'What type of treatment are you currently on?',
            tds: 'Have you already had genomic profiling done on your tumor?'
          };
          const question1 = firstQuestion[patientContext.journeyCode] || firstQuestion.mrd;
          
          // Journey-specific progress items
          const progressItems = {
            mrd: '○ Tissue availability\n○ Insurance',
            trm: '○ Current treatment\n○ Insurance',
            tds: '○ Prior genomic testing\n○ Insurance'
          };
          const progress = progressItems[patientContext.journeyCode] || progressItems.mrd;
          
          return `**Let's find the right tests for you** 🎯

Just 2 quick questions to narrow down the best options.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Your Progress**

✓ Cancer type: ${patientContext.cancerType}
✓ Where you are: ${journeyLabel}
${progress}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Question 1 of 2:** ${question1}`;
        }
      }
      // Fallback if no context
      if (chatMode === 'learn') {
        return "Hi! 👋 I'm here to help you understand cancer blood tests (also called liquid biopsy).";
      }
      return "Let's find tests that might fit your situation. 🎯\n\nI'll ask you a few questions about:\n1. Your clinical situation — to identify tests that might be a fit\n2. Insurance & access — to suggest the most accessible options\n3. Your doctor relationship — to help you prepare the conversation\n\n**Let's start:** What type of cancer are you dealing with, or are you being evaluated for?";
    }
    return getWelcomeMessage(persona);
  }, [persona, chatMode, patientContext]);

  // Scroll to show user's question at top after response arrives
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0 && !isLoading && scrollPositionBeforeSubmit.current !== null) {
      requestAnimationFrame(() => {
        // Find the last user message element and scroll container so it's at top
        const userMessages = chatContainerRef.current.querySelectorAll('[data-message-role="user"]');
        if (userMessages.length > 0) {
          const lastUserMessage = userMessages[userMessages.length - 1];
          // Get position relative to scroll container
          const containerRect = chatContainerRef.current.getBoundingClientRect();
          const messageRect = lastUserMessage.getBoundingClientRect();
          const scrollOffset = messageRect.top - containerRect.top + chatContainerRef.current.scrollTop;
          // Scroll so user message is at top with small padding
          chatContainerRef.current.scrollTop = Math.max(0, scrollOffset - 8);
        }
        scrollPositionBeforeSubmit.current = null;
      });
    }
  }, [messages, isLoading]);

  const handleSubmit = async (suggestedQuestion = null) => {
    const question = suggestedQuestion || input.trim();
    if (!question || isLoading) return;

    // Save scroll position before adding the question
    if (chatContainerRef.current) {
      scrollPositionBeforeSubmit.current = chatContainerRef.current.scrollTop;
    }

    setInput('');

    track('chat_message_sent', {
      persona,
      model: selectedModel,
      message_length: question.length,
      is_suggested: !!suggestedQuestion,
      chat_mode: chatMode
    });

    const newUserMessage = { role: 'user', content: question };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Limit history to last 6 messages to reduce token usage
      const recentMessages = updatedMessages.slice(-6);
      
      // For patient chat, prepend the welcome message so Claude knows what Q1 was
      let messagesForApi = recentMessages;
      if (persona === 'patient' && chatMode === 'find' && patientContext?.cancerType) {
        const welcomeAsAssistant = { role: 'assistant', content: welcomeMessage };
        messagesForApi = [welcomeAsAssistant, ...recentMessages];
      }
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'all',
          persona: persona,
          testData: JSON.stringify(testData),
          messages: messagesForApi,
          model: selectedModel,
          patientChatMode: persona === 'patient' ? chatMode : null,
          patientContext: persona === 'patient' ? patientContext : null
        })
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();
      
      if (data?.content?.[0]?.text) {
        setMessages([...updatedMessages, { role: 'assistant', content: data.content[0].text }]);
      } else {
        setMessages([...updatedMessages, { role: 'assistant', content: "I received an unexpected response. Please try again." }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: "I'm having trouble connecting. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    track('chat_cleared', { persona, chat_mode: chatMode });
  };

  const printChat = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>OpenOnco Consultation Summary</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; line-height: 1.6; }
            h1 { color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 10px; }
            .message { margin: 20px 0; padding: 15px; border-radius: 10px; }
            .user { background: #e8f4fc; margin-left: 20%; }
            .assistant { background: #f5f5f5; margin-right: 20%; }
            .label { font-weight: bold; color: #1a5276; margin-bottom: 5px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>🧬 OpenOnco Conversation Summary</h1>
          <p style="color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
          ${messages.map(m => `
            <div class="message ${m.role}">
              <div class="label">${m.role === 'user' ? '👤 You' : '🤖 OpenOnco'}:</div>
              <div>${m.content.replace(/\n/g, '<br>')}</div>
            </div>
          `).join('')}
          <div class="footer">
            <p>This information is for educational purposes only. Always discuss testing options with your healthcare provider.</p>
            <p>Learn more at <strong>www.openonco.org</strong></p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Resize handlers
  const handleResizeStart = (startY, isTouchEvent = false) => {
    const startHeight = chatHeight;
    
    const handleMove = (moveEvent) => {
      const currentY = isTouchEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const delta = currentY - startY;
      const newHeight = Math.min(600, Math.max(200, startHeight + delta));
      setChatHeight(newHeight);
    };
    
    const handleEnd = () => {
      document.removeEventListener(isTouchEvent ? 'touchmove' : 'mousemove', handleMove);
      document.removeEventListener(isTouchEvent ? 'touchend' : 'mouseup', handleEnd);
    };
    
    document.addEventListener(isTouchEvent ? 'touchmove' : 'mousemove', handleMove, isTouchEvent ? { passive: false } : undefined);
    document.addEventListener(isTouchEvent ? 'touchend' : 'mouseup', handleEnd);
  };

  const isCompact = variant === 'sidebar';
  const isPatient = persona === 'patient';
  const hasPatientContext = isPatient && patientContext?.cancerType;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden flex flex-col ${theme.container} ${isCompact ? 'p-4' : 'p-6'} ${className}`}>
      {/* Header - matches navigator styling for sidebar */}
      {isCompact ? (
        <div className="mb-3 relative">
          <h3 className="text-lg font-bold text-slate-800 text-center">Chat with Claude about the tests:</h3>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className={`absolute right-0 top-0 text-xs border rounded px-2 py-1 ${theme.modelSelect}`}
          >
            {CHAT_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-4">
          {/* Loading spinner (left) */}
          <div className="w-8 flex-shrink-0">
            {isLoading && (
              <svg className={`w-5 h-5 ${theme.spinnerColor} animate-spin`} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
          </div>

          {/* Title (center) - hide if we have context */}
          {showTitle && !hasPatientContext && (
            <div className="flex-1 text-center">
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                Chat with us to Learn About These Tests and Your Own Options
              </h2>
            </div>
          )}
          
          {/* Spacer when no title */}
          {hasPatientContext && <div className="flex-1" />}

          {/* Right side: model selector + print */}
          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className={`text-xs border rounded px-2 py-1 ${theme.modelSelect}`}
            >
              {CHAT_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {messages.length > 2 && (
              <button
                onClick={printChat}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors bg-white/20 hover:bg-white/30 text-white"
                title="Print conversation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div 
        ref={chatContainerRef}
        className={`overflow-y-auto ${isCompact ? '' : 'rounded-xl p-4 mb-1'} ${theme.messageArea}`}
        style={{ 
          height: isCompact ? undefined : `${chatHeight}px`,
          minHeight: isCompact ? '150px' : '200px',
          maxHeight: isCompact ? undefined : '600px',
          flex: isCompact ? 1 : undefined
        }}
      >
        {/* Mode toggle (patient only - legacy, controlled by showModeToggle prop) */}
        {showModeToggle && (
          <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mb-4">
            <button 
              onClick={() => { setChatMode('learn'); setMessages([]); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                chatMode === 'learn' 
                  ? 'bg-[#1a5276] text-white shadow-md' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Learn about the tests in general
            </button>
            <button 
              onClick={() => { setChatMode('find'); setMessages([]); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                chatMode === 'find' 
                  ? 'bg-[#1a5276] text-white shadow-md' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Walk me through my personal options
            </button>
          </div>
        )}

        {/* Welcome message + suggestions */}
        {messages.length === 0 && (
          <div className="space-y-3">
            {/* Welcome message bubble only for patient */}
            {isPatient && (
              <div className="flex justify-start">
                <div className={`max-w-[90%] rounded-xl px-4 py-3 ${theme.assistantBubble}`}>
                  <SimpleMarkdown text={welcomeMessage} className="text-sm" />
                  {/* Inline suggestions for patient learn mode */}
                  {chatMode === 'learn' && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {suggestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleSubmit(q)}
                          className={`px-3 py-1.5 border rounded-full text-xs text-left transition-colors ${theme.suggestionBtn}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Suggestions only (no welcome bubble) for non-patient */}
            {!isPatient && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Try an example question:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(q)}
                      className={`px-3 py-1.5 border rounded-full text-xs text-left transition-colors ${theme.suggestionBtn}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                data-message-role={msg.role} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-xl px-4 py-3 ${msg.role === 'user' ? theme.userBubble : theme.assistantBubble}`}>
                  {msg.role === 'assistant' ? (
                    <SimpleMarkdown text={msg.content} className="text-sm" onTestClick={onViewTests} />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start mt-4">
            <div className={`rounded-xl px-4 py-3 ${theme.assistantBubble}`}>
              <div className="flex gap-1">
                <span className={`w-2 h-2 ${theme.loadingDot} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></span>
                <span className={`w-2 h-2 ${theme.loadingDot} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></span>
                <span className={`w-2 h-2 ${theme.loadingDot} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      {resizable && !isCompact && (
        <div 
          className="flex justify-center items-center py-2 mb-2 cursor-ns-resize group touch-none"
          onMouseDown={(e) => { e.preventDefault(); handleResizeStart(e.clientY, false); }}
          onTouchStart={(e) => { e.preventDefault(); handleResizeStart(e.touches[0].clientY, true); }}
        >
          <div className={`w-16 h-2 rounded-full transition-colors ${theme.resizeHandle}`} />
        </div>
      )}

      {/* Input area */}
      <div className={`${isCompact ? 'pt-3 mt-3 border-t border-slate-100' : ''}`}>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isPatient ? "Ask a question or explain your situation..." : "Ask about testing, describe a situation, compare specific tests..."}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 border ${theme.input}`}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${theme.submitBtn}`}
          >
            Ask
          </button>
        </form>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className={`mt-2 text-xs ${isPatient ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Reset Chat
          </button>
        )}
      </div>
    </div>
  );
};

export default Chat;
