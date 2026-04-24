import axios, { AxiosRequestConfig } from 'axios';

/**
 * Admin-app API client.
 *
 * All functions return `Promise<any>` — the backend shapes are dynamic
 * and vary per-endpoint. Phase 3 of the TS migration will replace these
 * with shared Prisma-derived types from a @storv/types package.
 */

interface StoredAdminUser {
  token?: string;
  [key: string]: unknown;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Request interceptor — attach Bearer token
api.interceptors.request.use(
  (config) => {
    const raw = localStorage.getItem('admin_user');
    const user: StoredAdminUser | null = raw ? JSON.parse(raw) : null;
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

type Params = Record<string, unknown>;
type Headers = Record<string, string>;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const login = (credentials: { email: string; password: string }) =>
  api.post('/auth/login', credentials);

// ── Admin Dashboard ──────────────────────────────────────────────────────────
export const getAdminDashboard = (): Promise<any> => api.get('/admin/dashboard').then(r => r.data);

// ── Admin Users ──────────────────────────────────────────────────────────────
export const getAdminUsers       = (params?: Params):   Promise<any> => api.get('/admin/users', { params }).then(r => r.data);
export const createAdminUser     = (data: unknown):     Promise<any> => api.post('/admin/users', data).then(r => r.data);
export const updateAdminUser     = (id: string | number, d: unknown): Promise<any> => api.put(`/admin/users/${id}`, d).then(r => r.data);
export const deleteAdminUser     = (id: string | number): Promise<any> => api.delete(`/admin/users/${id}`).then(r => r.data);
export const approveAdminUser    = (id: string | number): Promise<any> => api.put(`/admin/users/${id}/approve`).then(r => r.data);
export const suspendAdminUser    = (id: string | number): Promise<any> => api.put(`/admin/users/${id}/suspend`).then(r => r.data);
export const rejectAdminUser     = (id: string | number): Promise<any> => api.put(`/admin/users/${id}/reject`).then(r => r.data);
export const impersonateUser     = (id: string | number): Promise<any> => api.post(`/admin/users/${id}/impersonate`).then(r => r.data);

// ── Admin Organizations ──────────────────────────────────────────────────────
export const getAdminOrganizations     = (params?: Params): Promise<any> => api.get('/admin/organizations', { params }).then(r => r.data);
export const createAdminOrganization   = (data: unknown):  Promise<any> => api.post('/admin/organizations', data).then(r => r.data);
export const updateAdminOrganization   = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/organizations/${id}`, data).then(r => r.data);
export const deleteAdminOrganization   = (id: string | number): Promise<any> => api.delete(`/admin/organizations/${id}`).then(r => r.data);

// ── Admin Stores ─────────────────────────────────────────────────────────────
export const getAdminStores      = (params?: Params):  Promise<any> => api.get('/admin/stores', { params }).then(r => r.data);
export const createAdminStore    = (data: unknown):   Promise<any> => api.post('/admin/stores', data).then(r => r.data);
export const updateAdminStore    = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/stores/${id}`, data).then(r => r.data);
export const deleteAdminStore    = (id: string | number): Promise<any> => api.delete(`/admin/stores/${id}`).then(r => r.data);

// ── Dejavoo Payment Merchants (superadmin-only, per-store) ──────────────────
export const listPaymentMerchants     = (params?: Params):  Promise<any> => api.get('/admin/payment-merchants', { params }).then(r => r.data);
export const getPaymentMerchant       = (id: string | number): Promise<any> => api.get(`/admin/payment-merchants/${id}`).then(r => r.data);
export const createPaymentMerchant    = (data: unknown):    Promise<any> => api.post('/admin/payment-merchants', data).then(r => r.data);
export const updatePaymentMerchant    = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/payment-merchants/${id}`, data).then(r => r.data);
export const deletePaymentMerchant    = (id: string | number): Promise<any> => api.delete(`/admin/payment-merchants/${id}`).then(r => r.data);
export const testPaymentMerchant      = (id: string | number): Promise<any> => api.post(`/admin/payment-merchants/${id}/test`).then(r => r.data);
export const activatePaymentMerchant  = (id: string | number): Promise<any> => api.post(`/admin/payment-merchants/${id}/activate`).then(r => r.data);
export const disablePaymentMerchant   = (id: string | number, reason?: string): Promise<any> => api.post(`/admin/payment-merchants/${id}/disable`, { reason }).then(r => r.data);
export const getPaymentMerchantAudit  = (id: string | number): Promise<any> => api.get(`/admin/payment-merchants/${id}/audit`).then(r => r.data);

// ── Dejavoo Payment Terminals (per-device, one per station) ─────────────────
export const listPaymentTerminals    = (params?: Params):  Promise<any> => api.get('/admin/payment-terminals', { params }).then(r => r.data);
export const createPaymentTerminal   = (data: unknown):   Promise<any> => api.post('/admin/payment-terminals', data).then(r => r.data);
export const updatePaymentTerminal   = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/payment-terminals/${id}`, data).then(r => r.data);
export const deletePaymentTerminal   = (id: string | number): Promise<any> => api.delete(`/admin/payment-terminals/${id}`).then(r => r.data);
export const pingPaymentTerminal     = (id: string | number): Promise<any> => api.post(`/admin/payment-terminals/${id}/ping`).then(r => r.data);

// ── Admin CMS Pages ──────────────────────────────────────────────────────────
export const getAdminCmsPages    = ():                Promise<any> => api.get('/admin/cms').then(r => r.data);
export const createAdminCmsPage  = (data: unknown):   Promise<any> => api.post('/admin/cms', data).then(r => r.data);
export const updateAdminCmsPage  = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/cms/${id}`, data).then(r => r.data);
export const deleteAdminCmsPage  = (id: string | number): Promise<any> => api.delete(`/admin/cms/${id}`).then(r => r.data);

// ── Admin Careers ────────────────────────────────────────────────────────────
export const getAdminCareers     = ():                Promise<any> => api.get('/admin/careers').then(r => r.data);
export const createAdminCareer   = (data: unknown):   Promise<any> => api.post('/admin/careers', data).then(r => r.data);
export const updateAdminCareer   = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/careers/${id}`, data).then(r => r.data);
export const deleteAdminCareer   = (id: string | number): Promise<any> => api.delete(`/admin/careers/${id}`).then(r => r.data);

