/**
 * Chat UI Controller
 * Manages the sliding chat panel, message rendering, and conversation flow.
 */

import { store } from '../store.js';
import { openRouterClient } from './openrouter.js';
import { getSystemPrompt, buildFinancialContext } from './prompts.js';
import { parseAIResponse, executeActions } from './actions.js';
import { escapeHtml } from '../utils/helpers.js';

/** @type {Array<{role: string, content: string}>} In-memory conversation history */
let conversationHistory = [];
/** @type {string|null} Current conversation id */
let currentConversationId = null;

/**
 * Initialise the chat panel — wire up event listeners and load saved state.
 */
export function initChat() {
  const sendBtn = document.getElementById('chat-send-btn');
  const input = document.getElementById('chat-input');
  const clearBtn = document.getElementById('chat-clear-btn');

  if (sendBtn) {
    sendBtn.addEventListener('click', () => sendMessage());
  }

  if (input) {
    // Enter to send (Shift+Enter for newline)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearChat);
  }

  // Load API credentials from settings
  loadSettings();

  // Load existing conversation or show welcome
  loadConversation();
}

/**
 * Read API key and model from user settings and configure the client.
 */
function loadSettings() {
  try {
    const settings = store.getSettings();
    if (settings?.openRouterApiKey) {
      openRouterClient.setApiKey(settings.openRouterApiKey);
    }
    if (settings?.preferredModel) {
      openRouterClient.setModel(settings.preferredModel);
    }
  } catch { /* settings not available yet */ }
}

/**
 * Load the most recent conversation from the store, or show a welcome message.
 */
function loadConversation() {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  try {
    const conversations = store.getConversations();
    if (conversations?.length) {
      const latest = conversations[conversations.length - 1];
      currentConversationId = latest.id;
      conversationHistory = latest.messages || [];
      // Render saved messages
      messagesEl.innerHTML = '';
      for (const msg of conversationHistory) {
        appendMessageDOM(msg.role, msg.content);
      }
      scrollToBottom();
      return;
    }
  } catch { /* no conversations yet */ }

  showWelcome();
}

/**
 * Render a welcome message in the chat panel.
 */
