import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { Save, ChevronDown, ChevronUp, FileText, Settings, Plus, Trash2 } from 'lucide-react';

const Gstr7Management = () => {
    const [pansData, setPansData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedPan, setExpandedPan] = useState(null);
    const [editState, setEditState] = useState({});
    const [hsnInputs, setHsnInputs] = useState({});
    const [savingHsn, setSavingHsn] = useState(null);
    const [savingGstd, setSavingGstd] = useState(null);
    const [savingGstinRow, setSavingGstinRow] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [showHsnMaster, setShowHsnMaster] = useState(false);
    const [hsnMaster, setHsnMaster] = useState([]);
    const [newHsn, setNewHsn] = useState('');
    const [newHsnDesc, setNewHsnDesc] = useState('');
    const [savingNewHsn, setSavingNewHsn] = useState(false);

    useEffect(() => {
        fetchData();
        fetchHsnMaster();
    }, []);

    const fetchHsnMaster = async () => {
        try {
            const data = await apiClient.getGstr7HsnMaster();
            setHsnMaster(data);
        } catch (err) {
            console.error('Failed to fetch HSN master', err);
        }
    };

    const isValidGstin = (gstin) => {
        const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        return regex.test(gstin.toUpperCase());
    };

    const showSuccess = (msg) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const fetchData = async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            const data = await apiClient.getPanGstr7Data();
            setPansData(data);

            const initialHsn = {};
            data.forEach(p => {
                initialHsn[p.panNumber] = p.hsnCode || '';
            });
            // Update only the inputs that haven't been touched yet, 
            // or just refresh all if we want to ensure consistency. 
            // We'll update the state based on the fetched data, but keep current unsaved edits where possible.
            setHsnInputs(prev => {
                const merged = { ...initialHsn };
                // Optionally keep unsaved changes by looping over prev. 
                // But simple replacement is fine if we just want to avoid the full page spinner.
                return merged;
            });
        } catch (err) {
            setError(err.message);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const handleExpand = (panObj) => {
        if (expandedPan === panObj.panNumber) {
            setExpandedPan(null);
        } else {
            setExpandedPan(panObj.panNumber);
            const initialState = { gstins: {} };
            panObj.gstins.forEach(g => {
                initialState.gstins[g.gstin] = {
                    gstdNo: g.gstdNo || '',
                    status: g.gstr7Status || 'Regular',
                    delayCount: g.gstr7DelayCount || 0
                };
            });
            setEditState({ [panObj.panNumber]: initialState });
        }
    };

    const handleHsnChange = (pan, val) => {
        setHsnInputs(prev => ({ ...prev, [pan]: val }));
    };

    const handleSaveHsn = async (pan) => {
        try {
            setSavingHsn(pan);
            setError(null);
            await apiClient.saveHsn(pan, hsnInputs[pan]);
            showSuccess(`HSN code saved for PAN ${pan}`);
            fetchData(false);
        } catch (err) {
            setError('Failed to save HSN: ' + err.message);
        } finally {
            setSavingHsn(null);
        }
    };

    const handleGstinChange = (pan, gstin, field, val) => {
        setEditState(prev => ({
            ...prev,
            [pan]: {
                ...prev[pan],
                gstins: {
                    ...prev[pan].gstins,
                    [gstin]: {
                        ...prev[pan].gstins[gstin],
                        [field]: val
                    }
                }
            }
        }));
    };

    const handleSaveGstd = async (pan, gstin) => {
        try {
            const state = editState[pan];
            if (!state) return;
            const gState = state.gstins[gstin];
            const newGstd = gState.gstdNo.trim().toUpperCase();

            if (newGstd !== '' && !isValidGstin(newGstd)) {
                throw new Error(`Invalid GSTD format for GSTIN ${gstin}.`);
            }

            setSavingGstd(gstin);
            setError(null);
            await apiClient.markUnmarkGstd(gstin, newGstd);
            showSuccess(`GSTD No. saved for ${gstin}`);
            fetchData(false);
        } catch (err) {
            setError('Failed to save GSTD: ' + err.message);
        } finally {
            setSavingGstd(null);
        }
    };

    // Save both GSTD No. and GSTR-7 filing details for a single GSTIN row
    const handleSaveGstinRow = async (pan, g) => {
        try {
            const state = editState[pan];
            if (!state) return;
            const gState = state.gstins[g.gstin];
            const currentGstd = g.gstdNo || '';
            const newGstd = gState.gstdNo.trim().toUpperCase();

            if (newGstd !== '' && !isValidGstin(newGstd)) {
                throw new Error(`Invalid GSTD format: "${newGstd}" must match GSTIN format (e.g. 27XXXXX0000X1ZX).`);
            }

            setSavingGstinRow(g.gstin);
            setError(null);

            // Save GSTD No. if changed
            if (currentGstd !== newGstd) {
                await apiClient.markUnmarkGstd(g.gstin, newGstd);
            }

            // Save GSTR-7 filing status if GSTD is set
            if (newGstd) {
                await apiClient.updateGstr7Status(
                    g.gstin,
                    gState.status,
                    gState.status === 'Delayed' ? parseInt(gState.delayCount || 0, 10) : 0
                );
            }

            showSuccess(`Saved GSTR-7 config for ${g.gstin}`);
            fetchData(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingGstinRow(null);
        }
    };

    const handleAddHsnMaster = async () => {
        if (!newHsn.trim()) return;
        try {
            setSavingNewHsn(true);
            await apiClient.addGstr7HsnMaster(newHsn.trim(), newHsnDesc.trim());
            setNewHsn('');
            setNewHsnDesc('');
            fetchHsnMaster();
            showSuccess('HSN added to master list');
        } catch (err) {
            setError('Failed to add HSN: ' + err.message);
        } finally {
            setSavingNewHsn(false);
        }
    };

    const handleDeleteHsnMaster = async (code) => {
        if (!window.confirm(`Remove HSN ${code} from GSTR-7 master list?`)) return;
        try {
            await apiClient.deleteGstr7HsnMaster(code);
            fetchHsnMaster();
            showSuccess('HSN removed from master list');
        } catch (err) {
            setError('Failed to delete HSN: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>GSTR-7 Management</h3>
                <button 
                    className="btn btn-secondary"
                    onClick={() => setShowHsnMaster(!showHsnMaster)}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                    <Settings size={14} style={{ marginRight: '6px' }} />
                    {showHsnMaster ? 'Back to PANs' : 'Manage GSTR-7 HSN Codes'}
                </button>
            </div>

            {showHsnMaster ? (
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h4 style={{ marginTop: 0, color: 'var(--primary-color)' }}>Master GSTR-7 HSN Codes</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                        Define HSN codes that require GSTR-7 configuration. If a PAN is associated with any of these codes, 
                        the "Manage GSTR-7" option will be available for it.
                    </p>

                    <div style={{ 
                        backgroundColor: 'var(--bg-alt-color)', 
                        padding: '1rem', 
                        borderRadius: 'var(--border-radius)',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'flex-end'
                    }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>HSN Code</label>
                            <input 
                                type="text"
                                className="form-control"
                                value={newHsn}
                                onChange={(e) => setNewHsn(e.target.value)}
                                placeholder="e.g. 7204"
                            />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>Description (Optional)</label>
                            <input 
                                type="text"
                                className="form-control"
                                value={newHsnDesc}
                                onChange={(e) => setNewHsnDesc(e.target.value)}
                                placeholder="Enter description"
                            />
                        </div>
                        <button 
                            className="btn btn-primary"
                            onClick={handleAddHsnMaster}
                            disabled={savingNewHsn || !newHsn}
                            style={{ height: '38px' }}
                        >
                            <Plus size={16} /> Add HSN
                        </button>
                    </div>

                    <table className="gst-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>HSN Code</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hsnMaster.map((item) => (
                                <tr key={item.hsnCode}>
                                    <td style={{ fontWeight: 600 }}>{item.hsnCode}</td>
                                    <td>{item.description || <span style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>No description</span>}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button 
                                            className="btn btn-danger"
                                            onClick={() => handleDeleteHsnMaster(item.hsnCode)}
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                        >
                                            <Trash2 size={14} /> Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {hsnMaster.length === 0 && (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                                        No HSN codes configured for GSTR-7.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <>
                    {error && (
                        <div style={{
                            color: 'white',
                            backgroundColor: 'var(--danger-color)',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--border-radius)',
                            marginBottom: '1rem',
                            fontSize: '0.9rem'
                        }}>
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div style={{
                            color: 'white',
                            backgroundColor: 'var(--success-color)',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--border-radius)',
                            marginBottom: '1rem',
                            fontSize: '0.9rem'
                        }}>
                            {successMsg}
                        </div>
                    )}


            <div className="card">
                <div className="gst-table-wrapper" style={{ overflowX: 'auto' }}>
                    <table className="gst-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '50px' }}>#</th>
                                <th>PAN Number</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>GSTINs</th>
                                <th>HSN Code</th>
                                <th style={{ width: '140px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pansData.map((panObj, index) => {
                                const isExpanded = expandedPan === panObj.panNumber;
                                const currentState = editState[panObj.panNumber];
                                const hsnVal = hsnInputs[panObj.panNumber] || '';
                                const isApplicable = panObj.isApplicable || (panObj.hsnCode && hsnMaster.some(m => m.hsnCode === panObj.hsnCode));

                                return (
                                    <React.Fragment key={panObj.panNumber}>
                                        {/* ── Main PAN Row ── */}
                                        <tr style={{
                                            backgroundColor: isExpanded ? 'rgba(37, 150, 190, 0.06)' : (index % 2 === 0 ? 'transparent' : 'var(--bg-alt-color)')
                                        }}>
                                            <td style={{ color: 'var(--text-light)', fontWeight: 500 }}>
                                                {index + 1}
                                            </td>
                                            <td style={{ fontWeight: 600, fontFamily: "'Roboto Mono', monospace", fontSize: '0.85rem' }}>
                                                {panObj.panNumber}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    backgroundColor: 'var(--primary-color)',
                                                    color: 'white',
                                                    padding: '0.15rem 0.55rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600
                                                }}>
                                                    {panObj.gstins.length}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={hsnVal}
                                                        onChange={(e) => handleHsnChange(panObj.panNumber, e.target.value)}
                                                        placeholder="Enter HSN"
                                                        style={{
                                                            width: '120px',
                                                            padding: '0.35rem 0.6rem',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    />
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => handleSaveHsn(panObj.panNumber)}
                                                        disabled={savingHsn === panObj.panNumber}
                                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                                        title="Save HSN Code"
                                                    >
                                                        <Save size={14} />
                                                        {savingHsn === panObj.panNumber ? 'Saving...' : 'Save'}
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                {isApplicable ? (
                                                    <button
                                                        className="btn btn-secondary"
                                                        onClick={() => handleExpand(panObj)}
                                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                                    >
                                                        <FileText size={14} />
                                                        {isExpanded ? 'Hide' : 'Manage GSTR-7'}
                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                                                        {hsnVal ? 'N/A' : '—'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>

                                        {/* ── Expanded GSTR-7 Config Panel ── */}
                                        {isExpanded && currentState && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: 0, borderBottom: '2px solid var(--primary-color)' }}>
                                                    <div style={{
                                                        backgroundColor: '#f8fbfd',
                                                        padding: '1.25rem 1.5rem',
                                                        borderLeft: '3px solid var(--primary-color)'
                                                    }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            marginBottom: '1rem',
                                                            paddingBottom: '0.75rem',
                                                            borderBottom: '1px solid var(--border-color)'
                                                        }}>
                                                            <h4 style={{
                                                                margin: 0,
                                                                fontSize: '0.95rem',
                                                                color: 'var(--primary-color)'
                                                            }}>
                                                                GSTR-7 Configuration — PAN {panObj.panNumber}
                                                            </h4>
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                color: 'var(--text-light)',
                                                                backgroundColor: 'var(--new-item-bg)',
                                                                padding: '0.2rem 0.6rem',
                                                                borderRadius: '4px'
                                                            }}>
                                                                HSN 7204 — GSTD Applicable
                                                            </span>
                                                        </div>

                                                        {/* GSTIN sub-table */}
                                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                            <thead>
                                                                <tr style={{ backgroundColor: 'rgba(37, 150, 190, 0.08)' }}>
                                                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>GSTIN</th>
                                                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>GSTD No.</th>
                                                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Filing Status</th>
                                                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Delay Count</th>
                                                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Last Updated</th>
                                                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Action</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {panObj.gstins.map((g, gi) => {
                                                                    const gState = currentState.gstins[g.gstin];
                                                                    // Only allow filing status interaction if GSTD is actually saved in backend
                                                                    const savedGstd = g.gstdNo ? String(g.gstdNo) : '';
                                                                    const currentGstd = gState.gstdNo ? String(gState.gstdNo) : '';
                                                                    const hasGstd = savedGstd.trim() !== '';

                                                                     return (
                                                                        <tr key={g.gstin} style={{
                                                                            borderBottom: '1px solid var(--border-color)',
                                                                            backgroundColor: gi % 2 === 0 ? 'white' : '#fafcfd',
                                                                            verticalAlign: 'middle'
                                                                        }}>
                                                                            {/* GSTIN */}
                                                                            <td style={{
                                                                                padding: '0.75rem',
                                                                                fontFamily: "'Roboto Mono', monospace",
                                                                                fontSize: '0.82rem',
                                                                                fontWeight: 600,
                                                                                color: 'var(--primary-color)',
                                                                                whiteSpace: 'nowrap'
                                                                            }}>
                                                                                {g.gstin}
                                                                            </td>

                                                                            {/* GSTD No. */}
                                                                            <td style={{ padding: '0.75rem' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                                    <input
                                                                                        type="text"
                                                                                        className="form-control"
                                                                                        value={currentGstd}
                                                                                        onChange={(e) => handleGstinChange(panObj.panNumber, g.gstin, 'gstdNo', e.target.value)}
                                                                                        placeholder="Enter GSTD No."
                                                                                        style={{ width: '160px', padding: '0.35rem 0.6rem', fontSize: '0.83rem' }}
                                                                                    />
                                                                                    {currentGstd !== savedGstd && (
                                                                                        <button
                                                                                            className="btn btn-primary"
                                                                                            onClick={() => handleSaveGstd(panObj.panNumber, g.gstin)}
                                                                                            disabled={savingGstd === g.gstin}
                                                                                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                                                                            title="Save GSTD No."
                                                                                        >
                                                                                            <Save size={13} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </td>

                                                                            {/* Filing Status */}
                                                                            <td style={{ padding: '0.75rem' }}>
                                                                                {hasGstd ? (
                                                                                    <select
                                                                                        className="form-control"
                                                                                        value={gState.status}
                                                                                        onChange={(e) => handleGstinChange(panObj.panNumber, g.gstin, 'status', e.target.value)}
                                                                                        style={{ width: '130px', padding: '0.35rem 0.5rem', fontSize: '0.83rem' }}
                                                                                    >
                                                                                        <option value="Regular">✅ Regular</option>
                                                                                        <option value="Delayed">⚠️ Delayed</option>
                                                                                        <option value="Missed">❌ Missed</option>
                                                                                    </select>
                                                                                ) : (
                                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic' }}>Enter GSTD first</span>
                                                                                )}
                                                                            </td>

                                                                            {/* Delay Count */}
                                                                            <td style={{ padding: '0.75rem' }}>
                                                                                {hasGstd && gState.status === 'Delayed' ? (
                                                                                    <input
                                                                                        type="number"
                                                                                        className="form-control"
                                                                                        min="0"
                                                                                        value={gState.delayCount}
                                                                                        onChange={(e) => handleGstinChange(panObj.panNumber, g.gstin, 'delayCount', e.target.value)}
                                                                                        style={{ width: '70px', padding: '0.35rem 0.5rem', fontSize: '0.83rem' }}
                                                                                    />
                                                                                ) : (
                                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>—</span>
                                                                                )}
                                                                            </td>

                                                                            {/* Last Updated */}
                                                                            <td style={{
                                                                                padding: '0.75rem',
                                                                                fontSize: '0.75rem',
                                                                                color: 'var(--text-light)',
                                                                                whiteSpace: 'nowrap'
                                                                            }}>
                                                                                {g.gstr7LastUpdated
                                                                                    ? new Date(g.gstr7LastUpdated).toLocaleString()
                                                                                    : <span style={{ fontStyle: 'italic' }}>Never</span>}
                                                                            </td>

                                                                            {/* Per-row Save button */}
                                                                            <td style={{ padding: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                                <button
                                                                                    className="btn btn-primary"
                                                                                    onClick={() => handleSaveGstinRow(panObj.panNumber, g)}
                                                                                    disabled={savingGstinRow === g.gstin}
                                                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                                                                                    title="Save GSTD No. and filing details for this GSTIN"
                                                                                >
                                                                                    {savingGstinRow === g.gstin
                                                                                        ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', marginRight: '4px' }}></span>Saving...</>
                                                                                        : <><Save size={13} style={{ marginRight: '4px' }} />Save Config</>}
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>

                    {pansData.length === 0 && !loading && (
                        <div style={{
                            padding: '3rem',
                            textAlign: 'center',
                            color: 'var(--text-light)',
                            borderTop: '1px solid var(--border-color)'
                        }}>
                            No PAN records available.
                        </div>
                    )}
                </div>
            </div>
        </>
    )}
</div>
    );
};

export default Gstr7Management;