// ── Admin Career Applications ────────────────────────────────────────────────
export const getAdminCareerApplications = (careerPostingId: string | number): Promise<any> => api.get(`/admin/careers/${careerPostingId}/applications`).then(r => r.data);
export const updateAdminJobApplication  = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/applications/${id}`, data).then(r => r.data);

// ── Admin Tickets ────────────────────────────────────────────────────────────
export const getAdminTickets       = (params?: Params):  Promise<any> => api.get('/admin/tickets', { params }).then(r => r.data);
export const createAdminTicket     = (data: unknown):   Promise<any> => api.post('/admin/tickets', data).then(r => r.data);
export const updateAdminTicket     = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/tickets/${id}`, data).then(r => r.data);
export const deleteAdminTicket     = (id: string | number): Promise<any> => api.delete(`/admin/tickets/${id}`).then(r => r.data);
export const addAdminTicketReply   = (id: string | number, data: unknown): Promise<any> => api.post(`/admin/tickets/${id}/reply`, data).then(r => r.data);

// ── Admin System Config ──────────────────────────────────────────────────────
export const getAdminSystemConfig    = ():              Promise<any> => api.get('/admin/config').then(r => r.data);
export const updateAdminSystemConfig = (data: unknown): Promise<any> => api.put('/admin/config', data).then(r => r.data);

// ── Admin Analytics ──────────────────────────────────────────────────────────
export const getAdminAnalyticsDashboard = (): Promise<any> => api.get('/admin/analytics/dashboard').then(r => r.data);
export const getAdminOrgAnalytics       = (): Promise<any> => api.get('/admin/analytics/organizations').then(r => r.data);
export const getAdminStorePerformance   = (): Promise<any> => api.get('/admin/analytics/stores').then(r => r.data);
export const getAdminUserActivity       = (): Promise<any> => api.get('/admin/analytics/users').then(r => r.data);

