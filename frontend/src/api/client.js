const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.detail || data.message || `请求失败：${response.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data;
}

async function streamRequest(path, payload, { signal, onEvent }) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    const message = data.detail || data.message || `请求失败：${response.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (!event) continue;
      if (event.type === 'error') {
        throw new Error(event.data?.message || '模型流式调用失败');
      }
      onEvent?.(event);
    }
  }
}

function parseSseFrame(frame) {
  const lines = frame.split('\n');
  let type = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      type = line.slice(6).trim();
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return null;
  return { type, data: JSON.parse(dataLines.join('\n')) };
}

export const api = {
  health: () => request('/health'),
  listProviders: () => request('/providers'),
  createProvider: (payload) => request('/providers', { method: 'POST', body: JSON.stringify(payload) }),
  updateProvider: (id, payload) => request(`/providers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProvider: (id) => request(`/providers/${id}`, { method: 'DELETE' }),
  testProvider: (id) => request(`/providers/${id}/test`, { method: 'POST' }),
  listConversations: () => request('/conversations'),
  createConversation: (payload) => request('/conversations', { method: 'POST', body: JSON.stringify(payload) }),
  getConversation: (id) => request(`/conversations/${id}`),
  summarizeConversation: (id, payload) => request(`/conversations/${id}/summary`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteConversation: (id) => request(`/conversations/${id}`, { method: 'DELETE' }),
  sendMainMessage: (payload) => request('/chat/main', { method: 'POST', body: JSON.stringify(payload) }),
  streamMainMessage: (payload, options) => streamRequest('/chat/main/stream', payload, options),
  createBranch: (payload) => request('/branches', { method: 'POST', body: JSON.stringify(payload) }),
  getBranch: (id) => request(`/branches/${id}`),
  sendParallelMessage: (payload) => request('/chat/parallel', { method: 'POST', body: JSON.stringify(payload) }),
  streamParallelMessage: (payload, options) => streamRequest('/chat/parallel/stream', payload, options),
  closeBranch: (id, payload) => request(`/branches/${id}/close`, { method: 'POST', body: JSON.stringify(payload) }),
};
