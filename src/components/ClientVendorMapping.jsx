import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, Plus, Search, Trash2, Edit2, Upload, 
  Check, X, ExternalLink, ShieldCheck, AlertCircle, Image as ImageIcon,
  ChevronRight, RefreshCw, CheckSquare, Square, FileSpreadsheet,
  UploadCloud, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '../api/apiClient';

export default function ClientVendorMapping({ currentUser }) {
  // State for Clients
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');

  // State for Mapped Vendors
  const [mappedVendors, setMappedVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');

  // Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null); // null = Add, obj = Edit
  const [clientForm, setClientForm] = useState({ clientGstin: '', clientName: '', logoFile: null });
  const [logoPreview, setLogoPreview] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Map Vendors Modal
  const [showMapModal, setShowMapModal] = useState(false);
  const [allAvailableVendors, setAllAvailableVendors] = useState([]);
  const [allVendorsLoading, setAllVendorsLoading] = useState(false);
  const [assignedVendorsMap, setAssignedVendorsMap] = useState({});
  const [mapSearch, setMapSearch] = useState('');
  const [selectedGstinsToMap, setSelectedGstinsToMap] = useState(new Set());
  const [mappingSubmitting, setMappingSubmitting] = useState(false);

  // Import Sheet Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importParsing, setImportParsing] = useState(false);
  const [parsedImportData, setParsedImportData] = useState([]); // array of { clientName, clientGstin, vendors: [{name, gstin}], duplicateVendors: [] }
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [expandedClientIndex, setExpandedClientIndex] = useState(null);

  // Global Alert / Toast
  const [notification, setNotification] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Initial Load: Fetch Clients
  useEffect(() => {
    fetchClients();
  }, []);

  // Fetch Mapped Vendors when selectedClient changes
  useEffect(() => {
    if (selectedClient?.id) {
      fetchMappedVendors(selectedClient.id);
    } else {
      setMappedVendors([]);
    }
  }, [selectedClient?.id]);

  const fetchClients = async () => {
    setClientsLoading(true);
    try {
      const data = await apiClient.getClients();
      setClients(data || []);
      // If a client was previously selected, update its record
      if (selectedClient) {
        const updatedSelected = (data || []).find(c => c.id === selectedClient.id);
        if (updatedSelected) {
          setSelectedClient(updatedSelected);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to load clients', 'error');
    } finally {
      setClientsLoading(false);
    }
  };

  const fetchMappedVendors = async (clientId) => {
    setVendorsLoading(true);
    try {
      const data = await apiClient.getClientVendors(clientId);
      setMappedVendors(data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch mapped vendors', 'error');
    } finally {
      setVendorsLoading(false);
    }
  };

  // ── Client CRUD Handlers ──────────────────────────────────────────────────

  const openAddClientModal = () => {
    setEditingClient(null);
    setClientForm({ clientGstin: '', clientName: '', logoFile: null });
    setLogoPreview(null);
    setShowClientModal(true);
  };

  const openEditClientModal = (client, e) => {
    e?.stopPropagation();
    setEditingClient(client);
    setClientForm({
      clientGstin: client.clientGstin || '',
      clientName: client.clientName || '',
      logoFile: null
    });
    setLogoPreview(client.hasLogo ? apiClient.getClientLogoUrl(client.id) : null);
    setShowClientModal(true);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds the 2 MB limit.');
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      alert('Please upload a PNG, JPEG, or SVG image.');
      return;
    }

    setClientForm(prev => ({ ...prev, logoFile: file }));

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setLogoPreview(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    const gstin = (clientForm.clientGstin || '').trim().toUpperCase();
    const name = (clientForm.clientName || '').trim();

    if (!gstin || gstin.length !== 15) {
      alert('Client GSTIN must be exactly 15 alphanumeric characters.');
      return;
    }
    if (!name) {
      alert('Client legal or trade name is required.');
      return;
    }

    setModalSubmitting(true);
    try {
      let savedClient;
      if (editingClient) {
        savedClient = await apiClient.updateClient(editingClient.id, {
          clientGstin: gstin,
          clientName: name
        });
        showToast(`Client "${name}" updated successfully.`);
      } else {
        savedClient = await apiClient.createClient({
          clientGstin: gstin,
          clientName: name
        });
        showToast(`Client "${name}" created successfully.`);
      }

      // If a logo file was selected, upload it now
      if (clientForm.logoFile && savedClient?.id) {
        try {
          await apiClient.uploadClientLogo(savedClient.id, clientForm.logoFile);
        } catch (logoErr) {
          showToast(`Client saved, but logo upload failed: ${logoErr.message}`, 'error');
        }
      }

      setShowClientModal(false);
      await fetchClients();

      // Automatically select if newly created or currently active
      if (!editingClient) {
        setSelectedClient(savedClient);
      }
    } catch (err) {
      alert(err.message || 'Operation failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDeleteClient = async (client, e) => {
    e?.stopPropagation();
    const confirmMsg = `Are you sure you want to delete client "${client.clientName}" (${client.clientGstin})?\n\nThis will also remove all its vendor mappings.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiClient.deleteClient(client.id);
      showToast(`Client "${client.clientName}" deleted.`);
      if (selectedClient?.id === client.id) {
        setSelectedClient(null);
      }
      fetchClients();
    } catch (err) {
      alert(err.message || 'Failed to delete client');
    }
  };

  // ── Vendor Mapping Handlers ───────────────────────────────────────────────

  const openMapVendorsModal = async () => {
    if (!selectedClient) return;
    setShowMapModal(true);
    setSelectedGstinsToMap(new Set());
    setMapSearch('');
    setAllVendorsLoading(true);

    try {
      const details = await apiClient.getDetails();
      setAllAvailableVendors(details || []);

      // Aggregate mapped vendors across all clients to ensure strict 1-to-many
      const mappingPromises = clients.map(async (c) => {
        try {
          const vendors = await apiClient.getClientVendors(c.id);
          return (vendors || []).map(v => ({
            vendorGstin: v.vendorGstin,
            clientId: c.id,
            clientName: c.clientName,
            clientGstin: c.clientGstin
          }));
        } catch {
          return [];
        }
      });

      const results = await Promise.all(mappingPromises);
      const assignedMap = {};
      results.flat().forEach(item => {
        assignedMap[item.vendorGstin] = {
          clientId: item.clientId,
          clientName: item.clientName,
          clientGstin: item.clientGstin
        };
      });
      setAssignedVendorsMap(assignedMap);
    } catch (err) {
      showToast(err.message || 'Failed to load GRC vendor list', 'error');
    } finally {
      setAllVendorsLoading(false);
    }
  };

  const toggleVendorSelection = (gstin) => {
    setSelectedGstinsToMap(prev => {
      const next = new Set(prev);
      if (next.has(gstin)) {
        next.delete(gstin);
      } else {
        next.add(gstin);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = (filteredVendors) => {
    // Only select vendors that are NOT mapped to ANY client
    const unassignedFiltered = filteredVendors
      .filter(v => !assignedVendorsMap[v.gstin])
      .map(v => v.gstin);

    setSelectedGstinsToMap(new Set(unassignedFiltered));
  };

  const handleClearAllSelected = () => {
    setSelectedGstinsToMap(new Set());
  };

  const handleConfirmMapping = async () => {
    if (!selectedClient || selectedGstinsToMap.size === 0) return;

    setMappingSubmitting(true);
    try {
      const gstinsArray = Array.from(selectedGstinsToMap);
      await apiClient.mapVendorsToClient(selectedClient.id, gstinsArray);
      showToast(`Successfully mapped ${gstinsArray.length} vendor(s) to ${selectedClient.clientName}.`);
      setShowMapModal(false);
      await fetchMappedVendors(selectedClient.id);
      await fetchClients(); // refresh vendor count on all client cards
    } catch (err) {
      alert(err.message || 'Failed to map vendors');
    } finally {
      setMappingSubmitting(false);
    }
  };

  const handleUnmapVendor = async (vendorGstin, tradeName) => {
    if (!selectedClient) return;
    const displayName = tradeName || vendorGstin;
    const confirm = window.confirm(`Remove mapping for vendor "${displayName}" from client "${selectedClient.clientName}"?`);
    if (!confirm) return;

    try {
      await apiClient.unmapVendorFromClient(selectedClient.id, vendorGstin);
      showToast(`Vendor ${vendorGstin} unmapped.`);
      await fetchMappedVendors(selectedClient.id);
      await fetchClients(); // refresh vendor count
    } catch (err) {
      alert(err.message || 'Failed to unmap vendor');
    }
  };

  // ── Import Sheet Handlers ─────────────────────────────────────────────────

  const openImportModal = () => {
    setImportFile(null);
    setParsedImportData([]);
    setExpandedClientIndex(null);
    setShowImportModal(true);
  };

  const handleSheetFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rows || rows.length < 2) {
        throw new Error('Sheet is empty or missing header rows.');
      }

      const headerRow = rows[0] || [];
      const subHeaderRow = rows[1] || [];

      // 1. Identify client blocks along row 0
      const detectedBlocks = [];
      for (let col = 0; col < headerRow.length; col++) {
        const rawName = String(headerRow[col] || '').trim();
        if (rawName && !rawName.toLowerCase().startsWith('vendor') && !rawName.toLowerCase().startsWith('gst')) {
          let vendorCol = col;
          let gstnCol = col + 1;
          for (let c = col; c < col + 8 && c < subHeaderRow.length; c++) {
            const h = String(subHeaderRow[c] || '').trim().toLowerCase();
            if (h === 'gstn' || h === 'gstin' || h.includes('gst')) gstnCol = c;
            if (h === 'vendor' || h.includes('vendor name') || h.includes('supplier')) vendorCol = c;
          }
          detectedBlocks.push({
            clientName: rawName,
            startCol: col,
            vendorCol,
            gstnCol
          });
        }
      }

      if (detectedBlocks.length === 0) {
        throw new Error('Could not detect any client columns in row 1. Make sure row 1 has client names.');
      }

      // Fetch existing GRC records to auto-resolve client GSTIN if possible
      let grcDetails = [];
      try {
        grcDetails = await apiClient.getDetails();
      } catch {
        grcDetails = [];
      }

      // Track all vendor GSTINs globally across the sheet to maintain 1-to-many
      const seenVendors = new Map(); // gstin -> clientName where first seen

      const parsedClients = detectedBlocks.map(block => {
        // Resolve client GSTIN
        let resolvedGstin = '';
        const existingClient = clients.find(c => 
          c.clientName && c.clientName.trim().toLowerCase() === block.clientName.toLowerCase()
        );

        if (existingClient) {
          resolvedGstin = existingClient.clientGstin;
        } else {
          // Check if there is an exact or contains match in grcDetails
          const matchedGrc = grcDetails.find(g => 
            (g.tradeName && g.tradeName.toLowerCase().includes(block.clientName.toLowerCase())) ||
            (g.legalName && g.legalName.toLowerCase().includes(block.clientName.toLowerCase()))
          );
          if (matchedGrc) {
            resolvedGstin = matchedGrc.gstin;
          }
        }

        // Extract vendors
        const validVendors = [];
        const duplicateVendors = [];

        for (let r = 2; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const vName = String(row[block.vendorCol] || '').trim();
          const vGstn = String(row[block.gstnCol] || '').trim().toUpperCase();

          if (vGstn && vGstn.length === 15 && /^[0-9A-Z]{15}$/.test(vGstn)) {
            if (seenVendors.has(vGstn)) {
              duplicateVendors.push({
                name: vName || vGstn,
                gstin: vGstn,
                firstClient: seenVendors.get(vGstn)
              });
            } else {
              seenVendors.set(vGstn, block.clientName);
              validVendors.push({
                name: vName || vGstn,
                gstin: vGstn
              });
            }
          }
        }

        return {
          clientName: block.clientName,
          clientGstin: resolvedGstin,
          vendors: validVendors,
          duplicateVendors: duplicateVendors
        };
      });

      setParsedImportData(parsedClients);
    } catch (err) {
      alert(err.message || 'Failed to parse sheet');
      setImportFile(null);
    } finally {
      setImportParsing(false);
    }
  };

  const handleUpdateClientGstin = (index, newGstin) => {
    setParsedImportData(prev => {
      const next = [...prev];
      next[index] = { ...next[index], clientGstin: newGstin.toUpperCase() };
      return next;
    });
  };

  const handleConfirmImport = async () => {
    if (!parsedImportData || parsedImportData.length === 0) return;

    setImportSubmitting(true);
    try {
      const payload = {
        clients: parsedImportData.map(c => ({
          clientName: c.clientName,
          clientGstin: c.clientGstin,
          vendorGstins: c.vendors.map(v => v.gstin)
        }))
      };

      const result = await apiClient.bulkImportClients(payload);
      showToast(`Sheet imported successfully! ${result.clientsCreated} client(s) created, ${result.vendorsMapped} vendor(s) mapped.`);
      setShowImportModal(false);
      setParsedImportData([]);
      await fetchClients();
      if (selectedClient) {
        await fetchMappedVendors(selectedClient.id);
      }
    } catch (err) {
      alert(err.message || 'Import failed');
    } finally {
      setImportSubmitting(false);
    }
  };

  // ── Derived Data & Filtering ──────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => 
      (c.clientName && c.clientName.toLowerCase().includes(q)) ||
      (c.clientGstin && c.clientGstin.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  const filteredMappedVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return mappedVendors;
    return mappedVendors.filter(v => 
      (v.vendorGstin && v.vendorGstin.toLowerCase().includes(q)) ||
      (v.tradeName && v.tradeName.toLowerCase().includes(q)) ||
      (v.legalName && v.legalName.toLowerCase().includes(q))
    );
  }, [mappedVendors, vendorSearch]);

  const availableVendorsFiltered = useMemo(() => {
    const q = mapSearch.trim().toLowerCase();
    return allAvailableVendors.filter(v => {
      const matchText = !q || 
        (v.gstin && v.gstin.toLowerCase().includes(q)) ||
        (v.tradeName && v.tradeName.toLowerCase().includes(q)) ||
        (v.legalName && v.legalName.toLowerCase().includes(q));
      return matchText;
    });
  }, [allAvailableVendors, mapSearch]);

  // Badge helpers
  const getScoreBadge = (score) => {
    if (score === null || score === undefined) {
      return <span className="score-badge score-na">N/A</span>;
    }
    if (score >= 70) {
      return <span className="score-badge score-high">{score}</span>;
    }
    if (score >= 40) {
      return <span className="score-badge score-mid">{score}</span>;
    }
    return <span className="score-badge score-low">{score}</span>;
  };

  const getStatusBadge = (status) => {
    const isActive = (status || '').toLowerCase() === 'active';
    return (
      <span className={`status-pill ${isActive ? 'status-active' : 'status-inactive'}`}>
        <span className="dot"></span>
        {status || 'Unknown'}
      </span>
    );
  };

  const totalVendorsInSheet = useMemo(() => {
    return parsedImportData.reduce((acc, c) => acc + (c.vendors?.length || 0), 0);
  }, [parsedImportData]);

  return (
    <div className="client-mapping-container">
      <style>{`
        .client-mapping-container {
          padding: 1.5rem 2rem 4rem;
          max-width: 1400px;
          margin: 0 auto;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1e293b;
        }

        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .page-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .page-title-badge {
          font-size: 0.72rem;
          background: linear-gradient(135deg, #ede9fe, #e0e7ff);
          color: #6d28d9;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
          border: 1px solid #c4b5fd;
        }

        /* Notifications */
        .toast-banner {
          position: fixed;
          top: 70px;
          right: 24px;
          z-index: 1000;
          padding: 0.8rem 1.25rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
          animation: slideIn 0.25s ease-out;
        }
        .toast-success {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .toast-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        @keyframes slideIn {
          from { transform: translateX(50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        /* Layout Grid */
        .mapping-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 980px) {
          .mapping-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Cards & Panes */
        .pane-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.05);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .pane-header {
          padding: 1.1rem 1.25rem;
          background: #fafbfc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.8rem;
        }

        .pane-title {
          font-size: 1rem;
          font-weight: 700;
          color: #1e1b4b;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
        }

        .search-input-box {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-input-box input {
          width: 100%;
          padding: 0.5rem 0.75rem 0.5rem 2.1rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.83rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }
        .search-input-box input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        .search-input-box .search-icon {
          position: absolute;
          left: 0.65rem;
          color: #94a3b8;
        }

        /* Buttons */
        .btn-primary-gradient {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: white;
          border: none;
          font-size: 0.85rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 3px 10px rgba(124, 58, 237, 0.28);
          white-space: nowrap;
        }
        .btn-primary-gradient:hover {
          transform: translateY(-1px);
          box-shadow: 0 5px 14px rgba(124, 58, 237, 0.4);
        }
        .btn-primary-gradient:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-outline-purple {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          background: #f5f3ff;
          color: #6d28d9;
          border: 1px solid #c4b5fd;
          font-size: 0.85rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .btn-outline-purple:hover {
          background: #ede9fe;
          border-color: #a78bfa;
          transform: translateY(-1px);
        }

        .btn-ghost-sm {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          padding: 0.35rem 0.65rem;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #475569;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-ghost-sm:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .btn-ghost-danger:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        /* Client Cards List */
        .client-list {
          padding: 0.75rem;
          max-height: 640px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .client-card {
          padding: 0.85rem;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          transition: all 0.2s ease;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          position: relative;
        }
        .client-card:hover {
          border-color: #c4b5fd;
          background: #faf5ff;
          transform: translateY(-1px);
        }
        .client-card.active {
          background: #f5f3ff;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
        }

        .client-avatar {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(135deg, #ede9fe, #ddd6fe);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          border: 1px solid #c4b5fd;
        }
        .client-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .client-avatar .fallback-initials {
          font-size: 1.1rem;
          font-weight: 800;
          color: #6d28d9;
        }

        .client-info {
          flex: 1;
          min-width: 0;
        }
        .client-name {
          font-size: 0.92rem;
          font-weight: 700;
          color: #1e1b4b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .client-gstin-code {
          font-size: 0.75rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #64748b;
          margin-top: 0.15rem;
        }
        .client-meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.7rem;
          font-weight: 700;
          color: #5b21b6;
          background: #ede9fe;
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
          margin-top: 0.35rem;
        }

        .client-card-actions {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          opacity: 0.8;
        }
        .client-card:hover .client-card-actions {
          opacity: 1;
        }

        /* Section B: Mapped Vendors Pane */
        .vendor-pane-body {
          padding: 1.25rem;
          min-height: 480px;
        }

        .selected-client-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
          gap: 0.8rem;
        }
        .client-banner-left {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .banner-logo {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: white;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .banner-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Vendors Table */
        .table-responsive {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .vendor-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .vendor-table th {
          background: #f8fafc;
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 700;
          color: #475569;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }
        .vendor-table td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .vendor-table tr:hover {
          background: #fafbfc;
        }

        /* Badges */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem 0.55rem;
          border-radius: 12px;
          font-size: 0.73rem;
          font-weight: 700;
        }
        .status-active {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }
        .status-active .dot {
          width: 6px; height: 6px; border-radius: 50%; background: #10b981;
        }
        .status-inactive {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
        .status-inactive .dot {
          width: 6px; height: 6px; border-radius: 50%; background: #ef4444;
        }

        .score-badge {
          display: inline-block;
          min-width: 38px;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          font-weight: 800;
          text-align: center;
          font-size: 0.8rem;
        }
        .score-high {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #86efac;
        }
        .score-mid {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fcd34d;
        }
        .score-low {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fca5a5;
        }
        .score-na {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #cbd5e1;
        }

        /* Empty & Loading Placeholders */
        .empty-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 3.5rem 1.5rem;
          color: #64748b;
        }
        .placeholder-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.85rem;
          color: #94a3b8;
        }

        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1050;
          padding: 1.5rem;
        }
        .modal-content-box {
          background: white;
          border-radius: 16px;
          max-width: 520px;
          width: 100%;
          box-shadow: 0 20px 40px -5px rgba(0,0,0,0.25);
          overflow: hidden;
          animation: modalPop 0.2s ease-out;
        }
        .modal-wide {
          max-width: 820px;
        }
        .modal-xl {
          max-width: 960px;
        }
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }

        .modal-header {
          padding: 1.1rem 1.4rem;
          background: #fafbfc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-body {
          padding: 1.4rem;
          max-height: 70vh;
          overflow-y: auto;
        }
        .modal-footer {
          padding: 1rem 1.4rem;
          background: #fafbfc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .form-group {
          margin-bottom: 1.1rem;
        }
        .form-group label {
          display: block;
          font-size: 0.82rem;
          font-weight: 700;
          color: #334155;
          margin-bottom: 0.35rem;
        }
        .form-control {
          width: 100%;
          padding: 0.55rem 0.8rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.88rem;
          font-family: inherit;
          box-sizing: border-box;
          outline: none;
        }
        .form-control:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
        }

        /* Drag & Drop Upload Zone */
        .upload-dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #f8fafc;
        }
        .upload-dropzone:hover {
          border-color: #7c3aed;
          background: #f5f3ff;
        }

        /* Vendor Multi-Select Modal Table */
        .selectable-row {
          cursor: pointer;
          user-select: none;
        }
        .selectable-row.selected {
          background: #f5f3ff !important;
        }
        .selectable-row.already-mapped {
          opacity: 0.65;
          cursor: not-allowed;
          background: #f8fafc !important;
        }

        /* Import Preview Cards */
        .client-preview-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fafbfc;
          padding: 0.9rem 1.1rem;
          margin-bottom: 0.85rem;
          transition: all 0.2s;
        }
        .client-preview-card:hover {
          border-color: #c4b5fd;
        }
        .client-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
      `}</style>

      {/* Toast Notification */}
      {notification && (
        <div className={`toast-banner ${notification.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: '0.4rem', color: 'inherit' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Page Title Bar */}
      <div className="header-bar">
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="#7c3aed" />
            Client-Vendor Mapping
            <span className="page-title-badge">Part 2 Module</span>
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Manage corporate buyers (clients) and assign suppliers (vendors). Each vendor can be mapped to one client exclusively.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button className="btn-outline-purple" onClick={openImportModal} title="Upload Excel/CSV sheet with horizontal client columns">
            <FileSpreadsheet size={16} />
            Import from Sheet
          </button>

          <button className="btn-primary-gradient" onClick={openAddClientModal}>
            <Plus size={16} />
            Add New Client
          </button>
        </div>
      </div>

      {/* Main Two-Pane Grid */}
      <div className="mapping-grid">
        
        {/* ================================================================= */}
        {/* SECTION A: CLIENT MANAGEMENT                                     */}
        {/* ================================================================= */}
        <div className="pane-card">
          <div className="pane-header">
            <h2 className="pane-title">
              <Users size={17} color="#6d28d9" />
              Clients ({clients.length})
            </h2>
            <div className="search-input-box" style={{ maxWidth: '170px' }}>
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="client-list">
            {clientsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem' }}>
                <div className="spinner"></div>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="empty-placeholder">
                <div className="placeholder-icon-wrap">
                  <Building2 size={26} />
                </div>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
                  {clientSearch ? 'No matching clients' : 'No clients added yet'}
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.3rem 0 0.8rem' }}>
                  {clientSearch ? 'Try adjusting your search query' : 'Create a client or import from sheet to begin mapping'}
                </p>
                {!clientSearch && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-ghost-sm" onClick={openAddClientModal}>
                      <Plus size={14} /> Add Client
                    </button>
                    <button className="btn-ghost-sm" onClick={openImportModal}>
                      <FileSpreadsheet size={14} /> Import Sheet
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredClients.map(client => {
                const isSelected = selectedClient?.id === client.id;
                const initials = (client.clientName || 'C')
                  .split(' ')
                  .map(w => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={client.id}
                    className={`client-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedClient(client)}
                    title="Click to view & manage mapped vendors"
                  >
                    <div className="client-avatar">
                      {client.hasLogo ? (
                        <img 
                          src={apiClient.getClientLogoUrl(client.id)} 
                          alt={client.clientName}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentNode.innerHTML = `<span class="fallback-initials">${initials}</span>`;
                          }}
                        />
                      ) : (
                        <span className="fallback-initials">{initials}</span>
                      )}
                    </div>

                    <div className="client-info">
                      <div className="client-name" title={client.clientName}>
                        {client.clientName}
                      </div>
                      <div className="client-gstin-code">{client.clientGstin}</div>
                      <div className="client-meta-badge">
                        <Users size={11} />
                        {client.vendorCount ?? 0} {client.vendorCount === 1 ? 'vendor' : 'vendors'} mapped
                      </div>
                    </div>

                    <div className="client-card-actions">
                      <button
                        className="btn-ghost-sm"
                        onClick={(e) => openEditClientModal(client, e)}
                        title="Edit Client details or logo"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn-ghost-sm btn-ghost-danger"
                        onClick={(e) => handleDeleteClient(client, e)}
                        title="Delete Client"
                      >
                        <Trash2 size={13} />
                      </button>
                      <ChevronRight 
                        size={16} 
                        color={isSelected ? '#7c3aed' : '#cbd5e1'} 
                        style={{ marginLeft: '0.2rem' }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECTION B: VENDOR MAPPING                                        */}
        {/* ================================================================= */}
        <div className="pane-card">
          <div className="pane-header">
            <h2 className="pane-title">
              <ShieldCheck size={17} color="#2563eb" />
              {selectedClient 
                ? `Mapped Vendors: ${selectedClient.clientName}`
                : 'Vendor Mapping Workspace'}
            </h2>

            {selectedClient && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="search-input-box" style={{ maxWidth: '200px' }}>
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search mapped..."
                    value={vendorSearch}
                    onChange={e => setVendorSearch(e.target.value)}
                  />
                </div>
                <button className="btn-primary-gradient" onClick={openMapVendorsModal}>
                  <Plus size={15} />
                  Map Vendors
                </button>
              </div>
            )}
          </div>

          <div className="vendor-pane-body">
            {!selectedClient ? (
              <div className="empty-placeholder" style={{ padding: '5rem 1rem' }}>
                <div className="placeholder-icon-wrap" style={{ width: '64px', height: '64px' }}>
                  <Building2 size={32} color="#7c3aed" />
                </div>
                <h3 style={{ margin: '0.4rem 0 0.2rem', color: '#1e293b', fontSize: '1.1rem' }}>
                  No Client Selected
                </h3>
                <p style={{ maxWidth: '380px', fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5 }}>
                  Select a corporate client from the left panel to review compliance scores and assign or unassign supplier GSTINs.
                </p>
              </div>
            ) : (
              <>
                {/* Active Client Banner */}
                <div className="selected-client-banner">
                  <div className="client-banner-left">
                    <div className="banner-logo">
                      {selectedClient.hasLogo ? (
                        <img src={apiClient.getClientLogoUrl(selectedClient.id)} alt={selectedClient.clientName} />
                      ) : (
                        <Building2 size={24} color="#6d28d9" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                        {selectedClient.clientName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>
                        GSTIN: <span style={{ fontWeight: 700, color: '#334155' }}>{selectedClient.clientGstin}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      padding: '0.4rem 0.8rem',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#475569'
                    }}>
                      Total Mapped: <span style={{ color: '#6d28d9' }}>{mappedVendors.length}</span>
                    </div>
                    <button 
                      className="btn-ghost-sm" 
                      onClick={() => fetchMappedVendors(selectedClient.id)} 
                      title="Refresh mapped vendors list"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                {/* Table of Mapped Vendors */}
                {vendorsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3.5rem' }}>
                    <div className="spinner"></div>
                  </div>
                ) : filteredMappedVendors.length === 0 ? (
                  <div className="empty-placeholder">
                    <div className="placeholder-icon-wrap">
                      <Users size={28} />
                    </div>
                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.95rem' }}>
                      {vendorSearch ? 'No matching mapped vendors' : 'No vendors currently mapped to this client'}
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.3rem 0 1rem', maxWidth: '340px' }}>
                      {vendorSearch 
                        ? 'Try a different search keyword' 
                        : 'Assign existing vendors from GRC to view compliance scores and monitor supply risk.'}
                    </p>
                    {!vendorSearch && (
                      <button className="btn-primary-gradient" onClick={openMapVendorsModal}>
                        <Plus size={15} /> Map First Vendor
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="vendor-table">
                      <thead>
                        <tr>
                          <th>Vendor GSTIN</th>
                          <th>Trade Name</th>
                          <th>Legal Name</th>
                          <th>GST Status</th>
                          <th>GRC Score</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMappedVendors.map(vendor => (
                          <tr key={vendor.vendorGstin}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                                  {vendor.vendorGstin}
                                </span>
                                <a
                                  href={`/vendor-report/${vendor.vendorGstin}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View Public Assessment Report"
                                  style={{ color: '#7c3aed', display: 'inline-flex' }}
                                >
                                  <ExternalLink size={13} />
                                </a>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#1e293b', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={vendor.tradeName || '—'}>
                                {vendor.tradeName || '—'}
                              </div>
                            </td>
                            <td>
                              <div style={{ color: '#64748b', fontSize: '0.8rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={vendor.legalName || '—'}>
                                {vendor.legalName || '—'}
                              </div>
                            </td>
                            <td>{getStatusBadge(vendor.gstStatus)}</td>
                            <td>{getScoreBadge(vendor.grcScore)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn-ghost-sm btn-ghost-danger"
                                onClick={() => handleUnmapVendor(vendor.vendorGstin, vendor.tradeName)}
                                title="Remove / Unmap this vendor from the client"
                              >
                                <X size={13} />
                                Unmap
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* =================================================================== */}
      {/* BULK IMPORT FROM SHEET MODAL                                        */}
      {/* =================================================================== */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importSubmitting && setShowImportModal(false)}>
          <div className="modal-content-box modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} color="#7c3aed" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Bulk Import Clients & Mapped Vendors
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Upload an Excel (.xlsx, .xls) or CSV sheet with horizontal client columns to auto-create clients and map vendors.
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowImportModal(false)}
                disabled={importSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* File Dropzone */}
              {!parsedImportData.length ? (
                <div 
                  className="upload-dropzone"
                  onClick={() => document.getElementById('sheet-file-input')?.click()}
                  style={{ padding: '2.5rem 1.5rem' }}
                >
                  <input
                    id="sheet-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleSheetFileSelected}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed'
                    }}>
                      <UploadCloud size={24} />
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                      {importParsing ? 'Analyzing sheet format...' : 'Click or drag Excel / CSV file here to upload'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '480px', lineHeight: 1.5 }}>
                      Expected format: Row 1 contains Client Names side-by-side horizontally. Below each client are their respective Vendor & GSTN columns.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Parsing Summary Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    borderRadius: '10px',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#5b21b6', fontSize: '0.88rem' }}>
                      <Check size={16} color="#7c3aed" />
                      Detected {parsedImportData.length} Client(s) • Total {totalVendorsInSheet} Vendor(s) to map
                    </div>

                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => { setParsedImportData([]); setImportFile(null); }}
                    >
                      Choose Different File
                    </button>
                  </div>

                  {/* Client Cards Preview */}
                  <div style={{ maxHeight: '440px', overflowY: 'auto', paddingRight: '0.3rem' }}>
                    {parsedImportData.map((clientItem, idx) => {
                      const isExpanded = expandedClientIndex === idx;
                      const hasDuplicates = clientItem.duplicateVendors && clientItem.duplicateVendors.length > 0;

                      return (
                        <div key={idx} className="client-preview-card">
                          <div className="client-preview-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <Building2 size={16} color="#7c3aed" />
                              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                                {clientItem.clientName}
                              </span>
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '6px',
                                background: '#ede9fe',
                                color: '#6d28d9',
                                fontWeight: 700
                              }}>
                                {clientItem.vendors.length} vendors
                              </span>

                              {hasDuplicates && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '6px',
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }} title="These vendors appeared under multiple clients in the sheet and will be mapped to their first occurrence.">
                                  <AlertTriangle size={12} />
                                  {clientItem.duplicateVendors.length} duplicate(s) omitted
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Client GSTIN:</span>
                                <input
                                  type="text"
                                  maxLength={15}
                                  placeholder="Auto-match or enter GSTIN"
                                  value={clientItem.clientGstin}
                                  onChange={e => handleUpdateClientGstin(idx, e.target.value)}
                                  className="form-control"
                                  style={{
                                    width: '180px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.78rem',
                                    fontFamily: 'monospace',
                                    fontWeight: 700
                                  }}
                                />
                              </div>

                              <button
                                type="button"
                                className="btn-ghost-sm"
                                onClick={() => setExpandedClientIndex(isExpanded ? null : idx)}
                                title="Toggle vendors list"
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {isExpanded ? 'Hide' : 'Preview Vendors'}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Vendor List */}
                          {isExpanded && (
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                                Vendors to be mapped under {clientItem.clientName}:
                              </div>

                              <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <table className="vendor-table" style={{ fontSize: '0.78rem' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ padding: '0.4rem 0.75rem' }}>#</th>
                                      <th style={{ padding: '0.4rem 0.75rem' }}>Vendor Name</th>
                                      <th style={{ padding: '0.4rem 0.75rem' }}>GSTIN</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {clientItem.vendors.map((v, vIdx) => (
                                      <tr key={v.gstin + vIdx}>
                                        <td style={{ padding: '0.4rem 0.75rem', color: '#94a3b8' }}>{vIdx + 1}</td>
                                        <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600 }}>{v.name}</td>
                                        <td style={{ padding: '0.4rem 0.75rem', fontFamily: 'monospace', fontWeight: 700, color: '#4338ca' }}>
                                          {v.gstin}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {parsedImportData.length > 0 && (
                  <span>
                    Ready to create/update <strong>{parsedImportData.length}</strong> clients and map <strong>{totalVendorsInSheet}</strong> vendors.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => setShowImportModal(false)}
                  disabled={importSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-gradient"
                  disabled={importSubmitting || !parsedImportData.length}
                  onClick={handleConfirmImport}
                >
                  {importSubmitting ? 'Importing Sheet...' : `Import & Map All (${parsedImportData.length} Clients)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ADD / EDIT CLIENT MODAL                                             */}
      {/* =================================================================== */}
      {showClientModal && (
        <div className="modal-overlay" onClick={() => !modalSubmitting && setShowClientModal(false)}>
          <div className="modal-content-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </h3>
              </div>
              <button 
                onClick={() => setShowClientModal(false)}
                disabled={modalSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveClient}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Client GSTIN *</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    className="form-control"
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '1px' }}
                    value={clientForm.clientGstin}
                    onChange={e => setClientForm({ ...clientForm, clientGstin: e.target.value.toUpperCase() })}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.73rem', marginTop: '0.2rem', display: 'block' }}>
                    15-character alphanumeric GSTIN of the corporate buyer / manufacturer.
                  </small>
                </div>

                <div className="form-group">
                  <label>Client Legal / Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rapidue Technologies Pvt Ltd / Tata Motors"
                    className="form-control"
                    value={clientForm.clientName}
                    onChange={e => setClientForm({ ...clientForm, clientName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Client Logo (PNG, JPEG, SVG — Max 2 MB)</label>
                  <div 
                    className="upload-dropzone"
                    onClick={() => document.getElementById('client-logo-input')?.click()}
                  >
                    <input
                      id="client-logo-input"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      style={{ display: 'none' }}
                      onChange={handleLogoChange}
                    />

                    {logoPreview ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                        <div style={{
                          width: '64px', height: '64px', borderRadius: '10px',
                          border: '1px solid #cbd5e1', overflow: 'hidden', background: 'white'
                        }}>
                          <img src={logoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                            {clientForm.logoFile ? clientForm.logoFile.name : 'Current Logo'}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>
                            Click to choose different image
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed'
                        }}>
                          <Upload size={18} />
                        </div>
                        <div style={{ fontSize: '0.83rem', fontWeight: 700, color: '#334155' }}>
                          Click or drag file to upload logo
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          Supported formats: PNG, JPEG, SVG (max 2 MB)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => setShowClientModal(false)}
                  disabled={modalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-gradient"
                  disabled={modalSubmitting}
                >
                  {modalSubmitting ? 'Saving...' : (editingClient ? 'Update Client' : 'Create Client')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MAP VENDORS MODAL (Strict 1-to-many: one vendor per client only)   */}
      {/* =================================================================== */}
      {showMapModal && selectedClient && (
        <div className="modal-overlay" onClick={() => !mappingSubmitting && setShowMapModal(false)}>
          <div className="modal-content-box modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="#7c3aed" />
                  Map Vendors to: {selectedClient.clientName}
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Each vendor can only be assigned to one client. Select unassigned vendors below.
                </div>
              </div>

              <button 
                onClick={() => setShowMapModal(false)}
                disabled={mappingSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1rem 1.4rem' }}>
              {/* Search & Bulk Select Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div className="search-input-box" style={{ flex: 1, minWidth: '220px' }}>
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by GSTIN, Trade name or Legal name..."
                    value={mapSearch}
                    onChange={e => setMapSearch(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => handleSelectAllFiltered(availableVendorsFiltered)}
                    title="Select all unassigned vendors shown"
                  >
                    Select All Unassigned
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={handleClearAllSelected}
                    disabled={selectedGstinsToMap.size === 0}
                  >
                    Clear ({selectedGstinsToMap.size})
                  </button>
                </div>
              </div>

              {/* Vendors List Table */}
              {allVendorsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <div className="spinner"></div>
                </div>
              ) : availableVendorsFiltered.length === 0 ? (
                <div className="empty-placeholder" style={{ padding: '2.5rem' }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#64748b' }}>No vendors match your search.</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <table className="vendor-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Vendor GSTIN</th>
                        <th>Trade Name</th>
                        <th>Status</th>
                        <th>GRC Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableVendorsFiltered.map(vendor => {
                        const assignedInfo = assignedVendorsMap[vendor.gstin];
                        const isMappedToThis = assignedInfo && assignedInfo.clientId === selectedClient.id;
                        const isMappedToOther = assignedInfo && assignedInfo.clientId !== selectedClient.id;
                        const isMapped = isMappedToThis || isMappedToOther;
                        const isChecked = selectedGstinsToMap.has(vendor.gstin);

                        return (
                          <tr
                            key={vendor.gstin}
                            className={`selectable-row ${isMapped ? 'already-mapped' : ''} ${isChecked ? 'selected' : ''}`}
                            onClick={() => {
                              if (!isMapped) toggleVendorSelection(vendor.gstin);
                            }}
                          >
                            <td style={{ textAlign: 'center' }}>
                              {isMappedToThis ? (
                                <Check size={16} color="#10b981" title="Already mapped to this client" />
                              ) : isMappedToOther ? (
                                <X size={15} color="#d97706" title={`Already mapped to client: ${assignedInfo.clientName}`} />
                              ) : isChecked ? (
                                <CheckSquare size={17} color="#7c3aed" />
                              ) : (
                                <Square size={17} color="#94a3b8" />
                              )}
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                                {vendor.gstin}
                              </span>
                              {isMappedToThis && (
                                <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: '#059669', background: '#d1fae5', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                                  Mapped to this client
                                </span>
                              )}
                              {isMappedToOther && (
                                <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: '#b45309', background: '#fef3c7', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }} title={`Client GSTIN: ${assignedInfo.clientGstin}`}>
                                  Mapped to: {assignedInfo.clientName}
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#1e293b', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {vendor.tradeName || vendor.legalName || '—'}
                              </div>
                            </td>
                            <td>{getStatusBadge(vendor.gstStatus)}</td>
                            <td>{getScoreBadge(vendor.grcScore)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                <span style={{ color: '#7c3aed' }}>{selectedGstinsToMap.size}</span> unassigned vendor(s) selected
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => setShowMapModal(false)}
                  disabled={mappingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-gradient"
                  disabled={mappingSubmitting || selectedGstinsToMap.size === 0}
                  onClick={handleConfirmMapping}
                >
                  {mappingSubmitting ? 'Mapping...' : `Map ${selectedGstinsToMap.size} Vendor(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