// ── Admin Payment Management ─────────────────────────────────────────────────
export const getAdminPaymentMerchant    = (orgId: string | number): Promise<any> => api.get('/admin/payment/merchant', { params: { orgId } }).then(r => r.data);
export const saveAdminPaymentMerchant   = (data: unknown):          Promise<any> => api.put('/admin/payment/merchant', data).then(r => r.data);
export const getAdminPaymentTerminals   = (params?: Params):        Promise<any> => api.get('/admin/payment/terminals', { params }).then(r => r.data);
export const pingAdminTerminal          = (id: string | number):    Promise<any> => api.post(`/admin/payment/terminals/${id}/ping`).then(r => r.data);
export const createAdminTerminal        = (data: unknown):          Promise<any> => api.post('/admin/payment/terminals', data).then(r => r.data);
export const updateAdminTerminal        = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/payment/terminals/${id}`, data).then(r => r.data);
export const deleteAdminTerminal        = (id: string | number):    Promise<any> => api.delete(`/admin/payment/terminals/${id}`).then(r => r.data);
export const getAdminPaymentSettings    = (storeId: string | number): Promise<any> => api.get(`/admin/payment/settings/${storeId}`).then(r => r.data);
export const saveAdminPaymentSettings   = (storeId: string | number, data: unknown): Promise<any> => api.put(`/admin/payment/settings/${storeId}`, data).then(r => r.data);
export const getAdminPaymentHistory     = (params?: Params):        Promise<any> => api.get('/admin/payment/history', { params }).then(r => r.data);

// ── Admin Billing — Plans & Add-ons ──────────────────────────────────────────
export const adminListPlans              = ():           Promise<any> => api.get('/admin/billing/plans').then(r => r.data);
export const adminCreatePlan             = (data: unknown): Promise<any> => api.post('/admin/billing/plans', data).then(r => r.data);
export const adminUpdatePlan             = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/billing/plans/${id}`, data).then(r => r.data);
export const adminDeletePlan             = (id: string | number): Promise<any> => api.delete(`/admin/billing/plans/${id}`).then(r => r.data);
export const adminCreateAddon            = (data: unknown): Promise<any> => api.post('/admin/billing/addons', data).then(r => r.data);
export const adminUpdateAddon            = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/billing/addons/${id}`, data).then(r => r.data);

// ── Admin Billing — Subscriptions ────────────────────────────────────────────
export const adminListSubscriptions      = (params?: Params): Promise<any> => api.get('/admin/billing/subscriptions', { params }).then(r => r.data);
export const adminGetSubscription        = (orgId: string | number): Promise<any> => api.get(`/admin/billing/subscriptions/${orgId}`).then(r => r.data);
export const adminUpsertSubscription     = (orgId: string | number, data: unknown): Promise<any> => api.put(`/admin/billing/subscriptions/${orgId}`, data).then(r => r.data);

// ── Admin Billing — Invoices ──────────────────────────────────────────────────
export const adminListInvoices           = (params?: Params): Promise<any> => api.get('/admin/billing/invoices', { params }).then(r => r.data);
export const adminWriteOffInvoice        = (id: string | number): Promise<any> => api.post(`/admin/billing/invoices/${id}/write-off`).then(r => r.data);
export const adminRetryInvoice           = (id: string | number): Promise<any> => api.post(`/admin/billing/invoices/${id}/retry`).then(r => r.data);

// ── Admin Billing — Equipment ─────────────────────────────────────────────────
export const adminListEquipmentProducts  = ():           Promise<any> => api.get('/admin/billing/equipment/products').then(r => r.data);
export const adminCreateEquipmentProduct = (data: unknown): Promise<any> => api.post('/admin/billing/equipment/products', data).then(r => r.data);
export const adminUpdateEquipmentProduct = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/billing/equipment/products/${id}`, data).then(r => r.data);
export const adminListEquipmentOrders    = (params?: Params): Promise<any> => api.get('/admin/billing/equipment/orders', { params }).then(r => r.data);
export const adminUpdateEquipmentOrder   = (id: string | number, data: unknown): Promise<any> => api.put(`/admin/billing/equipment/orders/${id}`, data).then(r => r.data);

// ── Database Backup ──────────────────────────────────────────────────────────
export const downloadDatabaseBackup = (target: string, format: string = 'sql'): Promise<any> => {
  const config: AxiosRequestConfig = { params: { format }, responseType: 'blob' };
  return api.get(`/admin/backup/${target}`, config);
};

// ── Image Re-hosting ─────────────────────────────────────────────────────────
export const getImageRehostStatus = ():                  Promise<any> => api.get('/admin/images/rehost-status').then(r => r.data);
export const triggerImageRehost   = (batchSize?: number): Promise<any> => api.post('/admin/images/rehost', { batchSize }).then(r => r.data);

