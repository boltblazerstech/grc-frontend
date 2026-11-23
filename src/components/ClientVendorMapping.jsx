import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Building2, Users, Plus, Search, Trash2, Edit2, Upload, 
  Check, X, ExternalLink, ShieldCheck, AlertCircle, Image as ImageIcon,
  ChevronRight, RefreshCw, CheckSquare, Square, FileSpreadsheet,
  UploadCloud, ChevronDown, ChevronUp, AlertTriangle, Download,
  Copy, CheckCircle2, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Save, Calendar,
  FileText, Sliders, RotateCcw, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { apiClient } from '../api/apiClient';
import { getGstr7Display } from '../utils/gstr7Display';
import {
  getDefaultTemplate,
  exportReportToPdf,
  exportReportToDocx,
  loadImageAsBase64
} from '../utils/reportExportHelper';
import GstDetailsModal from './GstDetailsModal';

export default function ClientVendorMapping({ currentUser }) {
  // Dynamic Rolling 15 Months relative to current calendar/filing period
  const rolling15Months = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth(); // 0 to 11
    const monthNames = ['Jan', 'Feb', 'March', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const rawList = [];

    for (let i = 14; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      const y = d.getFullYear();
      const mIdx = d.getMonth();
      const name = monthNames[mIdx];
      rawList.push({ name, year: y, monthIndex: mIdx, date: d });
    }

    return rawList.map(item => {
      // All previous year months get year suffix (e.g. "Sep 2025", "Dec 2025")
      // Current year months stay as bare month names (e.g. "Jan", "Sep", "Oct", "Nov")
      const isPreviousYear = item.year < curYear;
      const label = isPreviousYear ? `${item.name} ${item.year}` : item.name;
      return {
        ...item,
        label,
        isPreviousYear,
        isCurrentYear: item.year === curYear
      };
    });
  }, []);

  const allSelectableMonths = useMemo(() => rolling15Months.map(m => m.label), [rolling15Months]);
  const last12Months = allSelectableMonths;

  // Recent 3 active/rolling months of the current year for Scenario 8 "Risky" determination
  const recent3CurrentMonths = useMemo(() => {
    const curMonthIdx = new Date().getMonth();
    const monthShorts = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const list = [];
    for (let i = 2; i >= 0; i--) {
      const idx = (curMonthIdx - i + 12) % 12;
      list.push(monthShorts[idx]);
    }
    return list;
  }, []);
  // State for Clients
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(urlTab === 'by-client' ? 'by-client' : 'all-vendors');
  const [allVendorsClientFilter, setAllVendorsClientFilter] = useState('ALL');

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(
    urlTab === 'by-client' ? null : { id: 'ALL', clientName: 'All Clients', isAllVendors: true }
  );
  const [clientsLoading, setClientsLoading] = useState(true);

  // Total vendors count across all clients
  const totalAllVendorsCount = useMemo(() => {
    return clients.reduce((sum, c) => sum + (c.vendorCount ?? 0), 0);
  }, [clients]);

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
    selectedMonths: []
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
  const [mapActionType, setMapActionType] = useState('append'); // 'append' | 'replace'

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

  // Edit Vendor Modal
  const [selectedVendorForModal, setSelectedVendorForModal] = useState(null);
  const [thresholds, setThresholds] = useState({});

  // Report-Level Excluded Vendors (hides/removes from report and downloads; DOES NOT delete from DB)
  const [excludedGstins, setExcludedGstins] = useState(new Set());

  // ── Recent Client IDs (For Horizontal 6 Client List, Most Recent First) ──
  const [recentClientIds, setRecentClientIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('grc_recent_client_ids') || '[]');
    } catch {
      return [];
    }
  });

  const markClientRecent = (clientId) => {
    if (!clientId || clientId === 'ALL') return;
    setRecentClientIds(prev => {
      const filtered = prev.filter(id => id !== clientId);
      const next = [clientId, ...filtered].slice(0, 50);
      try {
        localStorage.setItem('grc_recent_client_ids', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Sorted clients for horizontal strip (recently added or accessed clients first)
  const sortedClients = useMemo(() => {
    if (!clients || clients.length === 0) return [];
    const idOrder = new Map(recentClientIds.map((id, idx) => [id, idx]));
    return [...clients].sort((a, b) => {
      const idxA = idOrder.has(a.id) ? idOrder.get(a.id) : 9999 + (b.id - a.id);
      const idxB = idOrder.has(b.id) ? idOrder.get(b.id) : 9999 + (a.id - b.id);
      return idxA - idxB;
    });
  }, [clients, recentClientIds]);

  const visibleClients = useMemo(() => sortedClients.slice(0, 6), [sortedClients]);
  const overflowClients = useMemo(() => sortedClients.slice(6), [sortedClients]);

  // ── Client Search Autocomplete State ──
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [showClientSearchDropdown, setShowClientSearchDropdown] = useState(false);
  const clientSearchContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // ── Overflow Clients Dropdown State ──
  const [showOverflowDropdown, setShowOverflowDropdown] = useState(false);
  const overflowDropdownRef = useRef(null);

  // ── Unified Client Setup & Vendor Mapping Modal State ──
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupClient, setSetupClient] = useState({
    clientGstin: '',
    clientName: '',
    isExistingClient: false,
    clientId: null,
    hasLogo: false,
    logoPreview: null,
    logoFile: null,
    vendorMode: 'sheet', // 'sheet' | 'registry'
    sheetVendors: [], // [{ name, gstin }]
    sheetFileName: '',
    sheetParsing: false,
    selectedRegistryGstins: new Set(),
    registrySearch: ''
  });
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  // Alphabetical Sorting for Company Name: null (default/original) | 'asc' (A to Z) | 'desc' (Z to A)
  const [nameSortOrder, setNameSortOrder] = useState(null);

  const toggleNameSort = () => {
    setNameSortOrder(prev => {
      if (prev === 'asc') return 'desc';
      if (prev === 'desc') return null;
      return 'asc';
    });
  };

  // Import Mode: 'CLIENT_REPLACE' (default) | 'CLIENT_APPEND' | 'GLOBAL_REPLACE'
  const [importMode, setImportMode] = useState('CLIENT_REPLACE');

  // Reset report exclusions whenever selectedClient changes
  useEffect(() => {
    setExcludedGstins(new Set());
  }, [selectedClient?.id]);

  useEffect(() => {
    apiClient.getRuleConfig().then(config => {
      const configMap = {};
      (config || []).forEach(item => {
        configMap[item.configKey] = item.configValue;
      });
      setThresholds(configMap);
    }).catch(() => {});
  }, []);

  // Report Template State (defaults to official PDF template, editable and persistent)
  const [reportTemplate, setReportTemplate] = useState(() => {
    const def = getDefaultTemplate();
    try {
      const saved = localStorage.getItem('grc_report_template_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...def,
          ...parsed,
          observations: Array.isArray(parsed?.observations) && parsed.observations.length > 0 
            ? parsed.observations 
            : def.observations
        };
      }
    } catch {}
    return def;
  });
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [exportingType, setExportingType] = useState(null); // 'excel' | 'pdf' | 'docx' | null
  const downloadDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target)) {
        setShowDownloadMenu(false);
      }
      if (clientSearchContainerRef.current && !clientSearchContainerRef.current.contains(e.target)) {
        setShowClientSearchDropdown(false);
      }
      if (overflowDropdownRef.current && !overflowDropdownRef.current.contains(e.target)) {
        setShowOverflowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      let localStore = {};
      try {
        localStore = JSON.parse(localStorage.getItem('grc_delayed_months_store') || '{}');
      } catch (e) {}

      const initial = {};
      mappedVendors.forEach(v => {
        const local = localStore[v.vendorGstin];
        initial[v.vendorGstin] = {
          gstr1: v.delayCountGstr1 ?? 0,
          gstr3b: v.delayCountGstr3b ?? 0,
          gstr1Months: v.delayedMonthsGstr1 || local?.gstr1Months || '',
          gstr3bMonths: v.delayedMonthsGstr3b || local?.gstr3bMonths || ''
        };
      });
      setInlineCompliance(initial);
    } else {
      setInlineCompliance({});
    }
  }, [mappedVendors]);

  const handleSwitchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    if (tab === 'all-vendors') {
      setSelectedClient({ id: 'ALL', clientName: 'All Clients', isAllVendors: true });
      fetchMappedVendors('ALL');
    } else {
      if (clients.length > 0) {
        const target = (selectedClient?.id && selectedClient.id !== 'ALL') ? selectedClient : clients[0];
        setSelectedClient(target);
        if (target) fetchMappedVendors(target.id);
      } else {
        setSelectedClient(null);
        setMappedVendors([]);
      }
    }
  };

  useEffect(() => {
    if (urlTab === 'by-client' && activeTab !== 'by-client') {
      handleSwitchTab('by-client');
    } else if (urlTab === 'all-vendors' && activeTab !== 'all-vendors') {
      handleSwitchTab('all-vendors');
    }
  }, [urlTab]);

  // Fetch Mapped Vendors when selectedClient or activeTab changes
  useEffect(() => {
    if (activeTab === 'all-vendors') {
      fetchMappedVendors('ALL');
    } else if (selectedClient?.id && selectedClient.id !== 'ALL') {
      fetchMappedVendors(selectedClient.id);
    } else {
      setMappedVendors([]);
    }
  }, [activeTab, selectedClient?.id]);

  const fetchClients = async (preferredClientId = null) => {
    setClientsLoading(true);
    try {
      const data = await apiClient.getClients();
      const clientList = data || [];
      setClients(clientList);

      if (activeTab === 'all-vendors' || preferredClientId === 'ALL') {
        setSelectedClient({ id: 'ALL', clientName: 'All Clients', isAllVendors: true });
        await fetchMappedVendors('ALL');
      } else if (preferredClientId) {
        const found = clientList.find(c => c.id === preferredClientId);
        const sel = found || clientList[0] || null;
        setSelectedClient(sel);
        if (sel) await fetchMappedVendors(sel.id);
      } else if (selectedClient && selectedClient.id !== 'ALL') {
        const updatedSelected = clientList.find(c => c.id === selectedClient.id);
        const sel = updatedSelected || clientList[0] || null;
        setSelectedClient(sel);
        if (sel) await fetchMappedVendors(sel.id);
      } else if (clientList.length > 0) {
        setSelectedClient(clientList[0]);
        await fetchMappedVendors(clientList[0].id);
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
      const isAll = clientId === 'ALL' || (!clientId && activeTab === 'all-vendors');
      const data = isAll
        ? await apiClient.getAllMappedVendors()
        : await apiClient.getClientVendors(clientId);
      const list = data || [];

      // Hydrate from localStorage store in case backend doesn't have the columns yet
      let localStore = {};
      try {
        localStore = JSON.parse(localStorage.getItem('grc_delayed_months_store') || '{}');
      } catch (e) {}

      // If any vendor has missing tradeName/legalName, fetch global details to enrich trader names
      let globalVendorMap = {};
      const needsNameEnrichment = list.some(v => 
        (!v.tradeName || v.tradeName === 'N/A' || v.tradeName === v.vendorGstin) && 
        (!v.legalName || v.legalName === 'N/A' || v.legalName === v.vendorGstin)
      );
      if (needsNameEnrichment) {
        try {
          const allDetails = await apiClient.getDetails();
          (allDetails || []).forEach(d => {
            if (d.gstin) {
              globalVendorMap[d.gstin.trim().toUpperCase()] = d;
            }
          });
        } catch (e) {}
      }

      const hydrated = list.map(v => {
        const local = localStore[v.vendorGstin];
        const gstinUpper = (v.vendorGstin || '').trim().toUpperCase();
        const globalInfo = globalVendorMap[gstinUpper];
        return {
          ...v,
          tradeName: v.tradeName || globalInfo?.tradeName || globalInfo?.traderName || '',
          legalName: v.legalName || globalInfo?.legalName || globalInfo?.name || '',
          gstStatus: (v.gstStatus && v.gstStatus.toLowerCase() !== 'unknown') ? v.gstStatus : (globalInfo?.status || globalInfo?.gstStatus || v.gstStatus || 'Active'),
          delayedMonthsGstr1: v.delayedMonthsGstr1 || local?.gstr1Months || '',
          delayedMonthsGstr3b: v.delayedMonthsGstr3b || local?.gstr3bMonths || ''
        };
      });

      setMappedVendors(hydrated);
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
      const origGstr1Months = (v.delayedMonthsGstr1 || '').trim();
      const origGstr3bMonths = (v.delayedMonthsGstr3b || '').trim();
      const curGstr1Months = (entry.gstr1Months || '').trim();
      const curGstr3bMonths = (entry.gstr3bMonths || '').trim();
      if (
        entry.gstr1 !== origGstr1 ||
        entry.gstr3b !== origGstr3b ||
        curGstr1Months !== origGstr1Months ||
        curGstr3bMonths !== origGstr3bMonths
      ) {
        modified.add(v.vendorGstin);
      }
    }
    return modified;
  }, [mappedVendors, inlineCompliance]);

  const handleComplianceChange = (vendorGstin, field, val) => {
    const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
    setInlineCompliance(prev => {
      const existing = prev[vendorGstin] || {
        gstr1: 0,
        gstr3b: 0,
        gstr1Months: '',
        gstr3bMonths: ''
      };

      return {
        ...prev,
        [vendorGstin]: {
          ...existing,
          [field]: num
        }
      };
    });
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
          const values = inlineCompliance[gstin] || {};
          const g1Count = values.gstr1 ?? 0;
          const g3bCount = values.gstr3b ?? 0;
          const m1 = (values.gstr1Months !== undefined && values.gstr1Months !== null) ? values.gstr1Months.trim() : '';
          const m3b = (values.gstr3bMonths !== undefined && values.gstr3bMonths !== null) ? values.gstr3bMonths.trim() : '';

          const payload = {
            delayCountGstr1: g1Count,
            delayCountGstr3b: g3bCount,
            delayedMonthsGstr1: m1,
            delayedMonthsGstr3b: m3b,
            updatedBy: currentUser?.name || 'Admin'
          };
          const updated = await apiClient.updateDetails(gstin, payload);
          return { gstin, updated, savedM1: m1, savedM3b: m3b };
        })
      );

      let successCount = 0;
      let failCount = 0;
      const successfulUpdates = {};

      results.forEach((res, idx) => {
        const gstin = gstinsToSave[idx];
        if (res.status === 'fulfilled') {
          successCount++;
          const val = res.value;
          successfulUpdates[gstin] = {
            ...val.updated,
            delayCountGstr1: val.updated?.delayCountGstr1 ?? val.updated?.delay_count_gstr1 ?? 0,
            delayCountGstr3b: val.updated?.delayCountGstr3b ?? val.updated?.delay_count_gstr3b ?? 0,
            delayedMonthsGstr1: val.updated?.delayedMonthsGstr1 || val.savedM1,
            delayedMonthsGstr3b: val.updated?.delayedMonthsGstr3b || val.savedM3b
          };
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
              delayedMonthsGstr1: updated.delayedMonthsGstr1 || '',
              delayedMonthsGstr3b: updated.delayedMonthsGstr3b || '',
              grcScore: updated.grcScore
            };
          }
          return v;
        }));

        setInlineCompliance(prev => {
          const next = { ...prev };
          Object.keys(successfulUpdates).forEach(g => {
            const updated = successfulUpdates[g];
            next[g] = {
              gstr1: updated.delayCountGstr1 ?? 0,
              gstr3b: updated.delayCountGstr3b ?? 0,
              gstr1Months: updated.delayedMonthsGstr1 || '',
              gstr3bMonths: updated.delayedMonthsGstr3b || ''
            };
          });
          return next;
        });

        // Cache persisted months in localStorage so refreshes always retain them
        try {
          const stored = JSON.parse(localStorage.getItem('grc_delayed_months_store') || '{}');
          Object.keys(successfulUpdates).forEach(g => {
            const upd = successfulUpdates[g];
            stored[g] = {
              ...(stored[g] || {}),
              gstr1Months: upd.delayedMonthsGstr1 || '',
              gstr3bMonths: upd.delayedMonthsGstr3b || ''
            };
          });
          localStorage.setItem('grc_delayed_months_store', JSON.stringify(stored));
        } catch (e) {}

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

  // ── Month Picker Handlers (Dynamic Rolling 15 Months) ─────────────────────
  const isMonthSelected = (selectedList, monthItem) => {
    if (!Array.isArray(selectedList) || selectedList.length === 0) return false;
    
    let targetName, targetYear, targetLabel;
    if (typeof monthItem === 'object' && monthItem !== null) {
      targetName = (monthItem.name || '').trim().toLowerCase();
      targetYear = monthItem.year ? String(monthItem.year) : '';
      targetLabel = (monthItem.label || targetName).trim().toLowerCase();
    } else {
      const str = String(monthItem || '').trim();
      const parts = str.split(/\s+/);
      targetName = (parts[0] || '').toLowerCase();
      targetYear = parts[1] || '';
      targetLabel = str.toLowerCase();
    }

    const curYearStr = String(new Date().getFullYear());
    const prevYearStr = String(new Date().getFullYear() - 1);
    const targetNameNorm = targetName.replace(/\bmarch\b/g, 'mar').slice(0, 3);

    return selectedList.some(m => {
      const s = String(m || '').trim().toLowerCase();
      if (!s) return false;

      // 1. Exact match
      if (s === targetLabel) return true;

      // 2. Normalize "march" vs "mar"
      const sNorm = s.replace(/\bmarch\b/g, 'mar');
      const tNorm = targetLabel.replace(/\bmarch\b/g, 'mar');
      if (sNorm === tNorm) return true;

      const yearMatch = s.match(/\b(20\d{2})\b/);
      const sYear = yearMatch ? yearMatch[1] : '';
      const sName = s.split(/\s+/)[0].replace(/\bmarch\b/g, 'mar').slice(0, 3);

      if (sName !== targetNameNorm) return false;

      // Both month names match
      if (targetYear) {
        if (sYear) {
          return sYear === targetYear;
        } else {
          // Token in list has no year specified.
          // If target is current year, bare month name matches current year.
          if (targetYear === curYearStr) return true;
          // If target is previous year, and the month only exists in previous year (e.g. Dec)
          if (targetYear === prevYearStr && targetName === 'dec') return true;
          return false;
        }
      } else {
        // target has no year specified (current year)
        return !sYear || sYear === curYearStr;
      }
    });
  };

  const openMonthPicker = (vendor, field) => {
    const gstin = vendor.vendorGstin;
    const currentVal = inlineCompliance[gstin];
    const existingStr = field === 'gstr1'
      ? (currentVal?.gstr1Months ?? vendor.delayedMonthsGstr1 ?? '')
      : (currentVal?.gstr3bMonths ?? vendor.delayedMonthsGstr3b ?? '');

    const tokens = existingStr
      ? existingStr.split(',').map(s => {
          const t = s.trim().replace(/-\d+$/, '');
          if (t.toLowerCase() === 'mar') return 'March';
          return t;
        }).filter(Boolean)
      : [];

    setMonthPicker({
      isOpen: true,
      vendorGstin: gstin,
      vendorName: getVendorDisplayName(vendor),
      field,
      selectedMonths: tokens
    });
  };

  const handleToggleMonth = (monthItem) => {
    const label = typeof monthItem === 'string' ? monthItem : monthItem.label;
    setMonthPicker(prev => {
      const isSel = isMonthSelected(prev.selectedMonths, monthItem);
      const updated = isSel
        ? prev.selectedMonths.filter(m => !isMonthSelected([m], monthItem))
        : [...prev.selectedMonths, label];
      return {
        ...prev,
        selectedMonths: updated
      };
    });
  };

  const handleApplyMonths = () => {
    const gstin = monthPicker.vendorGstin;
    const field = monthPicker.field;

    // Sort selected months chronologically according to rolling15Months order
    const labelOrder = rolling15Months.map(m => m.label);
    const sorted = [...monthPicker.selectedMonths].sort((a, b) => {
      const idxA = labelOrder.findIndex(lbl => isMonthSelected([a], lbl));
      const idxB = labelOrder.findIndex(lbl => isMonthSelected([b], lbl));
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    // Standardize selected tokens to match the current rolling15Months labels
    const standardized = sorted.map(tok => {
      const matched = rolling15Months.find(m => isMonthSelected([tok], m));
      return matched ? matched.label : tok;
    });

    const monthsStr = standardized.join(', ');

    setInlineCompliance(prev => {
      const existing = prev[gstin] || { gstr1: 0, gstr3b: 0, gstr1Months: '', gstr3bMonths: '' };
      return {
        ...prev,
        [gstin]: {
          ...existing,
          [field === 'gstr1' ? 'gstr1Months' : 'gstr3bMonths']: monthsStr
        }
      };
    });

    setMonthPicker(prev => ({ ...prev, isOpen: false }));
  };

  const handleSaveCompliance = async (vendorGstin) => {
    const values = inlineCompliance[vendorGstin];
    if (!values) return;

    setSavingGstins(prev => ({ ...prev, [vendorGstin]: 'saving' }));
    try {
      const g1Count = values.gstr1 ?? 0;
      const g3bCount = values.gstr3b ?? 0;
      const m1 = (values.gstr1Months !== undefined && values.gstr1Months !== null) ? values.gstr1Months.trim() : '';
      const m3b = (values.gstr3bMonths !== undefined && values.gstr3bMonths !== null) ? values.gstr3bMonths.trim() : '';

      const payload = {
        delayCountGstr1: g1Count,
        delayCountGstr3b: g3bCount,
        delayedMonthsGstr1: m1,
        delayedMonthsGstr3b: m3b,
        updatedBy: currentUser?.name || 'Admin'
      };

      const updated = await apiClient.updateDetails(vendorGstin, payload);

      // Save to localStorage so refreshes always retain them
      try {
        const stored = JSON.parse(localStorage.getItem('grc_delayed_months_store') || '{}');
        stored[vendorGstin] = {
          ...(stored[vendorGstin] || {}),
          gstr1Months: m1,
          gstr3bMonths: m3b
        };
        localStorage.setItem('grc_delayed_months_store', JSON.stringify(stored));
      } catch (e) {}

      // Update mappedVendors state in place
      setMappedVendors(prev => prev.map(v => {
        if (v.vendorGstin === vendorGstin) {
          return {
            ...v,
            delayCountGstr1: updated.delayCountGstr1,
            delayCountGstr3b: updated.delayCountGstr3b,
            delayedMonthsGstr1: updated.delayedMonthsGstr1 || m1,
            delayedMonthsGstr3b: updated.delayedMonthsGstr3b || m3b,
            grcScore: updated.grcScore
          };
        }
        return v;
      }));

      // Also ensure inlineCompliance is updated
      setInlineCompliance(prev => ({
        ...prev,
        [vendorGstin]: {
          gstr1: updated.delayCountGstr1,
          gstr3b: updated.delayCountGstr3b,
          gstr1Months: updated.delayedMonthsGstr1 || m1,
          gstr3bMonths: updated.delayedMonthsGstr3b || m3b
        }
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

  // ── CLIENT SEARCH & AUTOCOMPLETE HANDLERS ─────────────────────────────────

  const handleClientSearchChange = (query) => {
    setClientSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query || query.trim().length < 2) {
      setClientSearchResults([]);
      setShowClientSearchDropdown(false);
      return;
    }

    setShowClientSearchDropdown(true);
    setIsSearchingClients(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const cleanQuery = query.trim().toLowerCase();

        // 1. Search existing clients
        const matchedExisting = clients.filter(c => {
          const gstinMatch = c.clientGstin && c.clientGstin.toLowerCase().includes(cleanQuery);
          const nameMatch = c.clientName && c.clientName.toLowerCase().includes(cleanQuery);
          return gstinMatch || nameMatch;
        }).map(c => ({
          gstin: c.clientGstin || '',
          name: c.clientName,
          tradeName: c.clientName,
          legalName: c.clientName,
          isExistingClient: true,
          clientId: c.id,
          hasLogo: c.hasLogo,
          vendorCount: c.vendorCount ?? 0,
          source: 'Client'
        }));

        // 2. Search Database Registry via backend searchCompanies
        let dbResults = [];
        try {
          dbResults = await apiClient.searchCompanies(query.trim());
        } catch (err) {
          console.warn('searchCompanies error:', err);
          dbResults = [];
        }

        // 3. Deduplicate
        const existingGstins = new Set(matchedExisting.map(c => (c.gstin || '').toUpperCase()));
        const uniqueDbResults = (dbResults || [])
          .filter(d => d.gstin && !existingGstins.has(d.gstin.toUpperCase()))
          .map(d => ({
            ...d,
            isExistingClient: false
          }));

        // 4. If query is a valid 15-char GSTIN and not in results, offer to add it directly
        const cleanUpper = query.trim().toUpperCase();
        const isValid15Gstin = /^[0-9A-Z]{15}$/.test(cleanUpper);
        const hasExactMatch = [...matchedExisting, ...uniqueDbResults].some(r => r.gstin?.toUpperCase() === cleanUpper);

        const customOption = (isValid15Gstin && !hasExactMatch) ? [{
          gstin: cleanUpper,
          name: cleanUpper,
          tradeName: cleanUpper,
          legalName: cleanUpper,
          isExistingClient: false,
          isCustomNew: true,
          source: 'New GSTIN'
        }] : [];

        setClientSearchResults([...customOption, ...matchedExisting, ...uniqueDbResults]);
      } catch (err) {
        console.error('Client search failed:', err);
      } finally {
        setIsSearchingClients(false);
      }
    }, 180);
  };

  const handleSelectSearchResult = async (comp) => {
    setShowClientSearchDropdown(false);
    setClientSearchQuery('');

    // Check if this matches an existing client
    const existing = clients.find(c =>
      (comp.clientId && c.id === comp.clientId) ||
      (comp.gstin && c.clientGstin && c.clientGstin.toUpperCase() === comp.gstin.toUpperCase())
    );

    const gstin = comp.gstin || existing?.clientGstin || '';
    const name = comp.name || comp.tradeName || comp.legalName || existing?.clientName || gstin;
    const clientId = existing?.id || comp.clientId || null;
    const hasLogo = existing?.hasLogo || comp.hasLogo || false;
    const logoUrl = gstin
      ? apiClient.getClientLogoByGstinUrl(gstin)
      : (hasLogo && clientId ? apiClient.getClientLogoUrl(clientId) : null);

    let currentMappedGstins = new Set();
    let existingMappedCount = 0;
    if (clientId) {
      try {
        const existingVendors = await apiClient.getClientVendors(clientId);
        if (Array.isArray(existingVendors)) {
          existingMappedCount = existingVendors.length;
          existingVendors.forEach(v => {
            const g = (v.vendorGstin || v.gstin || '').toUpperCase();
            if (g) currentMappedGstins.add(g);
          });
        }
      } catch (err) {
        console.warn('Failed to pre-fetch client vendors:', err);
      }
    }

    setSetupClient({
      clientGstin: gstin,
      clientName: name,
      isExistingClient: Boolean(existing || comp.isExistingClient),
      clientId: clientId,
      hasLogo: hasLogo,
      logoPreview: hasLogo ? logoUrl : null,
      logoFile: null,
      logoRemoved: false,
      vendorMode: existingMappedCount > 0 ? 'registry' : 'sheet',
      sheetVendors: [],
      sheetFileName: '',
      sheetParsing: false,
      selectedRegistryGstins: currentMappedGstins,
      existingMappedCount: existingMappedCount,
      vendorsModified: false,
      registrySearch: ''
    });

    if (allAvailableVendors.length === 0) {
      apiClient.getDetails().then(v => setAllAvailableVendors(v || [])).catch(() => {});
    }

    setShowSetupModal(true);
  };

  const openSetupModalForClient = async (client, e) => {
    e?.stopPropagation();
    const gstin = client.clientGstin || '';
    const name = client.clientName || gstin;
    const hasLogo = client.hasLogo || false;
    const logoUrl = gstin
      ? apiClient.getClientLogoByGstinUrl(gstin)
      : (hasLogo ? apiClient.getClientLogoUrl(client.id) : null);

    let currentMappedGstins = new Set();
    let existingMappedCount = 0;
    try {
      const existingVendors = await apiClient.getClientVendors(client.id);
      if (Array.isArray(existingVendors)) {
        existingMappedCount = existingVendors.length;
        existingVendors.forEach(v => {
          const g = (v.vendorGstin || v.gstin || '').toUpperCase();
          if (g) currentMappedGstins.add(g);
        });
      }
    } catch (err) {
      console.warn('Failed to pre-fetch client vendors:', err);
    }

    setSetupClient({
      clientGstin: gstin,
      clientName: name,
      isExistingClient: true,
      clientId: client.id,
      hasLogo: hasLogo,
      logoPreview: hasLogo ? logoUrl : null,
      logoFile: null,
      logoRemoved: false,
      vendorMode: existingMappedCount > 0 ? 'registry' : 'sheet',
      sheetVendors: [],
      sheetFileName: '',
      sheetParsing: false,
      selectedRegistryGstins: currentMappedGstins,
      existingMappedCount: existingMappedCount,
      vendorsModified: false,
      registrySearch: ''
    });

    if (allAvailableVendors.length === 0) {
      apiClient.getDetails().then(v => setAllAvailableVendors(v || [])).catch(() => {});
    }

    setShowSetupModal(true);
  };

  const handleSetupSheetFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSetupClient(prev => ({ ...prev, sheetParsing: true, sheetFileName: file.name }));
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in file');
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rows || rows.length < 2) {
        throw new Error('Sheet is empty or missing data rows');
      }

      let headerRowIdx = -1;
      let vendorCol = -1;
      let gstnCol = -1;

      for (let r = 0; r < Math.min(rows.length, 5); r++) {
        const row = rows[r];
        if (!row || !row.length) continue;
        for (let c = 0; c < row.length; c++) {
          const h = String(row[c] || '').trim().toLowerCase();
          if (h === 'vendor' || h === 'vendor name' || h.includes('vendor') || h.includes('supplier') || h.includes('party')) {
            vendorCol = c;
          }
          if (h === 'gstn' || h === 'gstin' || h === 'vendor gstn' || h.includes('gst')) {
            gstnCol = c;
          }
        }
        if (vendorCol !== -1 && gstnCol !== -1) {
          headerRowIdx = r;
          break;
        }
      }

      if (vendorCol === -1 || gstnCol === -1) {
        vendorCol = 0;
        gstnCol = 1;
        headerRowIdx = 0;
      }

      const validVendors = [];
      const seen = new Set();
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const vName = String(row[vendorCol] || '').trim();
        const vGstn = String(row[gstnCol] || '').trim().toUpperCase();
        if (vGstn && vGstn.length === 15 && /^[0-9A-Z]{15}$/.test(vGstn) && !seen.has(vGstn)) {
          seen.add(vGstn);
          validVendors.push({ name: vName || vGstn, gstin: vGstn });
        }
      }

      if (validVendors.length === 0) {
        throw new Error('No valid 15-character GSTIN vendor rows found in sheet');
      }

      setSetupClient(prev => ({
        ...prev,
        sheetVendors: validVendors,
        sheetParsing: false,
        vendorsModified: true
      }));
      showToast(`Detected ${validVendors.length} valid vendors in sheet.`);
    } catch (err) {
      alert('Failed to parse sheet: ' + err.message);
      setSetupClient(prev => ({ ...prev, sheetParsing: false, sheetFileName: '' }));
    }
  };

  const handleToggleRegistryGstin = (gstin) => {
    setSetupClient(prev => {
      const next = new Set(prev.selectedRegistryGstins);
      if (next.has(gstin)) next.delete(gstin);
      else next.add(gstin);
      return { ...prev, selectedRegistryGstins: next, vendorsModified: true };
    });
  };

  const handleSelectAllRegistryVendors = () => {
    setSetupClient(prev => {
      const q = (prev.registrySearch || '').toLowerCase();
      const filtered = allAvailableVendors.filter(v => {
        if (!q) return true;
        return (v.gstin || '').toLowerCase().includes(q) || (getVendorDisplayName(v) || '').toLowerCase().includes(q);
      });
      const next = new Set(prev.selectedRegistryGstins);
      filtered.forEach(v => { if (v.gstin) next.add(v.gstin.toUpperCase()); });
      return { ...prev, selectedRegistryGstins: next, vendorsModified: true };
    });
  };

  const handleDeselectAllRegistryVendors = () => {
    setSetupClient(prev => ({ ...prev, selectedRegistryGstins: new Set(), vendorsModified: true }));
  };

  const handleSaveSetupModal = async () => {
    const gstin = setupClient.clientGstin.trim().toUpperCase();
    const name = setupClient.clientName.trim();

    if (!gstin || !name) {
      alert('Client Legal / Trade Name and GSTIN are required.');
      return;
    }
    if (gstin.length !== 15 || !/^[0-9A-Z]{15}$/.test(gstin)) {
      alert('Client GSTIN must be exactly 15 alphanumeric characters.');
      return;
    }

    setSetupSubmitting(true);
    try {
      let targetClientId = setupClient.clientId;

      // 1. Resolve or Create Client
      if (targetClientId) {
        await apiClient.updateClient(targetClientId, { clientGstin: gstin, clientName: name });
      } else {
        const existing = clients.find(c => c.clientGstin && c.clientGstin.toUpperCase() === gstin);
        if (existing) {
          targetClientId = existing.id;
          await apiClient.updateClient(targetClientId, { clientGstin: gstin, clientName: name });
        } else {
          const created = await apiClient.createClient({ clientGstin: gstin, clientName: name });
          targetClientId = created?.id;
        }
      }

      // 2. Handle Persistent Logo
      if (setupClient.logoRemoved && targetClientId) {
        try {
          await apiClient.deleteClientLogo(targetClientId, gstin);
        } catch (logoErr) {
          console.warn('Logo delete notice:', logoErr);
        }
      } else if (setupClient.logoFile && targetClientId) {
        try {
          await apiClient.uploadClientLogo(targetClientId, setupClient.logoFile);
          await apiClient.uploadClientLogoByGstin(gstin, setupClient.logoFile, name);
        } catch (logoErr) {
          console.warn('Persistent logo upload notice:', logoErr);
        }
      }

      // 3. Map Vendors
      let mappedCount = 0;
      if (setupClient.vendorMode === 'sheet' && setupClient.sheetVendors.length > 0) {
        const vendorGstins = setupClient.sheetVendors.map(v => v.gstin);
        await apiClient.replaceClientVendors(targetClientId, vendorGstins);
        mappedCount = vendorGstins.length;
      } else if (setupClient.vendorMode === 'registry' && setupClient.vendorsModified) {
        const vendorGstins = Array.from(setupClient.selectedRegistryGstins);
        await apiClient.replaceClientVendors(targetClientId, vendorGstins);
        mappedCount = vendorGstins.length;
      }

      // 4. Mark Client as recent so it appears first in the 6 horizontal clients
      markClientRecent(targetClientId);

      // 5. Close Setup Modal
      setShowSetupModal(false);
      showToast(setupClient.isExistingClient
        ? `Client "${name}" updated successfully!`
        : `Client "${name}" saved! ${mappedCount > 0 ? mappedCount + ' vendors mapped.' : ''}`
      );

      // 6. Refresh clients and select this client so vendors populate in table
      await fetchClients(targetClientId);
    } catch (err) {
      alert(err.message || 'Failed to save client and map vendors');
    } finally {
      setSetupSubmitting(false);
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
    const logoUrl = client.clientGstin
      ? apiClient.getClientLogoByGstinUrl(client.clientGstin)
      : (client.hasLogo ? apiClient.getClientLogoUrl(client.id) : null);
    setLogoPreview(client.hasLogo ? logoUrl : null);
    setShowClientModal(true);
  };

  const openLogoModal = (client, e) => {
    e?.stopPropagation();
    setLogoTargetClient(client);
    setDirectLogoFile(null);
    const logoUrl = client.clientGstin
      ? apiClient.getClientLogoByGstinUrl(client.clientGstin)
      : (client.hasLogo ? apiClient.getClientLogoUrl(client.id) : null);
    setDirectLogoPreview(client.hasLogo ? logoUrl : null);
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
      setRecentClientIds(prev => {
        const next = prev.filter(id => id !== clientId);
        try { localStorage.setItem('grc_recent_client_ids', JSON.stringify(next)); } catch {}
        return next;
      });
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
      if (logoTargetClient.id) {
        await apiClient.uploadClientLogo(logoTargetClient.id, directLogoFile);
      } else if (logoTargetClient.clientGstin) {
        await apiClient.uploadClientLogoByGstin(logoTargetClient.clientGstin, directLogoFile, logoTargetClient.clientName);
      }
      showToast('Logo uploaded and mapped to GSTIN successfully');
      setShowLogoModal(false);
      fetchClients(logoTargetClient.id);
    } catch (err) {
      alert(err.message || 'Logo upload failed');
    } finally {
      setLogoSubmitting(false);
    }
  };

  const handleRemoveDirectLogo = async () => {
    if (!logoTargetClient) return;
    if (!window.confirm(`Are you sure you want to remove the logo for "${logoTargetClient.clientName}"?`)) {
      return;
    }
    setLogoSubmitting(true);
    try {
      await apiClient.deleteClientLogo(logoTargetClient.id, logoTargetClient.clientGstin);
      showToast('Client logo removed successfully');
      setShowLogoModal(false);
      fetchClients(logoTargetClient.id);
    } catch (err) {
      alert(err.message || 'Failed to remove logo');
    } finally {
      setLogoSubmitting(false);
    }
  };

  // ── Vendor Unmapping & Editing Handlers (Persistent Client-Wise Removal) ──

  const handleUnmapVendor = async (vendorOrGstin) => {
    if (!vendorOrGstin) return;
    const isObj = typeof vendorOrGstin === 'object' && vendorOrGstin !== null;
    const vendorGstin = isObj ? (vendorOrGstin.vendorGstin || vendorOrGstin.gstin) : vendorOrGstin;
    if (!vendorGstin) return;

    // Determine target client ID and name (handles both client-wise view and all-vendors view)
    let targetClientId = null;
    let targetClientName = 'this client';

    if (isObj && vendorOrGstin.clientId) {
      targetClientId = vendorOrGstin.clientId;
      targetClientName = vendorOrGstin.clientName || 'this client';
    } else if (selectedClient && selectedClient.id && selectedClient.id !== 'ALL') {
      targetClientId = selectedClient.id;
      targetClientName = selectedClient.clientName || 'this client';
    } else if (activeTab === 'all-vendors' && isObj) {
      targetClientId = vendorOrGstin.clientId;
      targetClientName = vendorOrGstin.clientName || 'this client';
    }

    if (!targetClientId) {
      showToast('Cannot determine target client for vendor removal', 'error');
      return;
    }

    const vendorDisplayName = (isObj && (vendorOrGstin.companyName || vendorOrGstin.legalName || vendorOrGstin.tradeName))
      ? (vendorOrGstin.companyName || vendorOrGstin.legalName || vendorOrGstin.tradeName)
      : vendorGstin;

    if (!window.confirm(`Are you sure you want to remove vendor "${vendorDisplayName}" (${vendorGstin}) from "${targetClientName}"?\n\n(Note: This persistently unmaps the vendor for this client and will not reappear on refresh. The vendor remains safe in the master database and other clients are not affected.)`)) {
      return;
    }

    try {
      if (apiClient.unmapVendorFromClient) {
        await apiClient.unmapVendorFromClient(targetClientId, vendorGstin);
      } else {
        await apiClient.unmapVendor(targetClientId, vendorGstin);
      }
      showToast(`Vendor "${vendorDisplayName}" removed from "${targetClientName}"`, 'success');
      
      // Update local mappedVendors state immediately
      setMappedVendors(prev => prev.filter(v => {
        const vGstin = v.vendorGstin || v.gstin;
        if (vGstin !== vendorGstin) return true;
        if (activeTab === 'all-vendors' && targetClientId) {
          return (v.clientId || v.client_id) !== targetClientId;
        }
        return false;
      }));

      // If excludedGstins had it, remove it
      setExcludedGstins(prev => {
        if (!prev.has(vendorGstin)) return prev;
        const next = new Set(prev);
        next.delete(vendorGstin);
        return next;
      });

      if (selectedVendorForModal && (selectedVendorForModal.vendorGstin || selectedVendorForModal.gstin) === vendorGstin) {
        setSelectedVendorForModal(null);
      }

      // Re-fetch to keep counts and server state in perfect sync
      if (activeTab === 'all-vendors') {
        fetchMappedVendors('ALL');
      } else if (selectedClient?.id) {
        fetchMappedVendors(selectedClient.id);
      }
      fetchClients(selectedClient?.id);
    } catch (err) {
      showToast(err.message || 'Failed to remove vendor', 'error');
    }
  };

  const handleEditVendorClick = async (vendor) => {
    const gstin = vendor.vendorGstin || vendor.gstin;
    try {
      const detail = await apiClient.getDetailByGstin(gstin);
      setSelectedVendorForModal(detail || { ...vendor, gstin });
    } catch (err) {
      setSelectedVendorForModal({
        ...vendor,
        gstin: gstin,
        legalName: vendor.legalName || vendor.vendorName || '',
        tradeName: vendor.tradeName || vendor.traderName || '',
        status: vendor.gstStatus || 'Active',
        delayCountGstr1: vendor.delayCountGstr1 ?? 0,
        delayCountGstr3b: vendor.delayCountGstr3b ?? 0,
        coreActivity: vendor.coreActivity || 'Manufacturer',
        aggregateTurnover: vendor.aggregateTurnover || 'N/A',
        aadhaarValidation: vendor.aadhaarValidation || 'No',
        dateOfRegistration: vendor.dateOfRegistration || '',
        age: vendor.age || 0
      });
    }
  };

  const handleModalVendorUpdate = (updatedItem) => {
    if (!updatedItem) return;
    setMappedVendors(prev => prev.map(v => {
      if ((v.vendorGstin || v.gstin) === updatedItem.gstin) {
        return {
          ...v,
          ...updatedItem,
          vendorName: updatedItem.legalName || updatedItem.tradeName || v.vendorName,
          legalName: updatedItem.legalName || v.legalName,
          tradeName: updatedItem.tradeName || v.tradeName,
          coreActivity: updatedItem.coreActivity || v.coreActivity,
          aggregateTurnover: updatedItem.aggregateTurnover || v.aggregateTurnover,
          grcScore: updatedItem.grcScore !== undefined ? updatedItem.grcScore : v.grcScore
        };
      }
      return v;
    }));
    if (selectedClient?.id) {
      fetchMappedVendors(selectedClient.id);
    }
  };

  // ── Map Vendors Modal Handlers ────────────────────────────────────────────

  const openMapModal = async (client) => {
    setSelectedGstinsToMap(new Set());
    setMapSearch('');
    setMapActionType('append');
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
      if (mapActionType === 'replace') {
        await apiClient.replaceClientVendors(selectedClient.id, gstinsArray);
        showToast(`Replaced vendors for ${selectedClient.clientName} (${gstinsArray.length} vendor(s)). Other clients preserved.`);
      } else {
        const res = await apiClient.mapVendors(selectedClient.id, gstinsArray);
        showToast(`Successfully mapped ${res.mappedCount || gstinsArray.length} vendor(s)`);
      }
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

  const handleRemoveClientFromImport = (index) => {
    setParsedImportData(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSheetFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('The uploaded file does not contain any readable sheets.');
      }

      let grcDetails = [];
      try {
        grcDetails = await apiClient.getDetails();
      } catch {
        grcDetails = [];
      }

      const seenVendors = new Map();
      let parsedClients = [];

      // ── STRATEGY 1: MULTI-SHEET PARSER (Each sheet = One Client) ──────────
      // Official format: Each sheet tab name represents a Client, rows are that client's vendors
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!rows || rows.length === 0) continue;

        // Find header row in first 5 rows
        let headerRowIdx = -1;
        let vendorCol = -1;
        let gstnCol = -1;

        for (let r = 0; r < Math.min(rows.length, 5); r++) {
          const row = rows[r];
          if (!row || !row.length) continue;
          let vCol = -1;
          let gCol = -1;
          for (let c = 0; c < row.length; c++) {
            const h = String(row[c] || '').trim().toLowerCase();
            if (h === 'vendor' || h === 'vendor name' || h.includes('vendor') || h.includes('supplier') || h.includes('party')) {
              vCol = c;
            }
            if (h === 'gstn' || h === 'gstin' || h === 'vendor gstn' || h.includes('gst')) {
              gCol = c;
            }
          }
          if (vCol !== -1 && gCol !== -1) {
            headerRowIdx = r;
            vendorCol = vCol;
            gstnCol = gCol;
            break;
          }
        }

        if (headerRowIdx === -1) continue;

        const cleanClientName = sheetName.trim();
        let resolvedGstin = '';

        // 1. Check if sheet name contains 15-char alphanumeric GSTIN
        const nameGstinMatch = cleanClientName.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i);
        if (nameGstinMatch) {
          resolvedGstin = nameGstinMatch[0].toUpperCase();
        } else {
          // 2. Match with existing clients by name
          const existingClient = clients.find(c =>
            c.clientName && c.clientName.trim().toLowerCase() === cleanClientName.toLowerCase()
          );
          if (existingClient && existingClient.clientGstin) {
            resolvedGstin = existingClient.clientGstin;
          } else {
            // 3. Match with Master GRC records
            const matchedGrc = grcDetails.find(g =>
              (g.tradeName && g.tradeName.toLowerCase().includes(cleanClientName.toLowerCase())) ||
              (g.legalName && g.legalName.toLowerCase().includes(cleanClientName.toLowerCase()))
            );
            if (matchedGrc && matchedGrc.gstin) {
              resolvedGstin = matchedGrc.gstin;
            }
          }
        }

        const validVendors = [];
        const duplicateVendors = [];

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const vName = String(row[vendorCol] || '').trim();
          const vGstn = String(row[gstnCol] || '').trim().toUpperCase();

          if (vGstn && vGstn.length === 15 && /^[0-9A-Z]{15}$/.test(vGstn)) {
            if (seenVendors.has(vGstn)) {
              duplicateVendors.push({
                name: vName || vGstn,
                gstin: vGstn,
                firstClient: seenVendors.get(vGstn)
              });
            } else {
              seenVendors.set(vGstn, cleanClientName);
              validVendors.push({
                name: vName || vGstn,
                gstin: vGstn
              });
            }
          }
        }

        parsedClients.push({
          clientName: cleanClientName,
          clientGstin: resolvedGstin,
          vendors: validVendors,
          duplicateVendors: duplicateVendors
        });
      }

      // ── STRATEGY 2: FALLBACK TO HORIZONTAL COLUMNS IN SHEET 1 ───────────────
      if (parsedClients.length === 0) {
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
          throw new Error("Could not detect valid Client sheets with 'Vendor' and 'GSTN' columns. Please check your Excel workbook.");
        }

        parsedClients = detectedBlocks.map(block => {
          let resolvedGstin = '';
          const existingClient = clients.find(c => 
            c.clientName && c.clientName.trim().toLowerCase() === block.clientName.toLowerCase()
          );

          if (existingClient && existingClient.clientGstin) {
            resolvedGstin = existingClient.clientGstin;
          } else {
            const matchedGrc = grcDetails.find(g => 
              (g.tradeName && g.tradeName.toLowerCase().includes(block.clientName.toLowerCase())) ||
              (g.legalName && g.legalName.toLowerCase().includes(block.clientName.toLowerCase()))
            );
            if (matchedGrc && matchedGrc.gstin) {
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
      }

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
        importMode: importMode,
        replaceAll: importMode === 'GLOBAL_REPLACE',
        replaceClientVendors: importMode === 'CLIENT_REPLACE',
        clients: parsedImportData.map(c => ({
          clientName: c.clientName,
          clientGstin: c.clientGstin,
          vendorGstins: c.vendors.map(v => v.gstin)
        }))
      };

      const result = await apiClient.bulkImportClients(payload);
      const msg = importMode === 'CLIENT_REPLACE'
        ? `Vendor data updated client-wise successfully! Replaced vendors for imported client(s) while all other clients remained safe.`
        : importMode === 'CLIENT_APPEND'
          ? `Vendors merged & appended successfully without deleting existing vendors.`
          : `Database replaced with ${result.clientsCreated} client(s) and ${result.vendorsMapped} vendor(s).`;
      showToast(msg);
      setShowImportModal(false);
      setParsedImportData([]);
      await fetchClients(selectedClient?.id);
      if (selectedClient?.id) {
        await fetchMappedVendors(selectedClient.id);
      }
    } catch (err) {
      alert(err.message || 'Import failed');
    } finally {
      setImportSubmitting(false);
    }
  };

  // ── Excel Export Handler ──────────────────────────────────────────────────

  const handleExportExcel = async () => {
    if (!filteredMappedVendors || filteredMappedVendors.length === 0) {
      alert('No vendors available to export.');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'GRC Assessment System';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Vendor Assessment', {
        views: [{ showGridLines: true }]
      });

      const isAllVendorsExport = activeTab === 'all-vendors' || selectedClient?.id === 'ALL';
      const offset = isAllVendorsExport ? 1 : 0;

      // Set Column Definitions with clean widths
      worksheet.columns = [
        { key: 'slNo', width: 9 },
        ...(isAllVendorsExport ? [{ key: 'clientName', width: 28 }] : []),
        { key: 'companyName', width: 38 },
        { key: 'gstn', width: 18 },
        { key: 'type', width: 22 },
        { key: 'age', width: 10 },
        { key: 'gstStatus', width: 13 },
        { key: 'gstr1', width: 22 },
        { key: 'gstr3b', width: 22 },
        { key: 'gstr7r', width: 24 },
        { key: 'aadhaar', width: 18 },
        { key: 'coreActivity', width: 28 },
        { key: 'turnover', width: 18 },
        { key: 'grcScore', width: 12 }
      ];

      // Header Row (matching dark purple template)
      const headerRow = worksheet.addRow([
        'Sl. No.',
        ...(isAllVendorsExport ? ['Client Name'] : []),
        'Supplier Name',
        'GSTN',
        'Type',
        'Age',
        'GST Status',
        'GSTR1',
        'Number of times GSTR-3B filing delay',
        'GSTR7R',
        'Aadhaar Authenticated',
        'Core Activity',
        'Turn over',
        'GRC Score'
      ]);
      headerRow.height = 28;

      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF3B1D6E' }
        };
        cell.font = {
          name: 'Arial',
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF28124D' } },
          bottom: { style: 'medium', color: { argb: 'FF28124D' } },
          left: { style: 'thin', color: { argb: 'FF4C2582' } },
          right: { style: 'thin', color: { argb: 'FF4C2582' } }
        };
      });

      // Style Presets (ARGB)
      const FILL_YELLOW = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF08A' } // Yellow
      };
      const FONT_YELLOW = {
        name: 'Arial',
        size: 9.5,
        bold: true,
        color: { argb: 'FF713F12' }
      };

      const FILL_SOFT_RED = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFECACA' } // Soft Red
      };
      const FONT_SOFT_RED = {
        name: 'Arial',
        size: 9.5,
        bold: true,
        color: { argb: 'FF991B1B' }
      };

      const FILL_CRITICAL_ROW = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDC2626' } // Solid Red
      };
      const FONT_CRITICAL_ROW = {
        name: 'Arial',
        size: 9.5,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };

      const THIN_BORDER = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      const last3Lower = recent3CurrentMonths;

      filteredMappedVendors.forEach((v, idx) => {
        const gstin = v.vendorGstin;
        const gstr1Val = inlineCompliance[gstin]?.gstr1 ?? v.delayCountGstr1 ?? 0;
        const gstr3bRaw = inlineCompliance[gstin]?.gstr3b !== undefined ? inlineCompliance[gstin]?.gstr3b : v.delayCountGstr3b;
        const isGstr3bMissing = checkIsGstr3bMissing(v);
        const gstr3bVal = isGstr3bMissing ? 'N/A' : (typeof gstr3bRaw === 'number' ? gstr3bRaw : parseInt(gstr3bRaw, 10) || 0);
        const gstr1Months = (inlineCompliance[gstin]?.gstr1Months ?? v.delayedMonthsGstr1 ?? '').trim();
        const gstr3bMonths = (inlineCompliance[gstin]?.gstr3bMonths ?? v.delayedMonthsGstr3b ?? '').trim();
        const gstr7Info = getGstr7Display(v);
        const ageDisplay = v.ageYears !== null && v.ageYears !== undefined
          ? Math.round(v.ageYears)
          : computeAge(v.registrationDate);

        // Scenario Evaluations
        const isTrader = isPartyTrader(v.coreActivity);
        const isPropOrPartner = isPropPartnerOrHuf(v.gstType);
        const isAadhaarNo = (v.aadhaarValidation || '').trim().toLowerCase() === 'no';
        const isGstr7NA = !v.gstdNo && (!v.gstr7Status || v.gstr7Status.toLowerCase() === 'n/a' || gstr7Info?.status?.text === 'N/A' || !gstr7Info?.status?.text);
        const isLowTurnover = isTurnoverUnder3Cr(v.aggregateTurnover);
        const isYoungAge = typeof ageDisplay === 'number' && ageDisplay < 2;

        // Scenario 6: Red Cross if individual firm or traders && GSTR3B delayed > 2
        const isIndividualFirmOrTrader = isTrader || isPropOrPartner;
        const showRedCross = isIndividualFirmOrTrader && typeof gstr3bVal === 'number' && gstr3bVal > 2;

        // Scenario 8: Risky ONLY if conditions of Scenario 6 are met AND delayed in recent 3 months of current year
        const curYearStr = String(new Date().getFullYear());
        const gstr3bTokens = (gstr3bMonths || '').split(',').map(s => s.trim().replace(/-\d+$/, '')).filter(Boolean);
        const hasLast3MonthsDelay = gstr3bTokens.length > 0 && gstr3bTokens.some(m => {
          const token = m.trim().toLowerCase();
          const yearMatch = token.match(/\b(20\d{2})\b/);
          if (yearMatch && yearMatch[1] !== curYearStr) return false;
          return last3Lower.some(l3 => token.startsWith(l3.slice(0, 3)));
        });
        const isRisky = showRedCross && hasLast3MonthsDelay;

        // Scenario 9 or missing GSTR-3B: Critical risk whole row red
        const isEntireRowRed = isGstr3bMissing || (typeof gstr3bVal === 'number' && gstr3bVal > 2 && isTrader && isAadhaarNo && isGstr7NA);

        // Excel Colored Dots & Rich Text formatting
        const isScoreRisky = v.grcScore !== null && v.grcScore !== undefined && Number(v.grcScore) > 30;
        const companyDotColorArgb = isEntireRowRed || (typeof gstr3bVal === 'number' && gstr3bVal > 2) || isScoreRisky
          ? 'FFDC2626' 
          : ((typeof gstr3bVal === 'number' && gstr3bVal >= 1) || gstr1Val >= 1 || (v.grcScore !== null && Number(v.grcScore) >= 20) ? 'FFF59E0B' : 'FF10B981');

        const companyRichText = [];
        if (isRisky || showRedCross) {
          companyRichText.push({
            text: '[Risky] ',
            font: { name: 'Arial', size: 9.5, bold: true, color: { argb: isEntireRowRed ? 'FFFFFFFF' : 'FFDC2626' } }
          });
        }
        // Colored circular dot indicator before company name
        companyRichText.push({
          text: '● ',
          font: { name: 'Arial', size: 12, bold: true, color: { argb: isEntireRowRed ? 'FFFFFFFF' : companyDotColorArgb } }
        });
        companyRichText.push({
          text: getVendorDisplayName(v),
          font: { name: 'Arial', size: 9.5, bold: isEntireRowRed, color: { argb: isEntireRowRed ? 'FFFFFFFF' : 'FF1E293B' } }
        });

        // GSTR-1: Colored circular dot + delay count + delayed months in RED
        const gstr1DotColorArgb = gstr1Val > 2 
          ? 'FFDC2626' 
          : (gstr1Val >= 1 ? 'FFF59E0B' : 'FF10B981');

        const gstr1RichText = [
          {
            text: '● ',
            font: { name: 'Arial', size: 12, bold: true, color: { argb: isEntireRowRed ? 'FFFFFFFF' : gstr1DotColorArgb } }
          },
          {
            text: `${gstr1Val}`,
            font: { name: 'Arial', size: 9.5, bold: true, color: { argb: isEntireRowRed ? 'FFFFFFFF' : 'FF1E293B' } }
          }
        ];
        if (gstr1Months) {
          gstr1RichText.push({
            text: `  ${gstr1Months}`,
            font: { name: 'Arial', size: 9, bold: true, color: { argb: isEntireRowRed ? 'FFFFFFFF' : 'FFDC2626' } }
          });
        }

        // GSTR-3B: Delay count + delayed months in RED
        const gstr3bCountColorArgb = isEntireRowRed 
          ? 'FFFFFFFF' 
          : (gstr3bVal > 2 ? 'FF991B1B' : (gstr3bVal >= 1 ? 'FF713F12' : 'FF1E293B'));

        const gstr3bRichText = [
          {
            text: `${gstr3bVal}`,
            font: { name: 'Arial', size: 9.5, bold: true, color: { argb: gstr3bCountColorArgb } }
          }
        ];
        if (gstr3bMonths) {
          gstr3bRichText.push({
            text: `  ${gstr3bMonths}`,
            font: { name: 'Arial', size: 9, bold: true, color: { argb: isEntireRowRed ? 'FFFFFFFF' : 'FFDC2626' } }
          });
        }

        const rowValues = [
          idx + 1,
          ...(isAllVendorsExport ? [v.clientName || 'Unassigned'] : []),
          '', // Populated with richText below (Supplier Name)
          v.vendorGstin,
          v.gstType || 'Partnership',
          ageDisplay,
          v.gstStatus || 'Active',
          '', // Populated with richText below
          '', // Populated with richText below
          gstr7Info?.status?.text || 'N/A',
          v.aadhaarValidation || 'N/A',
          v.coreActivity || 'Manufacturer',
          v.aggregateTurnover || 'N/A',
          v.grcScore ?? 'N/A'
        ];

        const row = worksheet.addRow(rowValues);
        row.height = 22;

        // Apply Base Borders & Fonts to all cells in this row
        const centerCols = [1, 5 + offset, 6 + offset, 10 + offset, 13 + offset];
        const centerDelayCols = [7 + offset, 8 + offset];
        if (isAllVendorsExport) centerCols.push(2); // Center Client column

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = THIN_BORDER;
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF1E293B' } };

          if (centerCols.includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (centerDelayCols.includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });

        if (isEntireRowRed) {
          // Scenario 9: Entire row red with white bold text
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = FILL_CRITICAL_ROW;
            cell.font = FONT_CRITICAL_ROW;
          });
        } else {
          // Individual Scenario Highlights:

          // Scenario 1: GSTR3B cell
          if (gstr3bVal > 2) {
            const c = row.getCell(8 + offset);
            c.fill = FILL_SOFT_RED;
          } else if (gstr3bVal >= 1) {
            const c = row.getCell(8 + offset);
            c.fill = FILL_YELLOW;
          }

          // Scenario 3: Aadhaar cell
          if ((isTrader || isPropOrPartner) && isAadhaarNo) {
            const c = row.getCell(10 + offset);
            c.fill = FILL_SOFT_RED;
            c.font = FONT_SOFT_RED;
          }

          // Scenario 4: Turnover cell
          if (isLowTurnover) {
            const c = row.getCell(12 + offset);
            c.fill = FILL_YELLOW;
            c.font = FONT_YELLOW;
          }

          // Scenario 5: Age cell
          if (isYoungAge) {
            const c = row.getCell(5 + offset);
            c.fill = FILL_YELLOW;
            c.font = FONT_YELLOW;
          }

          // Scenario 7: GSTR7R cell
          if (isTrader && isGstr7NA) {
            const c = row.getCell(9 + offset);
            c.fill = FILL_SOFT_RED;
            c.font = FONT_SOFT_RED;
          }
        }

        // Apply RichText values with colored dots and bold red delayed months
        row.getCell(isAllVendorsExport ? 3 : 2).value = { richText: companyRichText };
        row.getCell(7 + offset).value = { richText: gstr1RichText };
        row.getCell(8 + offset).value = { richText: gstr3bRichText };
      });

      // Write to buffer and trigger browser download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeClientName = isAllVendorsExport ? 'All_Uploaded_Vendors' : (selectedClient?.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeClientName}_Vendor_Assessment.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Excel failed:', err);
      alert('Failed to export styled Excel. Please try again.');
    }
  };

  // ── PDF & DOCX Assessment Report Generators ───────────────────────────────

  const getClientLogoBase64 = async () => {
    if (activeTab === 'all-vendors' || selectedClient?.id === 'ALL') {
      return null;
    }
    if (selectedClient?.id) {
      const url = apiClient.getClientLogoUrl(selectedClient.id);
      const base64 = await loadImageAsBase64(url);
      if (base64) return base64;
    }
    if (selectedClient?.clientGstin) {
      const url = apiClient.getClientLogoByGstinUrl(selectedClient.clientGstin);
      const base64 = await loadImageAsBase64(url);
      if (base64) return base64;
    }
    return null;
  };

  const getPreparedVendorsForExport = () => {
    const last3Lower = recent3CurrentMonths;

    return filteredMappedVendors.map((v) => {
      const gstin = v.vendorGstin;
      const gstr1Val = inlineCompliance[gstin]?.gstr1 ?? v.delayCountGstr1 ?? 0;
      const gstr3bRaw = inlineCompliance[gstin]?.gstr3b !== undefined ? inlineCompliance[gstin]?.gstr3b : v.delayCountGstr3b;
      const isGstr3bMissing = checkIsGstr3bMissing(v);
      const gstr3bVal = isGstr3bMissing ? 'N/A' : (typeof gstr3bRaw === 'number' ? gstr3bRaw : parseInt(gstr3bRaw, 10) || 0);
      const gstr1Months = (inlineCompliance[gstin]?.gstr1Months ?? v.delayedMonthsGstr1 ?? '').trim();
      const gstr3bMonths = (inlineCompliance[gstin]?.gstr3bMonths ?? v.delayedMonthsGstr3b ?? '').trim();
      const gstr7Info = getGstr7Display(v);
      const ageDisplay = v.ageYears !== null && v.ageYears !== undefined
        ? Math.round(v.ageYears)
        : computeAge(v.registrationDate);

      const isTrader = isPartyTrader(v.coreActivity);
      const isPropOrPartner = isPropPartnerOrHuf(v.gstType);
      const isAadhaarNo = (v.aadhaarValidation || '').trim().toLowerCase() === 'no';
      const isGstr7NA = !v.gstdNo && (!v.gstr7Status || v.gstr7Status.toLowerCase() === 'n/a' || gstr7Info?.status?.text === 'N/A' || !gstr7Info?.status?.text);
      const isLowTurnover = isTurnoverUnder3Cr(v.aggregateTurnover);

      // Scenario 6: Red Cross if individual firm or traders && GSTR3B delayed > 2
      const isIndividualFirmOrTrader = isTrader || isPropOrPartner;
      const showRedCross = isIndividualFirmOrTrader && typeof gstr3bVal === 'number' && gstr3bVal > 2;

      // Scenario 8: Risky ONLY if conditions of Scenario 6 are met AND delayed in recent 3 months of current year
      const curYearStr = String(new Date().getFullYear());
      const gstr3bTokens = (gstr3bMonths || '').split(',').map(s => s.trim().replace(/-\d+$/, '')).filter(Boolean);
      const hasLast3MonthsDelay = gstr3bTokens.length > 0 && gstr3bTokens.some(m => {
        const token = m.trim().toLowerCase();
        const yearMatch = token.match(/\b(20\d{2})\b/);
        if (yearMatch && yearMatch[1] !== curYearStr) return false;
        return last3Lower.some(l3 => token.startsWith(l3.slice(0, 3)));
      });
      const isRisky = showRedCross && hasLast3MonthsDelay;

      // Scenario 9 or missing GSTR-3B: Critical risk whole row red
      const isEntireRowRed = isGstr3bMissing || (typeof gstr3bVal === 'number' && gstr3bVal > 2 && isTrader && isAadhaarNo && isGstr7NA);

      // Colored circular dot indicator colors matching website table
      const isScoreRisky = v.grcScore !== null && v.grcScore !== undefined && Number(v.grcScore) > 30;
      const companyDotColorHex = isEntireRowRed || (typeof gstr3bVal === 'number' && gstr3bVal > 2) || isScoreRisky ? '#dc2626' : ((typeof gstr3bVal === 'number' && gstr3bVal >= 1) || gstr1Val >= 1 || (v.grcScore !== null && Number(v.grcScore) >= 20) ? '#f59e0b' : '#10b981');
      const gstr1DotColorHex = gstr1Val > 2 ? '#dc2626' : (gstr1Val >= 1 ? '#f59e0b' : '#10b981');

      return {
        gstin,
        companyName: getVendorDisplayName(v),
        clientName: v.clientName || 'N/A',
        clientId: v.clientId,
        companyDotSymbol: '●',
        companyDotColorHex,
        isRisky,
        showRedCross,
        isEntireRowRed,
        isGstr3bMissing,
        gstType: v.gstType || 'Partnership',
        ageDisplay,
        gstStatus: v.gstStatus || 'Active',
        gstr1Val,
        gstr1DotSymbol: '●',
        gstr1DotColorHex,
        gstr1Months,
        gstr3bVal,
        gstr3bMonths,
        gstr7Text: gstr7Info?.status?.text || 'N/A',
        aadhaarValidation: v.aadhaarValidation || 'N/A',
        coreActivity: v.coreActivity || 'Manufacturer',
        aggregateTurnover: v.aggregateTurnover || 'N/A',
        isLowTurnover,
        grcScore: v.grcScore
      };
    });
  };

  const handleExportPdf = async () => {
    if (!filteredMappedVendors.length) {
      showToast('No vendors to export', 'error');
      return;
    }
    setExportingType('pdf');
    try {
      const clientLogo = await getClientLogoBase64();
      const preparedVendors = getPreparedVendorsForExport();
      const exportClientObj = (activeTab === 'all-vendors' || selectedClient?.id === 'ALL')
        ? { id: 'ALL', clientName: 'All Clients', isAllVendors: true }
        : selectedClient;
      await exportReportToPdf({
        client: exportClientObj,
        vendors: preparedVendors,
        template: reportTemplate,
        clientLogoDataUrl: clientLogo
      });
      showToast('PDF report downloaded successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to export PDF: ' + err.message, 'error');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportDocx = async () => {
    if (!filteredMappedVendors.length) {
      showToast('No vendors to export', 'error');
      return;
    }
    setExportingType('docx');
    try {
      const clientLogo = await getClientLogoBase64();
      const preparedVendors = getPreparedVendorsForExport();
      const exportClientObj = (activeTab === 'all-vendors' || selectedClient?.id === 'ALL')
        ? { id: 'ALL', clientName: 'All Clients', isAllVendors: true }
        : selectedClient;
      await exportReportToDocx({
        client: exportClientObj,
        vendors: preparedVendors,
        template: reportTemplate,
        clientLogoDataUrl: clientLogo
      });
      showToast('Word DOCX report downloaded successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to export DOCX: ' + err.message, 'error');
    } finally {
      setExportingType(null);
    }
  };

  // ── Derived Data & Helpers ────────────────────────────────────────────────

    // ── Scenario Color & Risk Evaluation Helpers ──────────────────────────────
  const isTurnoverUnder3Cr = (turnoverStr) => {
    if (!turnoverStr) return false;
    const t = turnoverStr.toLowerCase();
    return t.includes('lakh') || 
      t.includes('below 1 cr') || 
      t.includes('0 to 40') || 
      t.includes('40 to 1.5') || 
      t.includes('1.5 cr');
  };

  const isPartyTrader = (activity) => {
    return (activity || '').toLowerCase().includes('trader');
  };

  const isPropPartnerOrHuf = (gstType) => {
    const t = (gstType || '').toLowerCase();
    return t.includes('proprietor') || 
      t.includes('individual') ||
      t.includes('partner') || 
      t.includes('firm') || 
      t.includes('huf') || 
      t.includes('hindu undivided');
  };

  const getVendorDisplayName = (vendor) => {
    if (!vendor) return '';
    const isInvalid = (str) => {
      if (!str) return true;
      const s = String(str).trim().toLowerCase();
      return s === '' || s === 'na' || s === 'n/a' || s === 'null' || s === 'none' || s === 'undefined' || s === '-';
    };

    // Trader Name / Trade Name from GSTN details
    const traderName = !isInvalid(vendor.tradeName)
      ? vendor.tradeName.trim()
      : (!isInvalid(vendor.traderName) ? vendor.traderName.trim() : (!isInvalid(vendor.businessName) ? vendor.businessName.trim() : null));

    // Vendor Name / Legal Name from GSTN details or import
    const vendorName = !isInvalid(vendor.vendorName)
      ? vendor.vendorName.trim()
      : (!isInvalid(vendor.legalName) ? vendor.legalName.trim() : (!isInvalid(vendor.name) ? vendor.name.trim() : null));

    // If Vendor Name is blank or NA, automatically populate Trader Name (and vice versa); fallback to GSTIN if both missing
    return traderName || vendorName || vendor.vendorGstin || vendor.gstin || '';
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

  const checkIsGstr3bMissing = (vendor) => {
    if (!vendor) return true;
    const gstin = vendor.vendorGstin || vendor.gstin;
    const status = (vendor.gstStatus || '').trim().toLowerCase();
    const inlineEntry = inlineCompliance ? inlineCompliance[gstin] : undefined;
    
    // If reviewer explicitly set an inline override number, respect it
    if (inlineEntry?.gstr3b !== undefined && inlineEntry?.gstr3b !== null) {
      const s = String(inlineEntry.gstr3b).trim().toUpperCase();
      if (s === 'N/A' || s === 'NA' || s === '') return true;
      return false;
    }
    
    // Unknown or Error GST status means return filing history was not fetched / missing
    if (status === 'unknown' || status === 'error' || !status) {
      return true;
    }
    
    const raw = vendor.delayCountGstr3b;
    if (raw === null || raw === undefined) return true;
    const rawStr = String(raw).trim().toUpperCase();
    return rawStr === 'N/A' || rawStr === 'NA' || rawStr === '';
  };

  const filteredMappedVendors = useMemo(() => {
    let list = mappedVendors.filter(v => !excludedGstins.has(v.vendorGstin));
    const q = vendorSearch.trim().toLowerCase();

    if (q) {
      list = list.filter(v => {
        const displayName = getVendorDisplayName(v).toLowerCase();
        return displayName.includes(q) ||
          (v.vendorGstin && v.vendorGstin.toLowerCase().includes(q)) ||
          (v.clientName && v.clientName.toLowerCase().includes(q)) ||
          (v.tradeName && v.tradeName.toLowerCase().includes(q)) ||
          (v.legalName && v.legalName.toLowerCase().includes(q)) ||
          (v.gstType && v.gstType.toLowerCase().includes(q)) ||
          (v.coreActivity && v.coreActivity.toLowerCase().includes(q)) ||
          (v.aggregateTurnover && v.aggregateTurnover.toLowerCase().includes(q));
      });
    }

    if (activeTab === 'all-vendors' && allVendorsClientFilter !== 'ALL') {
      const targetClientId = Number(allVendorsClientFilter);
      list = list.filter(v => v.clientId === targetClientId);
    }

    if (statusFilter === 'delayed-gstr1') {
      list = list.filter(v => (inlineCompliance[v.vendorGstin]?.gstr1 ?? v.delayCountGstr1 ?? 0) > 0);
    } else if (statusFilter === 'delayed-gstr3b') {
      list = list.filter(v => (inlineCompliance[v.vendorGstin]?.gstr3b ?? v.delayCountGstr3b ?? 0) > 0);
    } else if (statusFilter === 'active') {
      list = list.filter(v => (v.gstStatus || '').toLowerCase() === 'active');
    } else if (statusFilter === 'high-risk') {
      const curYearStr = String(new Date().getFullYear());
      const last3Lower = recent3CurrentMonths;

      list = list.filter(v => {
        const gstin = v.vendorGstin;
        const isGstr3bMissing = checkIsGstr3bMissing(v);

        // 0. Missing GSTR-3B is critical risk!
        if (isGstr3bMissing) {
          return true;
        }

        const gstr3bRaw = inlineCompliance[gstin]?.gstr3b !== undefined ? inlineCompliance[gstin]?.gstr3b : v.delayCountGstr3b;

        const gstr3bVal = typeof gstr3bRaw === 'number' ? gstr3bRaw : parseInt(gstr3bRaw, 10) || 0;
        const gstr3bMonths = (inlineCompliance[gstin]?.gstr3bMonths ?? v.delayedMonthsGstr3b ?? '').trim();

        // 1. GRC Score > 30 is the Risky category
        if (v.grcScore !== null && v.grcScore !== undefined && Number(v.grcScore) > 30) {
          return true;
        }

        // 2. High GSTR-3B delay risk (> 2 delays)
        if (gstr3bVal > 2) {
          return true;
        }

        const isTrader = isPartyTrader(v.coreActivity);
        const isPropOrPartner = isPropPartnerOrHuf(v.gstType);
        const isIndividualFirmOrTrader = isTrader || isPropOrPartner;
        const showRedCross = isIndividualFirmOrTrader && gstr3bVal > 2;

        if (showRedCross) {
          return true;
        }

        // 3. Scenario 8: Recent 3 months delay in current year
        const gstr3bTokens = (gstr3bMonths || '').split(',').map(s => s.trim().replace(/-\d+$/, '')).filter(Boolean);
        const hasLast3MonthsDelay = gstr3bTokens.length > 0 && gstr3bTokens.some(m => {
          const token = m.trim().toLowerCase();
          const yearMatch = token.match(/\b(20\d{2})\b/);
          if (yearMatch && yearMatch[1] !== curYearStr) return false;
          return last3Lower.some(l3 => token.startsWith(l3.slice(0, 3)));
        });
        if (showRedCross && hasLast3MonthsDelay) {
          return true;
        }

        // 4. Scenario 9: Critical risk whole line red
        const isAadhaarNo = (v.aadhaarValidation || '').trim().toLowerCase() === 'no';
        const isGstr7NA = !v.gstdNo && (!v.gstr7Status || v.gstr7Status.toLowerCase() === 'n/a');
        if (gstr3bVal > 2 && isTrader && isAadhaarNo && isGstr7NA) {
          return true;
        }

        return false;
      });
    }

    // Alphabetical Sorting by Company / Vendor Name (A to Z or Z to A)
    if (nameSortOrder === 'asc') {
      list = [...list].sort((a, b) => {
        const nameA = getVendorDisplayName(a).trim().toLowerCase();
        const nameB = getVendorDisplayName(b).trim().toLowerCase();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
    } else if (nameSortOrder === 'desc') {
      list = [...list].sort((a, b) => {
        const nameA = getVendorDisplayName(a).trim().toLowerCase();
        const nameB = getVendorDisplayName(b).trim().toLowerCase();
        return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    return list;
  }, [mappedVendors, excludedGstins, vendorSearch, statusFilter, inlineCompliance, nameSortOrder]);

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

        /* ── Primary View Tabs: All Uploaded Vendors vs Client-Wise View ── */
        .assessment-main-tabs {
          display: flex;
          gap: 0.85rem;
          margin-bottom: 1.25rem;
          background: #ffffff;
          padding: 0.5rem;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .assessment-main-tab {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.75rem 1.15rem;
          border-radius: 10px;
          border: 1.5px solid transparent;
          background: #f8fafc;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
          font-family: inherit;
        }

        .assessment-main-tab:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .assessment-main-tab.active {
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          border-color: #a78bfa;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.12);
        }

        .tab-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #64748b;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .assessment-main-tab.active .tab-icon-box {
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          color: #ffffff;
          border-color: transparent;
          box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);
        }

        .tab-text-box {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          min-width: 0;
          flex: 1;
        }

        .tab-title-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .tab-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #334155;
          letter-spacing: -0.2px;
        }

        .assessment-main-tab.active .tab-title {
          color: #4c1d95;
        }

        .tab-pill-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.15rem 0.55rem;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: 700;
          background: #e2e8f0;
          color: #475569;
        }

        .assessment-main-tab.active .tab-pill-badge {
          background: #7c3aed;
          color: #ffffff;
        }

        .tab-subtext {
          font-size: 0.74rem;
          color: #64748b;
          font-weight: 500;
        }

        .assessment-main-tab.active .tab-subtext {
          color: #6d28d9;
          font-weight: 600;
        }

        /* All Vendors Top Bar */
        .all-vendors-bar {
          background: linear-gradient(135deg, #ffffff 0%, #faf5ff 100%) !important;
          border-left: 4px solid #7c3aed !important;
        }

        .all-vendors-badge-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .all-vendors-icon-avatar {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(124, 58, 237, 0.25);
          flex-shrink: 0;
        }

        .all-vendors-title {
          font-size: 1rem;
          font-weight: 800;
          color: #1e1b4b;
          line-height: 1.2;
        }

        .all-vendors-subtitle {
          font-size: 0.74rem;
          color: #6d28d9;
          font-weight: 600;
        }

        /* Vendor Client Tag */
        .vendor-client-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.22rem 0.6rem;
          background: #f5f3ff;
          color: #5b21b6;
          border: 1px solid #ddd6fe;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .vendor-client-badge:hover {
          background: #ede9fe;
          border-color: #c4b5fd;
          transform: translateY(-1px);
        }

        .client-dropdown-select.compact {
          padding: 0.45rem 2rem 0.45rem 0.75rem;
          font-size: 0.82rem;
          border-radius: 8px;
        }

        .client-filter-dropdown-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #ffffff;
          padding: 0.2rem 0.5rem;
          border-radius: 9px;
          border: 1.5px solid #ddd6fe;
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

        /* ── Client Search Bar & Dropdown ── */
        .client-search-wrapper {
          position: relative;
          min-width: 320px;
          flex: 1;
          max-width: 520px;
        }

        .client-search-input-box {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .client-search-icon {
          position: absolute;
          left: 0.85rem;
          color: #7c3aed;
          pointer-events: none;
        }

        .client-search-input {
          width: 100%;
          padding: 0.65rem 2.2rem 0.65rem 2.6rem;
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 600;
          color: #0f172a;
          background: #f8fafc;
          border: 1.5px solid #ddd6fe;
          border-radius: 10px;
          outline: none;
          transition: all 0.2s ease;
        }

        .client-search-input:focus {
          background: #ffffff;
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
        }

        .btn-clear-search {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
        }
        .btn-clear-search:hover {
          color: #64748b;
        }

        .client-search-spinner {
          position: absolute;
          right: 2rem;
          color: #7c3aed;
        }

        .client-search-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          max-height: 380px;
          overflow-y: auto;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
          z-index: 1000;
        }

        .client-search-result-row {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .client-search-result-row:last-child {
          border-bottom: none;
        }

        .client-search-result-row:hover {
          background: #f5f3ff;
        }

        .result-avatar {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          overflow: hidden;
          background: #ede9fe;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .result-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .result-initial-avatar {
          font-weight: 800;
          color: #7c3aed;
          font-size: 0.95rem;
        }

        .result-info {
          flex: 1;
          min-width: 0;
        }

        .result-name-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 2px;
        }

        .result-comp-name {
          font-weight: 700;
          font-size: 0.9rem;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .badge-existing-client {
          background: #ede9fe;
          color: #6d28d9;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .badge-db-record {
          background: #e2e8f0;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 1px 7px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .result-meta-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.78rem;
          color: #64748b;
          font-family: monospace;
        }

        .result-gstin {
          color: #7c3aed;
          font-weight: 600;
        }

        .search-empty-state {
          padding: 1.25rem 1rem;
          text-align: center;
          color: #64748b;
          font-size: 0.85rem;
        }

        /* ── Horizontal 6 Clients Strip ── */
        .horizontal-clients-strip {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.7rem 1.1rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-bottom: 1.25rem;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
          flex-wrap: wrap;
        }

        .horizontal-clients-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          font-weight: 800;
          color: #0f172a;
          flex-shrink: 0;
        }

        .horizontal-clients-list {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          flex-wrap: wrap;
          flex: 1;
        }

        .client-chip-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.42rem 0.85rem;
          border-radius: 999px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .client-chip-pill:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        .client-chip-pill.active {
          background: #ede9fe;
          border-color: #7c3aed;
          color: #5b21b6;
          font-weight: 700;
          box-shadow: 0 2px 10px rgba(124, 58, 237, 0.18);
        }

        .chip-avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ddd6fe;
          color: #5b21b6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.68rem;
          font-weight: 800;
          overflow: hidden;
          flex-shrink: 0;
        }

        .chip-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .chip-name {
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chip-count {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 700;
        }

        .client-chip-pill.active .chip-count {
          color: #7c3aed;
        }

        .client-overflow-wrapper {
          position: relative;
        }

        .client-overflow-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.42rem 0.85rem;
          border-radius: 999px;
          border: 1.5px dashed #7c3aed;
          background: #ffffff;
          color: #7c3aed;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .client-overflow-btn:hover, .client-overflow-btn.open {
          background: #f5f3ff;
          border-style: solid;
        }

        .client-overflow-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 240px;
          max-height: 280px;
          overflow-y: auto;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
          z-index: 1000;
        }

        .overflow-menu-header {
          padding: 0.5rem 0.85rem;
          font-size: 0.72rem;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          border-bottom: 1px solid #f1f5f9;
        }

        .overflow-client-item {
          padding: 0.6rem 0.85rem;
          border-bottom: 1px solid #f8fafc;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .overflow-client-item:hover {
          background: #f5f3ff;
        }

        .overflow-client-item.active {
          background: #ede9fe;
        }

        .overflow-item-name {
          font-weight: 700;
          font-size: 0.86rem;
          color: #0f172a;
        }

        .overflow-item-gstin {
          font-size: 0.75rem;
          color: #64748b;
          font-family: monospace;
        }

        .overflow-item-count {
          font-size: 0.72rem;
          color: #7c3aed;
          font-weight: 600;
        }

        /* ── Setup Client & Map Vendors Modal ── */
        .modal-card.modal-card-setup {
          max-width: 1240px !important;
          width: 95vw !important;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          border-radius: 18px;
        }

        .setup-modal-grid-3col {
          display: grid;
          grid-template-columns: 1fr 1fr 1.35fr;
          gap: 1.25rem;
          align-items: stretch;
        }

        @media (max-width: 1100px) {
          .setup-modal-grid-3col {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 768px) {
          .setup-modal-grid-3col {
            grid-template-columns: 1fr;
          }
        }

        .setup-section-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
        }

        .setup-section-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .setup-logo-box {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 1.25rem;
          background: #ffffff;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .setup-logo-box:hover {
          border-color: #7c3aed;
          background: #fcfaff;
        }

        .setup-vendor-mode-tabs {
          display: flex;
          background: #e2e8f0;
          border-radius: 8px;
          padding: 3px;
          margin-bottom: 0.85rem;
          gap: 3px;
        }

        .setup-vendor-mode-tab {
          flex: 1;
          padding: 0.45rem;
          font-size: 0.82rem;
          font-weight: 700;
          border: none;
          background: transparent;
          color: #475569;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .setup-vendor-mode-tab.active {
          background: #ffffff;
          color: #7c3aed;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        }

        .chip-edit-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: none;
          background: #f1f5f9;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-left: 2px;
        }

        .chip-edit-btn:hover {
          background: #7c3aed;
          color: #ffffff;
        }

        .client-chip-pill.active .chip-edit-btn {
          background: #ddd6fe;
          color: #5b21b6;
        }

        .client-chip-pill.active .chip-edit-btn:hover {
          background: #7c3aed;
          color: #ffffff;
        }

        .overflow-client-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.6rem 0.85rem;
          border-bottom: 1px solid #f8fafc;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .overflow-edit-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .overflow-edit-btn:hover {
          background: #7c3aed;
          color: #ffffff;
          border-color: #7c3aed;
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

        
        /* ── Scenario Background & Dot Styling ── */
        .cell-bg-yellow {
          background-color: #fef08a !important;
          color: #713f12 !important;
          font-weight: 700 !important;
        }

        .cell-bg-red {
          background-color: #fecaca !important;
          color: #991b1b !important;
          font-weight: 700 !important;
        }

        .row-critical-risk {
          background-color: #dc2626 !important;
          color: #ffffff !important;
        }

        .row-critical-risk td {
          background-color: #dc2626 !important;
          color: #ffffff !important;
          border-color: #b91c1c !important;
        }

        .row-critical-risk .company-name-text,
        .row-critical-risk .gstn-cell span,
        .row-critical-risk .compliance-months-display,
        .row-critical-risk .copy-btn {
          color: #ffffff !important;
        }

        /* Keep badges readable and high-contrast on white pill backgrounds in critical risk red rows */
        .row-critical-risk .status-pill.status-active {
          background-color: #ffffff !important;
          color: #16a34a !important;
          font-weight: 800 !important;
          border: 1px solid #bbf7d0 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .row-critical-risk .status-pill.status-active .dot {
          background-color: #16a34a !important;
        }

        .row-critical-risk .status-pill.status-inactive {
          background-color: #ffffff !important;
          color: #dc2626 !important;
          font-weight: 800 !important;
          border: 1px solid #fca5a5 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .row-critical-risk .status-pill.status-inactive .dot {
          background-color: #dc2626 !important;
        }

        .gstr3b-na-badge {
          display: inline-block;
          padding: 0.22rem 0.65rem;
          background-color: #fee2e2;
          color: #dc2626;
          font-weight: 800;
          font-size: 0.78rem;
          border-radius: 6px;
          border: 1px solid #fca5a5;
          letter-spacing: 0.02em;
        }

        .row-critical-risk .gstr3b-na-badge {
          background-color: #ffffff !important;
          color: #dc2626 !important;
          border: 1px solid #fca5a5 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .row-critical-risk .gstr7-badge {
          background-color: #ffffff !important;
          color: #dc2626 !important;
          font-weight: 800 !important;
          border: 1px solid #fca5a5 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .row-critical-risk .score-badge,
        .row-critical-risk .score-badge.score-low,
        .row-critical-risk .score-badge.score-mid,
        .row-critical-risk .score-badge.score-high,
        .row-critical-risk .score-badge.score-na {
          background-color: #ffffff !important;
          color: #dc2626 !important;
          font-weight: 800 !important;
          border: 1px solid #fca5a5 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .row-critical-risk .btn-table-action {
          color: #ffffff !important;
        }

        .row-critical-risk .btn-table-action:hover {
          background-color: rgba(255, 255, 255, 0.2) !important;
          color: #ffffff !important;
        }

        .badge-risky {
          background-color: #dc2626;
          color: #ffffff;
          font-size: 0.68rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.02em;
          margin-right: 6px;
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(220, 38, 38, 0.4);
        }

        .circular-dot-indicator {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
          margin-right: 7px;
          border: 1.5px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
          transition: transform 0.15s ease;
        }

        .circular-dot-indicator:hover {
          transform: scale(1.18);
        }

        /* Scenario 6: Red Cross Indicator */
        .red-cross-indicator {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background-color: #fee2e2;
          color: #dc2626;
          border: 1.5px solid #ef4444;
          margin-right: 6px;
          flex-shrink: 0;
          box-shadow: 0 1px 2px rgba(220, 38, 38, 0.2);
          transition: transform 0.15s ease;
        }

        .red-cross-indicator:hover {
          transform: scale(1.18);
        }

        .row-critical-risk .red-cross-indicator {
          background-color: #ffffff !important;
          color: #dc2626 !important;
          border: 1.5px solid #fca5a5 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
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
          display: flex;
          flex-direction: column;
        }

        .table-responsive-wrapper {
          overflow-x: auto;
          overflow-y: auto;
          max-height: calc(100vh - 300px);
          position: relative;
          flex: 1 1 auto;
        }

        .table-footer-fixed-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 0.8rem;
          color: #475569;
          flex-wrap: wrap;
          gap: 0.75rem;
          flex-shrink: 0;
          z-index: 5;
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
          text-align: center;
        }

        .assessment-table th.th-company {
          text-align: left;
        }

        .assessment-table th.th-sortable {
          cursor: pointer;
          user-select: none;
          transition: background 0.15s ease;
        }

        .assessment-table th.th-sortable:hover {
          background: #4c268f;
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
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

        /* Editable Compliance Cell - Centered in middle */
        .compliance-cell {
          display: flex;
          align-items: center;
          justify-content: center;
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
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer !important;
          color: #64748b;
          transition: all 0.15s ease;
          padding: 0;
          flex-shrink: 0;
          position: relative;
          z-index: 2;
          pointer-events: auto !important;
        }

        .btn-month-picker:hover {
          background: #ede9fe !important;
          color: #7c3aed !important;
          border-color: #a78bfa !important;
          transform: scale(1.08);
        }

        .btn-month-picker.has-months {
          background: #fee2e2 !important;
          color: #dc2626 !important;
          border-color: #fca5a5 !important;
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

        /* Download Dropdown & Options */
        .download-dropdown-wrapper {
          position: relative;
          display: inline-block;
        }

        .btn-download-main {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.55rem 1.15rem;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          color: #1e293b;
          border-radius: 9px;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
        }

        .btn-download-main:hover:not(:disabled) {
          background: #ffffff;
          border-color: #7c3aed;
          color: #7c3aed;
          box-shadow: 0 3px 10px rgba(124, 58, 237, 0.12);
        }

        .btn-download-main:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .download-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 310px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
          padding: 0.45rem;
          z-index: 1000;
          animation: dropFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes dropFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .download-menu-item {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.65rem 0.8rem;
          background: none;
          border: none;
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s ease;
        }

        .download-menu-item:hover {
          background: #f1f5f9;
        }

        .download-menu-item.item-customize:hover {
          background: #f5f3ff;
        }

        .download-menu-item .item-title {
          font-size: 0.86rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 2px;
        }

        .download-menu-item .item-desc {
          font-size: 0.73rem;
          color: #64748b;
          line-height: 1.25;
        }

        .dropdown-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 0.35rem 0;
        }

        /* Template Customization Modal Styles */
        .template-editor-modal {
          max-width: 900px !important;
          max-height: 92vh !important;
          display: flex;
          flex-direction: column;
        }

        .template-editor-body {
          overflow-y: auto;
          max-height: calc(92vh - 140px);
          padding: 1.25rem 1.5rem;
        }

        .template-form-section {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.1rem;
          margin-bottom: 1.25rem;
        }

        .template-form-section .section-title {
          font-size: 0.92rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .form-row-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.85rem;
        }

        .observations-list-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .observation-edit-item {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          padding: 0.75rem;
          transition: border-color 0.15s ease;
        }

        .observation-edit-item:focus-within {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
        }

        .obs-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.4rem;
        }

        .obs-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #7c3aed;
          color: #ffffff;
          font-size: 0.75rem;
          font-weight: 800;
          flex-shrink: 0;
        }

        .obs-title-input {
          flex: 1;
          padding: 0.35rem 0.65rem;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          color: #0f172a;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }

        .obs-desc-textarea {
          width: 100%;
          padding: 0.45rem 0.65rem;
          font-family: inherit;
          font-size: 0.82rem;
          color: #334155;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          resize: vertical;
        }

        .template-editor-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 0 0 16px 16px;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .footer-right-buttons {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .btn-download-pdf-action {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #dc2626;
          color: #ffffff;
          border: none;
          padding: 0.55rem 1rem;
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-download-pdf-action:hover:not(:disabled) {
          background: #b91c1c;
          box-shadow: 0 3px 10px rgba(220, 38, 38, 0.25);
        }

        .btn-download-docx-action {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 0.55rem 1rem;
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-download-docx-action:hover:not(:disabled) {
          background: #1d4ed8;
          box-shadow: 0 3px 10px rgba(37, 99, 235, 0.25);
        }
      `}</style>

      {/* ── Primary View Tabs: All Uploaded Vendors (One Report) vs Client-Wise View ── */}
      <div className="assessment-main-tabs">
        <button
          type="button"
          className={`assessment-main-tab ${activeTab === 'all-vendors' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('all-vendors')}
        >
          <div className="tab-icon-box">
            <Layers size={18} />
          </div>
          <div className="tab-text-box">
            <div className="tab-title-row">
              <span className="tab-title">All Uploaded Vendors</span>
              <span className="tab-pill-badge">{totalAllVendorsCount} Vendors</span>
            </div>
            <span className="tab-subtext">One Consolidated Assessment Report for All Clients</span>
          </div>
        </button>

        <button
          type="button"
          className={`assessment-main-tab ${activeTab === 'by-client' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('by-client')}
        >
          <div className="tab-icon-box">
            <Building2 size={18} />
          </div>
          <div className="tab-text-box">
            <div className="tab-title-row">
              <span className="tab-title">Client-Wise Assessment</span>
              <span className="tab-pill-badge">{clients.length} Clients</span>
            </div>
            <span className="tab-subtext">Manage Individual Client Portfolios</span>
          </div>
        </button>
      </div>

      {/* ── Top Bar: All Vendors View vs Client-Wise View ── */}
      {activeTab === 'all-vendors' ? (
        <div className="client-top-bar all-vendors-bar">
          <div className="client-selector-group">
            <div className="all-vendors-badge-group">
              <div className="all-vendors-icon-avatar">
                <Layers size={18} color="#ffffff" />
              </div>
              <div>
                <div className="all-vendors-title">All Uploaded Vendors Assessment</div>
                <div className="all-vendors-subtitle">
                  One report for all vendors across {clients.length} client portfolios ({filteredMappedVendors.length} of {totalAllVendorsCount} vendors)
                </div>
              </div>
            </div>

            {/* Quick Client Filter within All Vendors */}
            {clients.length > 0 && (
              <div className="client-filter-dropdown-wrapper" title="Quickly filter all vendors by client">
                <Building2 size={15} color="#7c3aed" />
                <select
                  className="client-dropdown-select compact"
                  value={allVendorsClientFilter}
                  onChange={(e) => setAllVendorsClientFilter(e.target.value)}
                >
                  <option value="ALL">All Clients ({clients.length} clients • {totalAllVendorsCount} vendors)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.clientName} ({c.vendorCount ?? 0} vendors)
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="dropdown-chevron" />
              </div>
            )}
          </div>

          <div className="top-action-buttons">
            <button className="btn-success-gradient" onClick={openImportModal} title="Upload client & vendor Excel sheet">
              <FileSpreadsheet size={16} /> Import from Sheet
            </button>
            <button className="btn-primary-gradient" onClick={openAddClientModal} title="Add a new client">
              <Plus size={16} /> Add Client
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="client-top-bar">
            {/* Client Search Bar with Live Suggestions Dropdown */}
            <div className="client-search-wrapper" ref={clientSearchContainerRef}>
              <div className="client-search-input-box">
                <Search size={17} className="client-search-icon" />
                <input
                  type="text"
                  className="client-search-input"
                  placeholder="Search client by GSTIN or Name to add/map..."
                  value={clientSearchQuery}
                  onChange={(e) => handleClientSearchChange(e.target.value)}
                  onFocus={() => {
                    if (clientSearchResults.length > 0 || clientSearchQuery.trim().length >= 2) {
                      setShowClientSearchDropdown(true);
                    }
                  }}
                />
                {clientSearchQuery && (
                  <button
                    type="button"
                    className="btn-clear-search"
                    onClick={() => {
                      setClientSearchQuery('');
                      setClientSearchResults([]);
                      setShowClientSearchDropdown(false);
                    }}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
                {isSearchingClients && (
                  <Loader2 size={16} className="spin-icon client-search-spinner" />
                )}
              </div>

              {/* Dropdown Results List */}
              {showClientSearchDropdown && (
                <div className="client-search-dropdown-menu">
                  {clientSearchResults.length > 0 ? (
                    clientSearchResults.map((comp) => {
                      const compLogo = comp.logoUrl || (comp.gstin ? apiClient.getClientLogoByGstinUrl(comp.gstin) : null);
                      return (
                        <div
                          key={comp.gstin}
                          className="client-search-result-row"
                          onClick={() => handleSelectSearchResult(comp)}
                        >
                          <div className="result-avatar">
                            {comp.hasLogo && compLogo ? (
                              <img
                                src={compLogo}
                                alt={comp.name}
                                className="result-logo-img"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="result-initial-avatar">
                                {(comp.name || comp.gstin || 'C').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="result-info">
                            <div className="result-name-row">
                              <span className="result-comp-name">{comp.name || comp.tradeName || comp.legalName}</span>
                              {comp.isExistingClient && (
                                <span className="badge-existing-client">Client ({comp.vendorCount ?? 0} vendors)</span>
                              )}
                              {!comp.isExistingClient && !comp.isCustomNew && (
                                <span className="badge-db-record">GST Database Record</span>
                              )}
                              {comp.isCustomNew && (
                                <span className="badge-existing-client" style={{ background: '#dbeafe', color: '#1d4ed8' }}>+ Add New Client</span>
                              )}
                            </div>
                            <div className="result-meta-row">
                              <span className="result-gstin">{comp.gstin}</span>
                              {comp.address && <span className="result-address">• {comp.address.slice(0, 42)}...</span>}
                            </div>
                          </div>
                          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700 }}>Setup & Map &rarr;</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="search-empty-state">
                      {clientSearchQuery.trim().length < 2
                        ? 'Type at least 2 characters to search clients by GSTIN or Name...'
                        : `No clients or database records found matching "${clientSearchQuery}"`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Client Badge (if selected) */}
            {selectedClient && selectedClient.id !== 'ALL' && (
              <div className="client-info-pill" style={{ margin: '0 0.5rem' }}>
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
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>{selectedClient.clientName}</div>
                  <div className="client-meta-gstin">{selectedClient.clientGstin}</div>
                </div>
                <span className="client-meta-count">{mappedVendors.length} Vendors</span>
              </div>
            )}

            {/* Top Actions: Import from Sheet & Active Client Actions */}
            <div className="top-action-buttons">
              <button className="btn-success-gradient" onClick={openImportModal} title="Upload client & vendor Excel sheet">
                <FileSpreadsheet size={16} /> Import from Sheet
              </button>
              {selectedClient && selectedClient.id !== 'ALL' && (
                <>
                  <button
                    className="btn-secondary-sm"
                    onClick={(e) => openSetupModalForClient(selectedClient, e)}
                    title="Edit client details, persistent logo, and mapped vendors"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Edit2 size={14} /> Edit Client
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

          {/* ── Horizontal List of Maximum 6 Clients (with + More Dropdown) ── */}
          {clients.length > 0 && (
            <div className="horizontal-clients-strip">
              <div className="horizontal-clients-label">
                <Building2 size={16} color="#7c3aed" />
                <span>Clients:</span>
              </div>

              <div className="horizontal-clients-list">
                {visibleClients.map((client) => {
                  const isSelected = selectedClient?.id === client.id;
                  const logoUrl = client.hasLogo ? apiClient.getClientLogoUrl(client.id) : null;
                  return (
                    <div
                      key={client.id}
                      className={`client-chip-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        markClientRecent(client.id);
                        setSelectedClient(client);
                        fetchMappedVendors(client.id);
                      }}
                      title={`${client.clientName} (${client.clientGstin}) • ${client.vendorCount ?? 0} vendors`}
                    >
                      <div className="chip-avatar">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={client.clientName}
                            className="chip-logo-img"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="chip-letter">
                            {client.clientName?.charAt(0)?.toUpperCase() || 'C'}
                          </span>
                        )}
                      </div>
                      <span className="chip-name">{client.clientName}</span>
                      <span className="chip-count">({client.vendorCount ?? 0})</span>
                      <button
                        type="button"
                        className="chip-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSetupModalForClient(client, e);
                        }}
                        title={`Edit ${client.clientName}`}
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  );
                })}

                {overflowClients.length > 0 && (
                  <div className="client-overflow-wrapper" ref={overflowDropdownRef}>
                    <button
                      type="button"
                      className={`client-overflow-btn ${showOverflowDropdown ? 'open' : ''}`}
                      onClick={() => setShowOverflowDropdown(prev => !prev)}
                      title="Show remaining clients"
                    >
                      <span>+{overflowClients.length} More</span>
                      <ChevronDown size={14} />
                    </button>

                    {showOverflowDropdown && (
                      <div className="client-overflow-menu">
                        <div className="overflow-menu-header">More Clients ({overflowClients.length})</div>
                        {overflowClients.map((c) => {
                          const isSel = selectedClient?.id === c.id;
                          return (
                            <div
                              key={c.id}
                              className={`overflow-client-item ${isSel ? 'active' : ''}`}
                              onClick={() => {
                                markClientRecent(c.id);
                                setSelectedClient(c);
                                fetchMappedVendors(c.id);
                                setShowOverflowDropdown(false);
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="overflow-item-name">{c.clientName}</div>
                                <div className="overflow-item-gstin">{c.clientGstin}</div>
                                <span className="overflow-item-count">{c.vendorCount ?? 0} vendors</span>
                              </div>
                              <button
                                type="button"
                                className="overflow-edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSetupModalForClient(c, e);
                                  setShowOverflowDropdown(false);
                                }}
                                title={`Edit ${c.clientName}`}
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

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

          <button
            type="button"
            className="btn-secondary-sm"
            onClick={() => setShowTemplateModal(true)}
            title="Edit report template, observations & disclaimer text"
          >
            <Sliders size={15} /> Edit Template
          </button>

          <div className="download-dropdown-wrapper" ref={downloadDropdownRef}>
            <button
              type="button"
              className="btn-download-main"
              onClick={() => setShowDownloadMenu(prev => !prev)}
              disabled={!filteredMappedVendors.length}
            >
              {exportingType ? (
                <>
                  <Loader2 size={15} className="spin-icon" />
                  Generating {exportingType.toUpperCase()}...
                </>
              ) : (
                <>
                  <Download size={15} />
                  Download
                  <ChevronDown size={14} />
                </>
              )}
            </button>

            {showDownloadMenu && (
              <div className="download-dropdown-menu">
                <button
                  type="button"
                  className="download-menu-item"
                  onClick={() => { setShowDownloadMenu(false); handleExportExcel(); }}
                >
                  <FileSpreadsheet size={16} color="#10b981" />
                  <div>
                    <div className="item-title">Export as Excel (.xlsx)</div>
                    <div className="item-desc">Spreadsheet with colored dots, red months & styles</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="download-menu-item"
                  onClick={() => { setShowDownloadMenu(false); handleExportPdf(); }}
                >
                  <FileText size={16} color="#ef4444" />
                  <div>
                    <div className="item-title">Download as PDF (.pdf)</div>
                    <div className="item-desc">Assessment report with key observations & styled table</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="download-menu-item"
                  onClick={() => { setShowDownloadMenu(false); handleExportDocx(); }}
                >
                  <Edit2 size={16} color="#2563eb" />
                  <div>
                    <div className="item-title">Download as DOCX (.docx)</div>
                    <div className="item-desc">100% editable Word template with tables & styles</div>
                  </div>
                </button>

                <div className="dropdown-divider"></div>

                <button
                  type="button"
                  className="download-menu-item item-customize"
                  onClick={() => { setShowDownloadMenu(false); setShowTemplateModal(true); }}
                >
                  <Sliders size={16} color="#7c3aed" />
                  <div>
                    <div className="item-title">Customize Report Template...</div>
                    <div className="item-desc">Edit month, observations & disclaimer text</div>
                  </div>
                </button>
              </div>
            )}
          </div>
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
          <>
            {reportTemplate?.tableWarning && reportTemplate.tableWarning.trim() && (
              <div style={{
                padding: '0.6rem 1rem',
                background: '#fef2f2',
                borderBottom: '1px solid #fee2e2',
                color: '#dc2626',
                fontWeight: 700,
                fontSize: '0.82rem',
                flexShrink: 0
              }}>
                {reportTemplate.tableWarning.trim()}
              </div>
            )}
            <div className="table-responsive-wrapper">
              <table className="assessment-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>Sl. No.</th>
                  {activeTab === 'all-vendors' && (
                    <th style={{ minWidth: '160px', textAlign: 'left' }}>Client Name</th>
                  )}
                  <th
                    className="th-company th-sortable"
                    style={{ minWidth: '230px', textAlign: 'left' }}
                    onClick={toggleNameSort}
                    title={
                      nameSortOrder === 'asc'
                        ? 'Sorted A → Z (Click to sort Z → A)'
                        : nameSortOrder === 'desc'
                          ? 'Sorted Z → A (Click to reset to default order)'
                          : 'Click to sort alphabetically (A → Z)'
                    }
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span>Supplier Name</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: nameSortOrder ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}
                      >
                        {nameSortOrder === 'asc' ? (
                          <>
                            <ArrowUp size={13} style={{ strokeWidth: 2.5 }} />
                            <span>A-Z</span>
                          </>
                        ) : nameSortOrder === 'desc' ? (
                          <>
                            <ArrowDown size={13} style={{ strokeWidth: 2.5 }} />
                            <span>Z-A</span>
                          </>
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.65 }} />
                        )}
                      </span>
                    </div>
                  </th>
                  <th style={{ minWidth: '150px', textAlign: 'center' }}>GSTN</th>
                  <th style={{ minWidth: '130px', textAlign: 'center' }}>Type</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Age</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>GST Status</th>
                  <th style={{ minWidth: '110px', textAlign: 'center' }} title="Editable field — edit and click 'Save Changes' above">
                    GSTR1 ✎
                  </th>
                  <th style={{ minWidth: '220px', textAlign: 'center' }} title="Editable field — edit and click 'Save Changes' above">
                    Number of times GSTR-3B filing delay ✎
                  </th>
                  <th style={{ minWidth: '160px', textAlign: 'center' }}>GSTR7R</th>
                  <th style={{ minWidth: '110px', textAlign: 'center' }}>Aadhaar Authenticated</th>
                  <th style={{ minWidth: '170px', textAlign: 'center' }}>Core Activity</th>
                  <th style={{ minWidth: '130px', textAlign: 'center' }}>Turn over</th>
                  <th style={{ minWidth: '90px', textAlign: 'center' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappedVendors.map((vendor, index) => {
                  const gstin = vendor.vendorGstin;
                  const gstr1Val = inlineCompliance[gstin]?.gstr1 ?? vendor.delayCountGstr1 ?? 0;
                  const gstr3bRaw = inlineCompliance[gstin]?.gstr3b !== undefined ? inlineCompliance[gstin]?.gstr3b : vendor.delayCountGstr3b;
                  const isGstr3bMissing = checkIsGstr3bMissing(vendor);
                  const gstr3bVal = isGstr3bMissing ? 'N/A' : (typeof gstr3bRaw === 'number' ? gstr3bRaw : parseInt(gstr3bRaw, 10) || 0);
                  const gstr1Months = (inlineCompliance[gstin]?.gstr1Months ?? vendor.delayedMonthsGstr1 ?? '').trim();
                  const gstr3bMonths = (inlineCompliance[gstin]?.gstr3bMonths ?? vendor.delayedMonthsGstr3b ?? '').trim();
                  const origGstr1 = vendor.delayCountGstr1 ?? 0;
                  const origGstr3b = vendor.delayCountGstr3b ?? 0;
                  const origGstr1Months = (vendor.delayedMonthsGstr1 || '').trim();
                  const origGstr3bMonths = (vendor.delayedMonthsGstr3b || '').trim();
                  const isGstr1Modified = (inlineCompliance[gstin]?.gstr1 !== undefined && inlineCompliance[gstin]?.gstr1 !== origGstr1) ||
                    (gstr1Months !== origGstr1Months);
                  const isGstr3bModified = (inlineCompliance[gstin]?.gstr3b !== undefined && inlineCompliance[gstin]?.gstr3b !== origGstr3b) ||
                    (gstr3bMonths !== origGstr3bMonths);
                  const saveStatus = savingGstins[gstin];
                  const gstr7Info = getGstr7Display(vendor);
                  
                  const ageDisplay = vendor.ageYears !== null && vendor.ageYears !== undefined
                    ? Math.round(vendor.ageYears)
                    : computeAge(vendor.registrationDate);

                  // ── Scenario Condition Evaluations ──
                  const isTrader = isPartyTrader(vendor.coreActivity);
                  const isPropOrPartner = isPropPartnerOrHuf(vendor.gstType);
                  const isAadhaarNo = (vendor.aadhaarValidation || '').trim().toLowerCase() === 'no';
                  const isGstr7NA = !vendor.gstdNo && (!vendor.gstr7Status || vendor.gstr7Status.toLowerCase() === 'n/a' || gstr7Info?.status?.text === 'N/A' || !gstr7Info?.status?.text);
                  const isLowTurnover = isTurnoverUnder3Cr(vendor.aggregateTurnover);
                  const isYoungAge = typeof ageDisplay === 'number' && ageDisplay < 2;

                  // Scenario 6: Red Cross if individual firm or traders && GSTR3B delayed > 2
                  const isIndividualFirmOrTrader = isTrader || isPropOrPartner;
                  const showRedCross = isIndividualFirmOrTrader && typeof gstr3bVal === 'number' && gstr3bVal > 2;

                  // Scenario 8: Risky badge if conditions of Scenario 6 are met PLUS delayed in recent 3 months of current year
                  const curYearStr = String(new Date().getFullYear());
                  const last3Lower = recent3CurrentMonths;
                  const gstr3bTokens = (gstr3bMonths || '').split(',').map(s => s.trim().replace(/-\d+$/, '')).filter(Boolean);
                  const hasLast3MonthsDelay = gstr3bTokens.length > 0 && gstr3bTokens.some(m => {
                    const token = m.trim().toLowerCase();
                    const yearMatch = token.match(/\b(20\d{2})\b/);
                    if (yearMatch && yearMatch[1] !== curYearStr) return false;
                    return last3Lower.some(l3 => token.startsWith(l3.slice(0, 3)));
                  });
                  const isRisky = showRedCross && hasLast3MonthsDelay;

                  // Scenario 9 or missing GSTR-3B: Whole line red with white text
                  const isEntireRowRed = isGstr3bMissing || (typeof gstr3bVal === 'number' && gstr3bVal > 2 && isTrader && isAadhaarNo && isGstr7NA);

                  // Scenario 2: GSTR1 circular dot color
                  const gstr1DotColor = gstr1Val > 2 ? '#ef4444' : gstr1Val >= 1 ? '#f59e0b' : '#10b981';

                  // Circular dot color before company name
                  const isScoreRisky = vendor.grcScore !== null && vendor.grcScore !== undefined && Number(vendor.grcScore) > 30;
                  const companyDotColor = isEntireRowRed || (typeof gstr3bVal === 'number' && gstr3bVal > 2) || isScoreRisky ? '#ef4444' : ((typeof gstr3bVal === 'number' && gstr3bVal >= 1) || gstr1Val >= 1 || (vendor.grcScore !== null && Number(vendor.grcScore) >= 20) ? '#f59e0b' : '#10b981');

                  return (
                    <tr key={gstin} className={isEntireRowRed ? 'row-critical-risk' : ''}>
                      {/* Sl. No. */}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                        {index + 1}
                      </td>

                      {/* Associated Client Name (shown in All Vendors mode - placed just before Supplier Name) */}
                      {activeTab === 'all-vendors' && (
                        <td style={{ textAlign: 'left' }}>
                          <span
                            className={`vendor-client-badge ${!vendor.clientName || vendor.clientName === 'Unassigned' ? 'is-unassigned' : ''}`}
                            title={vendor.clientName && vendor.clientName !== 'Unassigned' ? `Client: ${vendor.clientName}. Click to switch to this client.` : 'This vendor is not yet mapped to any client'}
                            onClick={() => {
                              if (vendor.clientId) {
                                const c = clients.find(item => item.id === vendor.clientId);
                                if (c) {
                                  setSelectedClient(c);
                                  handleSwitchTab('by-client');
                                }
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: vendor.clientId ? 'pointer' : 'default',
                              fontWeight: 600
                            }}
                          >
                            <Building2 size={12} style={{ opacity: 0.7 }} />
                            <span>{vendor.clientName || 'Unassigned'}</span>
                          </span>
                        </td>
                      )}

                      {/* Supplier Name */}
                      <td>
                        <div className="company-cell">
                          {(isRisky || showRedCross) && <span className="badge-risky">Risky</span>}
                          <span
                            className="circular-dot-indicator"
                            style={{ backgroundColor: companyDotColor }}
                            title={gstr3bVal > 2 ? 'High delay risk' : gstr3bVal >= 1 ? 'Moderate delay' : 'Compliant'}
                          />
                          <span className="company-name-text">
                            {getVendorDisplayName(vendor)}
                          </span>
                        </div>
                      </td>

                      {/* GSTN */}
                      <td style={{ textAlign: 'center' }}>
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
                      <td style={{ textAlign: 'center', color: isEntireRowRed ? '#ffffff' : '#475569', fontSize: '0.82rem' }}>
                        {vendor.gstType || 'Partnership'}
                      </td>

                      {/* Age */}
                      <td
                        className={!isEntireRowRed && isYoungAge ? 'cell-bg-yellow' : ''}
                        style={{ textAlign: 'center', fontWeight: 700, color: isEntireRowRed ? '#ffffff' : (!isEntireRowRed && isYoungAge ? '#713f12' : '#334155') }}
                        title={vendor.registrationDate ? `Registered: ${vendor.registrationDate}` : ''}
                      >
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
                      <td style={{ textAlign: 'center' }}>
                        <div className="compliance-cell">
                          <span
                            className="circular-dot-indicator"
                            style={{ backgroundColor: gstr1DotColor, marginRight: '7px' }}
                            title={`GSTR-1 delay: ${gstr1Val}`}
                          />
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
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openMonthPicker(vendor, 'gstr1'); }}
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
                      <td
                        className={!isEntireRowRed ? (typeof gstr3bVal === 'number' && gstr3bVal > 2 ? 'cell-bg-red' : (typeof gstr3bVal === 'number' && gstr3bVal >= 1 ? 'cell-bg-yellow' : '')) : ''}
                        style={{ textAlign: 'center' }}
                      >
                        <div className="compliance-cell">
                          {isGstr3bMissing ? (
                            <span
                              className="gstr3b-na-badge"
                              title="GSTR-3B is missing (N/A) — row marked critical risk red. Click to set delay count."
                              onClick={() => handleComplianceChange(gstin, 'gstr3b', 0)}
                              style={{ cursor: 'pointer' }}
                            >
                              N/A
                            </span>
                          ) : (
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
                          )}
                          <button
                            type="button"
                            className={`btn-month-picker ${gstr3bMonths ? 'has-months' : ''}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openMonthPicker(vendor, 'gstr3b'); }}
                            title={gstr3bMonths ? `Delayed months: ${gstr3bMonths} (Click to edit)` : "Select delayed months for GSTR-3B"}
                          >
                            <Calendar size={13} />
                          </button>
                          {gstr3bMonths && (
                            <span className="compliance-months-display" title={`Delayed months: ${gstr3bMonths}`}>
                              {gstr3bMonths}
                            </span>
                          )}
                          {isGstr3bModified && <span className="dirty-dot" title="Unsaved changes" />}
                          {saveStatus === 'saving' && <Loader2 size={13} className="spin-icon" color="#7c3aed" />}
                          {saveStatus === 'saved' && <span className="save-indicator">✓</span>}
                        </div>
                      </td>

                      {/* GSTR7R */}
                      <td
                        className={!isEntireRowRed && isTrader && isGstr7NA ? 'cell-bg-red' : ''}
                        style={{ textAlign: 'center' }}
                      >
                        <span
                          className="gstr7-badge"
                          style={isEntireRowRed ? {
                            backgroundColor: '#ffffff',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            fontWeight: 800
                          } : {
                            background: (!isEntireRowRed && isTrader && isGstr7NA) ? '#ef4444' : gstr7Info.status.bg,
                            color: (!isEntireRowRed && isTrader && isGstr7NA) ? '#ffffff' : gstr7Info.status.color,
                            border: (!isEntireRowRed && isTrader && isGstr7NA) ? '1px solid #b91c1c' : `1px solid ${gstr7Info.status.border}`
                          }}
                        >
                          {gstr7Info.status.text}
                        </span>
                      </td>

                      {/* Aadhaar Authenticated */}
                      <td
                        className={!isEntireRowRed && (isTrader || isPropOrPartner) && isAadhaarNo ? 'cell-bg-red' : ''}
                        style={{ textAlign: 'center' }}
                      >
                        {vendor.aadhaarValidation === 'Yes' ? (
                          <span style={{ color: isEntireRowRed ? '#ffffff' : '#16a34a', fontWeight: 800 }}>Yes</span>
                        ) : vendor.aadhaarValidation === 'No' ? (
                          <span style={{ color: isEntireRowRed ? '#ffffff' : ((isTrader || isPropOrPartner) ? '#991b1b' : '#64748b'), fontWeight: 800 }}>No</span>
                        ) : (
                          <span style={{ color: isEntireRowRed ? '#ffffff' : '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Core Activity */}
                      <td style={{ textAlign: 'center', color: isEntireRowRed ? '#ffffff' : '#475569', fontSize: '0.82rem' }}>
                        {vendor.coreActivity || 'Manufacturer'}
                      </td>

                      {/* Turn over */}
                      <td
                        className={!isEntireRowRed && isLowTurnover ? 'cell-bg-yellow' : ''}
                        style={{ textAlign: 'center', color: isEntireRowRed ? '#ffffff' : (!isEntireRowRed && isLowTurnover ? '#713f12' : '#334155'), fontWeight: 600, fontSize: '0.82rem' }}
                      >
                        {vendor.aggregateTurnover || 'N/A'}
                      </td>

                      {/* Score & Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          {getScoreBadge(vendor.grcScore)}
                          <button
                            type="button"
                            className="btn-table-action"
                            onClick={() => handleEditVendorClick(vendor)}
                            title="Edit Vendor Details"
                          >
                            <Edit2 size={14} />
                          </button>
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
                            onClick={() => handleUnmapVendor(vendor)}
                            title="Remove vendor for this client (persistent; does not delete from master database)"
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

          {/* ── Fixed Bottom Footer Bar (Outside Table Scroll) ── */}
          <div className="table-footer-fixed-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>Score Categories:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#15803d', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}></span>
                GRC &lt; 20: Good
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#b45309', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}></span>
                20 &lt; GRC &lt; 30: Careful category
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#b91c1c', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span>
                GRC &gt; 30: Risky category
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}>
                Showing {filteredMappedVendors.length} of {mappedVendors.length} vendors
              </span>
              {excludedGstins.size > 0 && (
                <button
                  type="button"
                  onClick={() => setExcludedGstins(new Set())}
                  title="Restore all vendors hidden from this report session"
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RotateCcw size={11} /> Restore {excludedGstins.size} hidden
                </button>
              )}
            </div>
          </div>
        </>
      )}
      </div>

      {/* ── Toast Notification ── */}
      {notification && (
        <div className={`toast-notification ${notification.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {notification.type === 'error' ? <AlertCircle size={18} color="#ef4444" /> : <Check size={18} color="#10b981" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ── CLIENT SETUP & VENDOR MAPPING MODAL (SEARCH RESULT / POPUP / EDIT) ── */}
      {showSetupModal && (
        <div className="modal-overlay" onClick={() => !setupSubmitting && setShowSetupModal(false)}>
          <div className="modal-card modal-card-setup" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#7c3aed'
                }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {setupClient.isExistingClient ? 'Edit Client & Vendor Mapping' : 'Add Client & Map Vendors'}
                    {setupClient.isExistingClient && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: '999px' }}>
                        Editing Client
                      </span>
                    )}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                    <span style={{ fontWeight: 600 }}>{setupClient.clientName || 'Unnamed Client'}</span>
                    <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: 700 }}>• {setupClient.clientGstin}</span>
                    {setupClient.existingMappedCount > 0 && (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>• {setupClient.existingMappedCount} vendors currently mapped</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="btn-ghost-sm"
                disabled={setupSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '76vh', padding: '1.4rem' }}>
              <div className="setup-modal-grid-3col">
                
                {/* ── SECTION 1: Client Information ── */}
                <div className="setup-section-card">
                  <div className="setup-section-title">
                    <ShieldCheck size={17} color="#7c3aed" />
                    <span>1. Client Information</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                      Client / Legal Name *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. RAPID FORGE AND FITTINGS"
                      value={setupClient.clientName}
                      onChange={(e) => setSetupClient(prev => ({ ...prev, clientName: e.target.value }))}
                      style={{ fontSize: '0.88rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                      Client GSTIN *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="15-digit GSTIN (e.g. 24AUFPJ6677D1ZL)"
                      value={setupClient.clientGstin}
                      maxLength={15}
                      onChange={(e) => setSetupClient(prev => ({ ...prev, clientGstin: e.target.value.toUpperCase() }))}
                      style={{ fontFamily: 'monospace', letterSpacing: '0.04em', fontSize: '0.88rem', fontWeight: 700, color: '#7c3aed' }}
                    />
                  </div>

                  <div style={{ marginTop: 'auto', padding: '0.75rem', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.76rem', color: '#64748b' }}>
                    {setupClient.isExistingClient ? (
                      <div>
                        <strong style={{ color: '#0f172a' }}>Status:</strong> Registered Client<br />
                        Changes will be saved to database.
                      </div>
                    ) : (
                      <div>
                        <strong style={{ color: '#0f172a' }}>New Client:</strong> Will be registered and mapped to vendors upon save.
                      </div>
                    )}
                  </div>
                </div>

                {/* ── SECTION 2: Client Logo (Persistent) ── */}
                <div className="setup-section-card">
                  <div className="setup-section-title">
                    <ImageIcon size={17} color="#7c3aed" />
                    <span>2. Client Logo (Persistent)</span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '-0.25rem 0 0.85rem 0', lineHeight: 1.4 }}>
                    Permanently saved for this GSTIN. Applied to all PDF & Word DOCX reports.
                  </p>

                  <div
                    className="setup-logo-box"
                    onClick={() => document.getElementById('setup-modal-logo-file')?.click()}
                    style={{ flex: 1, minHeight: '170px' }}
                  >
                    <input
                      id="setup-modal-logo-file"
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
                          setSetupClient(prev => ({
                            ...prev,
                            logoFile: file,
                            logoPreview: URL.createObjectURL(file),
                            logoRemoved: false
                          }));
                        }
                      }}
                    />
                    {setupClient.logoPreview ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', width: '100%' }}>
                        <img
                          src={setupClient.logoPreview}
                          alt="Logo Preview"
                          style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain' }}
                        />
                        <span style={{ fontSize: '0.78rem', color: '#7c3aed', fontWeight: 700 }}>
                          Click to choose a different logo
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                        <UploadCloud size={36} color="#7c3aed" />
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>Upload Client Logo</span>
                        <span style={{ fontSize: '0.75rem' }}>PNG, JPEG, SVG (Max 2MB)</span>
                        <span style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 600, marginTop: '4px' }}>Click to Browse</span>
                      </div>
                    )}
                  </div>

                  {setupClient.logoPreview && (
                    <div style={{ marginTop: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>✓ Logo Attached</span>
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        style={{ color: '#ef4444', fontSize: '0.75rem', padding: '0.2rem 0.6rem', border: '1px solid #fecaca', borderRadius: '6px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSetupClient(prev => ({ ...prev, logoFile: null, logoPreview: null, logoRemoved: true }));
                        }}
                      >
                        <Trash2 size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} /> Remove Logo
                      </button>
                    </div>
                  )}
                </div>

                {/* ── SECTION 3: Map Vendors to this Client ── */}
                <div className="setup-section-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="setup-section-title">
                    <Users size={17} color="#7c3aed" />
                    <span>3. Map Vendors</span>
                  </div>

                  <div className="setup-vendor-mode-tabs">
                    <button
                      type="button"
                      className={`setup-vendor-mode-tab ${setupClient.vendorMode === 'sheet' ? 'active' : ''}`}
                      onClick={() => setSetupClient(prev => ({ ...prev, vendorMode: 'sheet' }))}
                    >
                      <FileSpreadsheet size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Upload Excel / CSV
                    </button>
                    <button
                      type="button"
                      className={`setup-vendor-mode-tab ${setupClient.vendorMode === 'registry' ? 'active' : ''}`}
                      onClick={() => setSetupClient(prev => ({ ...prev, vendorMode: 'registry' }))}
                    >
                      <Users size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Pick from Registry ({allAvailableVendors.length})
                    </button>
                  </div>

                  {setupClient.vendorMode === 'sheet' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                      <div
                        className="setup-logo-box"
                        onClick={() => document.getElementById('setup-vendor-sheet-file')?.click()}
                        style={{ padding: '1.25rem 1rem', minHeight: '130px' }}
                      >
                        <input
                          id="setup-vendor-sheet-file"
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          style={{ display: 'none' }}
                          onChange={handleSetupSheetFileChange}
                        />
                        <FileSpreadsheet size={34} color="#16a34a" style={{ margin: '0 auto 0.4rem auto' }} />
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                          {setupClient.sheetFileName ? setupClient.sheetFileName : 'Select or drop Vendor Excel / CSV Sheet'}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                          Extracts Vendor Name and 15-digit GSTN automatically
                        </div>
                      </div>

                      {setupClient.sheetParsing && (
                        <div style={{ textAlign: 'center', padding: '0.75rem', color: '#7c3aed', fontSize: '0.85rem' }}>
                          <Loader2 size={18} className="spin-icon" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                          Parsing vendors from sheet...
                        </div>
                      )}

                      {setupClient.sheetVendors.length > 0 && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', overflow: 'hidden', flex: 1 }}>
                          <div style={{
                            padding: '0.45rem 0.75rem', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#166534' }}>
                              ✓ {setupClient.sheetVendors.length} Vendors Ready to Map
                            </span>
                            <span style={{ fontSize: '0.74rem', color: '#15803d' }}>
                              Previewing first 5
                            </span>
                          </div>
                          <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '0.35rem 0.65rem' }}>
                            {setupClient.sheetVendors.slice(0, 5).map((v, i) => (
                              <div
                                key={v.gstin + i}
                                style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '0.35rem 0.4rem', borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none',
                                  fontSize: '0.78rem'
                                }}
                              >
                                <span style={{ fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                                  {i + 1}. {v.name}
                                </span>
                                <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: 600 }}>
                                  {v.gstin}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search database vendors..."
                          value={setupClient.registrySearch}
                          onChange={(e) => setSetupClient(prev => ({ ...prev, registrySearch: e.target.value }))}
                          style={{ paddingLeft: '2.2rem', fontSize: '0.82rem', paddingBlock: '0.42rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <span style={{ color: '#7c3aed', fontWeight: 700 }}>
                          {setupClient.selectedRegistryGstins.size} vendors selected
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={handleSelectAllRegistryVendors}
                            style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Select All
                          </button>
                          <span style={{ color: '#cbd5e1' }}>|</span>
                          <button
                            type="button"
                            onClick={handleDeselectAllRegistryVendors}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div style={{
                        maxHeight: '190px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px',
                        background: '#ffffff', display: 'flex', flexDirection: 'column'
                      }}>
                        {allAvailableVendors
                          .filter(v => {
                            if (!setupClient.registrySearch) return true;
                            const q = setupClient.registrySearch.toLowerCase();
                            const gstin = (v.gstin || '').toLowerCase();
                            const name = (getVendorDisplayName(v) || '').toLowerCase();
                            return gstin.includes(q) || name.includes(q);
                          })
                          .slice(0, 100)
                          .map(v => {
                            const isChecked = setupClient.selectedRegistryGstins.has(v.gstin);
                            return (
                              <div
                                key={v.gstin}
                                onClick={() => handleToggleRegistryGstin(v.gstin)}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '0.45rem 0.75rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                                  background: isChecked ? '#f5f3ff' : '#ffffff'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                  {isChecked ? <CheckSquare size={16} color="#7c3aed" /> : <Square size={16} color="#94a3b8" />}
                                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {getVendorDisplayName(v)}
                                  </span>
                                </div>
                                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                                  {v.gstin}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.4rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                {setupClient.vendorMode === 'sheet' && setupClient.sheetVendors.length > 0 && (
                  <span>Will map <strong>{setupClient.sheetVendors.length} vendors</strong> from sheet</span>
                )}
                {setupClient.vendorMode === 'registry' && setupClient.selectedRegistryGstins.size > 0 && (
                  <span>Will map <strong>{setupClient.selectedRegistryGstins.size} vendors</strong> to this client</span>
                )}
                {setupClient.vendorMode === 'registry' && setupClient.selectedRegistryGstins.size === 0 && (
                  <span>No vendors selected</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => setShowSetupModal(false)}
                  disabled={setupSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-gradient"
                  onClick={handleSaveSetupModal}
                  disabled={setupSubmitting}
                  style={{ minWidth: '160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {setupSubmitting ? (
                    <>
                      <Loader2 size={16} className="spin-icon" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> {setupClient.isExistingClient ? 'Save Changes' : 'Save & Map Vendors'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
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
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {logoTargetClient?.hasLogo && (
                    <button
                      type="button"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        background: 'white',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={handleRemoveDirectLogo}
                      disabled={logoSubmitting}
                    >
                      <Trash2 size={13} />
                      Remove Logo
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn-ghost-sm" onClick={() => setShowLogoModal(false)} disabled={logoSubmitting}>Cancel</button>
                  <button type="submit" className="btn-primary-gradient" disabled={logoSubmitting || !directLogoFile}>
                    {logoSubmitting ? 'Uploading...' : 'Upload Logo'}
                  </button>
                </div>
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
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Selected: <strong>{selectedGstinsToMap.size}</strong> vendor(s)
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', cursor: 'pointer', color: '#334155', fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="mapActionType"
                    value="append"
                    checked={mapActionType === 'append'}
                    onChange={() => setMapActionType('append')}
                  />
                  Append / Add to client
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', cursor: 'pointer', color: '#b91c1c', fontWeight: 600 }} title="Replaces only this client's mapped vendors. Leaves other clients untouched.">
                  <input
                    type="radio"
                    name="mapActionType"
                    value="replace"
                    checked={mapActionType === 'replace'}
                    onChange={() => setMapActionType('replace')}
                  />
                  Replace this client's vendors
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => setShowMapModal(false)} disabled={mappingSubmitting}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary-gradient"
                  disabled={mappingSubmitting || selectedGstinsToMap.size === 0}
                  onClick={handleConfirmMapping}
                >
                  {mappingSubmitting 
                    ? 'Saving...' 
                    : mapActionType === 'replace'
                      ? `Replace Vendors (${selectedGstinsToMap.size})`
                      : `Map Selected (${selectedGstinsToMap.size})`
                  }
                </button>
              </div>
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
                  Upload an Excel workbook where each sheet represents a Client and their respective vendors.
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
                      {importParsing ? 'Analyzing sheets & clients...' : 'Click or drag Excel file (.xlsx) here to upload'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '520px', lineHeight: 1.5 }}>
                      Multi-Sheet Format: Each sheet tab represents a Client (e.g. "Company Name -1"), containing columns for Vendor, GSTN, Email, Mobile Number, Transactions.
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
                      Detected {parsedImportData.length} Client Sheet(s) • Total {totalVendorsInSheet} Vendor(s) to map
                    </div>
                    <button type="button" className="btn-ghost-sm" onClick={() => { setParsedImportData([]); setImportFile(null); }}>
                      Choose Different File
                    </button>
                  </div>

                  {/* Import Mode Selector — Client-Wise Update vs Append vs Global */}
                  <div style={{
                    padding: '0.85rem 1rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>
                      Choose How to Update Vendor Data:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input
                          type="radio"
                          name="importMode"
                          value="CLIENT_REPLACE"
                          checked={importMode === 'CLIENT_REPLACE'}
                          onChange={() => setImportMode('CLIENT_REPLACE')}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <strong style={{ color: '#0f172a' }}>Client-Wise Replace (Recommended):</strong> Replace vendor data only for the client(s) in this sheet.
                          <div style={{ color: '#16a34a', fontSize: '0.74rem', fontWeight: 600 }}>
                            ✓ Existing vendor data of all other clients is safely preserved and not touched.
                          </div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input
                          type="radio"
                          name="importMode"
                          value="CLIENT_APPEND"
                          checked={importMode === 'CLIENT_APPEND'}
                          onChange={() => setImportMode('CLIENT_APPEND')}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <strong style={{ color: '#0f172a' }}>Merge / Append:</strong> Add new vendors to the existing vendor list for each client.
                          <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
                            Keeps existing vendors and adds any newly detected vendors from this upload.
                          </div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input
                          type="radio"
                          name="importMode"
                          value="GLOBAL_REPLACE"
                          checked={importMode === 'GLOBAL_REPLACE'}
                          onChange={() => setImportMode('GLOBAL_REPLACE')}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <strong style={{ color: '#dc2626' }}>Global Replace:</strong> Clear all existing clients and replace entire database.
                          <div style={{ color: '#dc2626', fontSize: '0.74rem' }}>
                            ⚠ Warning: Replaces all clients and all vendor mappings across the system.
                          </div>
                        </div>
                      </label>
                    </div>
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
                              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: clientItem.vendors.length > 0 ? '#ede9fe' : '#f1f5f9', color: clientItem.vendors.length > 0 ? '#6d28d9' : '#64748b', fontWeight: 800 }}>
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
                                style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem', color: '#ef4444' }}
                                title="Remove this sheet/client from import"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveClientFromImport(idx);
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
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
                            <div style={{ padding: '0.85rem 1rem', background: '#ffffff', maxHeight: '220px', overflowY: 'auto' }}>
                              {clientItem.vendors.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                  No vendors found in this sheet.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                  {clientItem.vendors.map((v, vIdx) => (
                                    <span
                                      key={vIdx}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        fontSize: '0.74rem',
                                        padding: '0.25rem 0.55rem',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        color: '#1e293b'
                                      }}
                                    >
                                      <span style={{ fontWeight: 700 }}>{v.name}</span>
                                      <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.72rem' }}>({v.gstin})</span>
                                    </span>
                                  ))}
                                </div>
                              )}
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
                  {importSubmitting 
                    ? 'Updating Vendor Data...' 
                    : importMode === 'CLIENT_REPLACE'
                      ? `Replace Vendors (${parsedImportData.length} Client(s))`
                      : importMode === 'CLIENT_APPEND'
                        ? `Append Vendors (${parsedImportData.length} Client(s))`
                        : `Replace Entire Database (${parsedImportData.length} Client(s))`
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── 12 Months Only Selector Modal ── */}
      {monthPicker.isOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9999 }}
          onClick={() => setMonthPicker(prev => ({ ...prev, isOpen: false }))}
        >
          <div
            className="modal-card"
            style={{ maxWidth: '480px', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ padding: '1.1rem 1.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="#7c3aed" />
                <h3 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                  Select Delayed Months
                </h3>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '6px',
                    background: monthPicker.field === 'gstr1' ? '#ede9fe' : '#fee2e2',
                    color: monthPicker.field === 'gstr1' ? '#7c3aed' : '#dc2626'
                  }}
                >
                  {monthPicker.field === 'gstr1' ? 'GSTR-1' : 'GSTR-3B'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMonthPicker(prev => ({ ...prev, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem 1.35rem' }}>
              <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '1.1rem' }}>
                Vendor: <strong style={{ color: '#0f172a' }}>{monthPicker.vendorName}</strong>
              </div>

              {/* Unified Last 15 Months Section */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
                  Last 15 Months
                </div>
                <span style={{ fontSize: '0.70rem', color: '#7c3aed', fontWeight: 700 }}>
                  Rolling 15-month compliance window
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.6rem',
                  marginBottom: '1.25rem'
                }}
              >
                {rolling15Months.map(monthObj => {
                  const isSelected = isMonthSelected(monthPicker.selectedMonths, monthObj);
                  return (
                    <button
                      key={monthObj.label}
                      type="button"
                      onClick={() => handleToggleMonth(monthObj)}
                      style={{
                        padding: '0.75rem 0.35rem',
                        fontFamily: 'inherit',
                        fontSize: monthObj.isPreviousYear ? '0.84rem' : '0.90rem',
                        fontWeight: 700,
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #dc2626' : '1.5px solid #e2e8f0',
                        background: isSelected ? '#fee2e2' : '#f8fafc',
                        color: isSelected ? '#b91c1c' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap',
                        boxShadow: isSelected ? '0 2px 6px rgba(220, 38, 38, 0.18)' : 'none'
                      }}
                    >
                      {isSelected && <Check size={14} color="#b91c1c" strokeWidth={3} />}
                      <span>{monthObj.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected months preview */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.75rem 0.9rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                  Selected: {monthPicker.selectedMonths.length > 0 ? (
                    <strong style={{ color: '#dc2626', marginLeft: '0.35rem', fontSize: '0.88rem' }}>
                      {monthPicker.selectedMonths.join(', ')}
                    </strong>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic', marginLeft: '0.35rem' }}>
                      None
                    </span>
                  )}
                </div>
                {monthPicker.selectedMonths.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMonthPicker(prev => ({ ...prev, selectedMonths: [] }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '2px 6px'
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '0.9rem 1.35rem', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setMonthPicker(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-gradient"
                onClick={handleApplyMonths}
              >
                <Check size={15} /> Apply ({monthPicker.selectedMonths.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Customization Modal (Editable PDF & DOCX Wording) ── */}
      {showTemplateModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowTemplateModal(false)}>
          <div className="modal-card template-editor-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Vendor Assessment Report Template</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Customize the header, observations, disclaimer, and warning before downloading PDF or Word DOCX.
                </div>
              </div>
              <button type="button" className="btn-ghost-sm" onClick={() => setShowTemplateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body template-editor-body">
              {/* Section: Report Header */}
              <div className="template-form-section">
                <div className="section-title">
                  <Building2 size={16} color="#7c3aed" />
                  Report Header & Salutation
                </div>
                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Report Month (e.g. Sep 26, Oct 26)</label>
                    <input 
                      type="text" 
                      value={reportTemplate.reportMonth || ''}
                      onChange={e => setReportTemplate(prev => ({ ...prev, reportMonth: e.target.value }))}
                      placeholder="e.g. Sep 26"
                    />
                  </div>
                  <div className="form-group">
                    <label>Salutation</label>
                    <input 
                      type="text" 
                      value={reportTemplate.salutation || ''}
                      onChange={e => setReportTemplate(prev => ({ ...prev, salutation: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Introductory Paragraph</label>
                  <input 
                    type="text" 
                    value={reportTemplate.introText || ''}
                    onChange={e => setReportTemplate(prev => ({ ...prev, introText: e.target.value }))}
                  />
                </div>
              </div>

              {/* Section: 7 Key Observations */}
              <div className="template-form-section">
                <div className="section-title">
                  <FileText size={16} color="#7c3aed" />
                  Key Observations (Numbered List on Page 1)
                </div>
                <div className="observations-list-grid">
                  {(reportTemplate.observations || []).map((obs, idx) => (
                    <div key={obs.id || idx} className="observation-edit-item">
                      <div className="obs-header">
                        <span className="obs-num">{idx + 1}</span>
                        <input 
                          type="text" 
                          className="obs-title-input"
                          value={obs.title || ''} 
                          onChange={e => {
                            const newObs = [...(reportTemplate.observations || [])];
                            newObs[idx] = { ...newObs[idx], title: e.target.value };
                            setReportTemplate(prev => ({ ...prev, observations: newObs }));
                          }}
                          placeholder="Observation Title"
                        />
                      </div>
                      <textarea 
                        rows={2}
                        className="obs-desc-textarea"
                        value={obs.text || ''}
                        onChange={e => {
                          const newObs = [...(reportTemplate.observations || [])];
                          newObs[idx] = { ...newObs[idx], text: e.target.value };
                          setReportTemplate(prev => ({ ...prev, observations: newObs }));
                        }}
                        placeholder="Observation description..."
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Section: Warning Notice Above Table */}
              <div className="template-form-section">
                <div className="section-title">
                  <AlertTriangle size={16} color="#dc2626" />
                  Warning Notice Above Table (Page 2 & Website Table)
                </div>
                <div className="form-group">
                  <label>Statement rendered just before the vendors table</label>
                  <input 
                    type="text" 
                    value={reportTemplate.tableWarning || ''}
                    onChange={e => setReportTemplate(prev => ({ ...prev, tableWarning: e.target.value }))}
                    placeholder="Please review these vendors..."
                  />
                </div>
              </div>

              {/* Section: Disclaimer & Sign-Off */}
              <div className="template-form-section">
                <div className="section-title">
                  <ShieldCheck size={16} color="#059669" />
                  Disclaimer & Sign-Off
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label>Disclaimer Paragraph 1</label>
                  <textarea 
                    rows={2}
                    value={reportTemplate.disclaimerP1 || ''}
                    onChange={e => setReportTemplate(prev => ({ ...prev, disclaimerP1: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label>Disclaimer Paragraph 2</label>
                  <textarea 
                    rows={2}
                    value={reportTemplate.disclaimerP2 || ''}
                    onChange={e => setReportTemplate(prev => ({ ...prev, disclaimerP2: e.target.value }))}
                  />
                </div>
                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Regards Text</label>
                    <input 
                      type="text" 
                      value={reportTemplate.regardsPrefix || ''}
                      onChange={e => setReportTemplate(prev => ({ ...prev, regardsPrefix: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Signer Designation</label>
                    <input 
                      type="text" 
                      value={reportTemplate.managerTitle || ''}
                      onChange={e => setReportTemplate(prev => ({ ...prev, managerTitle: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Footer Branding & Logo */}
              <div className="template-form-section">
                <div className="section-title">
                  <ImageIcon size={16} color="#7c3aed" />
                  Footer Logo & Branding (All Page Footers)
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.85rem' }}>
                  Upload a company logo image to display centered in the footer of all report pages.
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
                  <div
                    className="upload-dropzone"
                    style={{ flex: '1 1 280px', padding: '1.1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => document.getElementById('template-footer-logo-input')?.click()}
                  >
                    <input
                      id="template-footer-logo-input"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            showToast('Logo file size must be under 2MB', 'error');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target.result;
                            setReportTemplate(prev => ({ ...prev, footerLogoDataUrl: dataUrl }));
                            showToast('Footer logo uploaded! Click "Save Template" to persist.');
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <UploadCloud size={24} color="#7c3aed" style={{ marginBottom: '0.35rem' }} />
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                      Click to upload Custom Footer Logo
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                      PNG, JPG, WEBP, SVG (Max 2MB)
                    </div>
                  </div>

                  {/* Logo Preview Card */}
                  <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Active Footer Logo
                    </div>
                    <div style={{ height: '50px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', padding: '4px 8px' }}>
                      {reportTemplate.footerLogoDataUrl ? (
                        <img
                          src={reportTemplate.footerLogoDataUrl}
                          alt="Footer Logo Preview"
                          style={{ maxHeight: '42px', maxWidth: '190px', objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 800, fontSize: '0.88rem' }}>
                          <span style={{ fontSize: '1.05rem' }}>♻</span> ScrapDMS (Default)
                        </div>
                      )}
                    </div>
                    {reportTemplate.footerLogoDataUrl ? (
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        style={{ color: '#dc2626', fontSize: '0.75rem', padding: '0.2rem 0.55rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportTemplate(prev => ({ ...prev, footerLogoDataUrl: null }));
                          showToast('Reset to default ScrapDMS footer logo', 'info');
                        }}
                      >
                        <Trash2 size={13} /> Remove Custom Logo
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.73rem', color: '#94a3b8' }}>Built-in official logo</span>
                    )}
                  </div>
                </div>

                <div className="form-row-grid" style={{ marginTop: '0.85rem' }}>
                  <div className="form-group">
                    <label>Company Branding / Text Fallback</label>
                    <input 
                      type="text" 
                      value={reportTemplate.companyName || ''}
                      onChange={e => setReportTemplate(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="e.g. ScrapDMS"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="template-editor-footer">
              <button 
                type="button" 
                className="btn-secondary-sm"
                onClick={() => {
                  const def = getDefaultTemplate();
                  setReportTemplate(def);
                  localStorage.removeItem('grc_report_template_v1');
                  showToast('Template reset to default values', 'info');
                }}
              >
                <RotateCcw size={14} /> Reset Default
              </button>

              <div className="footer-right-buttons">
                <button 
                  type="button" 
                  className="btn-secondary-sm"
                  onClick={() => {
                    localStorage.setItem('grc_report_template_v1', JSON.stringify(reportTemplate));
                    showToast('Template preferences saved locally');
                    setShowTemplateModal(false);
                  }}
                >
                  <Save size={14} /> Save Template
                </button>

                <button 
                  type="button" 
                  className="btn-download-pdf-action"
                  onClick={async () => {
                    localStorage.setItem('grc_report_template_v1', JSON.stringify(reportTemplate));
                    setShowTemplateModal(false);
                    await handleExportPdf();
                  }}
                  disabled={!filteredMappedVendors.length || exportingType !== null}
                >
                  <FileText size={15} /> Download PDF
                </button>

                <button 
                  type="button" 
                  className="btn-download-docx-action"
                  onClick={async () => {
                    localStorage.setItem('grc_report_template_v1', JSON.stringify(reportTemplate));
                    setShowTemplateModal(false);
                    await handleExportDocx();
                  }}
                  disabled={!filteredMappedVendors.length || exportingType !== null}
                >
                  <Edit2 size={15} /> Download DOCX
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedVendorForModal && (
        <GstDetailsModal
          gst={selectedVendorForModal}
          onClose={() => setSelectedVendorForModal(null)}
          onUpdate={handleModalVendorUpdate}
          onDelete={handleUnmapVendor}
          currentUser={currentUser}
          thresholds={thresholds}
        />
      )}
    </div>
  );
}
