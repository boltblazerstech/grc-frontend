import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Receipt, Search, Building2, MapPin, Calendar, FileText, 
  Edit2, Download, Check, AlertCircle, RefreshCw, X, ArrowLeft,
  DollarSign, Percent, ShieldCheck, CreditCard, ChevronDown, CheckCircle2,
  FileSpreadsheet, Sparkles, Loader2, History, Clock, ArrowUpRight, FolderArchive, Eye
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { amountToIndianWords, formatIndianCurrency } from '../utils/numberToWords';
import { exportInvoiceToPdf, exportInvoiceToDocx } from '../utils/invoiceExportHelper';

export default function CreateInvoice({ currentUser, onBack }) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  // Selected company state
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Helper to format default dates
  const todayFormatted = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const suffix = (day >= 11 && day <= 13) ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][day % 10];
    return `${day}${suffix} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const MONTH_OPTIONS = useMemo(() => [
    { value: 1, label: '01 - January', short: 'Jan' },
    { value: 2, label: '02 - February', short: 'Feb' },
    { value: 3, label: '03 - March', short: 'Mar' },
    { value: 4, label: '04 - April', short: 'Apr' },
    { value: 5, label: '05 - May', short: 'May' },
    { value: 6, label: '06 - June', short: 'Jun' },
    { value: 7, label: '07 - July', short: 'Jul' },
    { value: 8, label: '08 - August', short: 'Aug' },
    { value: 9, label: '09 - September', short: 'Sep' },
    { value: 10, label: '10 - October', short: 'Oct' },
    { value: 11, label: '11 - November', short: 'Nov' },
    { value: 12, label: '12 - December', short: 'Dec' },
  ], []);

  const YEAR_OPTIONS = useMemo(() => [2024, 2025, 2026, 2027, 2028, 2029, 2030], []);

  // Default to previous month
  const now = new Date();
  const initMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1..12
  const initYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [billingMonth, setBillingMonth] = useState(initMonth);
  const [billingYear, setBillingYear] = useState(initYear);
  const [autoGenLoading, setAutoGenLoading] = useState(false);

  const defaultBillingPeriod = useMemo(() => {
    const shortMonth = MONTH_OPTIONS.find(m => m.value === Number(initMonth))?.short || 'Oct';
    const curYear = String(initYear).slice(-2);
    return `${shortMonth}’ ${curYear}`;
  }, [MONTH_OPTIONS, initMonth, initYear]);

  // Invoice Form State
  const [formData, setFormData] = useState({
    supplierGstin: '06AANHD7145Q1ZN',
    supplierUdyam: 'UDYAM-HR-05-0154507',
    customerName: '',
    customerGstin: '',
    customerAddress: '',
    natureOfSupply: 'SaaS / Software Services',
    sacCode: '998313',
    invoiceNo: '',
    invoiceDate: todayFormatted,
    billingPeriod: defaultBillingPeriod,
    itemDescription: 'ScrapDMS SaaS Platform Monthly Subscription',
    price: 40000,
    discountPercent: 0,
    bankName: 'IDFC FIRST',
    accountName: 'SCRAPDMS',
    accountNo: '10252673565',
    ifsc: 'IDFB0020144',
    branch: 'Gurgaon Rosewood City, sector 49 , Gurugram'
  });

  const [downloadingFormat, setDownloadingFormat] = useState(null); // 'pdf' | 'docx' | null
  const [toastMessage, setToastMessage] = useState(null);

  // Tabs & Recent Invoices state (previous 2 months + current month)
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'recent'
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentFilterMonth, setRecentFilterMonth] = useState('ALL');
  const [recentSearch, setRecentSearch] = useState('');

  // 3-month window labels (current month + previous two months)
  const windowMonths = useMemo(() => {
    const today = new Date();
    const list = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mNum = d.getMonth() + 1;
      const yNum = d.getFullYear();
      const shortLabel = `${monthNames[d.getMonth()]}’ ${String(yNum).slice(-2)}`;
      list.push({
        key: `m${i}`,
        month: mNum,
        year: yNum,
        label: i === 0 ? `Current Month (${shortLabel})` : i === 1 ? `Previous Month (${shortLabel})` : `2 Months Ago (${shortLabel})`,
        shortLabel
      });
    }
    return list;
  }, []);

  const loadRecentInvoices = async () => {
    setLoadingRecent(true);
    try {
      const data = await apiClient.getRecentInvoices();
      setRecentInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load recent invoices:', e);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadRecentInvoices();
  }, []);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Click outside listener for search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preload details cache on mount so search suggestions are instantaneous
  useEffect(() => {
    apiClient.getDetails().catch((e) => console.warn('Preload details warning:', e));
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    setShowDropdown(true);

    const timer = setTimeout(async () => {
      try {
        const results = await apiClient.searchCompanies(searchQuery.trim());
        setSearchResults(results || []);
      } catch (err) {
        console.error('Company search error:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Automatic Invoice Number recalculation when Company Name, Month, or Year changes
  useEffect(() => {
    const custName = formData.customerName;
    if (!custName || !custName.trim()) return;

    let active = true;
    setAutoGenLoading(true);

    apiClient.getNextInvoiceNumber(custName, billingMonth, billingYear)
      .then(nextNo => {
        if (!active || !nextNo) return;
        const shortMonth = MONTH_OPTIONS.find(m => m.value === Number(billingMonth))?.short || 'Oct';
        const shortYear = String(billingYear).slice(-2);
        setFormData(prev => ({
          ...prev,
          invoiceNo: nextNo,
          billingPeriod: `${shortMonth}’ ${shortYear}`
        }));
      })
      .catch(err => console.warn('Failed to auto-generate invoice number:', err))
      .finally(() => {
        if (active) setAutoGenLoading(false);
      });

    return () => { active = false; };
  }, [formData.customerName, billingMonth, billingYear, MONTH_OPTIONS]);

  // Handle company selection
  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setShowDropdown(false);
    setSearchQuery('');

    const cName = company.name || company.tradeName || company.legalName || '';
    const formattedCustName = cName.toLowerCase().startsWith('m/s') ? cName : `M/s ${cName}`;

    setFormData(prev => ({
      ...prev,
      customerName: formattedCustName,
      customerGstin: company.gstin || '',
      customerAddress: company.address || ''
    }));

    showToast(`Loaded details for ${cName}`);
  };

  // Calculations
  const calculations = useMemo(() => {
    const rawPrice = parseFloat(formData.price) || 0;
    const discPct = parseFloat(formData.discountPercent) || 0;

    const discountAmount = (rawPrice * discPct) / 100;
    const finalRate = Math.max(0, rawPrice - discountAmount);

    // Check interstate tax: Supplier state is 06 (Haryana)
    const custGstin = (formData.customerGstin || '').trim().toUpperCase();
    const isHaryana = custGstin.startsWith('06');
    const isInterState = !isHaryana; // True if outside Haryana

    const igstRate = 18;
    const cgstRate = 9;
    const sgstRate = 9;

    let taxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;

    if (isInterState) {
      taxAmount = Math.round((finalRate * igstRate) / 100);
    } else {
      cgstAmount = Math.round((finalRate * cgstRate) / 100);
      sgstAmount = Math.round((finalRate * sgstRate) / 100);
      taxAmount = cgstAmount + sgstAmount;
    }

    const totalAmount = Math.round(finalRate + taxAmount);
    const amountInWords = amountToIndianWords(totalAmount);

    return {
      rawPrice,
      discountPercent: discPct,
      discountAmount,
      finalRate,
      isInterState,
      igstRate,
      cgstRate,
      sgstRate,
      cgstAmount,
      sgstAmount,
      taxAmount,
      totalAmount,
      amountInWords
    };
  }, [formData.price, formData.discountPercent, formData.customerGstin]);

  // Combined invoice payload for export
  const invoicePayload = useMemo(() => ({
    ...formData,
    ...calculations
  }), [formData, calculations]);

  // Filtered recent invoices based on active month filter and search
  const filteredRecentInvoices = useMemo(() => {
    let list = recentInvoices;
    if (recentFilterMonth !== 'ALL') {
      const targetWindow = windowMonths.find(w => w.key === recentFilterMonth);
      if (targetWindow) {
        list = list.filter(inv => {
          if (inv.billingMonth && inv.billingYear) {
            return inv.billingMonth === targetWindow.month && inv.billingYear === targetWindow.year;
          }
          const mStr = String(targetWindow.month).padStart(2, '0');
          const yStr = String(targetWindow.year).slice(-2);
          return (inv.invoiceNumber && inv.invoiceNumber.includes(`/${mStr}/${yStr}`)) ||
                 (inv.billingPeriod && inv.billingPeriod.toLowerCase().includes(targetWindow.shortLabel.toLowerCase()));
        });
      }
    }
    if (recentSearch.trim()) {
      const q = recentSearch.trim().toLowerCase();
      list = list.filter(inv =>
        (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
        (inv.companyName && inv.companyName.toLowerCase().includes(q)) ||
        (inv.customerGstin && inv.customerGstin.toLowerCase().includes(q))
      );
    }
    return list;
  }, [recentInvoices, recentFilterMonth, windowMonths, recentSearch]);

  // Download Handlers
  const handleDownloadPdf = async () => {
    if (!formData.customerName || !formData.customerGstin) {
      alert('Please provide customer name and GSTIN before downloading.');
      return;
    }
    setDownloadingFormat('pdf');
    try {
      await exportInvoiceToPdf(invoicePayload);
      // Record invoice with full details in database list
      await apiClient.recordInvoice(invoicePayload, formData.customerName, billingMonth, billingYear);
      loadRecentInvoices();
      showToast('PDF Invoice generated and downloaded successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadDocx = async () => {
    if (!formData.customerName || !formData.customerGstin) {
      alert('Please provide customer name and GSTIN before downloading.');
      return;
    }
    setDownloadingFormat('docx');
    try {
      await exportInvoiceToDocx(invoicePayload);
      // Record invoice with full details in database list
      await apiClient.recordInvoice(invoicePayload, formData.customerName, billingMonth, billingYear);
      loadRecentInvoices();
      showToast('Word DOCX Invoice generated and downloaded successfully!');
    } catch (err) {
      console.error('DOCX export error:', err);
      alert('Failed to generate DOCX: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingFormat(null);
    }
  };

  // Re-download directly from Recent Invoices table
  const handleDownloadSavedPdf = async (inv) => {
    try {
      const payload = inv.jsonData ? JSON.parse(inv.jsonData) : {
        ...inv,
        invoiceNo: inv.invoiceNumber || inv.invoiceNo,
        customerName: inv.customerName || inv.companyName
      };
      await exportInvoiceToPdf(payload);
      showToast(`Downloaded PDF for ${inv.invoiceNumber || inv.invoiceNo}`);
    } catch (e) {
      console.error(e);
      alert('Failed to download PDF: ' + e.message);
    }
  };

  const handleDownloadSavedDocx = async (inv) => {
    try {
      const payload = inv.jsonData ? JSON.parse(inv.jsonData) : {
        ...inv,
        invoiceNo: inv.invoiceNumber || inv.invoiceNo,
        customerName: inv.customerName || inv.companyName
      };
      await exportInvoiceToDocx(payload);
      showToast(`Downloaded Word DOCX for ${inv.invoiceNumber || inv.invoiceNo}`);
    } catch (e) {
      console.error(e);
      alert('Failed to download DOCX: ' + e.message);
    }
  };

  const handleLoadSavedInvoice = (inv) => {
    try {
      const payload = inv.jsonData ? JSON.parse(inv.jsonData) : inv;
      setFormData(prev => ({
        ...prev,
        customerName: payload.customerName || payload.companyName || prev.customerName,
        customerGstin: payload.customerGstin || prev.customerGstin,
        customerAddress: payload.customerAddress || prev.customerAddress,
        natureOfSupply: payload.natureOfSupply || prev.natureOfSupply,
        sacCode: payload.sacCode || prev.sacCode,
        invoiceNo: payload.invoiceNumber || payload.invoiceNo || prev.invoiceNo,
        invoiceDate: payload.invoiceDate || prev.invoiceDate,
        billingPeriod: payload.billingPeriod || prev.billingPeriod,
        itemDescription: payload.itemDescription || prev.itemDescription,
        price: payload.price !== undefined ? payload.price : prev.price,
        discountPercent: payload.discountPercent !== undefined ? payload.discountPercent : 0,
      }));
      if (payload.billingMonth) setBillingMonth(payload.billingMonth);
      if (payload.billingYear) setBillingYear(payload.billingYear);
      setActiveTab('create');
      showToast(`Loaded ${inv.invoiceNumber || inv.invoiceNo} into editor!`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="create-invoice-wrapper">
      <style>{`
        .create-invoice-wrapper {
          min-height: calc(100vh - 58px);
          background: #f8fafc;
          padding: 2rem 1.5rem 4rem 1.5rem;
          font-family: 'Outfit', sans-serif;
          color: #0f172a;
        }

        .invoice-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Top Bar */
        .invoice-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.75rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #475569;
          font-size: 0.86rem;
          font-weight: 700;
          padding: 0.45rem 0.9rem;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-btn:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .page-title-box h1 {
          font-size: 1.6rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          margin: 0 0 0.2rem 0;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .page-title-box p {
          font-size: 0.88rem;
          color: #64748b;
          margin: 0;
        }

        /* Search Section */
        .search-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          margin-bottom: 1.5rem;
          position: relative;
        }

        .search-input-wrapper {
          position: relative;
          width: 100%;
        }

        .search-input-wrapper input {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 2.85rem;
          border-radius: 12px;
          border: 2px solid #e2e8f0;
          font-size: 0.95rem;
          font-family: inherit;
          font-weight: 600;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .search-input-wrapper input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1);
        }

        .search-icon-inside {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          max-height: 340px;
          overflow-y: auto;
          z-index: 50;
        }

        .search-item {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.15s ease;
        }

        .search-item:last-child {
          border-bottom: none;
        }

        .search-item:hover {
          background: #f8fafc;
        }

        .search-item-info h4 {
          margin: 0 0 0.2rem 0;
          font-size: 0.92rem;
          font-weight: 800;
          color: #0f172a;
        }

        .search-item-info p {
          margin: 0;
          font-size: 0.78rem;
          color: #64748b;
          line-height: 1.3;
        }

        .badge-gstn {
          font-family: monospace;
          background: #ede9fe;
          color: #6d28d9;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
        }

        /* Selected Company Banner */
        .selected-company-banner {
          background: linear-gradient(135deg, #f5f3ff, #ede9fe);
          border: 1px solid #c4b5fd;
          border-radius: 12px;
          padding: 0.85rem 1.25rem;
          margin-top: 0.85rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .company-pill-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .btn-change-company {
          font-size: 0.76rem;
          font-weight: 700;
          color: #6d28d9;
          background: #ffffff;
          border: 1px solid #ddd6fe;
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-change-company:hover {
          background: #ede9fe;
        }

        /* Two Column Grid */
        .invoice-editor-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        @media (max-width: 900px) {
          .invoice-editor-grid {
            grid-template-columns: 1fr;
          }
        }

        .form-section-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        .section-header-title {
          font-size: 1rem;
          font-weight: 800;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 0.75rem;
        }

        .form-row-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-field label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .form-field input, .form-field textarea, .form-field select {
          padding: 0.65rem 0.85rem;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-family: inherit;
          font-size: 0.88rem;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          background: #ffffff;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-field input:focus, .form-field textarea:focus, .form-field select:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
        }

        .form-field input[readonly], .form-field textarea[readonly] {
          background: #f8fafc;
          color: #64748b;
        }

        /* Summary Card */
        .summary-card {
          background: linear-gradient(135deg, #1e1b4b, #312e81);
          color: #ffffff;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 10px 25px -5px rgba(49, 46, 129, 0.3);
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.88rem;
          color: #c7d2fe;
        }

        .summary-row strong {
          color: #ffffff;
          font-size: 0.95rem;
        }

        .summary-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.15);
          margin: 0.2rem 0;
        }

        .summary-total {
          font-size: 1.4rem;
          font-weight: 900;
          color: #38bdf8;
        }

        .amount-in-words-box {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 0.75rem;
          font-size: 0.8rem;
          color: #e0e7ff;
          line-height: 1.4;
          font-style: italic;
        }

        /* Action Buttons */
        .invoice-actions-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }

        .btn-download-pdf {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.8rem 1.6rem;
          border-radius: 12px;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);
          transition: all 0.2s ease;
        }

        .btn-download-pdf:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4);
        }

        .btn-download-docx {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.8rem 1.6rem;
          border-radius: 12px;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
          transition: all 0.2s ease;
        }

        .btn-download-docx:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
        }

        .btn-download-pdf:disabled, .btn-download-docx:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        /* Nav Tabs */
        .invoice-nav-tabs {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1.5rem;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 0.25rem;
        }

        .nav-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.25rem;
          border: none;
          background: transparent;
          font-size: 0.92rem;
          font-weight: 700;
          color: #64748b;
          border-radius: 10px 10px 0 0;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }

        .nav-tab-btn:hover {
          color: #1e293b;
          background: #f1f5f9;
        }

        .nav-tab-btn.active {
          color: #7c3aed;
          background: #ffffff;
          box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
        }

        .nav-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -0.35rem;
          left: 0;
          right: 0;
          height: 3px;
          background: #7c3aed;
          border-radius: 3px 3px 0 0;
        }

        .tab-badge {
          background: #ede9fe;
          color: #7c3aed;
          font-size: 0.72rem;
          font-weight: 800;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
        }

        .nav-tab-btn.active .tab-badge {
          background: #7c3aed;
          color: #ffffff;
        }

        /* Recent Invoices Card & Elements */
        .recent-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 1.75rem;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          border: 1px solid #e2e8f0;
          margin-bottom: 2rem;
        }

        .recent-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .recent-title-group h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 0.25rem 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .recent-title-group p {
          font-size: 0.85rem;
          color: #64748b;
          margin: 0;
        }

        .recent-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
          padding: 0.9rem 1.1rem;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .recent-chips-container {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }

        .filter-chip {
          padding: 0.4rem 0.85rem;
          border-radius: 999px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-chip:hover {
          border-color: #7c3aed;
          color: #7c3aed;
        }

        .filter-chip.active {
          background: #7c3aed;
          border-color: #7c3aed;
          color: #ffffff;
        }

        .recent-search-box {
          position: relative;
          min-width: 260px;
        }

        .recent-search-box input {
          width: 100%;
          padding: 0.5rem 0.85rem 0.5rem 2.2rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.82rem;
          font-family: inherit;
          color: #0f172a;
          background: #ffffff;
          outline: none;
        }

        .recent-search-box input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }

        .recent-search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        /* Recent Table */
        .recent-table-wrapper {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .recent-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.86rem;
          text-align: left;
        }

        .recent-table th {
          background: #f1f5f9;
          padding: 0.75rem 1rem;
          color: #475569;
          font-weight: 800;
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #cbd5e1;
          white-space: nowrap;
        }

        .recent-table td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
          vertical-align: middle;
        }

        .recent-table tr:hover td {
          background: #f8fafc;
        }

        .inv-badge-num {
          display: inline-block;
          font-family: 'JetBrains Mono', monospace, monospace;
          font-weight: 800;
          color: #0f172a;
          font-size: 0.85rem;
          background: #f1f5f9;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .inv-company-cell {
          font-weight: 700;
          color: #0f172a;
        }

        .inv-gstin-sub {
          font-size: 0.75rem;
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
        }

        .inv-period-badge {
          display: inline-block;
          background: #eff6ff;
          color: #2563eb;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .inv-amt-cell {
          font-weight: 800;
          color: #059669;
          font-size: 0.92rem;
        }

        .table-actions {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .btn-table-action {
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          transition: all 0.15s ease;
        }

        .btn-table-action.pdf {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .btn-table-action.pdf:hover {
          background: #dc2626;
          color: #ffffff;
        }

        .btn-table-action.docx {
          color: #2563eb;
          border-color: #bfdbfe;
          background: #eff6ff;
        }

        .btn-table-action.docx:hover {
          background: #2563eb;
          color: #ffffff;
        }

        .btn-table-action.load {
          color: #7c3aed;
          border-color: #ddd6fe;
          background: #f5f3ff;
        }

        .btn-table-action.load:hover {
          background: #7c3aed;
          color: #ffffff;
        }

        /* Quick Reference Drawer on Create Tab */
        .recent-reference-box {
          margin-top: 2rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
        }

        .recent-ref-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.9rem;
        }

        .recent-ref-header h3 {
          margin: 0;
          font-size: 0.98rem;
          font-weight: 800;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .recent-ref-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 0.75rem;
        }

        .recent-ref-card {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 10px;
          padding: 0.75rem 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          transition: all 0.15s ease;
        }

        .recent-ref-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        /* Toast notification */
        .invoice-toast {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          background: #0f172a;
          color: #ffffff;
          padding: 0.85rem 1.25rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.88rem;
          font-weight: 700;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
          z-index: 9999;
          animation: slideUpToast 0.25s ease-out;
        }

        @keyframes slideUpToast {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Toast */}
      {toastMessage && (
        <div className="invoice-toast">
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toastMessage.msg}</span>
        </div>
      )}

      <div className="invoice-container">
        {/* Top Header Bar */}
        <div className="invoice-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {onBack && (
              <button className="back-btn" onClick={onBack}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <div className="page-title-box">
              <h1><Receipt size={28} color="#7c3aed" /> Create Tax Invoice</h1>
              <p>Generate, calculate, and download official ScrapDMS Tax Invoices in PDF and Word DOCX formats.</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="invoice-nav-tabs">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <Receipt size={17} /> Create Tax Invoice
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => { setActiveTab('recent'); loadRecentInvoices(); }}
          >
            <Clock size={17} /> Recent Invoices (Previous 2 Months & Current)
            {recentInvoices.length > 0 && (
              <span className="tab-badge">{recentInvoices.length}</span>
            )}
          </button>
        </div>

        {activeTab === 'recent' ? (
          <div className="recent-card">
            <div className="recent-header">
              <div className="recent-title-group">
                <h2><History size={22} color="#7c3aed" /> Generated Invoices (Rolling 3 Months)</h2>
                <p>Access, view, reload, and re-download invoices generated for the previous two months and current month.</p>
              </div>
              <button
                className="btn-table-action"
                style={{ background: '#f8fafc', padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}
                onClick={loadRecentInvoices}
                disabled={loadingRecent}
              >
                <RefreshCw size={14} className={loadingRecent ? 'spin-icon' : ''} /> Refresh
              </button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="recent-toolbar">
              <div className="recent-chips-container">
                <button
                  type="button"
                  className={`filter-chip ${recentFilterMonth === 'ALL' ? 'active' : ''}`}
                  onClick={() => setRecentFilterMonth('ALL')}
                >
                  All (3 Months)
                </button>
                {windowMonths.map(w => (
                  <button
                    key={w.key}
                    type="button"
                    className={`filter-chip ${recentFilterMonth === w.key ? 'active' : ''}`}
                    onClick={() => setRecentFilterMonth(w.key)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              <div className="recent-search-box">
                <Search size={15} className="recent-search-icon" />
                <input
                  type="text"
                  placeholder="Filter by invoice #, company, GSTIN..."
                  value={recentSearch}
                  onChange={e => setRecentSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            {filteredRecentInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <FolderArchive size={42} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                  No generated invoices found for this selection
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Invoices generated for the current and past two months will appear here automatically.
                </div>
                <button
                  type="button"
                  className="btn-table-action load"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.86rem', display: 'inline-flex' }}
                  onClick={() => setActiveTab('create')}
                >
                  <Receipt size={16} /> Create an Invoice Now
                </button>
              </div>
            ) : (
              <div className="recent-table-wrapper">
                <table className="recent-table">
                  <thead>
                    <tr>
                      <th>Invoice No & Date</th>
                      <th>Customer Name & GSTIN</th>
                      <th>Billing Period</th>
                      <th>Total (INR)</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecentInvoices.map((inv, idx) => {
                      const invNumber = inv.invoiceNumber || inv.invoiceNo || 'N/A';
                      const compName = inv.customerName || inv.companyName || 'N/A';
                      const gstin = inv.customerGstin || inv.gstin || '-';
                      const period = inv.billingPeriod || (inv.billingMonth && inv.billingYear ? `${inv.billingMonth}/${inv.billingYear}` : '-');
                      const invDate = inv.invoiceDate || (inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-');
                      const total = inv.totalAmount !== undefined ? formatIndianCurrency(inv.totalAmount) : (inv.jsonData ? formatIndianCurrency(JSON.parse(inv.jsonData).totalAmount) : '-');

                      return (
                        <tr key={inv.id || idx}>
                          <td>
                            <div className="inv-badge-num">{invNumber}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                              {invDate}
                            </div>
                          </td>
                          <td>
                            <div className="inv-company-cell">{compName}</div>
                            <div className="inv-gstin-sub">GSTIN: {gstin}</div>
                          </td>
                          <td>
                            <span className="inv-period-badge">{period}</span>
                          </td>
                          <td>
                            <span className="inv-amt-cell">₹{total}</span>
                          </td>
                          <td>
                            <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn-table-action pdf"
                                title="Download PDF"
                                onClick={() => handleDownloadSavedPdf(inv)}
                              >
                                <FileText size={14} /> PDF
                              </button>
                              <button
                                type="button"
                                className="btn-table-action docx"
                                title="Download DOCX"
                                onClick={() => handleDownloadSavedDocx(inv)}
                              >
                                <Edit2 size={14} /> DOCX
                              </button>
                              <button
                                type="button"
                                className="btn-table-action load"
                                title="Load into Invoice Form"
                                onClick={() => handleLoadSavedInvoice(inv)}
                              >
                                <ArrowUpRight size={14} /> Load Form
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
        ) : (
          <>
        {/* Search Bar Card */}
        <div className="search-card" ref={searchContainerRef}>
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
            Search Company (Customer / Client / Vendor):
          </div>
          <div className="search-input-wrapper">
            <Search className="search-icon-inside" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              placeholder="Type Company Name, Legal Name, or 15-character GSTIN (e.g. Ajar Amar, 03ABMFA6469N1ZW)..."
            />
            {searching && (
              <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
                <Loader2 size={18} className="spin-icon" color="#7c3aed" />
              </div>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchQuery.trim().length >= 2 && (
            <div className="search-dropdown">
              {searching && searchResults.length === 0 && (
                <div style={{ padding: '1rem', color: '#6d28d9', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Loader2 size={16} className="spin-icon" color="#7c3aed" />
                  <span>Searching matching companies in database...</span>
                </div>
              )}
              {!searching && searchResults.length === 0 && (
                <div style={{ padding: '1.25rem 1rem', color: '#64748b', fontSize: '0.88rem', textAlign: 'center', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: '#334155' }}>No company found matching "{searchQuery}"</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    You can try searching by 15-digit GSTIN or fill in the customer details manually below.
                  </div>
                </div>
              )}
              {searchResults.map((company, idx) => (
                <div
                  key={idx}
                  className="search-item"
                  onClick={() => handleSelectCompany(company)}
                >
                  <div className="search-item-info">
                    <h4>{company.name}</h4>
                    <p>{company.address ? company.address.substring(0, 110) + '...' : 'Address not specified'}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                    <span className="badge-gstn">{company.gstin}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{company.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Company Banner */}
          {selectedCompany && (
            <div className="selected-company-banner">
              <div className="company-pill-content">
                <Building2 size={20} color="#7c3aed" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#1e1b4b' }}>
                    {selectedCompany.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6d28d9', fontFamily: 'monospace', fontWeight: 700 }}>
                    GSTN: {selectedCompany.gstin} • {calculations.isInterState ? 'Outside Haryana (IGST 18%)' : 'Haryana (CGST 9% + SGST 9%)'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-change-company"
                onClick={() => {
                  setSelectedCompany(null);
                  setSearchQuery('');
                }}
              >
                Change Company
              </button>
            </div>
          )}
        </div>

        {/* Invoice Form Two-Column Grid */}
        <div className="invoice-editor-grid">
          {/* Column 1: Bill To & Supply Details */}
          <div className="form-section-card">
            <div className="section-header-title">
              <Building2 size={18} color="#7c3aed" /> Bill To (Customer Details)
            </div>

            <div className="form-field">
              <label>Customer Name *</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="e.g. M/s AJAR AMAR STEEL CONCAST"
              />
            </div>

            <div className="form-field">
              <label>Customer GSTN *</label>
              <input
                type="text"
                maxLength={15}
                value={formData.customerGstin}
                onChange={e => setFormData({ ...formData, customerGstin: e.target.value.toUpperCase() })}
                placeholder="e.g. 03ABMFA6469N1ZW"
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <div className="form-field">
              <label>Full Billing Address</label>
              <textarea
                rows={3}
                value={formData.customerAddress}
                onChange={e => setFormData({ ...formData, customerAddress: e.target.value })}
                placeholder="Street address, city, state, pincode..."
              />
            </div>

            <div className="section-header-title" style={{ marginTop: '0.75rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={18} color="#7c3aed" /> Invoice Details
              </div>
              <span style={{ fontSize: '0.72rem', color: '#6d28d9', background: '#ede9fe', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 700 }}>
                Auto-updates Invoice No.
              </span>
            </div>

            {/* Select Month and Year for automatic numbering */}
            <div className="form-row-2col">
              <div className="form-field">
                <label>Billing Month *</label>
                <select
                  value={billingMonth}
                  onChange={e => setBillingMonth(Number(e.target.value))}
                >
                  {MONTH_OPTIONS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Billing Year *</label>
                <select
                  value={billingYear}
                  onChange={e => setBillingYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Invoice Number *</label>
                  {autoGenLoading ? (
                    <span style={{ fontSize: '0.7rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Loader2 size={12} className="spin-icon" /> Calculating...
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>
                      Auto-generated
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={e => setFormData({ ...formData, invoiceNo: e.target.value })}
                  placeholder="e.g. Scrapdmss/10/26"
                  style={{ fontWeight: 800, color: '#1e1b4b', letterSpacing: '0.3px' }}
                />
              </div>

              <div className="form-field">
                <label>Invoice Date *</label>
                <input
                  type="text"
                  value={formData.invoiceDate}
                  onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                  placeholder="e.g. 1st Nov 2026"
                />
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-field">
                <label>Billing Period *</label>
                <input
                  type="text"
                  value={formData.billingPeriod}
                  onChange={e => setFormData({ ...formData, billingPeriod: e.target.value })}
                  placeholder="e.g. Oct’ 26"
                />
              </div>

              <div className="form-field">
                <label>SAC Code</label>
                <input
                  type="text"
                  value={formData.sacCode}
                  onChange={e => setFormData({ ...formData, sacCode: e.target.value })}
                  placeholder="998313"
                />
              </div>
            </div>

            <div className="form-field">
              <label>Nature of Supply</label>
              <input
                type="text"
                value={formData.natureOfSupply}
                onChange={e => setFormData({ ...formData, natureOfSupply: e.target.value })}
                placeholder="SaaS / Software Services"
              />
            </div>
          </div>

          {/* Column 2: Items, Pricing & Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-section-card">
              <div className="section-header-title">
                <DollarSign size={18} color="#10b981" /> Subscription & Price
              </div>

              <div className="form-field">
                <label>Item Description</label>
                <input
                  type="text"
                  value={formData.itemDescription}
                  onChange={e => setFormData({ ...formData, itemDescription: e.target.value })}
                  placeholder="ScrapDMS SaaS Platform Monthly Subscription"
                />
              </div>

              <div className="form-row-2col">
                <div className="form-field">
                  <label>Base Price (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    placeholder="40000"
                  />
                </div>

                <div className="form-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Discount (%)</label>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: (parseFloat(formData.discountPercent) > 0) ? '#10b981' : '#64748b' }}>
                      {(parseFloat(formData.discountPercent) > 0) ? 'Column Visible' : 'Column Hidden'}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={formData.discountPercent}
                    onChange={e => setFormData({ ...formData, discountPercent: e.target.value })}
                    placeholder="0 (Optional - enter to show discount)"
                  />
                </div>
              </div>
            </div>

            {/* Calculations Summary Card */}
            <div className="summary-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800, color: '#a5b4fc' }}>
                  Auto-Calculated Totals
                </span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.15)', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                  {calculations.isInterState ? 'IGST 18%' : 'CGST 9% + SGST 9%'}
                </span>
              </div>

              <div className="summary-row">
                <span>Base Price:</span>
                <strong>₹{formatIndianCurrency(calculations.rawPrice)}</strong>
              </div>

              {calculations.discountPercent > 0 && (
                <div className="summary-row">
                  <span>Discount ({calculations.discountPercent}%):</span>
                  <span style={{ color: '#fca5a5' }}>− ₹{formatIndianCurrency(calculations.discountAmount)}</span>
                </div>
              )}

              <div className="summary-row">
                <span>Final Rate (Taxable Value):</span>
                <strong>₹{formatIndianCurrency(calculations.finalRate)}</strong>
              </div>

              <div className="summary-row">
                <span>{calculations.isInterState ? 'IGST (18%):' : 'CGST (9%) + SGST (9%):'}</span>
                <strong>+ ₹{formatIndianCurrency(calculations.taxAmount)}</strong>
              </div>

              <div className="summary-divider" />

              <div className="summary-row" style={{ alignItems: 'baseline' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>Total Amount:</span>
                <span className="summary-total">₹{formatIndianCurrency(calculations.totalAmount)}</span>
              </div>

              <div className="amount-in-words-box">
                <strong>In Words:</strong> {calculations.amountInWords}
              </div>
            </div>
          </div>
        </div>

        {/* Download Buttons Section */}
        <div className="invoice-actions-footer">
          <button
            type="button"
            className="btn-download-pdf"
            onClick={handleDownloadPdf}
            disabled={downloadingFormat !== null}
          >
            {downloadingFormat === 'pdf' ? (
              <>
                <Loader2 size={18} className="spin-icon" /> Generating PDF...
              </>
            ) : (
              <>
                <FileText size={18} /> Download as PDF (.pdf)
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-download-docx"
            onClick={handleDownloadDocx}
            disabled={downloadingFormat !== null}
          >
            {downloadingFormat === 'docx' ? (
              <>
                <Loader2 size={18} className="spin-icon" /> Generating DOCX...
              </>
            ) : (
              <>
                <Edit2 size={18} /> Download as DOCX (.docx)
              </>
            )}
          </button>
        </div>

        {/* Quick Reference Box for Recent Invoices */}
        {recentInvoices.length > 0 && (
          <div className="recent-reference-box">
            <div className="recent-ref-header">
              <h3>
                <Clock size={18} color="#7c3aed" /> Recent Generated Invoices (Rolling 3 Months)
              </h3>
              <button
                type="button"
                className="btn-table-action load"
                onClick={() => setActiveTab('recent')}
                style={{ fontSize: '0.8rem' }}
              >
                View Full List ({recentInvoices.length}) <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="recent-ref-grid">
              {recentInvoices.slice(0, 3).map((inv, idx) => (
                <div key={inv.id || idx} className="recent-ref-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="inv-badge-num" style={{ fontSize: '0.78rem' }}>
                      {inv.invoiceNumber || inv.invoiceNo}
                    </span>
                    <span className="inv-period-badge" style={{ fontSize: '0.72rem' }}>
                      {inv.billingPeriod || `${inv.billingMonth}/${inv.billingYear}`}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inv.customerName || inv.companyName}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669' }}>
                      ₹{formatIndianCurrency(inv.totalAmount || 0)}
                    </span>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        type="button"
                        className="btn-table-action pdf"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                        onClick={() => handleDownloadSavedPdf(inv)}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        className="btn-table-action load"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                        onClick={() => handleLoadSavedInvoice(inv)}
                      >
                        Load
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
