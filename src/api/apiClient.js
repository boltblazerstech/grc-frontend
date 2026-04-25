// Use relative paths to allow Netlify Proxy to handle HTTP/HTTPS issues
const API_BASE_URL = '/api/grc';
const API_USER_URL = '/api/users';

export const apiClient = {
    async getDetails() {
        const response = await fetch(`${API_BASE_URL}/details`);
        if (!response.ok) throw new Error('Failed to fetch details');
        return response.json();
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

    async saveHsn(pan, hsnCode) {
        const savedUser = localStorage.getItem('grc_user');
        const userName = savedUser ? JSON.parse(savedUser).name : 'Unknown';

        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Role': 'super_admin'
            },
            body: JSON.stringify({ pan, hsnCode, updatedBy: userName })
        });
        if (!response.ok) throw new Error('Failed to save HSN');
        return response.json();
    },

    async markUnmarkGstd(gstin, gstdNo) {
        const queryParam = gstdNo ? `?gstdNo=${encodeURIComponent(gstdNo)}` : '';
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/gstd/${gstin}${queryParam}`, {
            method: 'PUT',
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to mark/unmark GSTD');
        return response.json();
    },

    async updateGstr7Status(gstin, status, delayCount) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/status/${gstin}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Role': 'super_admin'
            },
            body: JSON.stringify({ status, delayCount })
        });
        if (!response.ok) throw new Error('Failed to update GSTR-7 status');
        return response.json();
    },

    // Master HSN list for GSTR-7
    async getGstr7HsnMaster() {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn-master`, {
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to fetch HSN master list');
        return response.json();
    },

    async addGstr7HsnMaster(hsnCode, description) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn-master`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Role': 'super_admin'
            },
            body: JSON.stringify({ hsnCode, description })
        });
        if (!response.ok) throw new Error('Failed to add HSN to master list');
        return response.json();
    },

    async deleteGstr7HsnMaster(hsnCode) {
        const response = await fetch(`${API_BASE_URL}/admin/gstr7/hsn-master/${hsnCode}`, {
            method: 'DELETE',
            headers: { 'Role': 'super_admin' }
        });
        if (!response.ok) throw new Error('Failed to delete HSN from master list');
        return response;
    }
};
