/**
 * OpenRouter API Client
 * Handles communication with the OpenRouter LLM gateway for FinanceAI.
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterClient {
  /**
   * @param {string} apiKey - OpenRouter API key
   * @param {string} model - Model identifier (e.g. 'openai/gpt-4o')
   */
  constructor(apiKey = '', model = 'openai/gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Send a non-streaming chat completion request.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options
   * @returns {Promise<string>} Assistant reply text
   */
  async chat(messages, options = {}) {
    if (!this.isConfigured()) {
      return '⚠️ API key not configured. Please add your OpenRouter API key in **Settings → AI Settings**.';
    }

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2000,
          stream: false,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err?.error?.message || response.statusText || 'Unknown error';
        console.error('[OpenRouter] API error', response.status, msg);
        return `⚠️ API error (${response.status}): ${msg}`;
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content?.trim() || '(empty response)';
    } catch (error) {
      console.error('[OpenRouter] Network error', error);
      return `⚠️ Network error: ${error.message}. Please check your connection and try again.`;
    }
  }

  /**
   * Send a streaming chat completion request.
   * @param {Array<{role: string, content: string}>} messages
   * @param {(chunk: string) => void} onChunk - called for each text delta
   * @param {Object} options
   * @returns {Promise<string>} Full assembled response
   */
  async streamChat(messages, onChunk, options = {}) {
    if (!this.isConfigured()) {
      const msg = '⚠️ API key not configured. Please add your OpenRouter API key in **Settings → AI Settings**.';
      onChunk(msg);
      return msg;
    }

    let fullResponse = '';

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2000,
          stream: true,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err?.error?.message || response.statusText || 'Unknown error';
        const errorText = `⚠️ API error (${response.status}): ${msg}`;
        onChunk(errorText);
        return errorText;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last potentially-incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);
          if (payload === '[DONE]') break;

          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              onChunk(delta);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      return fullResponse || '(empty response)';
    } catch (error) {
      console.error('[OpenRouter] Stream error', error);
      const errorText = `⚠️ Network error: ${error.message}`;
      onChunk(errorText);
      return errorText;
    }
  }

  /**
   * Test the connection with a simple ping.
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return { ok: false, message: 'API key not set.' };
    }
    try {
      const reply = await this.chat(
        [{ role: 'user', content: 'Respond with exactly: "Connection successful"' }],
        { maxTokens: 20, temperature: 0 }
      );
      const ok = !reply.startsWith('⚠️');
      return { ok, message: ok ? `Connected! Model: ${this.model}` : reply };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  /** Set the model identifier */
  setModel(model) {
    this.model = model;
  }

  /** Set the API key */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /** @returns {boolean} Whether an API key is present */
  isConfigured() {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  /** @private Build common request headers */
  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'FinanceAI',
    };
  }
}

/** Singleton client instance — configured at runtime from saved settings */
export const openRouterClient = new OpenRouterClient('');
