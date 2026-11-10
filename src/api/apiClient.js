const _BACKEND = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:8080'
    : 'https://grc-backend-135177300761.asia-south1.run.app';
const API_BASE_URL = `${_BACKEND}/api/grc`;
const API_USER_URL = `${_BACKEND}/api/users`;
const API_CLIENTS_URL = `${_BACKEND}/api/admin/clients`;

let _cachedDetails = null;

export const apiClient = {
    async getDetails() {
        if (_cachedDetails && Array.isArray(_cachedDetails) && _cachedDetails.length > 0) {
            return _cachedDetails;
        }
        const response = await fetch(`${API_BASE_URL}/details`);
        if (!response.ok) throw new Error('Failed to fetch details');
        const data = await response.json();
        _cachedDetails = data;
        return data;
    },

    async getDetailByGstin(gstin) {
        const response = await fetch(`${API_BASE_URL}/details/${gstin}`);
        if (!response.ok) throw new Error('Failed to fetch detail for GSTIN');
        return response.json();
    },

    async calculateScore(gstin) {
        const response = await fetch(`${API_BASE_URL}/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gstin })
        });
        if (!response.ok) throw new Error('Failed to calculate score');
        return response.json();
    },

    async recalculateDetail(gstin) {
        const response = await fetch(`${API_BASE_URL}/recalculate/${gstin}`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to recalculate score');
        return response.json();
    },

    async recalculateAll() {
        const response = await fetch(`${API_BASE_URL}/recalculate-all`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to recalculate all scores');
        return response.text();
    },

    async updateDetails(gstin, data) {
        const savedUser = localStorage.getItem('grc_user');
        const userName = savedUser ? JSON.parse(savedUser).name : 'Unknown';

        const response = await fetch(`${API_BASE_URL}/details/${gstin}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, updatedBy: userName })
        });
        if (!response.ok) throw new Error('Failed to update details');
        return response.json();
    },

    async overrideScore(gstin, newScore) {
        const response = await fetch(`${API_BASE_URL}/score/${gstin}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newScore })
        });
        if (!response.ok) throw new Error('Failed to override score');
        return response.json();
    },

    async fetchGstDetails(gstins) {
        const response = await fetch(`${API_BASE_URL}/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gstins })
        });
        if (!response.ok) throw new Error('Failed to fetch new GST details');
        return response.text();
    },

    async deleteGstDetail(gstin) {
        const response = await fetch(`${API_BASE_URL}/details/${gstin}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete GST detail');
        return response.text();
    },

    async cleanupGarbageRecords() {
        const response = await fetch(`${API_BASE_URL}/cleanup-garbage`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to cleanup garbage records');
        return response.text();
    },

    // User Management
    async loginUser(identifier, password) {
        const response = await fetch(`${API_USER_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Login failed');
        }
        return response.json();
    },

    async getUserById(userId) {
        const response = await fetch(`${API_USER_URL}/${userId}`);
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to fetch user');
        }
        return response.json();
    },

    async getUsers() {
        const response = await fetch(API_USER_URL);
        if (!response.ok) throw new Error('Failed to fetch users');
        return response.json();
    },

    async createUser(request, creatorRole) {
        const response = await fetch(`${API_USER_URL}/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Role': creatorRole
            },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to create user');
        }
        return response.json();
    },

    async changePassword(userId, currentPassword, newPassword) {
        const response = await fetch(`${API_USER_URL}/${userId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to change password');
        }
        return response.text();
    },

    async updateUser(userId, request, creatorRole) {
        const response = await fetch(`${API_USER_URL}/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Role': creatorRole
            },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to update user');
        }
        return response.json();
    },

    async deleteUser(userId, creatorRole) {
        const response = await fetch(`${API_USER_URL}/${userId}`, {
            method: 'DELETE',
            headers: {
                'Role': creatorRole
            }
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to delete user');
        }
        return response.text();
    },

    async getRuleConfig() {
        const response = await fetch(`${API_BASE_URL}/rule-config`);
        if (!response.ok) throw new Error('Failed to fetch rule config');
        return response.json();
    },

    async updateRuleConfig(payload) {
        const response = await fetch(`${API_BASE_URL}/rule-config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to update rule config');
        return response.json();
    },

    async getGstDetailsAdmin(gstin) {
        const response = await fetch(`${API_BASE_URL}/details/${gstin}/admin`, {
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to fetch admin detail for GSTIN');
        return response.json();
    },

    async refreshGstFromApi(gstins = [], updatedBy = null) {
        const response = await fetch(`${API_BASE_URL}/admin/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Role': 'super_admin'
            },
            body: JSON.stringify({ gstins, updatedBy })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to refresh GST data from API');
        }
        return response.json();
    },

    // ── GSTR-7 Management Endpoints ──────────────────────────────────────────

    async getPanGstr7Data() {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/pans`, {
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to fetch PAN GSTR-7 data');
        return response.json();
    },

    async assignCategoryToPan(pan, categoryId) {
        const savedUser = localStorage.getItem('grc_user');
        const userName = savedUser ? JSON.parse(savedUser).name : 'Unknown';

        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Role': 'super_admin'
            },
            body: JSON.stringify({ pan, categoryId, updatedBy: userName })
        });
        if (!response.ok) throw new Error('Failed to assign category');
        return response.json();
    },

    async setTdsApplicable(pan, isApplicable) {
        const savedUser = localStorage.getItem('grc_user');
        const userName = savedUser ? JSON.parse(savedUser).name : 'Unknown';

        const response = await fetch(`${API_BASE_URL}/admin/gstr7/tds/${pan}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Role': 'super_admin'
            },
            body: JSON.stringify({ isApplicable, updatedBy: userName })
        });
        if (!response.ok) {
            let msg = 'Failed to set TDS status';
            try { const b = await response.json(); msg = b.details || b.message || msg; } catch {}
            throw new Error(msg);
        }
        return response.json();
    },

    async markUnmarkGstd(gstin, gstdNo) {
        const queryParam = gstdNo ? `?gstdNo=${encodeURIComponent(gstdNo)}` : '';
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/gstd/${gstin}${queryParam}`, {
            method: 'PUT',
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to mark/unmark TDS no');
        return response.json();
    },

    async updateGstr7Status(gstin, status, delayCount, missedCount) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/status/${gstin}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Role': 'super_admin'
            },
            body: JSON.stringify({ status, delayCount, missedCount })
        });
        if (!response.ok) throw new Error('Failed to update GSTR-7 status');
        return response.json();
    },

    // HSN Categories
    async getHsnCategories() {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn-categories`, {
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to fetch HSN categories');
        return response.json();
    },

    async addHsnCategory(name, description) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn-categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Role': 'super_admin' },
            body: JSON.stringify({ name, description })
        });
        if (!response.ok) throw new Error('Failed to add HSN category');
        return response.json();
    },

    async deleteHsnCategory(id) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn-categories/${id}`, {
            method: 'DELETE',
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to delete HSN category');
    },

    async addCodeToCategory(categoryId, hsnCode, description) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn-categories/${categoryId}/codes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Role': 'super_admin' },
            body: JSON.stringify({ hsnCode, description })
        });
        if (!response.ok) throw new Error('Failed to add HSN code');
        return response.json();
    },

    async removeCodeFromCategory(categoryId, hsnCode) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn-categories/${categoryId}/codes/${hsnCode}`, {
            method: 'DELETE',
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to remove HSN code');
    },

    // GSTR-7 Filing History (AI-powered)
    async parseGstr7Filing(gstin, tableText) {
        const savedUser = localStorage.getItem('grc_user');
        const userRole = savedUser ? JSON.parse(savedUser).role : 'user';
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/parse-filing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Role': userRole },
            body: JSON.stringify({ gstin, tableText })
        });
        if (!response.ok) {
            const msg = await response.text();
            throw new Error(msg || 'AI parsing failed');
        }
        return response.json();
    },

    async parseAndSaveGstr7FilingAsync(gstin, tableText) {
        const savedUser = localStorage.getItem('grc_user');
        const userRole = savedUser ? JSON.parse(savedUser).role : 'user';
        const userName = savedUser ? JSON.parse(savedUser).name : 'Unknown';

        const response = await fetch(`${API_BASE_URL}/admin/gstr7/parse-save-async`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Role': userRole,
                'Username': userName
            },
            body: JSON.stringify({ gstin, tableText })
        });
        if (!response.ok) {
            const msg = await response.text();
            throw new Error(msg || 'Failed to start async parsing');
        }
        return response.json();
    },

    async saveGstr7Filing(gstin, records) {
        const savedUser = localStorage.getItem('grc_user');
        const userRole = savedUser ? JSON.parse(savedUser).role : 'user';
        const userName = savedUser ? JSON.parse(savedUser).name : 'Unknown';

        const response = await fetch(`${API_BASE_URL}/admin/gstr7/save-filing`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Role': userRole,
                'Username': userName
            },
            body: JSON.stringify({ gstin, records })
        });
        if (!response.ok) {
            const msg = await response.text();
            throw new Error(msg || 'Failed to save filing data');
        }
        return response.json();
    },

    async getGstr7FilingDetails(gstin) {
        const savedUser = localStorage.getItem('grc_user');
        const userRole = savedUser ? JSON.parse(savedUser).role : 'user';
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/filing-details/${gstin}`, {
            headers: { 'Role': userRole }
        });
        if (!response.ok) throw new Error('Failed to fetch filing details');
        return response.json();
    },

    async getAllGstr7FilingDetails() {
        const savedUser = localStorage.getItem('grc_user');
        const userRole = savedUser ? JSON.parse(savedUser).role : 'user';
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/filing-details-all`, {
            headers: { 'Role': userRole }
        });
        if (!response.ok) throw new Error('Failed to fetch all filing details');
        return response.json();
    },

    async getPendingReviews() {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/reviews`, {
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to fetch pending reviews');
        return response.json();
    },

    async getReviewsForGstin(gstin) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/reviews`, {
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) return [];
        const all = await response.json();
        return all.filter(r => r.gstin === gstin);
    },

    async approveReview(id, records) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/reviews/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Role': 'super_admin' },
            body: JSON.stringify({ records })
        });
        if (!response.ok) throw new Error('Failed to approve review');
    },

    async rejectReview(id) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/reviews/${id}/reject`, {
            method: 'DELETE',
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to reject review');
    },

    async getNewVendors(limit = 50) {
        const response = await fetch(`${API_BASE_URL}/admin/new-vendors?limit=${limit}`, {
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to fetch new vendors');
        return response.json();
    },

    // ── Trash Management Endpoints ──────────────────────────────────────────

    async trashGstin(gstin) {
        const response = await fetch(`${API_BASE_URL}/admin/trash/${gstin}`, {
            method: 'POST',
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to move GSTIN to trash');
        return response.text();
    },

    async restoreGstin(gstin) {
        const response = await fetch(`${API_BASE_URL}/admin/trash/${gstin}/restore`, {
            method: 'POST',
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to restore GSTIN from trash');
        return response.text();
    },

    async getTrashedGstins() {
        const response = await fetch(`${API_BASE_URL}/admin/trash`, {
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to fetch trashed GSTINs');
        return response.json();
    },

    // ── Client-Vendor Mapping Endpoints (Part 2) ─────────────────────────────

    async getClients() {
        const response = await fetch(API_CLIENTS_URL);
        if (!response.ok) throw new Error('Failed to fetch clients');
        return response.json();
    },

    async getClientById(id) {
        const response = await fetch(`${API_CLIENTS_URL}/${id}`);
        if (!response.ok) throw new Error('Failed to fetch client');
        return response.json();
    },

    async createClient(data) {
        const response = await fetch(API_CLIENTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            let msg = 'Failed to create client';
            try {
                const b = await response.json();
                msg = b.details || b.message || b.error || msg;
            } catch {
                msg = (await response.text()) || msg;
            }
            throw new Error(msg);
        }
        return response.json();
    },

    async updateClient(id, data) {
        const response = await fetch(`${API_CLIENTS_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            let msg = 'Failed to update client';
            try {
                const b = await response.json();
                msg = b.details || b.message || b.error || msg;
            } catch {
                msg = (await response.text()) || msg;
            }
            throw new Error(msg);
        }
        return response.json();
    },

    async deleteClient(id) {
        const response = await fetch(`${API_CLIENTS_URL}/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            let msg = 'Failed to delete client';
            try {
                const b = await response.json();
                msg = b.details || b.message || b.error || msg;
            } catch {
                msg = (await response.text()) || msg;
            }
            throw new Error(msg);
        }
        return response.json();
    },

    async uploadClientLogo(clientId, file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_CLIENTS_URL}/${clientId}/logo`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            let msg = 'Failed to upload client logo';
            try {
                const b = await response.json();
                msg = b.details || b.message || b.error || msg;
            } catch {
                msg = (await response.text()) || msg;
            }
            throw new Error(msg);
        }
        return response.json();
    },

    getClientLogoUrl(clientId) {
        return `${API_CLIENTS_URL}/${clientId}/logo`;
    },

    async getClientVendors(clientId) {
        const response = await fetch(`${API_CLIENTS_URL}/${clientId}/vendors`);
        if (!response.ok) throw new Error('Failed to fetch mapped vendors');
        return response.json();
    },

    async getAssignedVendors() {
        const response = await fetch(`${API_CLIENTS_URL}/assigned-vendors`);
        if (!response.ok) throw new Error('Failed to fetch assigned vendors list');
        return response.json();
    },

    async mapVendorsToClient(clientId, vendorGstins) {
        const response = await fetch(`${API_CLIENTS_URL}/${clientId}/vendors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vendorGstins })
        });
        if (!response.ok) {
            let msg = 'Failed to map vendors';
            try {
                const b = await response.json();
                msg = b.details || b.message || b.error || msg;
            } catch {
                msg = (await response.text()) || msg;
            }
            throw new Error(msg);
        }
        return response.json();
    },

    async unmapVendorFromClient(clientId, vendorGstin) {
        const response = await fetch(`${API_CLIENTS_URL}/${clientId}/vendors/${encodeURIComponent(vendorGstin)}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            let msg = 'Failed to unmap vendor';
            try {
                const b = await response.json();
                msg = b.details || b.message || b.error || msg;
            } catch {
                msg = (await response.text()) || msg;
            }
            throw new Error(msg);
        }
        return response.json();
    },

    async bulkImportClients(data) {
        const response = await fetch(`${API_CLIENTS_URL}/bulk-import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            let msg = 'Failed to import sheet data';
            try {
                const b = await response.json();
                msg = b.details || b.message || b.error || msg;
            } catch {
                msg = (await response.text()) || msg;
            }
            throw new Error(msg);
        }
        return response.json();
    },

    async searchCompanies(query) {
        if (!query || query.trim().length < 2) return [];
        const clean = query.trim().toLowerCase();

        // 1. Try backend search endpoint
        try {
            const response = await fetch(`${API_CLIENTS_URL}/search-companies?query=${encodeURIComponent(query.trim())}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data;
                }
            }
        } catch (e) {
            console.warn('Backend search endpoint unavailable, using dataset fallback:', e);
        }

        // 2. Reliable Fallback: Search in-memory / loaded details + clients
        try {
            const results = [];
            const seenGstin = new Set();

            // Check clients if available
            try {
                const cResp = await fetch(`${API_CLIENTS_URL}`);
                if (cResp.ok) {
                    const clients = await cResp.json();
                    if (Array.isArray(clients)) {
                        for (const c of clients) {
                            const nameMatch = c.clientName && c.clientName.toLowerCase().includes(clean);
                            const gstinMatch = c.clientGstin && c.clientGstin.toLowerCase().includes(clean);
                            if (nameMatch || gstinMatch) {
                                results.push({
                                    gstin: c.clientGstin || '',
                                    name: c.clientName || '',
                                    tradeName: c.clientName || '',
                                    legalName: c.clientName || '',
                                    address: '',
                                    gstType: '',
                                    source: 'Client'
                                });
                                if (c.clientGstin) seenGstin.add(c.clientGstin.toLowerCase());
                            }
                        }
                    }
                }
            } catch {}

            // Check loaded/cached gst_details
            if (!_cachedDetails) {
                const resp = await fetch(`${API_BASE_URL}/details`);
                if (resp.ok) {
                    _cachedDetails = await resp.json();
                }
            }
            if (Array.isArray(_cachedDetails)) {
                for (const g of _cachedDetails) {
                    if (g.gstin && seenGstin.has(g.gstin.toLowerCase())) continue;
                    const gstinMatch = g.gstin && g.gstin.toLowerCase().includes(clean);
                    const tradeMatch = g.tradeName && g.tradeName.toLowerCase().includes(clean);
                    const legalMatch = g.legalName && g.legalName.toLowerCase().includes(clean);
                    if (gstinMatch || tradeMatch || legalMatch) {
                        results.push({
                            gstin: g.gstin,
                            name: g.tradeName || g.legalName || g.gstin,
                            tradeName: g.tradeName,
                            legalName: g.legalName,
                            address: g.address || '',
                            gstType: g.gstType || '',
                            source: 'Database'
                        });
                        if (g.gstin) seenGstin.add(g.gstin.toLowerCase());
                        if (results.length >= 25) break;
                    }
                }
            }
            return results;
        } catch (err) {
            console.error('Local fallback search error:', err);
        }

        return [];
    }
};
