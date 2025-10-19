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
  updateProfilePicture: (pictureData) => api.put('/users/profile-picture', { picture: pictureData }),
  removeProfilePicture: () => api.delete('/users/profile-picture'),
};

// Spaces API
export const spacesAPI = {
  getSpaceGroups: () => api.get('/space-groups'),
  getSpaces: (spaceGroupId) => api.get('/spaces', { params: { space_group_id: spaceGroupId } }),
  joinSpace: (spaceId) => api.post(`/spaces/${spaceId}/join`),
  leaveSpace: (spaceId) => api.post(`/spaces/${spaceId}/leave`),
  getSpaceMembers: (spaceId) => api.get(`/spaces/${spaceId}/members`),
  getSpaceMembersDetailed: (spaceId) => api.get(`/spaces/${spaceId}/members-detailed`),
  removeMember: (spaceId, userId) => api.delete(`/spaces/${spaceId}/members/${userId}`),
  blockMember: (spaceId, userId, blockType = 'hard', expiresAt = null) => api.put(`/spaces/${spaceId}/members/${userId}/block`, { block_type: blockType, expires_at: expiresAt }),
  unblockMember: (spaceId, userId) => api.put(`/spaces/${spaceId}/members/${userId}/unblock`),
  promoteToManager: (spaceId, userId) => api.put(`/spaces/${spaceId}/members/${userId}/promote`),
  demoteFromManager: (spaceId, userId) => api.put(`/spaces/${spaceId}/members/${userId}/demote`),
  configureSpace: (spaceId, data) => api.put(`/admin/spaces/${spaceId}/configure`, data),
  // Join requests
  createJoinRequest: (spaceId, message) => api.post(`/spaces/${spaceId}/join-request`, { message }),
  getJoinRequests: (spaceId) => api.get(`/spaces/${spaceId}/join-requests`),
  getMyJoinRequests: () => api.get('/my-join-requests'),
  approveJoinRequest: (requestId) => api.put(`/join-requests/${requestId}/approve`),
  rejectJoinRequest: (requestId) => api.put(`/join-requests/${requestId}/reject`),
  cancelJoinRequest: (requestId) => api.delete(`/join-requests/${requestId}`),
  // Space Invites (for Secret spaces)
  createSpaceInvite: (spaceId, maxUses, expiresAt) => api.post(`/spaces/${spaceId}/invites`, { max_uses: maxUses, expires_at: expiresAt }),
  getSpaceInvites: (spaceId) => api.get(`/spaces/${spaceId}/invites`),
  deactivateInvite: (inviteCode) => api.delete(`/invites/${inviteCode}`),
  joinViaInvite: (inviteCode) => api.post(`/join/${inviteCode}`),
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
  createOrder: (tierId, currency, originUrl) => api.post('/payments/create-order', { origin_url: originUrl }, { params: { tier_id: tierId, currency } }),
  checkStatus: (sessionId) => api.get(`/payments/status/${sessionId}`),
  verifyRazorpayPayment: (data) => api.post('/payments/razorpay/verify', data),
};


// Leaderboard & Levels API
export const leaderboardAPI = {
  getLeaderboard: (timeFilter = 'all') => api.get('/leaderboard', { params: { time_filter: timeFilter } }),
  getLevels: () => api.get('/levels'),
  createLevel: (data) => api.post('/admin/levels', data),
  updateLevel: (levelId, data) => api.put(`/admin/levels/${levelId}`, data),
  deleteLevel: (levelId) => api.delete(`/admin/levels/${levelId}`),
  seedDefaultLevels: () => api.post('/admin/seed-levels'),
  getUserPointsHistory: (userId) => api.get(`/users/${userId}/points-history`),
};


// Admin API
export const adminAPI = {
  createSpaceGroup: (data) => api.post('/admin/space-groups', data),
  createSpace: (data) => api.post('/admin/spaces', data),
  getAnalytics: () => api.get('/admin/analytics'),
  archiveMember: (userId) => api.put(`/admin/members/${userId}/archive`),
  unarchiveMember: (userId) => api.put(`/admin/members/${userId}/unarchive`),
  deleteMember: (userId) => api.delete(`/admin/members/${userId}`),
  processExpiredBlocks: () => api.post('/admin/process-expired-blocks'),
};


// User Management API
export const usersAPI = {
  getAllUsers: () => api.get('/users/all'),
  getAllUsersWithMemberships: () => api.get('/users/all-with-memberships'),
  promoteToAdmin: (userId) => api.put(`/users/${userId}/promote-to-admin`),
  demoteFromAdmin: (userId) => api.put(`/users/${userId}/demote-from-admin`),
  getManagedSpaces: (userId) => api.get(`/users/${userId}/managed-spaces`),
  setTeamMember: (userId, isTeamMember) => api.put(`/users/${userId}/set-team-member`, { is_team_member: isTeamMember }),
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
