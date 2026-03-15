import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, List, LayoutGrid, Edit3, Trash2, X, AlertCircle, RefreshCw, Eye, Copy, Check } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import GstCard from './GstCard';
import GstDetailsModal from './GstDetailsModal';
import GstQuickEditRow from './GstQuickEditRow';

const getScoreColor = (score, thresholds) => {
    if (score === null || score === undefined) return '';
    const red = thresholds?.COLOR_RED_THRESHOLD ?? 30;
    const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;
    
    if (score > red) return 'score-red';
    if (score >= yellow) return 'score-yellow';
    return 'score-green';
};

const Dashboard = ({ forceRefreshFlag, currentUser }) => {
    const [gstList, setGstList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState(currentUser ? 'edit' : 'grid'); // 'edit', 'list', or 'grid' (Guest defaults to grid)
    const [thresholds, setThresholds] = useState({});

    // Search and Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [scoreFilter, setScoreFilter] = useState('all'); // 'all', 'good', 'okay', 'watch'

    // New GST Feature
    const [showFetchModal, setShowFetchModal] = useState(false);
    const [copiedGstin, setCopiedGstin] = useState(null);
    const [newGstInput, setNewGstInput] = useState('');
    const [isFetchingNew, setIsFetchingNew] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [recentlyAdded, setRecentlyAdded] = useState(new Set());

    // Modal state
    const [selectedGst, setSelectedGst] = useState(null);

    const handleCopy = (gstin) => {
        navigator.clipboard.writeText(gstin);
        setCopiedGstin(gstin);
        setTimeout(() => setCopiedGstin(null), 2000);
    };

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [data, config] = await Promise.all([
                apiClient.getDetails(),
                apiClient.getRuleConfig()
            ]);
            setGstList(data);
            
            const configMap = {};
            config.forEach(item => configMap[item.configKey] = item.configValue);
            setThresholds(configMap);
            
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to connect to backend.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        // If logged out, force grid view
        if (!currentUser) {
            setViewMode('grid');
        }
    }, [forceRefreshFlag, currentUser]);

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
        // If modal should be opened or if it is already open for this item, update it
        if (updatedItem._openModal || (selectedGst && selectedGst.gstin === updatedItem.gstin)) {
            const { _openModal, ...cleanItem } = updatedItem;
            setSelectedGst(cleanItem);
        }
    };

    const handleDeleteGstin = (deletedGstin) => {
        setGstList(prev => prev.filter(item => item.gstin !== deletedGstin));
    };

    const handleRecalculateAll = async () => {
        if (!window.confirm('Recalculate all GRC scores? This may take a moment.')) return;

        setLoading(true);
        try {
            await apiClient.recalculateAll();
            await fetchDashboardData();
        } catch (err) {
            setError(err.message || 'Failed to recalculate all scores');
        } finally {
            setLoading(false);
        }
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

        if (scoreFilter !== 'all') {
            const redThreshold = thresholds?.COLOR_RED_THRESHOLD ?? 30;
            const yellowThreshold = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;

            list = list.filter(g => {
                if (g.grcScore === null || g.grcScore === undefined) return false;
                if (scoreFilter === 'watch') return g.grcScore > redThreshold;
                if (scoreFilter === 'okay') return g.grcScore >= yellowThreshold && g.grcScore <= redThreshold;
                if (scoreFilter === 'good') return g.grcScore < yellowThreshold;
                return true;
            });
        }

        return list.sort((a, b) => {
            if (a.scoreCalculatedAt && b.scoreCalculatedAt) {
                return new Date(b.scoreCalculatedAt) - new Date(a.scoreCalculatedAt);
            }
            return a.gstin.localeCompare(b.gstin);
        });
    }, [gstList, searchTerm, scoreFilter, thresholds]);

    // Filter the list into Dummy (15 score) and Normal
    const dummyList = useMemo(() => processedList.filter(g => g.updatedBy === 'Dummy'), [processedList]);
    const normalList = useMemo(() => processedList.filter(g => g.updatedBy !== 'Dummy'), [processedList]);

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

            <div className="dashboard-header card" style={{ padding: '0.6rem 1rem', marginBottom: '1rem' }}>
                {currentUser && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-primary" onClick={() => { setShowFetchModal(true); setFetchError(''); setNewGstInput(''); }} style={{ whiteSpace: 'nowrap' }}>
                            <Plus size={18} /> Fetch New GST
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={handleRecalculateAll}
                            style={{ whiteSpace: 'nowrap' }}
                            disabled={loading}
                        >
                            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Recalculate All
                        </button>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="search-bar">
                        <div style={{ position: 'relative', width: '100% ' }}>
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
                    {currentUser && (
                        <div className="view-toggle">
                            <button
                                className={`view-toggle-btn ${viewMode === 'edit' ? 'active' : ''}`}
                                onClick={() => setViewMode('edit')}
                                title="Quick Edit View"
                            >
                                <Edit3 size={18} />
                            </button>
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
                    )}
                </div>
            </div>

            {/* Score Filter Buttons */}
            <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                marginBottom: '1rem', 
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <button 
                    onClick={() => setScoreFilter('all')}
                    className={`btn ${scoreFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                    All
                </button>
                <button 
                    onClick={() => setScoreFilter(scoreFilter === 'watch' ? 'all' : 'watch')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                        padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                        border: scoreFilter === 'watch' ? '2px solid var(--danger-color)' : '1px solid var(--border-color)',
                        backgroundColor: scoreFilter === 'watch' ? 'rgba(239, 68, 68, 0.1)' : 'white',
                        fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                    }}
                >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--danger-color)' }}></span>
                    <span>{'>'}30 Under WatchList</span>
                </button>
                <button 
                    onClick={() => setScoreFilter(scoreFilter === 'okay' ? 'all' : 'okay')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                        padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                        border: scoreFilter === 'okay' ? '2px solid var(--warning-color)' : '1px solid var(--border-color)',
                        backgroundColor: scoreFilter === 'okay' ? 'rgba(234, 179, 8, 0.1)' : 'white',
                        fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                    }}
                >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--warning-color)' }}></span>
                    <span>20-30 Okay</span>
                </button>
                <button 
                    onClick={() => setScoreFilter(scoreFilter === 'good' ? 'all' : 'good')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                        padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                        border: scoreFilter === 'good' ? '2px solid var(--success-color)' : '1px solid var(--border-color)',
                        backgroundColor: scoreFilter === 'good' ? 'rgba(34, 197, 94, 0.1)' : 'white',
                        fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                    }}
                >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--success-color)' }}></span>
                    <span>{'<'}20 Good</span>
                </button>
                
                {scoreFilter !== 'all' && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginLeft: '0.5rem' }}>
                        Filtering: <strong>{processedList.length}</strong> items found
                    </span>
                )}
            </div>

            {/* Dummy Score Section */}
            {dummyList.length > 0 && viewMode !== 'grid' && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        background: 'linear-gradient(135deg, #7c3a00 0%, #3d1f00 100%)',
                        border: '1px solid #f97316',
                        borderRadius: '8px 8px 0 0',
                        padding: '0.65rem 1rem',
                    }}>
                        <AlertCircle size={18} style={{ color: '#f97316', flexShrink: 0 }} />
                        <span style={{ color: '#fed7aa', fontWeight: 600, fontSize: '0.95rem' }}>
                            Dummy Score GSTs ({dummyList.length}) - Details pending
                        </span>
                    </div>

                    {viewMode === 'list' ? (
                        <div className="gst-table-wrapper card" style={{ padding: 0, overflowX: 'auto', borderRadius: '0 0 8px 8px', border: '1px solid #f97316', borderTop: 'none' }}>
                            <table className="gst-table" style={{ minWidth: '700px' }}>
                                <thead style={{ background: 'rgba(249,115,22,0.12)' }}>
                                    <tr>
                                        <th style={{ width: '40px' }}>#</th>
                                        <th>GSTIN</th>
                                        <th>Trade Name</th>
                                        <th style={{ textAlign: 'center', width: '100px' }}>Score</th>
                                        <th>Last Updated On</th>
                                        <th>Last Updated By</th>
                                        <th style={{ textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dummyList.map((gst, index) => (
                                        <tr key={gst.gstin}
                                            style={{ background: 'rgba(249,115,22,0.05)' }}
                                        >
                                            <td style={{ color: 'var(--text-light)', fontWeight: 500, textAlign: 'center' }}>{index + 1}</td>
                                            <td className="gstin-cell" style={{ whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {gst.gstin}
                                                    <button 
                                                        className="ghost-btn" 
                                                        onClick={() => handleCopy(gst.gstin)}
                                                        title="Copy GSTIN"
                                                        style={{ padding: '0.2rem', color: copiedGstin === gst.gstin ? 'var(--success-color)' : 'var(--text-light)' }}
                                                    >
                                                        {copiedGstin === gst.gstin ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                {gst.tradeName || gst.legalName || 'N/A'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`score-badge score-badge-sm ${getScoreColor(gst.grcScore, thresholds)}`} style={{ margin: '0 auto' }}>
                                                    {gst.grcScore ?? '-'}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-light)' }}>
                                                {gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Never'}
                                            </td>
                                            <td style={{ color: 'var(--primary-color)', fontWeight: 500 }}>
                                                {gst.updatedBy || '-'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button 
                                                    className="btn btn-sm btn-secondary" 
                                                    onClick={() => setSelectedGst(gst)}
                                                    title="View Details"
                                                    style={{ padding: '0.3rem' }}
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="gst-grid" style={{ 
                            border: '1px solid #f97316', 
                            borderTop: 'none', 
                            borderRadius: '0 0 8px 8px', 
                            padding: '1.25rem',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1rem'
                        }}>
                            {dummyList.map((gst, index) => (
                                <div key={gst.gstin}
                                    style={{
                                        background: 'rgba(249,115,22,0.05)',
                                        border: '1px solid rgba(249,115,22,0.3)',
                                        borderRadius: '12px', 
                                        padding: '0.85rem 1rem',
                                        display: 'flex',
                                        flexDirection: 'column', 
                                        gap: '0.6rem',
                                        boxShadow: '0 2px 4px rgba(249,115,22,0.1)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                            <span style={{ color: '#f97316', fontWeight: 600, fontSize: '0.8rem' }}>#{index + 1}</span>
                                            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fed7aa', letterSpacing: '0.5px' }}>{gst.gstin}</span>
                                        </div>
                                        <div className={`score-badge ${getScoreColor(gst.grcScore, thresholds)}`} style={{ 
                                            fontSize: '1rem', 
                                            fontWeight: 700,
                                            padding: '0.2rem 0.6rem',
                                            minWidth: '36px',
                                            textAlign: 'center'
                                        }}>
                                            {gst.grcScore ?? '-'}
                                        </div>
                                    </div>
                                    
                                    <div style={{ height: '1px', background: 'rgba(249,115,22,0.2)' }}></div>

                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: '1.2fr 1fr', 
                                        gap: '0.4rem 0.5rem', 
                                        fontSize: '0.8rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '0.5rem' }}>
                                            <span style={{ color: '#fdba74', opacity: 0.9 }}>Status:</span>
                                            <span style={{ color: '#fed7aa', fontWeight: 600 }}>{gst.gstStatus || 'N/A'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#fdba74', opacity: 0.9 }}>Turnover:</span>
                                            <span style={{ color: '#fed7aa', fontWeight: 600 }}>
                                                {(!gst.aggregateTurnover || gst.aggregateTurnover === "0" || gst.aggregateTurnover === 0) 
                                                    ? 'N/A' 
                                                    : `${gst.aggregateTurnover} Cr+`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '0.5rem' }}>
                                            <span style={{ color: '#fdba74', opacity: 0.9 }}>Age:</span>
                                            <span style={{ color: '#fed7aa', fontWeight: 600 }}>{gst.registrationDate ? 'Pending' : 'N/A'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#fdba74', opacity: 0.9 }}>Type:</span>
                                            <span style={{ color: '#fed7aa', fontWeight: 600 }}>{gst.gstType ? gst.gstType.split(' ')[0] : 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '0.4rem', borderTop: '1px dashed rgba(249,115,22,0.3)', paddingTop: '0.4rem', fontSize: '0.7rem', color: '#fed7aa', opacity: 0.8, display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Updated:</span>
                                        <span>{gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#fdba74', opacity: 0.7, fontStyle: 'italic' }}>
                                            Details Pending
                                        </span>
                                        <button 
                                            className="btn btn-sm" 
                                            onClick={() => setSelectedGst(gst)}
                                            style={{ 
                                                padding: '0.25rem 0.5rem', 
                                                background: 'transparent', 
                                                border: '1px solid rgba(249,115,22,0.4)',
                                                color: '#fed7aa',
                                                fontSize: '0.75rem',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            <Eye size={14} style={{ marginRight: '4px' }} /> View
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : ( 

                        <div style={{ border: '1px solid #f97316', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '1rem' }}>
                            {dummyList.map((gst, index) => (
                                <GstQuickEditRow
                                    key={gst.gstin}
                                    index={index + 1}
                                    gst={gst}
                                    getScoreColor={(score) => getScoreColor(score, thresholds)}
                                    onUpdate={handleUpdateItemInList}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'list' ? (
                <div className="gst-table-wrapper card" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                    <table className="gst-table" style={{ minWidth: '700px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th>GSTIN</th>
                                <th>Trade Name</th>
                                <th style={{ textAlign: 'center' }}>GRC Score</th>
                                <th>Last Updated On</th>
                                <th>Last Updated By</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {normalList.length > 0 ? (
                                normalList.map((gst, index) => (
                                    <tr
                                        key={gst.gstin}
                                        className={`gst-table-row ${recentlyAdded.has(gst.gstin) ? 'new-item' : ''}`}
                                    >
                                        <td style={{ color: 'var(--text-light)', fontWeight: 500, textAlign: 'center' }}>{index + 1}</td>
                                        <td className="gstin-cell" style={{ whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {gst.gstin}
                                                <button 
                                                    className="ghost-btn" 
                                                    onClick={() => handleCopy(gst.gstin)}
                                                    title="Copy GSTIN"
                                                    style={{ padding: '0.2rem', color: copiedGstin === gst.gstin ? 'var(--success-color)' : 'var(--text-light)' }}
                                                >
                                                    {copiedGstin === gst.gstin ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            {gst.tradeName || gst.legalName || 'N/A'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`score-badge score-badge-sm ${getScoreColor(gst.grcScore, thresholds)}`} style={{ margin: '0 auto' }}>
                                                {gst.grcScore !== null ? gst.grcScore : '-'}
                                            </span>
                                        </td>
                                        <td>
                                            {gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Never'}
                                        </td>
                                        <td>
                                            {gst.updatedBy || '-'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button 
                                                className="btn btn-sm btn-secondary" 
                                                onClick={() => setSelectedGst(gst)}
                                                title="View Details"
                                                style={{ padding: '0.3rem' }}
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                                        {processedList.length === 0 ? 'No GST numbers found matching your criteria.' : 'All entries have dummy scores - fill in details using "Quick Edit" or the modal.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="gst-grid">
                    {normalList.length > 0 ? (
                        normalList.map((gst, index) => (
                            <GstCard
                                key={gst.gstin}
                                gst={gst}
                                index={index + 1}
                                isNew={recentlyAdded.has(gst.gstin)}
                                isFirstFetch={false}
                                onClick={setSelectedGst}
                                thresholds={thresholds}
                            />
                        ))
                    ) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                            <p>No GST numbers found matching your criteria.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="gst-quick-edit-list">
                    {normalList.length > 0 ? (
                        normalList.map((gst, index) => (
                            <GstQuickEditRow
                                key={gst.gstin}
                                index={index + 1}
                                gst={gst}
                                getScoreColor={(score) => getScoreColor(score, thresholds)}
                                onUpdate={handleUpdateItemInList}
                            />
                        ))
                    ) : (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
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
                    currentUser={currentUser}
                    thresholds={thresholds}
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
