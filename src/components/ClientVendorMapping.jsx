import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, Plus, Search, Trash2, Edit2, Upload, 
  Check, X, ExternalLink, ShieldCheck, AlertCircle, Image as ImageIcon,
  ChevronRight, RefreshCw, CheckSquare, Square, FileSpreadsheet,
  UploadCloud, ChevronDown, ChevronUp, AlertTriangle, Download,
  Copy, CheckCircle2, Loader2, ArrowUpDown, Save, Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '../api/apiClient';
import { getGstr7Display } from '../utils/gstr7Display';

export default function ClientVendorMapping({ currentUser }) {
  // State for Clients
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientsLoading, setClientsLoading] = useState(true);

  // State for Mapped Vendors
  const [mappedVendors, setMappedVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'delayed-gstr1' | 'delayed-gstr3b' | 'active' | 'high-risk'

  // Inline Compliance Editing State: { [gstin]: { gstr1: number, gstr3b: number } }
  const [inlineCompliance, setInlineCompliance] = useState({});
  const [savingGstins, setSavingGstins] = useState({}); // { [gstin]: 'saving' | 'saved' | 'error' }
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savedSuccessFlash, setSavedSuccessFlash] = useState(false);
  const [copiedGstin, setCopiedGstin] = useState(null);

  // Month Picker Modal State for selecting multiple delayed months
  const [monthPicker, setMonthPicker] = useState({
    isOpen: false,
    vendorGstin: '',
    vendorName: '',
    field: 'gstr3b', // 'gstr1' | 'gstr3b'
    selectedYear: '2024',
    selectedMonths: [],
    customInput: '',
    syncCountWithMonths: true
  });

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
  const [parsedImportData, setParsedImportData] = useState([]);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [expandedClientIndex, setExpandedClientIndex] = useState(null);

  // Logo Upload Modal
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [logoTargetClient, setLogoTargetClient] = useState(null);
  const [directLogoFile, setDirectLogoFile] = useState(null);
  const [directLogoPreview, setDirectLogoPreview] = useState(null);
  const [logoSubmitting, setLogoSubmitting] = useState(false);

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

  // Sync inline compliance dictionary when mappedVendors changes
  useEffect(() => {
    if (mappedVendors && mappedVendors.length > 0) {
      const initial = {};
      mappedVendors.forEach(v => {
        initial[v.vendorGstin] = {
          gstr1: v.delayCountGstr1 ?? 0,
          gstr3b: v.delayCountGstr3b ?? 0,
          gstr1Months: v.delayedMonthsGstr1 || '',
          gstr3bMonths: v.delayedMonthsGstr3b || ''
        };
      });
      setInlineCompliance(initial);
    } else {
      setInlineCompliance({});
    }
  }, [mappedVendors]);

  // Fetch Mapped Vendors when selectedClient changes
  useEffect(() => {
    if (selectedClient?.id) {
      fetchMappedVendors(selectedClient.id);
    } else {
      setMappedVendors([]);
    }
  }, [selectedClient?.id]);

  const fetchClients = async (preferredClientId = null) => {
    setClientsLoading(true);
    try {
      const data = await apiClient.getClients();
      const clientList = data || [];
      setClients(clientList);

      if (preferredClientId) {
        const found = clientList.find(c => c.id === preferredClientId);
        setSelectedClient(found || clientList[0] || null);
      } else if (selectedClient) {
        const updatedSelected = clientList.find(c => c.id === selectedClient.id);
        setSelectedClient(updatedSelected || clientList[0] || null);
      } else if (clientList.length > 0) {
        setSelectedClient(clientList[0]);
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

  // ── Manual Compliance Editing Handlers ────────────────────────────────────

  // Compute GSTINs that have unsaved changes compared to mappedVendors
  const modifiedGstins = useMemo(() => {
    const modified = new Set();
    if (!mappedVendors || mappedVendors.length === 0) return modified;
    for (const v of mappedVendors) {
      const entry = inlineCompliance[v.vendorGstin];
      if (!entry) continue;
      const origGstr1 = v.delayCountGstr1 ?? 0;
      const origGstr3b = v.delayCountGstr3b ?? 0;
      const origGstr1Months = v.delayedMonthsGstr1 || '';
      const origGstr3bMonths = v.delayedMonthsGstr3b || '';
      if (
        entry.gstr1 !== origGstr1 ||
        entry.gstr3b !== origGstr3b ||
        (entry.gstr1Months || '') !== origGstr1Months ||
        (entry.gstr3bMonths || '') !== origGstr3bMonths
      ) {
        modified.add(v.vendorGstin);
      }
    }
    return modified;
  }, [mappedVendors, inlineCompliance]);

  const handleComplianceChange = (vendorGstin, field, val) => {
    const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
    setInlineCompliance(prev => ({
      ...prev,
      [vendorGstin]: {
        ...(prev[vendorGstin] || { gstr1: 0, gstr3b: 0 }),
        [field]: num
      }
    }));
  };

  const handleSaveAllCompliance = async () => {
    if (modifiedGstins.size === 0) {
      showToast('No compliance changes to save', 'info');
      return;
    }

    setIsSavingAll(true);
    const gstinsToSave = Array.from(modifiedGstins);

    // Set saving status for all modified gstins
    setSavingGstins(prev => {
      const next = { ...prev };
      gstinsToSave.forEach(g => { next[g] = 'saving'; });
      return next;
    });

    try {
      const results = await Promise.allSettled(
        gstinsToSave.map(async (gstin) => {
          const values = inlineCompliance[gstin];
          const payload = {
            delayCountGstr1: values.gstr1,
            delayCountGstr3b: values.gstr3b,
            delayedMonthsGstr1: values.gstr1Months || null,
            delayedMonthsGstr3b: values.gstr3bMonths || null,
            updatedBy: currentUser?.name || 'Admin'
          };
          const updated = await apiClient.updateDetails(gstin, payload);
          return { gstin, updated };
        })
      );

      let successCount = 0;
      let failCount = 0;
      const successfulUpdates = {};

      results.forEach((res, idx) => {
        const gstin = gstinsToSave[idx];
        if (res.status === 'fulfilled') {
          successCount++;
          successfulUpdates[gstin] = res.value.updated;
        } else {
          failCount++;
        }
      });

      if (successCount > 0) {
        setMappedVendors(prev => prev.map(v => {
          const updated = successfulUpdates[v.vendorGstin];
          if (updated) {
            return {
              ...v,
              delayCountGstr1: updated.delayCountGstr1,
              delayCountGstr3b: updated.delayCountGstr3b,
              delayedMonthsGstr1: updated.delayedMonthsGstr1,
              delayedMonthsGstr3b: updated.delayedMonthsGstr3b,
              grcScore: updated.grcScore
            };
          }
          return v;
        }));

        setSavingGstins(prev => {
          const next = { ...prev };
          Object.keys(successfulUpdates).forEach(g => {
            next[g] = 'saved';
          });
          return next;
        });

        setSavedSuccessFlash(true);
        setTimeout(() => setSavedSuccessFlash(false), 3000);
        showToast(`Successfully saved compliance changes for ${successCount} vendor(s)!`);
      }

      if (failCount > 0) {
        showToast(`Failed to update ${failCount} vendor(s). Please try again.`, 'error');
      }

      setTimeout(() => {
        setSavingGstins({});
      }, 2500);
    } catch (err) {
      showToast(err.message || 'Error saving compliance changes', 'error');
    } finally {
      setIsSavingAll(false);
    }
  };

  // ── Month Picker Handlers ────────────────────────────────────────────────
  const openMonthPicker = (vendor, field) => {
    const gstin = vendor.vendorGstin;
    const currentVal = inlineCompliance[gstin];
    const existingStr = field === 'gstr1'
      ? (currentVal?.gstr1Months ?? vendor.delayedMonthsGstr1 ?? '')
      : (currentVal?.gstr3bMonths ?? vendor.delayedMonthsGstr3b ?? '');

    const tokens = existingStr
      ? existingStr.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    setMonthPicker({
      isOpen: true,
      vendorGstin: gstin,
      vendorName: getVendorDisplayName(vendor),
      field,
      selectedYear: '2024',
      selectedMonths: tokens,
      customInput: existingStr,
      syncCountWithMonths: true
    });
  };

  const handleToggleMonth = (monthName) => {
    const yrSuffix = monthPicker.selectedYear === 'none'
      ? ''
      : `-${monthPicker.selectedYear.slice(-2)}`;
    const tag = `${monthName}${yrSuffix}`;

    setMonthPicker(prev => {
      const exists = prev.selectedMonths.includes(tag);
      const updated = exists
        ? prev.selectedMonths.filter(m => m !== tag)
        : [...prev.selectedMonths, tag];
      return {
        ...prev,
        selectedMonths: updated,
        customInput: updated.join(', ')
      };
    });
  };

  const handleCustomInputChange = (val) => {
    const tokens = val.split(',').map(s => s.trim()).filter(Boolean);
    setMonthPicker(prev => ({
      ...prev,
      customInput: val,
      selectedMonths: tokens
    }));
  };

  const handlePresetClick = (preset) => {
    const tokens = preset.split(',').map(s => s.trim()).filter(Boolean);
    setMonthPicker(prev => {
      const combined = Array.from(new Set([...prev.selectedMonths, ...tokens]));
      return {
        ...prev,
        selectedMonths: combined,
        customInput: combined.join(', ')
      };
    });
  };

  const handleApplyMonths = () => {
    const gstin = monthPicker.vendorGstin;
    const field = monthPicker.field;
    const finalStr = monthPicker.customInput.trim();
    const tokens = finalStr ? finalStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const count = tokens.length;

    setInlineCompliance(prev => {
      const existing = prev[gstin] || { gstr1: 0, gstr3b: 0, gstr1Months: '', gstr3bMonths: '' };
      return {
        ...prev,
        [gstin]: {
          ...existing,
          [field === 'gstr1' ? 'gstr1Months' : 'gstr3bMonths']: finalStr,
          ...(monthPicker.syncCountWithMonths ? { [field]: count } : {})
        }
      };
    });

    setMonthPicker(prev => ({ ...prev, isOpen: false }));
  };

  const handleSaveCompliance = async (vendorGstin) => {
    const values = inlineCompliance[vendorGstin];
    if (!values) return;

    // Check if changed compared to mappedVendors
    const original = mappedVendors.find(v => v.vendorGstin === vendorGstin);
    if (original && original.delayCountGstr1 === values.gstr1 && original.delayCountGstr3b === values.gstr3b) {
      return; // No change
    }

    setSavingGstins(prev => ({ ...prev, [vendorGstin]: 'saving' }));
    try {
      const payload = {
        delayCountGstr1: values.gstr1,
        delayCountGstr3b: values.gstr3b,
        updatedBy: currentUser?.name || 'Admin'
      };

      const updated = await apiClient.updateDetails(vendorGstin, payload);

      // Update mappedVendors state in place
      setMappedVendors(prev => prev.map(v => {
        if (v.vendorGstin === vendorGstin) {
          return {
            ...v,
            delayCountGstr1: updated.delayCountGstr1,
            delayCountGstr3b: updated.delayCountGstr3b,
            grcScore: updated.grcScore
          };
        }
        return v;
      }));

      setSavingGstins(prev => ({ ...prev, [vendorGstin]: 'saved' }));
      setTimeout(() => {
        setSavingGstins(prev => {
          const next = { ...prev };
          delete next[vendorGstin];
          return next;
        });
      }, 2000);
    } catch (err) {
      setSavingGstins(prev => ({ ...prev, [vendorGstin]: 'error' }));
      showToast(err.message || 'Failed to update compliance status', 'error');
      setTimeout(() => {
        setSavingGstins(prev => {
          const next = { ...prev };
          delete next[vendorGstin];
          return next;
        });
      }, 3000);
    }
  };

  const handleCopyGstin = (gstin, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(gstin);
    setCopiedGstin(gstin);
    setTimeout(() => setCopiedGstin(null), 1500);
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

  const openLogoModal = (client, e) => {
    e?.stopPropagation();
    setLogoTargetClient(client);
    setDirectLogoFile(null);
    setDirectLogoPreview(client.hasLogo ? apiClient.getClientLogoUrl(client.id) : null);
    setShowLogoModal(true);
  };

  const handleDeleteClient = async (clientId, clientName, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${clientName}" and remove all mapped vendors?`)) {
      return;
    }
    try {
      await apiClient.deleteClient(clientId);
      showToast(`Client "${clientName}" deleted successfully`);
      if (selectedClient?.id === clientId) {
        setSelectedClient(null);
        setMappedVendors([]);
      }
      fetchClients();
    } catch (err) {
      showToast(err.message || 'Failed to delete client', 'error');
    }
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    const gstin = clientForm.clientGstin.trim().toUpperCase();
    const name = clientForm.clientName.trim();

    if (!gstin || !name) {
      alert('Please provide both Client GSTIN and Legal / Business Name.');
      return;
    }

    if (gstin.length !== 15 || !/^[0-9A-Z]{15}$/.test(gstin)) {
      alert('Client GSTIN must be exactly 15 alphanumeric characters.');
      return;
    }

    setModalSubmitting(true);
    try {
      if (editingClient) {
        await apiClient.updateClient(editingClient.id, { clientGstin: gstin, clientName: name });
        if (clientForm.logoFile) {
          await apiClient.uploadClientLogo(editingClient.id, clientForm.logoFile);
        }
        showToast('Client updated successfully');
        setShowClientModal(false);
        fetchClients(editingClient.id);
      } else {
        const created = await apiClient.createClient({ clientGstin: gstin, clientName: name });
        if (clientForm.logoFile && created?.id) {
          try {
            await apiClient.uploadClientLogo(created.id, clientForm.logoFile);
          } catch (logoErr) {
            console.warn('Logo upload warning:', logoErr);
          }
        }
        showToast('Client created successfully');
        setShowClientModal(false);
        fetchClients(created?.id);
      }
    } catch (err) {
      alert(err.message || 'Operation failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDirectLogoSubmit = async (e) => {
    e.preventDefault();
    if (!directLogoFile || !logoTargetClient) return;

    setLogoSubmitting(true);
    try {
      await apiClient.uploadClientLogo(logoTargetClient.id, directLogoFile);
      showToast('Logo uploaded successfully');
      setShowLogoModal(false);
      fetchClients(logoTargetClient.id);
    } catch (err) {
      alert(err.message || 'Logo upload failed');
    } finally {
      setLogoSubmitting(false);
    }
  };

  // ── Vendor Unmapping Handler ──────────────────────────────────────────────

  const handleUnmapVendor = async (vendorGstin) => {
    if (!selectedClient) return;
    if (!window.confirm(`Unmap vendor "${vendorGstin}" from "${selectedClient.clientName}"?`)) {
      return;
    }
    try {
      await apiClient.unmapVendor(selectedClient.id, vendorGstin);
      showToast(`Vendor ${vendorGstin} unmapped`);
      fetchMappedVendors(selectedClient.id);
      fetchClients(selectedClient.id);
    } catch (err) {
      showToast(err.message || 'Failed to unmap vendor', 'error');
    }
  };

  // ── Map Vendors Modal Handlers ────────────────────────────────────────────

  const openMapModal = async (client) => {
    setSelectedGstinsToMap(new Set());
    setMapSearch('');
    setShowMapModal(true);
    setAllVendorsLoading(true);

    try {
      const [vendors, assignedMap] = await Promise.all([
        apiClient.getDetails(),
        apiClient.getAssignedVendors().catch(() => ({}))
      ]);
      setAllAvailableVendors(vendors || []);
      setAssignedVendorsMap(assignedMap || {});
    } catch (err) {
      showToast(err.message || 'Failed to load vendor registry', 'error');
    } finally {
      setAllVendorsLoading(false);
    }
  };

  const toggleSelectGstin = (gstin) => {
    setSelectedGstinsToMap(prev => {
      const next = new Set(prev);
      if (next.has(gstin)) next.delete(gstin);
      else next.add(gstin);
      return next;
    });
  };

  const handleConfirmMapping = async () => {
    if (!selectedClient || selectedGstinsToMap.size === 0) return;

    setMappingSubmitting(true);
    try {
      const gstinsArray = Array.from(selectedGstinsToMap);
      const res = await apiClient.mapVendors(selectedClient.id, gstinsArray);
      showToast(`Successfully mapped ${res.mappedCount || gstinsArray.length} vendor(s)`);
      setShowMapModal(false);
      fetchMappedVendors(selectedClient.id);
      fetchClients(selectedClient.id);
    } catch (err) {
      alert(err.message || 'Mapping failed');
    } finally {
      setMappingSubmitting(false);
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

      let grcDetails = [];
      try {
        grcDetails = await apiClient.getDetails();
      } catch {
        grcDetails = [];
      }

      const seenVendors = new Map();

      const parsedClients = detectedBlocks.map(block => {
        let resolvedGstin = '';
        const existingClient = clients.find(c => 
          c.clientName && c.clientName.trim().toLowerCase() === block.clientName.toLowerCase()
        );

        if (existingClient) {
          resolvedGstin = existingClient.clientGstin;
        } else {
          const matchedGrc = grcDetails.find(g => 
            (g.tradeName && g.tradeName.toLowerCase().includes(block.clientName.toLowerCase())) ||
            (g.legalName && g.legalName.toLowerCase().includes(block.clientName.toLowerCase()))
          );
          if (matchedGrc) {
            resolvedGstin = matchedGrc.gstin;
          }
        }

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
        replaceExisting: true,
        clients: parsedImportData.map(c => ({
          clientName: c.clientName,
          clientGstin: c.clientGstin,
          vendorGstins: c.vendors.map(v => v.gstin)
        }))
      };

      const result = await apiClient.bulkImportClients(payload);
      showToast(`Sheet imported successfully! Replaced with ${result.clientsCreated} client(s) and ${result.vendorsMapped} vendor(s) mapped.`);
      setShowImportModal(false);
      setParsedImportData([]);
      setSelectedClient(null);
      setMappedVendors([]);
      await fetchClients();
    } catch (err) {
      alert(err.message || 'Import failed');
    } finally {
      setImportSubmitting(false);
    }
  };

  // ── Excel Export Handler ──────────────────────────────────────────────────

  const handleExportExcel = () => {
    if (!filteredMappedVendors || filteredMappedVendors.length === 0) {
      alert('No vendors available to export.');
      return;
    }

    const headers = [
      'Sl. No.',
      'Company Name',
      'GSTN',
      'Type',
      'Age',
      'GST Status',
      'GSTR1',
      'GSTR3B (Delayed)',
      'GSTR7R',
      'Aadhaar Authenticated',
      'Core Activity',
      'Turn over',
      'GRC Score'
    ];

    const dataRows = filteredMappedVendors.map((v, idx) => {
      const gstr7Info = getGstr7Display(v);
      const gstr1Val = inlineCompliance[v.vendorGstin]?.gstr1 ?? v.delayCountGstr1 ?? 0;
      const gstr3bVal = inlineCompliance[v.vendorGstin]?.gstr3b ?? v.delayCountGstr3b ?? 0;
      const gstr1Months = inlineCompliance[v.vendorGstin]?.gstr1Months ?? v.delayedMonthsGstr1 ?? '';
      const gstr3bMonths = inlineCompliance[v.vendorGstin]?.gstr3bMonths ?? v.delayedMonthsGstr3b ?? '';
      const ageVal = v.ageYears !== null && v.ageYears !== undefined ? Math.round(v.ageYears) : computeAge(v.registrationDate);

      return [
        idx + 1,
        getVendorDisplayName(v),
        v.vendorGstin,
        v.gstType || 'Partnership',
        ageVal,
        v.gstStatus || 'Active',
        gstr1Months ? `${gstr1Val} (${gstr1Months})` : gstr1Val,
        gstr3bMonths ? `${gstr3bVal} (${gstr3bMonths})` : gstr3bVal,
        gstr7Info?.status?.text || 'N/A',
        v.aadhaarValidation || 'N/A',
        v.coreActivity || 'Manufacturer',
        v.aggregateTurnover || 'N/A',
        v.grcScore ?? 'N/A'
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assessment');
    const safeClientName = (selectedClient?.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `${safeClientName}_Vendor_Assessment.xlsx`);
  };

  // ── Derived Data & Helpers ────────────────────────────────────────────────

  const getVendorDisplayName = (vendor) => {
    if (!vendor) return '';
    const isInvalid = (str) => {
      if (!str) return true;
      const s = String(str).trim().toLowerCase();
      return s === '' || s === 'na' || s === 'n/a' || s === 'null' || s === 'none' || s === 'undefined' || s === '-';
    };

    const trade = !isInvalid(vendor.tradeName) ? vendor.tradeName.trim() : null;
    const legal = !isInvalid(vendor.legalName) ? vendor.legalName.trim() : null;

    // Prioritize trade name; if null/NA, fallback to legal name; if both fail, GSTIN
    return trade || legal || vendor.vendorGstin || vendor.gstin || '';
  };

  const computeAge = (regDate) => {
    if (!regDate) return '-';
    try {
      const diffDays = (Date.now() - new Date(regDate).getTime()) / (1000 * 60 * 60 * 24);
      const years = Math.round(diffDays / 365.25);
      return years >= 0 ? years : 0;
    } catch {
      return '-';
    }
  };

  const filteredMappedVendors = useMemo(() => {
    let list = mappedVendors;
    const q = vendorSearch.trim().toLowerCase();

    if (q) {
      list = list.filter(v => {
        const displayName = getVendorDisplayName(v).toLowerCase();
        return displayName.includes(q) ||
          (v.vendorGstin && v.vendorGstin.toLowerCase().includes(q)) ||
          (v.tradeName && v.tradeName.toLowerCase().includes(q)) ||
          (v.legalName && v.legalName.toLowerCase().includes(q)) ||
          (v.gstType && v.gstType.toLowerCase().includes(q)) ||
          (v.coreActivity && v.coreActivity.toLowerCase().includes(q)) ||
          (v.aggregateTurnover && v.aggregateTurnover.toLowerCase().includes(q));
      });
    }

    if (statusFilter === 'delayed-gstr1') {
      list = list.filter(v => (inlineCompliance[v.vendorGstin]?.gstr1 ?? v.delayCountGstr1 ?? 0) > 0);
    } else if (statusFilter === 'delayed-gstr3b') {
      list = list.filter(v => (inlineCompliance[v.vendorGstin]?.gstr3b ?? v.delayCountGstr3b ?? 0) > 0);
    } else if (statusFilter === 'active') {
      list = list.filter(v => (v.gstStatus || '').toLowerCase() === 'active');
    } else if (statusFilter === 'high-risk') {
      list = list.filter(v => (v.grcScore !== null && v.grcScore < 40) || (inlineCompliance[v.vendorGstin]?.gstr3b ?? v.delayCountGstr3b ?? 0) >= 2);
    }

    return list;
  }, [mappedVendors, vendorSearch, statusFilter, inlineCompliance]);

  const availableVendorsFiltered = useMemo(() => {
    const q = mapSearch.trim().toLowerCase();
    return allAvailableVendors.filter(v => {
      const displayName = getVendorDisplayName(v).toLowerCase();
      const matchText = !q || 
        displayName.includes(q) ||
        (v.gstin && v.gstin.toLowerCase().includes(q)) ||
        (v.tradeName && v.tradeName.toLowerCase().includes(q)) ||
        (v.legalName && v.legalName.toLowerCase().includes(q));
      return matchText;
    });
  }, [allAvailableVendors, mapSearch]);

  const totalVendorsInSheet = useMemo(() => {
    return parsedImportData.reduce((acc, c) => acc + (c.vendors?.length || 0), 0);
  }, [parsedImportData]);

  const getScoreBadge = (score) => {
    if (score === null || score === undefined) return <span className="score-badge score-na">N/A</span>;
    if (score >= 70) return <span className="score-badge score-high">{score}</span>;
    if (score >= 40) return <span className="score-badge score-mid">{score}</span>;
    return <span className="score-badge score-low">{score}</span>;
  };

  return (
    <div className="client-mapping-container">
      <style>{`
        .client-mapping-container {
          padding: 1.5rem 2rem 4rem;
          max-width: 1600px;
          margin: 0 auto;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1e293b;
        }

        /* Top Bar & Client Selector */
        .client-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
          padding: 1.1rem 1.4rem;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
          gap: 1.25rem;
        }

        .client-selector-group {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .client-label {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .client-dropdown-wrapper {
          position: relative;
          min-width: 290px;
        }

        .client-dropdown-select {
          width: 100%;
          padding: 0.65rem 2.4rem 0.65rem 1rem;
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 700;
          color: #1e293b;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          outline: none;
          cursor: pointer;
          appearance: none;
          transition: all 0.2s ease;
        }

        .client-dropdown-select:hover {
          border-color: #94a3b8;
          background: #ffffff;
        }

        .client-dropdown-select:focus {
          border-color: #7c3aed;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }

        .dropdown-chevron {
          position: absolute;
          right: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #64748b;
        }

        .client-info-pill {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.35rem 0.85rem;
          background: #f1f5f9;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }

        .client-logo-avatar {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          object-fit: contain;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 2px;
        }

        .client-meta-gstin {
          font-family: 'SFMono-Regular', Consolas, monospace;
          font-size: 0.78rem;
          font-weight: 700;
          color: #334155;
          letter-spacing: 0.03em;
        }

        .client-meta-count {
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0.2rem 0.55rem;
          border-radius: 9999px;
          background: #ede9fe;
          color: #6d28d9;
        }

        .top-action-buttons {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        /* Buttons */
        .btn-primary-gradient {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.55rem 1rem;
          font-family: inherit;
          font-size: 0.84rem;
          font-weight: 700;
          color: #ffffff;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25);
        }

        .btn-primary-gradient:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .btn-success-gradient {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.55rem 1rem;
          font-family: inherit;
          font-size: 0.84rem;
          font-weight: 700;
          color: #ffffff;
          background: linear-gradient(135deg, #059669, #047857);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
        }

        .btn-success-gradient:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .btn-secondary-sm {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.85rem;
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          color: #334155;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-secondary-sm:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }

        .btn-danger-sm {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          font-family: inherit;
          color: #ef4444;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-danger-sm:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        /* Prominent Save Button above Table */
        .btn-save-compliance {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.52rem 1.05rem;
          font-family: inherit;
          font-size: 0.84rem;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
        }

        .btn-save-compliance.has-changes {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
          animation: pulseSaveButton 2s infinite ease-in-out;
        }

        .btn-save-compliance.has-changes:hover {
          background: linear-gradient(135deg, #1d4ed8, #1e40af);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
        }

        .btn-save-compliance.is-saved {
          background: #10b981;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        .btn-save-compliance.no-changes {
          background: #f1f5f9;
          color: #94a3b8;
          border-color: #e2e8f0;
          cursor: not-allowed;
        }

        .btn-save-compliance:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .save-badge-count {
          background: rgba(255, 255, 255, 0.25);
          padding: 0.1rem 0.45rem;
          border-radius: 9999px;
          font-size: 0.76rem;
          font-weight: 800;
          margin-left: 0.2rem;
        }

        @keyframes pulseSaveButton {
          0% {
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
          }
        }

        /* Filter & Toolbar Area */
        .table-toolbar-card {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .search-and-filters {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          flex: 1;
        }

        .search-input-wrapper {
          position: relative;
          min-width: 280px;
          max-width: 380px;
          flex: 1;
        }

        .search-input-wrapper input {
          width: 100%;
          padding: 0.55rem 0.8rem 0.55rem 2.3rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 0.85rem;
          outline: none;
          font-family: inherit;
          background: #f8fafc;
        }

        .search-input-wrapper input:focus {
          border-color: #7c3aed;
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.12);
        }

        .filter-chip-group {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }

        .filter-chip {
          padding: 0.35rem 0.75rem;
          font-size: 0.78rem;
          font-weight: 700;
          border-radius: 9999px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .filter-chip:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .filter-chip.active {
          background: #3b1d6e;
          color: #ffffff;
          border-color: #3b1d6e;
        }

        /* Standard Assessment Table */
        .table-container-card {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }

        .table-responsive-wrapper {
          overflow-x: auto;
          max-height: calc(100vh - 280px);
          position: relative;
        }

        .assessment-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.84rem;
          text-align: left;
          min-width: 1250px;
        }

        /* Dark Purple Header matching Excel screenshot */
        .assessment-table th {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #3b1d6e;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.82rem;
          padding: 0.85rem 0.65rem;
          letter-spacing: 0.01em;
          white-space: nowrap;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: 2px solid #28124d;
        }

        .assessment-table th:last-child {
          border-right: none;
        }

        .assessment-table td {
          padding: 0.65rem 0.65rem;
          border-bottom: 1px solid #f1f5f9;
          border-right: 1px solid #f8fafc;
          vertical-align: middle;
          color: #1e293b;
        }

        .assessment-table tr:hover td {
          background-color: #faf5ff;
        }

        .assessment-table tr:last-child td {
          border-bottom: none;
        }

        /* Cell Specifics */
        .company-cell {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          max-width: 250px;
        }

        .company-icon {
          flex-shrink: 0;
        }

        .company-name-text {
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
          white-space: normal;
          word-break: break-word;
        }

        .gstn-cell {
          font-family: 'SFMono-Regular', Consolas, monospace;
          font-size: 0.82rem;
          font-weight: 700;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .copy-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          border-radius: 4px;
        }

        .copy-btn:hover {
          color: #7c3aed;
          background: #f1f5f9;
        }

        /* Editable Compliance Cell */
        .compliance-cell {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .compliance-edit-box {
          width: 38px;
          height: 30px;
          border-radius: 6px;
          text-align: center;
          font-family: inherit;
          font-size: 0.88rem;
          font-weight: 800;
          outline: none;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          transition: all 0.15s ease;
        }

        .compliance-edit-box:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
          background: #ffffff;
        }

        .compliance-zero {
          color: #15803d;
          border-color: #bbf7d0;
          background: #f0fdf4;
        }

        .compliance-has-delay {
          color: #b45309;
          border-color: #fde68a;
          background: #fffbeb;
        }

        .compliance-high-delay {
          color: #b91c1c;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .compliance-edit-box.is-dirty {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25) !important;
          background-color: #eff6ff !important;
          color: #1d4ed8 !important;
        }

        /* Month Picker Button & Months Display */
        .btn-month-picker {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          transition: all 0.15s ease;
          padding: 0;
          flex-shrink: 0;
        }

        .btn-month-picker:hover {
          background: #ede9fe;
          color: #7c3aed;
          border-color: #c4b5fd;
          transform: translateY(-1px);
        }

        .btn-month-picker.has-months {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fca5a5;
        }

        .compliance-months-display {
          color: #dc2626;
          font-weight: 700;
          font-size: 0.74rem;
          white-space: nowrap;
          letter-spacing: -0.01em;
          padding: 1px 3px;
        }

        /* Month Picker Modal Styles */
        .year-tabs {
          display: flex;
          gap: 0.45rem;
          margin-bottom: 0.9rem;
          flex-wrap: wrap;
        }

        .year-tab-btn {
          padding: 0.35rem 0.8rem;
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 700;
          border-radius: 20px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .year-tab-btn:hover {
          border-color: #94a3b8;
          color: #1e293b;
        }

        .year-tab-btn.active {
          background: #7c3aed;
          color: #ffffff;
          border-color: #7c3aed;
          box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25);
        }

        .month-picker-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 1.15rem;
        }

        .month-btn {
          padding: 0.6rem 0.5rem;
          font-family: inherit;
          font-size: 0.84rem;
          font-weight: 700;
          border-radius: 8px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .month-btn:hover {
          background: #ede9fe;
          color: #6d28d9;
          border-color: #c4b5fd;
        }

        .month-btn.selected {
          background: #dc2626;
          color: #ffffff;
          border-color: #b91c1c;
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3);
        }

        .quick-presets-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .preset-chip {
          padding: 0.25rem 0.6rem;
          font-size: 0.74rem;
          font-weight: 700;
          border-radius: 6px;
          border: 1px solid #fed7aa;
          background: #fff7ed;
          color: #c2410c;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .preset-chip:hover {
          background: #ffedd5;
          border-color: #fb923c;
        }

        .selected-tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-bottom: 0.85rem;
          min-height: 34px;
          padding: 0.45rem;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px dashed #cbd5e1;
          align-items: center;
        }

        .month-tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem 0.55rem;
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
          border-radius: 9999px;
          font-size: 0.76rem;
          font-weight: 700;
        }

        .month-tag-pill button {
          background: none;
          border: none;
          color: #991b1b;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          font-size: 0.95rem;
          line-height: 1;
        }

        .dirty-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #2563eb;
          display: inline-block;
          flex-shrink: 0;
          animation: pulseSaveButton 1.5s infinite ease-in-out;
        }

        .save-indicator {
          font-size: 0.7rem;
          font-weight: 700;
          color: #16a34a;
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .delay-tag {
          font-size: 0.72rem;
          font-weight: 700;
          color: #dc2626;
          white-space: nowrap;
        }

        /* GSTR7 Badge */
        .gstr7-badge {
          display: inline-block;
          padding: 0.2rem 0.55rem;
          font-size: 0.76rem;
          font-weight: 700;
          border-radius: 6px;
          white-space: nowrap;
        }

        /* Status Pills */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.55rem;
          border-radius: 9999px;
        }

        .status-active {
          background: #dcfce7;
          color: #15803d;
        }

        .status-inactive {
          background: #fee2e2;
          color: #b91c1c;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        /* Score Badge */
        .score-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 24px;
          padding: 0 0.4rem;
          border-radius: 6px;
          font-weight: 800;
          font-size: 0.8rem;
        }

        .score-high {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .score-mid {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .score-low {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .score-na {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .btn-table-action {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #64748b;
          border-radius: 6px;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }

        .btn-table-action:hover {
          color: #7c3aed;
          background: #f1f5f9;
        }

        .btn-table-danger:hover {
          color: #ef4444;
          background: #fef2f2;
        }

        /* Spin */
        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Toast Alert */
        .toast-notification {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          z-index: 1000;
          padding: 0.85rem 1.35rem;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 700;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          gap: 0.6rem;
          animation: slideUp 0.3s ease;
        }

        .toast-success {
          background: #0f172a;
          color: #ffffff;
          border-left: 4px solid #10b981;
        }

        .toast-error {
          background: #0f172a;
          color: #ffffff;
          border-left: 4px solid #ef4444;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 520px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }

        .modal-card-lg {
          max-width: 950px;
        }

        .modal-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .form-group {
          margin-bottom: 1.1rem;
        }

        .form-label {
          display: block;
          font-size: 0.82rem;
          font-weight: 700;
          color: #334155;
          margin-bottom: 0.35rem;
        }

        .form-input {
          width: 100%;
          padding: 0.6rem 0.85rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 0.88rem;
          outline: none;
          font-family: inherit;
        }

        .form-input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
        }

        .upload-dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          cursor: pointer;
          background: #f8fafc;
          transition: all 0.2s;
        }

        .upload-dropzone:hover {
          border-color: #7c3aed;
          background: #f5f3ff;
        }

        .btn-ghost-sm {
          padding: 0.5rem 0.85rem;
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          color: #64748b;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: 8px;
        }

        .btn-ghost-sm:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .empty-state-card {
          padding: 4rem 2rem;
          text-align: center;
          color: #64748b;
        }
      `}</style>

      {/* ── Top Bar with Client-Wise Filter Dropdown ── */}
      <div className="client-top-bar">
        <div className="client-selector-group">
          <div className="client-label">
            <Building2 size={18} color="#7c3aed" />
            <span>Select Client:</span>
          </div>

          <div className="client-dropdown-wrapper">
            <select
              className="client-dropdown-select"
              value={selectedClient?.id || ''}
              onChange={(e) => {
                const c = clients.find(item => item.id === Number(e.target.value));
                setSelectedClient(c || null);
              }}
              disabled={clientsLoading || clients.length === 0}
            >
              {clients.length === 0 && (
                <option value="">No clients found - import or add client</option>
              )}
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.clientName} ({c.vendorCount ?? 0} vendors)
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="dropdown-chevron" />
          </div>

          {selectedClient && (
            <div className="client-info-pill">
              {selectedClient.hasLogo ? (
                <img
                  src={apiClient.getClientLogoUrl(selectedClient.id)}
                  alt={selectedClient.clientName}
                  className="client-logo-avatar"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  width: '32px', height: '32px', borderRadius: '6px',
                  background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#7c3aed', fontWeight: 800, fontSize: '0.85rem'
                }}>
                  {selectedClient.clientName?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div>
                <div className="client-meta-gstin">{selectedClient.clientGstin}</div>
              </div>
              <span className="client-meta-count">{mappedVendors.length} Vendors</span>
            </div>
          )}
        </div>

        <div className="top-action-buttons">
          <button className="btn-success-gradient" onClick={openImportModal} title="Upload client & vendor Excel sheet">
            <FileSpreadsheet size={16} /> Import from Sheet
          </button>
          <button className="btn-primary-gradient" onClick={openAddClientModal}>
            <Plus size={16} /> Add Client
          </button>
          {selectedClient && (
            <>
              <button className="btn-secondary-sm" onClick={() => openMapModal(selectedClient)} title="Search and map existing GRC vendors to this client">
                <Users size={15} /> Map More Vendors
              </button>
              <button className="btn-secondary-sm" onClick={(e) => openEditClientModal(selectedClient, e)} title="Edit Client details">
                <Edit2 size={14} /> Edit
              </button>
              <button className="btn-secondary-sm" onClick={(e) => openLogoModal(selectedClient, e)} title="Change or upload Client Logo">
                <Upload size={14} /> Logo
              </button>
              <button className="btn-danger-sm" onClick={(e) => handleDeleteClient(selectedClient.id, selectedClient.clientName, e)} title="Delete Client">
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Table Toolbar (Search, Filter, Export) ── */}
      <div className="table-toolbar-card">
        <div className="search-and-filters">
          <div className="search-input-wrapper">
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search vendor name, GSTIN, activity, turnover..."
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
            />
          </div>

          <div className="filter-chip-group">
            <button
              className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({mappedVendors.length})
            </button>
            <button
              className={`filter-chip ${statusFilter === 'delayed-gstr1' ? 'active' : ''}`}
              onClick={() => setStatusFilter('delayed-gstr1')}
            >
              Delayed GSTR-1
            </button>
            <button
              className={`filter-chip ${statusFilter === 'delayed-gstr3b' ? 'active' : ''}`}
              onClick={() => setStatusFilter('delayed-gstr3b')}
            >
              Delayed GSTR-3B
            </button>
            <button
              className={`filter-chip ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active GST
            </button>
            <button
              className={`filter-chip ${statusFilter === 'high-risk' ? 'active' : ''}`}
              onClick={() => setStatusFilter('high-risk')}
            >
              High Risk
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className={`btn-save-compliance ${savedSuccessFlash ? 'is-saved' : modifiedGstins.size > 0 ? 'has-changes' : 'no-changes'}`}
            onClick={handleSaveAllCompliance}
            disabled={isSavingAll || (modifiedGstins.size === 0 && !savedSuccessFlash)}
            title={modifiedGstins.size > 0 ? `Save compliance changes for ${modifiedGstins.size} vendor(s)` : 'No unsaved changes'}
          >
            {isSavingAll ? (
              <>
                <Loader2 size={15} className="spin-icon" /> Saving...
              </>
            ) : savedSuccessFlash ? (
              <>
                <Check size={15} /> All Saved!
              </>
            ) : (
              <>
                <Save size={15} /> Save Changes
                {modifiedGstins.size > 0 && (
                  <span className="save-badge-count">{modifiedGstins.size}</span>
                )}
              </>
            )}
          </button>

          <button className="btn-secondary-sm" onClick={handleExportExcel} disabled={!filteredMappedVendors.length}>
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* ── Standard Assessment Table (Matching Excel Template) ── */}
      <div className="table-container-card">
        {vendorsLoading ? (
          <div className="empty-state-card">
            <Loader2 size={32} className="spin-icon" style={{ margin: '0 auto 1rem', color: '#7c3aed' }} />
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Loading mapped vendors for {selectedClient?.clientName}...</div>
          </div>
        ) : !selectedClient ? (
          <div className="empty-state-card">
            <Building2 size={44} style={{ margin: '0 auto 1rem', color: '#94a3b8' }} />
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginBottom: '0.4rem' }}>No Client Selected</div>
            <div style={{ fontSize: '0.85rem' }}>Select a client from the dropdown above or import an Excel sheet.</div>
          </div>
        ) : filteredMappedVendors.length === 0 ? (
          <div className="empty-state-card">
            <Users size={44} style={{ margin: '0 auto 1rem', color: '#94a3b8' }} />
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginBottom: '0.4rem' }}>
              {mappedVendors.length === 0 ? `No vendors mapped to "${selectedClient.clientName}" yet` : 'No matching vendors found'}
            </div>
            <div style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {mappedVendors.length === 0 
                ? 'Upload an Excel sheet or click "Map More Vendors" to associate vendors with this client.' 
                : 'Try clearing your search query or filter chip.'}
            </div>
            {mappedVendors.length === 0 && (
              <button className="btn-primary-gradient" onClick={() => openMapModal(selectedClient)}>
                <Users size={16} /> Map Vendors Now
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="assessment-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>Sl. No.</th>
                  <th style={{ minWidth: '220px' }}>Company Name</th>
                  <th style={{ minWidth: '150px' }}>GSTN</th>
                  <th style={{ minWidth: '130px' }}>Type</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Age</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>GST Status</th>
                  <th style={{ minWidth: '110px' }} title="Editable field — edit and click 'Save Changes' above">
                    GSTR1 ✎
                  </th>
                  <th style={{ minWidth: '150px' }} title="Editable field — edit and click 'Save Changes' above">
                    GSTR3B (Delayed) ✎
                  </th>
                  <th style={{ minWidth: '160px' }}>GSTR7R</th>
                  <th style={{ minWidth: '110px', textAlign: 'center' }}>Aadhaar Authenticated</th>
                  <th style={{ minWidth: '170px' }}>Core Activity</th>
                  <th style={{ minWidth: '130px' }}>Turn over</th>
                  <th style={{ minWidth: '100px', textAlign: 'center' }}>Score & Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappedVendors.map((vendor, index) => {
                  const gstin = vendor.vendorGstin;
                  const gstr1Val = inlineCompliance[gstin]?.gstr1 ?? vendor.delayCountGstr1 ?? 0;
                  const gstr3bVal = inlineCompliance[gstin]?.gstr3b ?? vendor.delayCountGstr3b ?? 0;
                  const gstr1Months = inlineCompliance[gstin]?.gstr1Months ?? vendor.delayedMonthsGstr1 ?? '';
                  const gstr3bMonths = inlineCompliance[gstin]?.gstr3bMonths ?? vendor.delayedMonthsGstr3b ?? '';
                  const isGstr1Modified = (inlineCompliance[gstin]?.gstr1 !== undefined && inlineCompliance[gstin]?.gstr1 !== (vendor.delayCountGstr1 ?? 0)) ||
                    (inlineCompliance[gstin]?.gstr1Months !== undefined && inlineCompliance[gstin]?.gstr1Months !== (vendor.delayedMonthsGstr1 || ''));
                  const isGstr3bModified = (inlineCompliance[gstin]?.gstr3b !== undefined && inlineCompliance[gstin]?.gstr3b !== (vendor.delayCountGstr3b ?? 0)) ||
                    (inlineCompliance[gstin]?.gstr3bMonths !== undefined && inlineCompliance[gstin]?.gstr3bMonths !== (vendor.delayedMonthsGstr3b || ''));
                  const saveStatus = savingGstins[gstin];
                  const gstr7Info = getGstr7Display(vendor);
                  const isHighRisk = (vendor.grcScore !== null && vendor.grcScore < 40) || gstr3bVal >= 2;
                  const ageDisplay = vendor.ageYears !== null && vendor.ageYears !== undefined
                    ? Math.round(vendor.ageYears)
                    : computeAge(vendor.registrationDate);

                  return (
                    <tr key={gstin}>
                      {/* Sl. No. */}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                        {index + 1}
                      </td>

                      {/* Company Name */}
                      <td>
                        <div className="company-cell">
                          <span className="company-icon">
                            <CheckCircle2 size={16} color="#16a34a" />
                          </span>
                          <span className="company-name-text">
                            {getVendorDisplayName(vendor)}
                          </span>
                        </div>
                      </td>

                      {/* GSTN */}
                      <td>
                        <div className="gstn-cell">
                          <span>{gstin}</span>
                          <button
                            type="button"
                            className="copy-btn"
                            onClick={(e) => handleCopyGstin(gstin, e)}
                            title="Copy GSTIN"
                          >
                            {copiedGstin === gstin ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </td>

                      {/* Type */}
                      <td style={{ color: '#475569', fontSize: '0.82rem' }}>
                        {vendor.gstType || 'Partnership'}
                      </td>

                      {/* Age */}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#334155' }} title={vendor.registrationDate ? `Registered: ${vendor.registrationDate}` : ''}>
                        {ageDisplay}
                      </td>

                      {/* GST Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-pill ${(vendor.gstStatus || '').toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}`}>
                          <span className="dot"></span>
                          {vendor.gstStatus || 'Active'}
                        </span>
                      </td>

                      {/* GSTR1 (Directly Editable) */}
                      <td>
                        <div className="compliance-cell">
                          <input
                            type="number"
                            min="0"
                            max="36"
                            className={`compliance-edit-box ${
                              isGstr1Modified
                                ? 'is-dirty'
                                : gstr1Val > 0 
                                  ? 'compliance-has-delay' 
                                  : 'compliance-zero'
                            }`}
                            value={gstr1Val}
                            onChange={(e) => handleComplianceChange(gstin, 'gstr1', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveAllCompliance()}
                            title="Edit GSTR-1 delay count"
                          />
                          <button
                            type="button"
                            className={`btn-month-picker ${gstr1Months ? 'has-months' : ''}`}
                            onClick={() => openMonthPicker(vendor, 'gstr1')}
                            title={gstr1Months ? `Delayed months: ${gstr1Months} (Click to edit)` : "Select delayed months for GSTR-1"}
                          >
                            <Calendar size={13} />
                          </button>
                          {gstr1Months && (
                            <span className="compliance-months-display" title={`Delayed months: ${gstr1Months}`}>
                              {gstr1Months}
                            </span>
                          )}
                          {isGstr1Modified && <span className="dirty-dot" title="Unsaved changes" />}
                          {saveStatus === 'saving' && <Loader2 size={13} className="spin-icon" color="#7c3aed" />}
                          {saveStatus === 'saved' && <span className="save-indicator">✓</span>}
                        </div>
                      </td>

                      {/* GSTR3B (Delayed) (Directly Editable) */}
                      <td>
                        <div className="compliance-cell">
                          <input
                            type="number"
                            min="0"
                            max="36"
                            className={`compliance-edit-box ${
                              isGstr3bModified
                                ? 'is-dirty'
                                : gstr3bVal >= 2 
                                  ? 'compliance-high-delay' 
                                  : gstr3bVal > 0 
                                    ? 'compliance-has-delay' 
                                    : 'compliance-zero'
                            }`}
                            value={gstr3bVal}
                            onChange={(e) => handleComplianceChange(gstin, 'gstr3b', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveAllCompliance()}
                            title="Edit GSTR-3B delay count"
                          />
                          <button
                            type="button"
                            className={`btn-month-picker ${gstr3bMonths ? 'has-months' : ''}`}
                            onClick={() => openMonthPicker(vendor, 'gstr3b')}
                            title={gstr3bMonths ? `Delayed months: ${gstr3bMonths} (Click to edit)` : "Select delayed months for GSTR-3B"}
                          >
                            <Calendar size={13} />
                          </button>
                          {gstr3bMonths ? (
                            <span className="compliance-months-display" title={`Delayed months: ${gstr3bMonths}`}>
                              {gstr3bMonths}
                            </span>
                          ) : gstr3bVal > 0 ? (
                            <span className="delay-tag">
                              {gstr3bVal >= 2 ? 'Delayed' : 'Delay'}
                            </span>
                          ) : null}
                          {isGstr3bModified && <span className="dirty-dot" title="Unsaved changes" />}
                          {saveStatus === 'saving' && <Loader2 size={13} className="spin-icon" color="#7c3aed" />}
                          {saveStatus === 'saved' && <span className="save-indicator">✓</span>}
                        </div>
                      </td>

                      {/* GSTR7R */}
                      <td>
                        <span
                          className="gstr7-badge"
                          style={{
                            background: gstr7Info.status.bg,
                            color: gstr7Info.status.color,
                            border: `1px solid ${gstr7Info.status.border}`
                          }}
                        >
                          {gstr7Info.status.text}
                        </span>
                      </td>

                      {/* Aadhaar Authenticated */}
                      <td style={{ textAlign: 'center' }}>
                        {vendor.aadhaarValidation === 'Yes' ? (
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>Yes</span>
                        ) : vendor.aadhaarValidation === 'No' ? (
                          <span style={{ color: '#64748b', fontWeight: 700 }}>No</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Core Activity */}
                      <td style={{ color: '#475569', fontSize: '0.82rem' }}>
                        {vendor.coreActivity || 'Manufacturer'}
                      </td>

                      {/* Turn over */}
                      <td style={{ color: '#334155', fontWeight: 600, fontSize: '0.82rem' }}>
                        {vendor.aggregateTurnover || 'N/A'}
                      </td>

                      {/* Score & Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          {getScoreBadge(vendor.grcScore)}
                          <a
                            href={vendor.reportUrl || `/vendor-report/${gstin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-table-action"
                            title="View Standalone Vendor Assessment Report"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            type="button"
                            className="btn-table-action btn-table-danger"
                            onClick={() => handleUnmapVendor(gstin)}
                            title="Unmap Vendor from Client"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Toast Notification ── */}
      {notification && (
        <div className={`toast-notification ${notification.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {notification.type === 'error' ? <AlertCircle size={18} color="#ef4444" /> : <Check size={18} color="#10b981" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ── ADD / EDIT CLIENT MODAL ── */}
      {showClientModal && (
        <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
              <button onClick={() => setShowClientModal(false)} className="btn-ghost-sm"><X size={18} /></button>
            </div>
            <form onSubmit={handleClientSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Client GSTIN *</label>
                  <input
                    type="text"
                    maxLength={15}
                    className="form-input"
                    placeholder="e.g. 03AAECA7648B1Z2"
                    value={clientForm.clientGstin}
                    onChange={(e) => setClientForm({ ...clientForm, clientGstin: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Legal / Business Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ALLIED RECYCLING LIMITED"
                    value={clientForm.clientName}
                    onChange={(e) => setClientForm({ ...clientForm, clientName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Logo (Optional, max 2MB)</label>
                  <div
                    className="upload-dropzone"
                    onClick={() => document.getElementById('client-logo-input')?.click()}
                  >
                    <input
                      id="client-logo-input"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            alert('Logo image must be smaller than 2MB.');
                            return;
                          }
                          setClientForm({ ...clientForm, logoFile: file });
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    {logoPreview ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <img src={logoPreview} alt="Preview" style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
                        <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700 }}>Click to change image</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                        <UploadCloud size={28} color="#7c3aed" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Click or drag logo here (PNG, JPEG, SVG)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost-sm" onClick={() => setShowClientModal(false)} disabled={modalSubmitting}>Cancel</button>
                <button type="submit" className="btn-primary-gradient" disabled={modalSubmitting}>
                  {modalSubmitting ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── UPLOAD LOGO MODAL ── */}
      {showLogoModal && logoTargetClient && (
        <div className="modal-overlay" onClick={() => setShowLogoModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Upload Logo: {logoTargetClient.clientName}</h3>
              <button onClick={() => setShowLogoModal(false)} className="btn-ghost-sm"><X size={18} /></button>
            </div>
            <form onSubmit={handleDirectLogoSubmit}>
              <div className="modal-body">
                <div
                  className="upload-dropzone"
                  onClick={() => document.getElementById('direct-logo-input')?.click()}
                >
                  <input
                    id="direct-logo-input"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          alert('Logo image must be smaller than 2MB.');
                          return;
                        }
                        setDirectLogoFile(file);
                        setDirectLogoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {directLogoPreview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <img src={directLogoPreview} alt="Preview" style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain' }} />
                      <span style={{ fontSize: '0.78rem', color: '#7c3aed', fontWeight: 700 }}>Click to choose a different logo</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                      <UploadCloud size={32} color="#7c3aed" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Click to select a logo (PNG, JPEG, SVG)</span>
                      <span style={{ fontSize: '0.75rem' }}>Maximum file size: 2MB</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost-sm" onClick={() => setShowLogoModal(false)} disabled={logoSubmitting}>Cancel</button>
                <button type="submit" className="btn-primary-gradient" disabled={logoSubmitting || !directLogoFile}>
                  {logoSubmitting ? 'Uploading...' : 'Upload Logo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MAP VENDORS MODAL ── */}
      {showMapModal && selectedClient && (
        <div className="modal-overlay" onClick={() => setShowMapModal(false)}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Map Vendors to: {selectedClient.clientName}</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Select vendors to map exclusively to this client (strict 1-to-many relationship).
                </div>
              </div>
              <button onClick={() => setShowMapModal(false)} className="btn-ghost-sm"><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '550px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search available vendors by name or GSTIN..."
                  value={mapSearch}
                  onChange={(e) => setMapSearch(e.target.value)}
                  style={{ paddingLeft: '2.4rem' }}
                />
              </div>

              {allVendorsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <Loader2 size={28} className="spin-icon" style={{ margin: '0 auto 0.5rem', color: '#7c3aed' }} />
                  <div>Loading vendor registry...</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {availableVendorsFiltered.slice(0, 100).map(vendor => {
                    const gstin = vendor.gstin;
                    const assignedInfo = assignedVendorsMap[gstin];
                    const isAlreadyMappedToCurrent = mappedVendors.some(m => m.vendorGstin === gstin);
                    const isMappedToOther = assignedInfo && assignedInfo.clientId !== selectedClient.id;
                    const isSelected = selectedGstinsToMap.has(gstin);

                    return (
                      <div
                        key={gstin}
                        onClick={() => {
                          if (isAlreadyMappedToCurrent) return;
                          toggleSelectGstin(gstin);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.9rem',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                          background: isSelected ? '#f5f3ff' : isAlreadyMappedToCurrent ? '#f8fafc' : '#ffffff',
                          cursor: isAlreadyMappedToCurrent ? 'not-allowed' : 'pointer',
                          opacity: isAlreadyMappedToCurrent ? 0.7 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div>
                            {isAlreadyMappedToCurrent ? (
                              <CheckSquare size={18} color="#16a34a" />
                            ) : isSelected ? (
                              <CheckSquare size={18} color="#7c3aed" />
                            ) : (
                              <Square size={18} color="#94a3b8" />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                              {getVendorDisplayName(vendor) || 'Unnamed Vendor'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>
                              {gstin}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isAlreadyMappedToCurrent && (
                            <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
                              Already Mapped
                            </span>
                          )}
                          {isMappedToOther && (
                            <span style={{ fontSize: '0.72rem', background: '#fffbeb', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 700 }} title={`Mapped to ${assignedInfo.clientName}. Selecting will reassign to this client.`}>
                              Mapped to: {assignedInfo.clientName}
                            </span>
                          )}
                          {getScoreBadge(vendor.grcScore)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <span style={{ marginRight: 'auto', fontSize: '0.82rem', color: '#64748b', alignSelf: 'center' }}>
                Selected: <strong>{selectedGstinsToMap.size}</strong> vendor(s)
              </span>
              <button type="button" className="btn-ghost-sm" onClick={() => setShowMapModal(false)} disabled={mappingSubmitting}>Cancel</button>
              <button
                type="button"
                className="btn-primary-gradient"
                disabled={mappingSubmitting || selectedGstinsToMap.size === 0}
                onClick={handleConfirmMapping}
              >
                {mappingSubmitting ? 'Mapping...' : `Map Selected (${selectedGstinsToMap.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT SHEET PREVIEW MODAL ── */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importSubmitting && setShowImportModal(false)}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Import & Map Clients from Excel</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Upload Excel (.xlsx, .xls) with side-by-side client blocks.
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} disabled={importSubmitting} className="btn-ghost-sm"><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '580px', overflowY: 'auto' }}>
              {!parsedImportData.length ? (
                <div
                  className="upload-dropzone"
                  onClick={() => document.getElementById('sheet-file-input')?.click()}
                  style={{ padding: '3rem 1.5rem' }}
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
                    <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                      {importParsing ? 'Analyzing sheet format...' : 'Click or drag Excel / CSV file here to upload'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '480px', lineHeight: 1.5 }}>
                      Expected format: Row 1 contains Client Names side-by-side horizontally. Below each client are their respective Vendor & GSTN columns.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    borderRadius: '10px',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#5b21b6', fontSize: '0.88rem' }}>
                      <Check size={16} color="#7c3aed" />
                      Detected {parsedImportData.length} Client(s) • Total {totalVendorsInSheet} Vendor(s) to map
                    </div>
                    <button type="button" className="btn-ghost-sm" onClick={() => { setParsedImportData([]); setImportFile(null); }}>
                      Choose Different File
                    </button>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.65rem 0.9rem',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                    color: '#92400e',
                    lineHeight: 1.4
                  }}>
                    <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Replace Existing Clients:</strong> All current clients and their mapped vendors will be replaced with the data from this sheet upon import.
                    </span>
                  </div>

                  {/* Client Cards List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {parsedImportData.map((clientItem, idx) => {
                      const isExpanded = expandedClientIndex === idx;
                      return (
                        <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem 1rem',
                            background: '#f8fafc',
                            borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <Building2 size={16} color="#7c3aed" />
                              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                                {clientItem.clientName}
                              </span>
                              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: '#ede9fe', color: '#6d28d9', fontWeight: 800 }}>
                                {clientItem.vendors.length} vendors
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>GSTIN:</span>
                                <input
                                  type="text"
                                  maxLength={15}
                                  value={clientItem.clientGstin}
                                  onChange={(e) => handleUpdateClientGstin(idx, e.target.value)}
                                  placeholder="Auto-resolving..."
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    width: '145px',
                                    textAlign: 'center'
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                className="btn-ghost-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => setExpandedClientIndex(isExpanded ? null : idx)}
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '0.85rem 1rem', background: '#ffffff', maxHeight: '180px', overflowY: 'auto' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {clientItem.vendors.map((v, vIdx) => (
                                  <span
                                    key={vIdx}
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      padding: '0.2rem 0.5rem',
                                      background: '#f1f5f9',
                                      borderRadius: '4px',
                                      color: '#334155'
                                    }}
                                  >
                                    {v.gstin}
                                  </span>
                                ))}
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
                    Ready to create <strong>{parsedImportData.length}</strong> clients and map <strong>{totalVendorsInSheet}</strong> vendors.
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => setShowImportModal(false)} disabled={importSubmitting}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary-gradient"
                  disabled={importSubmitting || !parsedImportData.length}
                  onClick={handleConfirmImport}
                >
                  {importSubmitting ? 'Replacing & Importing...' : `Replace & Import All (${parsedImportData.length} Clients)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
