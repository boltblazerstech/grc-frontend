import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { Check, X, History, Sparkles, AlertCircle } from 'lucide-react';

const Gstr7ReviewPage = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [actioningId, setActioningId] = useState(null);
    const [editRecords, setEditRecords] = useState({});

    useEffect(() => { fetchReviews(); }, []);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getPendingReviews();
            setReviews(data);
            const initialEdits = {};
            data.forEach(r => {
                try { initialEdits[r.id] = JSON.parse(r.parsedData); } 
                catch (e) { initialEdits[r.id] = []; }
            });
            setEditRecords(initialEdits);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleApprove = async (review) => {
        setActioningId(review.id);
        try {
            const records = editRecords[review.id] || [];
            await apiClient.approveReview(review.id, records);
            setSuccess(`Review for ${review.gstin} approved and saved to DB!`);
            fetchReviews();
        } catch (err) { setError('Approval failed: ' + err.message); }
        finally { setActioningId(null); }
    };

    const handleReject = async (id) => {
        if (!window.confirm('Are you sure you want to reject this submission?')) return;
        setActioningId(id);
        try {
            await apiClient.rejectReview(id);
            setSuccess(`Review rejected.`);
            fetchReviews();
        } catch (err) { setError('Rejection failed: ' + err.message); }
        finally { setActioningId(null); }
    };

    const handleDateChange = (reviewId, index, newDate) => {
        setEditRecords(prev => {
            const newArr = [...(prev[reviewId] || [])];
            newArr[index] = { ...newArr[index], dateOfFiling: newDate || null };
            return { ...prev, [reviewId]: newArr };
        });
    };

    const handleRemoveRow = (reviewId, index) => {
        setEditRecords(prev => {
            const newArr = [...(prev[reviewId] || [])];
            newArr.splice(index, 1);
            return { ...prev, [reviewId]: newArr };
        });
    };

    const fmtDate = (d) => new Date(d).toLocaleString();

    if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner"></div></div>;

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={24} /> GSTR-7 Pending Reviews
                </h2>
                <button className="btn btn-secondary" onClick={fetchReviews}>Refresh</button>
            </div>

            {error && <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
            {success && <div style={{ background: '#d4edda', color: '#155724', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{success}</div>}

            {reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <Check size={48} color="#28a745" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ margin: 0, color: 'var(--text-color)' }}>All caught up!</h3>
                    <p style={{ color: 'var(--text-light)', marginTop: '0.5rem' }}>There are no pending GSTR-7 submissions to review.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {reviews.map(rev => {
                        const records = editRecords[rev.id] || [];
                        
                        return (
                            <div key={rev.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                                <div style={{ background: '#f8f9fa', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-color)' }}>GSTIN: {rev.gstin}</h3>
                                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                                            Submitted by <strong>{rev.submittedBy || 'Unknown'}</strong> on {fmtDate(rev.submittedAt)}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={() => handleApprove(rev)} 
                                            disabled={actioningId === rev.id}
                                            style={{ background: '#28a745', borderColor: '#28a745', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {actioningId === rev.id ? <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <Check size={16} />}
                                            Approve & Save
                                        </button>
                                        <button 
                                            className="btn btn-secondary" 
                                            onClick={() => handleReject(rev.id)} 
                                            disabled={actioningId === rev.id}
                                            style={{ color: '#dc3545', borderColor: '#dc3545', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <X size={16} /> Reject
                                        </button>
                                    </div>
                                </div>
                                <div style={{ padding: '1.5rem' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parsed Data to be Saved</h4>
                                    {records.length > 0 ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ background: '#f8f9fa' }}>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Return Period</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Date of Filing</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)', width: '40px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {records.map((p, i) => (
                                                    <tr key={i}>
                                                        <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>{p.returnPeriod}</td>
                                                        <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                                            <input 
                                                                type="date" 
                                                                value={p.dateOfFiling || ''} 
                                                                onChange={(e) => handleDateChange(rev.id, i, e.target.value)}
                                                                style={{ padding: '0.35rem', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem', outline: 'none' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                                            <button onClick={() => handleRemoveRow(rev.id, i)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', padding: '0.2rem' }} title="Remove Record">
                                                                <X size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p style={{ margin: 0, color: 'var(--text-light)' }}>No records extracted.</p>
                                    )}
                                    
                                    <div style={{ marginTop: '1.5rem', background: '#fff3cd', color: '#856404', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <AlertCircle size={16} />
                                        <span>Approving this will overwrite the existing GSTR-7 filing history for <strong>{rev.gstin}</strong>.</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Gstr7ReviewPage;