function showWelcome() {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  messagesEl.innerHTML = '';
  const welcomeHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome__icon">
        <i data-lucide="bot" style="width:40px;height:40px;color:var(--accent-primary)"></i>
      </div>
      <h3 style="margin:0.75rem 0 0.5rem;color:var(--text-primary)">Hi! I'm FinanceAI 👋</h3>
      <p style="color:var(--text-secondary);font-size:0.875rem;margin:0 0 1rem">
        I can help you analyse your finances, plan budgets, track goals, and more.
        Ask me anything about your money!
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center">
        ${quickPromptBtn('How much did I spend this month?')}
        ${quickPromptBtn('Suggest a budget plan')}
        ${quickPromptBtn('Summarise my finances')}
        ${quickPromptBtn('How can I save more?')}
      </div>
    </div>
  `;
  messagesEl.innerHTML = welcomeHTML;

  // Attach quick-prompt click handlers
  messagesEl.querySelectorAll('.chat-quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      if (input) input.value = btn.textContent.trim();
      sendMessage();
    });
  });

  if (window.lucide) lucide.createIcons();
}

/**
 * Small helper for quick-prompt button HTML
 */
function quickPromptBtn(text) {
  return `<button class="chat-quick-prompt btn btn--outline btn--sm" style="font-size:0.8rem">${escapeHtml(text)}</button>`;
}

/**
 * Send the current user message, get AI response, and render both.
 */
export async function sendMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  // Clear input & reset height
  input.value = '';
  input.style.height = 'auto';

  // Remove welcome screen if present
  const welcome = document.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  // Render user bubble
  appendMessageDOM('user', text);
  conversationHistory.push({ role: 'user', content: text });
  scrollToBottom();

  // Show typing
  showTypingIndicator();

  // Reload settings in case they changed
  loadSettings();

  if (!openRouterClient.isConfigured()) {
    removeTypingIndicator();
    const apiMsg = '⚙️ Please add your **OpenRouter API key** in [Settings](#/settings) → AI Settings to start chatting.';
    appendMessageDOM('assistant', apiMsg);
    conversationHistory.push({ role: 'assistant', content: apiMsg });
    saveConversation();
    scrollToBottom();
    return;
  }

  // Build context-aware messages
  const context = buildFinancialContext(text);
  const contextualizedContent = `${context}\n\n---\n\nUser question: ${text}`;

  const messages = [
    { role: 'system', content: getSystemPrompt() },
    ...conversationHistory.slice(0, -1).slice(-10), // last 10 for history window
    { role: 'user', content: contextualizedContent },
  ];

  try {
    const rawResponse = await openRouterClient.chat(messages);

    removeTypingIndicator();

    // Parse actions
    const { text: displayText, actions } = parseAIResponse(rawResponse);

    // Execute any actions
    let actionResults = '';
    if (actions.length > 0) {
      actionResults = await executeActions(actions);
      // Dispatch store-updated so views refresh
      window.dispatchEvent(new CustomEvent('store-updated'));
    }

    // Compose the final display message
    let finalDisplay = displayText;
    if (actionResults) {
      finalDisplay += (finalDisplay ? '\n\n' : '') + actionResults;
    }

    appendMessageDOM('assistant', finalDisplay || rawResponse);
    conversationHistory.push({ role: 'assistant', content: rawResponse });
    saveConversation();
    updateBadge();
  } catch (error) {
    removeTypingIndicator();
    const errMsg = `⚠️ Something went wrong: ${error.message}`;
    appendMessageDOM('assistant', errMsg);
    conversationHistory.push({ role: 'assistant', content: errMsg });
  }

  scrollToBottom();
}

/**
 * Save the current conversation to the store.
 */
function saveConversation() {
  try {
    const convData = {
      messages: conversationHistory,
      updatedAt: new Date().toISOString(),
    };

    if (currentConversationId) {
      store.updateConversation(currentConversationId, convData);
    } else {
      currentConversationId = store.generateId('conv');
      store.addConversation({
        id: currentConversationId,
        title: conversationHistory[0]?.content?.slice(0, 60) || 'New chat',
        createdAt: new Date().toISOString(),
        ...convData,
      });
    }
  } catch { /* store may not support conversations yet */ }
}

/**
 * Append a rendered message bubble to the chat messages container.
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
function appendMessageDOM(role, content) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  const div = document.createElement('div');
  div.className = `chat-message chat-message--${role}`;

  if (role === 'assistant') {
    div.innerHTML = `
      <div class="chat-message__avatar">
        <i data-lucide="bot" style="width:18px;height:18px"></i>
      </div>
      <div class="chat-message__content">${formatMarkdown(content)}</div>
    `;
  } else {
    div.innerHTML = `
      <div class="chat-message__content">${escapeHtml(content)}</div>
    `;
  }

  messagesEl.appendChild(div);
  if (window.lucide) lucide.createIcons();
}

/**
 * Render a message as an exported helper (for external use).
 */
export function renderMessage(role, content) {
  appendMessageDOM(role, content);
  scrollToBottom();
}

/**
 * Minimal markdown-to-HTML formatter for assistant messages.
 * Handles bold, italic, bullet lists, inline code, and code blocks.
 */
function formatMarkdown(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Code blocks: ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:0.1em 0.35em;border-radius:4px;font-size:0.85em">$1</code>');

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic *text*
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Headings ## text
  html = html.replace(/^### (.+)$/gm, '<h4 style="margin:0.5em 0 0.25em;font-size:0.95em">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="margin:0.5em 0 0.25em;font-size:1em">$1</h3>');

  // Bullet lists (- or •)
  html = html.replace(/^[\-•] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul style="margin:0.25em 0;padding-left:1.25em">$1</ul>');
  // Collapse consecutive </ul><ul>
  html = html.replace(/<\/ul>\s*<ul[^>]*>/g, '');

  // Numbered lists
  html = html.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');

  // Links [text](#hash)
  html = html.replace(/\[([^\]]+)\]\((#[^\)]+)\)/g, '<a href="$2" style="color:var(--accent-primary)">$1</a>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * Show the typing indicator (three animated dots).
 */
export function showTypingIndicator() {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl || messagesEl.querySelector('.chat-message--typing')) return;

  const div = document.createElement('div');
  div.className = 'chat-message chat-message--assistant chat-message--typing';
  div.innerHTML = `
    <div class="chat-message__avatar">
      <i data-lucide="bot" style="width:18px;height:18px"></i>
    </div>
    <div class="chat-message__content">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesEl.appendChild(div);
  if (window.lucide) lucide.createIcons();
  scrollToBottom();
}

/**
 * Remove the typing indicator.
 */
export function removeTypingIndicator() {
  const el = document.querySelector('.chat-message--typing');
  if (el) el.remove();
}

/**
 * Smoothly scroll the chat messages to the bottom.
 */
export function scrollToBottom() {
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
  }
}

/**
 * Clear all messages and start a fresh conversation.
 */
export function clearChat() {
  conversationHistory = [];
  currentConversationId = null;
  showWelcome();
}

/**
 * Update the unread badge on the chat toggle button.
 */
function updateBadge() {
  const badge = document.getElementById('chat-badge');
  if (badge) {
    // Simple: show badge if panel is closed
    const panel = document.getElementById('chat-panel');
    if (panel && !panel.classList.contains('open')) {
      badge.style.display = 'block';
    }
  }
}
