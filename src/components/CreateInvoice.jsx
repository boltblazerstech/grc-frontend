import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Receipt, Search, Building2, MapPin, Calendar, FileText, 
  Edit2, Download, Check, AlertCircle, RefreshCw, X, ArrowLeft,
  DollarSign, Percent, ShieldCheck, CreditCard, ChevronDown, CheckCircle2,
  FileSpreadsheet, Sparkles, Loader2
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

  const defaultBillingPeriod = useMemo(() => {
    const d = new Date();
    // Default to previous month or current month
    d.setMonth(d.getMonth() - 1);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const curYear = String(d.getFullYear()).slice(-2);
    return `${monthNames[d.getMonth()]}’ ${curYear}`;
  }, []);

  // Invoice Form State
  const [formData, setFormData] = useState({
    supplierGstin: '06AANHD7145Q1ZN',
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
    discountPercent: 17.5,
    bankName: 'IDFC FIRST',
    accountName: 'SCRAPDMS',
    accountNo: '10252673565',
    ifsc: 'IDFB0020144',
    branch: 'Gurgaon Rosewood City, sector 49 , Gurugram'
  });

  const [downloadingFormat, setDownloadingFormat] = useState(null); // 'pdf' | 'docx' | null
  const [toastMessage, setToastMessage] = useState(null);

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

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await apiClient.searchCompanies(searchQuery.trim());
        setSearchResults(results || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Company search error:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle company selection
  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setShowDropdown(false);
    setSearchQuery('');

    // Generate short identifier for invoice number
    const cleanName = (company.name || company.tradeName || company.legalName || 'Client')
      .replace(/[^a-zA-Z0-9]/g, '');
    const shortPrefix = cleanName.length > 8 ? cleanName.substring(0, 8) : cleanName;
    const year = new Date().getFullYear();
    const suggestedInvoiceNo = `${shortPrefix}/${year}-1`;

    const cName = company.name || company.tradeName || company.legalName || '';
    const formattedCustName = cName.toLowerCase().startsWith('m/s') ? cName : `M/s ${cName}`;

    setFormData(prev => ({
      ...prev,
      customerName: formattedCustName,
      customerGstin: company.gstin || '',
      customerAddress: company.address || '',
      invoiceNo: prev.invoiceNo || suggestedInvoiceNo
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

  // Download Handlers
  const handleDownloadPdf = async () => {
    if (!formData.customerName || !formData.customerGstin) {
      alert('Please provide customer name and GSTIN before downloading.');
      return;
    }
    setDownloadingFormat('pdf');
    try {
      await exportInvoiceToPdf(invoicePayload);
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
      showToast('Word DOCX Invoice generated and downloaded successfully!');
    } catch (err) {
      console.error('DOCX export error:', err);
      alert('Failed to generate DOCX: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingFormat(null);
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

        .form-field input, .form-field textarea {
          padding: 0.65rem 0.85rem;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-family: inherit;
          font-size: 0.88rem;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-field input:focus, .form-field textarea:focus {
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
          {showDropdown && searchResults.length > 0 && (
            <div className="search-dropdown">
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

            <div className="section-header-title" style={{ marginTop: '0.75rem' }}>
              <Receipt size={18} color="#7c3aed" /> Invoice Details
            </div>

            <div className="form-row-2col">
              <div className="form-field">
                <label>Invoice Number *</label>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={e => setFormData({ ...formData, invoiceNo: e.target.value })}
                  placeholder="e.g. AjarAmar/2026-1"
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
                  <label>Discount (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={formData.discountPercent}
                    onChange={e => setFormData({ ...formData, discountPercent: e.target.value })}
                    placeholder="17.5"
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

              <div className="summary-row">
                <span>Discount ({calculations.discountPercent}%):</span>
                <span style={{ color: '#fca5a5' }}>− ₹{formatIndianCurrency(calculations.discountAmount)}</span>
              </div>

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
      </div>
    </div>
  );
}
