const API_HOST = 'http://3.111.157.12';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${API_HOST}/api/grc`;

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

    async recalculateAll() {
        const response = await fetch(`${API_BASE_URL}/recalculate-all`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to recalculate all scores');
        return response.text();
    },

    async updateDetails(gstin, data) {
        const response = await fetch(`${API_BASE_URL}/details/${gstin}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
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

    // User Management
    async loginUser(identifier, password) {
        const response = await fetch(`${API_HOST}/api/users/login`, {
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

    async getUsers() {
        const response = await fetch(`${API_HOST}/api/users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        return response.json();
    },

    async createUser(request, creatorRole) {
        const response = await fetch(`${API_HOST}/api/users/create`, {
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
        const response = await fetch(`${API_HOST}/api/users/${userId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to change password');
        }
        return response.text();
    }
};