// ── RBAC — Roles & Permissions ───────────────────────────────────────────────
export const getPermissions       = (scope?: string):        Promise<any> => api.get('/roles/permissions', { params: scope ? { scope } : undefined }).then(r => r.data);
export const listRoles            = (params?: Params):       Promise<any> => api.get('/roles', { params }).then(r => r.data);
export const getRole              = (id: string | number):   Promise<any> => api.get(`/roles/${id}`).then(r => r.data);
export const createRole           = (data: unknown, params?: Params): Promise<any> => api.post('/roles', data, { params }).then(r => r.data);
export const updateRole           = (id: string | number, data: unknown): Promise<any> => api.put(`/roles/${id}`, data).then(r => r.data);
export const deleteRole           = (id: string | number):   Promise<any> => api.delete(`/roles/${id}`).then(r => r.data);
export const getUserRoles         = (userId: string | number): Promise<any> => api.get(`/roles/users/${userId}/roles`).then(r => r.data);
export const setUserRoles         = (userId: string | number, roleIds: Array<string | number>): Promise<any> => api.put(`/roles/users/${userId}/roles`, { roleIds }).then(r => r.data);

// ── Price Scenarios (Interchange-plus calculator, superadmin-only) ──────────
export const listPriceScenarios   = (params?: Params):      Promise<any> => api.get('/price-scenarios', { params }).then(r => r.data);
export const getPriceScenario     = (id: string | number):  Promise<any> => api.get(`/price-scenarios/${id}`).then(r => r.data);
export const createPriceScenario  = (data: unknown):        Promise<any> => api.post('/price-scenarios', data).then(r => r.data);
export const updatePriceScenario  = (id: string | number, data: unknown): Promise<any> => api.put(`/price-scenarios/${id}`, data).then(r => r.data);
export const deletePriceScenario  = (id: string | number):  Promise<any> => api.delete(`/price-scenarios/${id}`).then(r => r.data);

// ── State catalog (US states with per-state defaults) ───────────────────
export const listAdminStates     = (params?: Params):       Promise<any> => api.get('/states', { params }).then(r => r.data);
export const getAdminState       = (code: string):          Promise<any> => api.get(`/states/${code}`).then(r => r.data);
export const createAdminState    = (data: unknown):         Promise<any> => api.post('/states', data).then(r => r.data);
export const updateAdminState    = (code: string, data: unknown): Promise<any> => api.put(`/states/${code}`, data).then(r => r.data);
export const deleteAdminState    = (code: string):          Promise<any> => api.delete(`/states/${code}`).then(r => r.data);

// ── Vendor Import Templates (Session 5) ──────────────────────────────────────
export const getVendorTemplates      = (params: Params = {}): Promise<any> => api.get('/vendor-templates', { params }).then(r => r.data);
export const getVendorTemplate       = (id: string | number): Promise<any> => api.get(`/vendor-templates/${id}`).then(r => r.data);
export const createVendorTemplate    = (data: unknown):     Promise<any> => api.post('/vendor-templates', data).then(r => r.data);
export const updateVendorTemplate    = (id: string | number, data: unknown): Promise<any> => api.put(`/vendor-templates/${id}`, data).then(r => r.data);
export const deleteVendorTemplate    = (id: string | number): Promise<any> => api.delete(`/vendor-templates/${id}`).then(r => r.data);
export const getVendorTemplateTransforms = ():              Promise<any> => api.get('/vendor-templates/transforms').then(r => r.data);
export const previewVendorTemplate   = (id: string | number, rows: unknown[]): Promise<any> => api.post(`/vendor-templates/${id}/preview`, { rows }).then(r => r.data);

// ── AI Assistant — admin review queue + KB curation ──────────────────────────
export const listAiReviews           = (status: string = 'pending'): Promise<any> => api.get('/ai-assistant/admin/reviews', { params: { status } }).then(r => r.data);
export const getAiReviewConversation = (id: string | number):         Promise<any> => api.get(`/ai-assistant/admin/reviews/${id}/conversation`).then(r => r.data);
export const promoteAiReview         = (id: string | number, data: unknown): Promise<any> => api.post(`/ai-assistant/admin/reviews/${id}/promote`, data).then(r => r.data);
export const dismissAiReview         = (id: string | number):         Promise<any> => api.post(`/ai-assistant/admin/reviews/${id}/dismiss`).then(r => r.data);

