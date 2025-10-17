import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  googleAuth: (redirectUrl) => api.get('/auth/google', { params: { redirect_url: redirectUrl } }),
  processSession: (sessionId) => api.post('/auth/session', {}, { headers: { 'X-Session-ID': sessionId } }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Spaces API
export const spacesAPI = {
  getSpaceGroups: () => api.get('/space-groups'),
  getSpaces: (spaceGroupId) => api.get('/spaces', { params: { space_group_id: spaceGroupId } }),
  joinSpace: (spaceId) => api.post(`/spaces/${spaceId}/join`),
  leaveSpace: (spaceId) => api.post(`/spaces/${spaceId}/leave`),
  getSpaceMembers: (spaceId) => api.get(`/spaces/${spaceId}/members`),
  configureSpace: (spaceId, data) => api.put(`/admin/spaces/${spaceId}/configure`, data),
};

// Events API
export const eventsAPI = {
  getEvents: (upcoming = true) => api.get('/events', { params: { upcoming } }),
  createEvent: (data) => api.post('/events', data),
  updateEvent: (eventId, data) => api.put(`/events/${eventId}`, data),
  deleteEvent: (eventId) => api.delete(`/events/${eventId}`),
  rsvpEvent: (eventId) => api.post(`/events/${eventId}/rsvp`),
};

// Members API
export const membersAPI = {
  getMembers: (search, skip = 0, limit = 50) => api.get('/members', { params: { search, skip, limit } }),
  getMember: (userId) => api.get(`/members/${userId}`),
  updateProfile: (data) => api.put('/members/profile', data),
};

// DMs API
export const dmsAPI = {
  getDMs: () => api.get('/dms'),
  sendDM: (receiverId, content) => api.post('/dms', { receiver_id: receiverId, content }),
};

// Notifications API
export const notificationsAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
};

// Feature Requests API
export const featureRequestsAPI = {
  getRequests: (sort = 'votes') => api.get('/feature-requests', { params: { sort } }),
  createRequest: (data) => api.post('/feature-requests', data),
  voteRequest: (requestId) => api.post(`/feature-requests/${requestId}/vote`),
};

// Payments API
export const paymentsAPI = {
  createOrder: (plan, originUrl) => api.post('/payments/create-order', { origin_url: originUrl }, { params: { plan } }),
  checkStatus: (sessionId) => api.get(`/payments/status/${sessionId}`),
};

// Admin API
export const adminAPI = {
  createSpaceGroup: (data) => api.post('/admin/space-groups', data),
  createSpace: (data) => api.post('/admin/spaces', data),
  getAnalytics: () => api.get('/admin/analytics'),
  archiveMember: (userId) => api.put(`/admin/members/${userId}/archive`),
  unarchiveMember: (userId) => api.put(`/admin/members/${userId}/unarchive`),
  deleteMember: (userId) => api.delete(`/admin/members/${userId}`),
};

// Posts API
export const postsAPI = {
  getSpacePosts: (spaceId, skip = 0, limit = 20) => api.get(`/spaces/${spaceId}/posts`, { params: { skip, limit } }),
  createPost: (data) => api.post('/posts', data),
  reactToPost: (postId, emoji) => api.post(`/posts/${postId}/react`, null, { params: { emoji } }),
  getComments: (postId) => api.get(`/posts/${postId}/comments`),
  addComment: (postId, content) => api.post(`/posts/${postId}/comments`, { content }),
};

// Invites API
export const invitesAPI = {
  generateInvite: (role) => api.post('/invites/generate', null, { params: { role } }),
  validateInvite: (token) => api.get(`/invites/validate/${token}`),
  getInvites: () => api.get('/invites'),
  createUserDirectly: (data) => api.post('/invites/create-user', data),
};
