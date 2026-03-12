import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, List, LayoutGrid, Trash2, X, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import GstCard from './GstCard';
import GstDetailsModal from './GstDetailsModal';

const getScoreColor = (score) => {
    if (score === null || score === undefined) return '';
    if (score > 80) return 'score-red';
    if (score > 50) return 'score-yellow';
    return 'score-green';
};

const Dashboard = ({ forceRefreshFlag }) => {
    const [gstList, setGstList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

    // Search state
    const [searchTerm, setSearchTerm] = useState('');

    // New GST Feature
    const [showFetchModal, setShowFetchModal] = useState(false);
    const [newGstInput, setNewGstInput] = useState('');
    const [isFetchingNew, setIsFetchingNew] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [recentlyAdded, setRecentlyAdded] = useState(new Set());

    // Modal state
    const [selectedGst, setSelectedGst] = useState(null);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const data = await apiClient.getDetails();
            setGstList(data);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to connect to backend.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [forceRefreshFlag]);

    const handleFetchNewGst = async (e) => {
        e.preventDefault();
        setFetchError('');
        if (!newGstInput.trim()) {
            setFetchError("Please enter at least one GSTIN.");
            return;
        }

        const gstins = newGstInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        if (gstins.length === 0) return;

        // GST Validation Regex
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
        const invalidGstins = gstins.filter(g => !gstRegex.test(g));

        if (invalidGstins.length > 0) {
            setFetchError(`Invalid GSTIN format: ${invalidGstins.join(', ')}`);
            return;
        }

        setIsFetchingNew(true);
        try {
            await apiClient.fetchGstDetails(gstins);
            const newSet = new Set(recentlyAdded);
            gstins.forEach(g => newSet.add(g));
            setRecentlyAdded(newSet);
            setNewGstInput('');
            setShowFetchModal(false);
            await fetchDashboardData();
        } catch (err) {
            setFetchError(err.message || 'Failed to fetch GST details from API.');
        } finally {
            setIsFetchingNew(false);
        }
    };

    const handleUpdateItemInList = (updatedItem) => {
        setGstList(prev => prev.map(item => item.gstin === updatedItem.gstin ? updatedItem : item));
        setSelectedGst(updatedItem);
    };

    const handleDeleteGstin = (deletedGstin) => {
        setGstList(prev => prev.filter(item => item.gstin !== deletedGstin));
    };

    const processedList = useMemo(() => {
        let list = [...gstList];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(g =>
                g.gstin.toLowerCase().includes(term) ||
                (g.tradeName && g.tradeName.toLowerCase().includes(term)) ||
                (g.legalName && g.legalName.toLowerCase().includes(term))
            );
        }

        return list.sort((a, b) => {
            const aIsFirstFetch = a.scoreVersion === 1;
            const bIsFirstFetch = b.scoreVersion === 1;

            if (aIsFirstFetch && !bIsFirstFetch) return -1;
            if (!aIsFirstFetch && bIsFirstFetch) return 1;

            const aIsNew = recentlyAdded.has(a.gstin);
            const bIsNew = recentlyAdded.has(b.gstin);
            if (aIsNew && !bIsNew) return -1;
            if (!aIsNew && bIsNew) return 1;

            if (a.scoreCalculatedAt && b.scoreCalculatedAt) {
                return new Date(b.scoreCalculatedAt) - new Date(a.scoreCalculatedAt);
            }
            return a.gstin.localeCompare(b.gstin);
        });
    }, [gstList, searchTerm, recentlyAdded]);

    if (loading && gstList.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
            </div>
        );
    }

    return (
        <div>
            {error && <div className="card" style={{ backgroundColor: 'var(--danger-color)', color: 'white', marginBottom: '2rem' }}>{error}</div>}

            <div className="dashboard-header card">
                <button className="btn btn-primary" onClick={() => { setShowFetchModal(true); setFetchError(''); setNewGstInput(''); }} style={{ whiteSpace: 'nowrap' }}>
                    <Plus size={18} /> Fetch New GST
                </button>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="search-bar">
                        <div style={{ position: 'relative', width: '100%' }}>
                            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Filter by GSTIN or Name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.5rem' }}
                            />
                        </div>
                    </div>
                    <div className="view-toggle">
                        <button
                            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                        <button
                            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Card View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="gst-table-wrapper card" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                    <table className="gst-table" style={{ minWidth: '700px' }}>
                        <thead>
                            <tr>
                                <th>GSTIN</th>
                                <th style={{ textAlign: 'center', width: '100px' }}>GRC Score</th>
                                <th>Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedList.length > 0 ? (
                                processedList.map((gst, index) => (
                                    <tr
                                        key={gst.gstin}
                                        className={`gst-table-row ${gst.scoreVersion === 1 ? 'first-fetch-item' : recentlyAdded.has(gst.gstin) ? 'new-item' : ''}`}
                                        onClick={() => setSelectedGst(gst)}
                                    >
                                        <td className="gstin-cell" style={{ whiteSpace: 'nowrap' }}>
                                            {gst.gstin}
                                            {gst.scoreVersion === 1 && <span className="first-fetch-badge">NEW API DATA</span>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`score-badge score-badge-sm ${getScoreColor(gst.grcScore)}`} style={{ margin: '0 auto' }}>
                                                {gst.grcScore !== null ? gst.grcScore : '-'}
                                            </span>
                                        </td>
                                        <td style={{ minWidth: '250px' }}>{gst.tradeName || gst.legalName || 'N/A'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                                        No GST numbers found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="gst-grid">
                    {processedList.length > 0 ? (
                        processedList.map(gst => (
                            <GstCard
                                key={gst.gstin}
                                gst={gst}
                                isNew={recentlyAdded.has(gst.gstin)}
                                isFirstFetch={gst.scoreVersion === 1}
                                onClick={setSelectedGst}
                            />
                        ))
                    ) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                            <p>No GST numbers found matching your criteria.</p>
                        </div>
                    )}
                </div>
            )}

            {selectedGst && (
                <GstDetailsModal
                    gst={selectedGst}
                    onClose={() => setSelectedGst(null)}
                    onUpdate={handleUpdateItemInList}
                    onDelete={handleDeleteGstin}
                />
            )}

            {showFetchModal && (
                <div className="modal-overlay" onClick={() => !isFetchingNew && setShowFetchModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Fetch New GST Details</h2>
                            <button className="close-btn" onClick={() => !isFetchingNew && setShowFetchModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {fetchError && (
                                <div style={{ color: 'white', backgroundColor: 'var(--danger-color)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                    <AlertCircle size={18} style={{ flexShrink: 0 }} /> {fetchError}
                                </div>
                            )}
                            <form onSubmit={handleFetchNewGst}>
                                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ marginBottom: '0.5rem', display: 'block', fontWeight: '500' }}>Enter GSTIN (comma separated for multiple):</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. 06ACUPK1294L2ZZ"
                                        value={newGstInput}
                                        onChange={e => {
                                            setNewGstInput(e.target.value.toUpperCase());
                                            setFetchError('');
                                        }}
                                        autoFocus
                                    />
                                    <small style={{ color: 'var(--text-light)', display: 'block', marginTop: '0.5rem' }}>
                                        Must be a valid 15-character GST number.
                                    </small>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowFetchModal(false)} disabled={isFetchingNew}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={isFetchingNew || !newGstInput.trim()}>
                                        {isFetchingNew ? <span className="spinner" style={{ width: '16px', height: '16px' }}></span> : 'Fetch & Save'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