// ── AI Product Tours — list + edit (admin-only) ─────────────────────────────
export const listAiTours             = (params: Params = {}):         Promise<any> => api.get('/ai-assistant/admin/tours', { params }).then(r => r.data);
export const getAiTour               = (id: string | number):         Promise<any> => api.get(`/ai-assistant/admin/tours/${id}`).then(r => r.data);
export const createAiTour            = (data: unknown):              Promise<any> => api.post('/ai-assistant/admin/tours', data).then(r => r.data);
export const updateAiTour            = (id: string | number, data: unknown): Promise<any> => api.put(`/ai-assistant/admin/tours/${id}`, data).then(r => r.data);
export const deleteAiTour            = (id: string | number):         Promise<any> => api.delete(`/ai-assistant/admin/tours/${id}`).then(r => r.data);

// ── AI Knowledge Base article management ─────────────────────────────────────
export const listKbArticles          = (params: Params = {}):         Promise<any> => api.get('/ai-assistant/admin/articles', { params }).then(r => r.data);
export const getKbArticle            = (id: string | number):         Promise<any> => api.get(`/ai-assistant/admin/articles/${id}`).then(r => r.data);
export const createKbArticle         = (data: unknown):              Promise<any> => api.post('/ai-assistant/admin/articles', data).then(r => r.data);
export const updateKbArticle         = (id: string | number, data: unknown): Promise<any> => api.put(`/ai-assistant/admin/articles/${id}`, data).then(r => r.data);
export const deleteKbArticle         = (id: string | number):         Promise<any> => api.delete(`/ai-assistant/admin/articles/${id}`).then(r => r.data);

// ── AI Assistant — chat widget (superadmin uses cross-tenant) ────────────────
export const listAiConversations = (headers: Headers = {}):  Promise<any> => api.get('/ai-assistant/conversations', { headers }).then(r => r.data);
export const createAiConversation = (headers: Headers = {}): Promise<any> => api.post('/ai-assistant/conversations', null, { headers }).then(r => r.data);
export const getAiConversation    = (id: string | number, headers: Headers = {}): Promise<any> => api.get(`/ai-assistant/conversations/${id}`, { headers }).then(r => r.data);
export const sendAiMessage        = (id: string | number, content: string, headers: Headers = {}): Promise<any> =>
  api.post(`/ai-assistant/conversations/${id}/messages`, { content }, { headers }).then(r => r.data);
export const deleteAiConversation = (id: string | number, headers: Headers = {}): Promise<any> => api.delete(`/ai-assistant/conversations/${id}`, { headers }).then(r => r.data);
export const submitAiFeedback     = (msgId: string | number, feedback: string, note: string | null = null, headers: Headers = {}): Promise<any> =>
  api.post(`/ai-assistant/messages/${msgId}/feedback`, { feedback, note }, { headers }).then(r => r.data);

// ── Admin Lottery Catalog (global, state-scoped ticket catalog) ──────────────
// Ticket Catalog CRUD — visible to all stores of the matching state.
export const listAdminLotteryCatalog    = (params?: Params): Promise<any> => api.get('/lottery/catalog/all', { params }).then(r => r.data);
export const createAdminLotteryCatalog  = (data: unknown):  Promise<any> => api.post('/lottery/catalog', data).then(r => r.data);
export const updateAdminLotteryCatalog  = (id: string | number, d: unknown): Promise<any> => api.put(`/lottery/catalog/${id}`, d).then(r => r.data);
export const deleteAdminLotteryCatalog  = (id: string | number): Promise<any> => api.delete(`/lottery/catalog/${id}`).then(r => r.data);

// Ticket Requests — store-submitted requests to add a game to the catalog.
export const listAdminLotteryRequests   = (params?: Params): Promise<any> => api.get('/lottery/ticket-requests', { params }).then(r => r.data);
export const reviewAdminLotteryRequest  = (id: string | number, d: unknown): Promise<any> => api.put(`/lottery/ticket-requests/${id}/review`, d).then(r => r.data);

// Supported states — backs the state dropdown in the Admin UI.
export const listAdminLotterySupportedStates = (): Promise<any> => api.get('/states/public').then(r => r.data);

// Pull the latest games from the state lottery's public feed.
export const syncAdminLotteryCatalog = (state: string): Promise<any> =>
  api.post('/lottery/catalog/sync', { state }).then(r => r.data);

export default api;
