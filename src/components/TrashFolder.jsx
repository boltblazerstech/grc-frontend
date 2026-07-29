import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

function TrashFolder({ currentUser }) {
  const [trashedGsts, setTrashedGsts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTrashed();
  }, []);

  const fetchTrashed = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.getTrashedGstins();
      setTrashedGsts(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch trashed GSTINs');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (gstin) => {
    if (!window.confirm(`Are you sure you want to restore GSTIN: ${gstin}?`)) return;
    try {
      await apiClient.restoreGstin(gstin);
      alert('GSTIN restored successfully');
      fetchTrashed();
    } catch (err) {
      alert(err.message || 'Failed to restore GSTIN');
    }
  };

  if (currentUser?.role !== 'super_admin') {
    return <div className="p-4" style={{ color: 'var(--text-color)' }}>Access denied. You must be an admin to view the trash folder.</div>;
  }

  return (
    <div className="admin-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.5rem' }}>🗑️</span> Trash Folder
      </h2>
      
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
        </div>
      ) : trashedGsts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--card-bg)', borderRadius: '8px', color: 'var(--text-light)' }}>
          <p style={{ fontSize: '1.1rem' }}>The trash folder is empty.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <table className="gst-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>GSTIN</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Trade Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>GST Status</th>
                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trashedGsts.map(gst => (
                <tr key={gst.gstin} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}><strong>{gst.gstin}</strong></td>
                  <td style={{ padding: '1rem' }}>{gst.tradeName || '-'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`status-badge ${gst.gstStatus?.toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}`} style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '999px', 
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      backgroundColor: gst.gstStatus?.toLowerCase() === 'active' ? '#dcfce7' : '#f3f4f6',
                      color: gst.gstStatus?.toLowerCase() === 'active' ? '#166534' : '#4b5563'
                    }}>
                      {gst.gstStatus || 'Unknown'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleRestore(gst.gstin)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#2563eb'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = '#3b82f6'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 14 4 9 9 4"></polyline>
                        <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                      </svg>
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TrashFolder;
