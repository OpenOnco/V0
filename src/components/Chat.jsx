/**
 * OpenOnco Reusable Chat Component
 * 
 * Single chat implementation that can be configured per persona.
 * Based on the patient chat UI (most mature).
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { buildSystemPrompt, getSuggestedQuestions, getWelcomeMessage } from '../chatPrompts';
import { track } from '@vercel/analytics';

// Chat model options
const CHAT_MODELS = [
  { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' }
];

/**
 * Reusable Chat Component
 * 
 * @param {Object} props
 * @param {string} props.persona - 'patient' | 'medical' | 'rnd'
 * @param {Array} props.testData - Compressed test data for context
 * @param {string} props.category - Optional category filter ('MRD', 'ECD', etc.)
 * @param {Object} props.categoryMeta - Optional category metadata
 * @param {boolean} props.isFloating - Floating chat mode (default: false)
 * @param {Function} props.onClose - Close handler for floating mode
 * @param {number} props.height - Chat height in pixels (default: 400)
 * @param {boolean} props.resizable - Allow height resizing (default: false)
 * @param {boolean} props.showModelSelector - Show model dropdown (default: true)
 * @param {Array} props.customSuggestions - Override default suggestions
 */
const Chat = ({
  persona = 'patient',
  testData = [],
  category = null,
  categoryMeta = null,
  isFloating = false,
  onClose = null,
  height = 400,
  resizable = false,
  showModelSelector = true,
  customSuggestions = null
}) => {
  const welcomeMessage = getWelcomeMessage(persona);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: welcomeMessage }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].id);
  const [chatHeight, setChatHeight] = useState(height);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Get suggestions - custom or from persona config
  const suggestions = customSuggestions || getSuggestedQuestions(persona);

  // Build system prompt - memoized
  const systemPrompt = useMemo(() => {
    return buildSystemPrompt(persona, testData, {
      category,
      meta: categoryMeta,
      includeKeyLegend: true,
      includeExamples: true
    });
  }, [persona, testData, category, categoryMeta]);

  // Reset chat when persona changes
  useEffect(() => {
    setMessages([{ role: 'assistant', content: getWelcomeMessage(persona) }]);
    setShowSuggestions(true);
  }, [persona]);

  // Auto-scroll to show question at top when response arrives
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 1) {
      const container = chatContainerRef.current;
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const userMessages = container.querySelectorAll('[data-message-role="user"]');
            const lastUserEl = userMessages[userMessages.length - 1];
            if (lastUserEl) {
              const containerRect = container.getBoundingClientRect();
              const userRect = lastUserEl.getBoundingClientRect();
              const relativeTop = userRect.top - containerRect.top + container.scrollTop;
              container.scrollTop = Math.max(0, relativeTop - 20);
            }
          }, 150);
        });
      }
    }
  }, [messages]);

  const handleSubmit = async (suggestedQuestion = null) => {
    const question = suggestedQuestion || input.trim();
    if (!question || isLoading) return;

    setInput('');
    setShowSuggestions(false);

    // Track chat submission
    track('chat_message_sent', {
      persona,
      model: selectedModel,
      message_length: question.length,
      is_suggested: !!suggestedQuestion,
      category: category || 'all'
    });

    const newUserMessage = { role: 'user', content: question };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.filter(m => m.role !== 'assistant' || updatedMessages.indexOf(m) > 0),
          systemPrompt,
          model: selectedModel
        })
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();
      setMessages([...updatedMessages, { role: 'assistant', content: data.content }]);
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setShowSuggestions(true);
    track('chat_cleared', { persona, category: category || 'all' });
  };

  return (
    <div className={`flex flex-col ${isFloating ? 'h-full' : ''}`}>
      {/* Header with model selector and clear button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          {showModelSelector && (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            >
              {CHAT_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button
              onClick={clearChat}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
          {isFloating && onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ height: isFloating ? undefined : chatHeight }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            data-message-role={msg.role}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && messages.length === 1 && (
          <div className="space-y-2 mt-4">
            <p className="text-xs text-gray-500 font-medium">Try asking:</p>
            {suggestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSubmit(q)}
                className="block w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question..."
            disabled={isLoading}
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
