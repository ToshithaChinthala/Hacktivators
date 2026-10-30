import api from './client'

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
}

export const privypassApi = {
  verify: (data) => api.post('/api/privypass/verify', data),
  getHistory: () => api.get('/api/privypass/history'),
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

