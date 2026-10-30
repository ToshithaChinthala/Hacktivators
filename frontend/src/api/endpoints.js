import api from './client'

export const authApi = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
}

export const dashboardApi = {
  getStats: () => api.get('/api/dashboard/stats'),
  getRecentActivity: () => api.get('/api/dashboard/activity'),
}

export const sourcemarkApi = {
  uploadFile: (formData) =>
    api.post('/api/sourcemark/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  verifyFile: (formData) =>
    api.post('/api/sourcemark/verify', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getFiles: () => api.get('/api/sourcemark/files'),
  getHistory: () => api.get('/api/sourcemark/history'),
  downloadReport: (comparisonId) =>
    api.get(`/api/sourcemark/report/${comparisonId}/download`, {
      responseType: 'blob',
    }),
}

export const trusttestApi = {
  run: (data) => api.post('/api/trusttest/run', data),
  getHistory: () => api.get('/api/trusttest/history'),
}

export const evidencelockApi = {
  register: (formData) =>
    api.post('/api/evidencelock/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getRecords: () => api.get('/api/evidencelock/records'),
  getRecordById: (id) => api.get(`/api/evidencelock/records/${id}`),
  getHistory: () => api.get('/api/evidencelock/history'),
  verifyChain: () => api.post('/api/evidencelock/verify-chain'),
}

export const reportsApi = {
  getTrustReport: () => api.get('/api/reports/trust-report'),
  downloadPdf: () =>
    api.get('/api/reports/download-pdf', { responseType: 'blob' }),
}

export const healthApi = {
  check: () => api.get('/api/health'),
}

export const provenanceguardApi = {
  // Checkpoints
  createCheckpoint: (actor = 'user') =>
    api.post('/api/provenanceguard/checkpoints/create', { actor }),
  listCheckpoints: () => api.get('/api/provenanceguard/checkpoints'),
  verifyRollback: () => api.get('/api/provenanceguard/checkpoints/verify'),
  getWitnessStore: () => api.get('/api/provenanceguard/checkpoints/witness'),

  // Re-save analysis
  analyzeResave: (formData) =>
    api.post('/api/provenanceguard/analyze-resave', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  registerDerivative: (formData) =>
    api.post('/api/provenanceguard/register-derivative', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getDerivatives: (fileId) => api.get(`/api/provenanceguard/derivatives/${fileId}`),

  // Key management
  listKeys: () => api.get('/api/provenanceguard/keys'),
  generateKey: (owner) => api.post('/api/provenanceguard/keys/generate', { owner }),
  rotateKey: (key_id, new_owner) =>
    api.post('/api/provenanceguard/keys/rotate', { key_id, new_owner }),
  revokeKey: (key_id, reason) =>
    api.post('/api/provenanceguard/keys/revoke', { key_id, reason }),
  reportCompromise: (payload) =>
    api.post('/api/provenanceguard/keys/report-compromise', payload),
  signMessage: (payload) => api.post('/api/provenanceguard/keys/sign', payload),
  verifySignature: (payload) => api.post('/api/provenanceguard/keys/verify', payload),
  listSignatures: () => api.get('/api/provenanceguard/signatures'),
}

