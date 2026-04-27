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
  deleteConversation: (id) => request(`/conversations/${id}`, { method: 'DELETE' }),
  sendMainMessage: (payload) => request('/chat/main', { method: 'POST', body: JSON.stringify(payload) }),
  createBranch: (payload) => request('/branches', { method: 'POST', body: JSON.stringify(payload) }),
  getBranch: (id) => request(`/branches/${id}`),
  sendParallelMessage: (payload) => request('/chat/parallel', { method: 'POST', body: JSON.stringify(payload) }),
  closeBranch: (id, payload) => request(`/branches/${id}/close`, { method: 'POST', body: JSON.stringify(payload) }),
};

