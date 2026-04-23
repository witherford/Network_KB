// Provider-agnostic chat completion. Pulls the next available key from the
// keyring and dispatches to the right endpoint. Returns the assistant's text.

import * as keyring from './keyring.js';

const ENDPOINTS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai:     'https://api.openai.com/v1/chat/completions',
  groq:       'https://api.groq.com/openai/v1/chat/completions',
  anthropic:  'https://api.anthropic.com/v1/messages'
};

export function isRetriable(status) {
  return status === 429 || (status >= 500 && status < 600);
}

export async function chat({ messages, maxTokens = 2000, temperature = 0.2, json = false }) {
  const tried = new Set();
  while (true) {
    const p = keyring.getNext();
    if (!p || tried.has(p.id)) {
      throw new Error('All AI keys exhausted or in cooldown');
    }
    tried.add(p.id);

    try {
      const text = await callProvider(p, { messages, maxTokens, temperature, json });
      keyring.markSuccess(p.id);
      return { text, provider: p.provider, model: p.model, keyId: p.id };
    } catch (err) {
      if (err.retriable) {
        keyring.markFailed(p.id);
        continue;
      }
      throw err;
    }
  }
}

async function callProvider(p, { messages, maxTokens, temperature, json }) {
  const url = ENDPOINTS[p.provider];
  if (!url) throw new Error(`Unknown provider: ${p.provider}`);

  if (p.provider === 'anthropic') {
    const body = {
      model: p.model,
      max_tokens: maxTokens,
      temperature,
      messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
      system: (messages.find(m => m.role === 'system') || {}).content || undefined
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': p.key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const e = new Error(`Anthropic ${res.status}`);
      e.retriable = isRetriable(res.status);
      throw e;
    }
    const j = await res.json();
    return j.content?.[0]?.text || '';
  }

  // OpenAI-compatible (openrouter, openai, groq)
  const body = {
    model: p.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {})
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + p.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const e = new Error(`${p.provider} ${res.status}`);
    e.retriable = isRetriable(res.status);
    throw e;
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

export function extractJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  // Direct JSON
  try { return JSON.parse(trimmed); } catch {}
  // Fenced code block
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  // First array/object in text
  const m = trimmed.match(/[\[\{][\s\S]*[\]\}]/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}
