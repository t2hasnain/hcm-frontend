'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User as UserIcon,
  RotateCcw,
  ShieldAlert,
  Wrench,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { extractErrorMessage } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  toolCalls?: string[];
  isError?: boolean;
}

const adminHrPrompts = [
  'Who is on leave today?',
  'Who came late most often this month?',
  'What is this month’s attendance rate?',
  'Summarize today’s workforce KPIs',
];

const employeePrompts = [
  'How many sick leaves do I have left this year?',
  'What is the company late arrival policy?',
  'How are my salary allowances calculated?',
  'What is another colleague’s salary?',
];

export function AIAssistantDrawer() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const role = user?.role || 'Employee';
  const quickPrompts = role === 'Employee' ? employeePrompts : adminHrPrompts;

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: `Hello ${user?.full_name || 'there'}! I am your HCM AI Assistant powered by Azure OpenAI. I can answer policy questions, check leave balances, look up attendance records, and provide executive analytics. How can I help you today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [user]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleSend = async (messageText?: string) => {
    const query = (messageText || input).trim();
    if (!query || loading) return;

    const userMsgId = Math.random().toString(36).slice(2);
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/api/v1/ai/chat', { message: query });
      const aiResponseText = res.data?.response || 'No response from assistant.';
      const toolCalls = res.data?.tool_calls_made || [];

      const aiMsg: Message = {
        id: Math.random().toString(36).slice(2),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err, 'Failed to connect to AI assistant. Please try again.');
      const errorResponse: Message = {
        id: Math.random().toString(36).slice(2),
        sender: 'ai',
        text: errorMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: Math.random().toString(36).slice(2),
        sender: 'ai',
        text: `Conversation cleared. What else would you like to explore, ${user?.full_name || 'colleague'}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const toggleToolExpand = (msgId: string) => {
    setExpandedTools((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-2xl hover:shadow-indigo-500/25 transition-all transform hover:scale-105 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
        title="Open HCM AI Copilot"
        aria-label="Open AI Copilot"
      >
        <Sparkles className="h-5 w-5 animate-pulse text-yellow-300" />
        <span className="text-sm font-semibold tracking-wide">AI Copilot</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="HCM AI Assistant Drawer"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-gray-900 dark:to-gray-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">HCM AI Assistant</h2>
                <Badge variant="blue" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5">
                  gpt-5.4-mini
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Enterprise Tool-Calling Copilot • Role: <span className="font-semibold">{role}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Clear conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'ai' && (
                <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={`max-w-[85%] flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                {m.sender === 'ai' && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                      <Sparkles className="h-2.5 w-2.5 text-indigo-500" />
                      AI-generated
                    </span>
                    <span className="text-[10px] text-gray-400">{m.timestamp}</span>
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : m.isError
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-bl-xs'
                      : 'bg-gray-100 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 border border-gray-200/50 dark:border-gray-700/50 rounded-bl-xs'
                  }`}
                >
                  {m.isError && (
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-red-600 dark:text-red-400 mb-1">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Request Notice
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>

                  {/* Tool calls disclosure */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 text-xs">
                      <button
                        onClick={() => toggleToolExpand(m.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <Wrench className="h-3 w-3 text-indigo-500" />
                        <span>{m.toolCalls.length} tool {m.toolCalls.length === 1 ? 'call' : 'calls'} executed</span>
                        {expandedTools[m.id] ? (
                          <ChevronUp className="h-3 w-3 ml-0.5" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-0.5" />
                        )}
                      </button>
                      {expandedTools[m.id] && (
                        <div className="mt-1 space-y-1">
                          {m.toolCalls.map((tc, idx) => (
                            <code
                              key={idx}
                              className="block bg-gray-200/70 dark:bg-gray-900/80 px-2 py-0.5 rounded text-[10px] text-gray-700 dark:text-gray-300 font-mono"
                            >
                              {tc}
                            </code>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {m.sender === 'user' && (
                  <span className="text-[10px] text-gray-400 mt-1 mr-1">{m.timestamp}</span>
                )}
              </div>

              {m.sender === 'user' && (
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-start animate-pulse">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-xs px-4 py-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Spinner size="sm" />
                <span>Analyzing data and executing tools...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800/80 bg-gray-50/60 dark:bg-gray-900/60 shrink-0">
          <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            Suggested Questions
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {quickPrompts.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="text-xs text-left px-2.5 py-1.5 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg border border-gray-200/80 dark:border-gray-700 transition-colors shadow-2xs disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask anything about HCM or policies...`}
              disabled={loading}
              className="flex-1 text-sm bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl shadow-md transition-all shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              Tool calling adheres strictly to RBAC. Queries outside your access scope are politely rejected.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
