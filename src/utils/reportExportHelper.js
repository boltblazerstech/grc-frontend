import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  Header,
  Footer,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
  VerticalAlign
} from 'docx';

// Default template texts matching the official Vendor Assessment Report format
export const getDefaultTemplate = () => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const curMonth = monthNames[now.getMonth()];
  const curYear = String(now.getFullYear()).slice(-2);
  const defaultMonthStr = `${curMonth} ${curYear}`;

  return {
    reportMonth: defaultMonthStr,
    salutation: 'Dear Team,',
    introText: 'Please find below the key observations from the Vendor Assessment Report:',
    observations: [
      {
        id: 1,
        title: 'Aadhaar Authentication',
        text: 'Vendors marked in Red should be checked for the reason why Aadhaar Authentication has not been completed, especially where the vendor is operating as a trader.'
      },
      {
        id: 2,
        title: 'GSTR-7 Compliance',
        text: 'Vendors marked in Red should be reviewed as non-filing or poor GSTR-7 compliance may indicate a potential compliance risk.'
      },
      {
        id: 3,
        title: 'GSTR-1 & GSTR-3B Filing',
        text: 'Vendors having more than one delay in GSTR-1 or GSTR-3B filing should be investigated and monitored due to GST compliance concerns.'
      },
      {
        id: 4,
        title: 'New Vendors',
        text: 'Vendors marked in Blue are less than 2 years old. Business with such vendors should initially be limited and their compliance should be reviewed regularly.'
      },
      {
        id: 5,
        title: 'Low Turnover Vendors',
        text: 'Vendors marked in Yellow have low turnover and should be monitored regularly as they may carry a higher risk in the scrap business.'
      },
      {
        id: 6,
        title: 'Risky Vendors',
        text: 'Vendors marked in Red under the Risk Assessment column should be checked before every order. Additional verification is recommended as these vendors may have a higher GST compliance risk.'
      },
      {
        id: 7,
        title: 'New Manufacturers in Scrap Business',
        text: 'Manufacturers marked in Red whose business age is less than 2 years should be reviewed on a quarterly basis. Their GST registration status, return filing compliance, and overall business activity should be monitored regularly.'
      }
    ],
    disclaimerTitle: 'Disclaimer:',
    disclaimerP1: 'This assessment is based on GST filings, Aadhaar Authentication, turnover, vendor age, business category, and other parameters that ScrapDMS considers important for vendor evaluation. These observations are intended as a guidance tool only.',
    disclaimerP2: "Customers are advised to perform their own due diligence and verification before conducting business with any vendor, as there may be factors not captured in this assessment that could impact the vendor's actual risk profile.",
    regardsPrefix: 'Regards,',
    companyName: 'ScrapDMS',
    managerTitle: 'Manager Data analysis',
    tableWarning: 'Please review these vendors, as their GSTR filing patterns appear to be repetitive in nature and may require further assessment.',
    footerLogoDataUrl: null
  };
};

// Generate base64 ScrapDMS logo using HTML5 Canvas for high-res embedding
export const createScrapDmsLogoDataUrl = () => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 70;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw colorful eco/recycle symbol
  const centerX = 120;
  const topY = 22;

  // Leaf 1: Cyan / Blue
  ctx.beginPath();
  ctx.moveTo(centerX - 10, topY);
  ctx.bezierCurveTo(centerX - 16, topY - 14, centerX - 4, topY - 18, centerX - 1, topY - 6);
  ctx.bezierCurveTo(centerX - 4, topY - 2, centerX - 7, topY + 2, centerX - 10, topY);
  ctx.fillStyle = '#0284c7';
  ctx.fill();

  // Leaf 2: Green
  ctx.beginPath();
  ctx.moveTo(centerX + 10, topY);
  ctx.bezierCurveTo(centerX + 16, topY - 14, centerX + 4, topY - 18, centerX + 1, topY - 6);
  ctx.bezierCurveTo(centerX + 4, topY - 2, centerX + 7, topY + 2, centerX + 10, topY);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  // Leaf 3: Emerald bottom
  ctx.beginPath();
  ctx.arc(centerX, topY + 3, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#059669';
  ctx.fill();

  // Draw "ScrapDMS" text
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Scrap', centerX - 26, topY + 34);

  ctx.fillStyle = '#0284c7';
  ctx.fillText('DMS', centerX + 32, topY + 34);

  return canvas.toDataURL('image/png');
};

// Helper to convert an image URL or Blob to Base64
export const loadImageAsBase64 = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not load logo as base64', err);
    return null;
  }
};

// Convert base64 data url to Uint8Array for docx ImageRun
export const dataUrlToUint8Array = (dataUrl) => {
  if (!dataUrl || !dataUrl.includes(',')) return null;
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper to convert hex color to RGB object
const hexToRgb = (hex) => {
  if (!hex) return { r: 16, g: 185, b: 129 };
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (isNaN(bigint)) return { r: 16, g: 185, b: 129 };
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
};

// ── EXPORT TO PDF ────────────────────────────────────────────────────────────
export const exportReportToPdf = async ({
  client,
  vendors,
  template,
  clientLogoDataUrl
}) => {
  const scrapLogoDataUrl = template.footerLogoDataUrl || createScrapDmsLogoDataUrl();
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isAllVendorsReport = Boolean(client?.isAllVendors || client?.id === 'ALL');
  const clientName = isAllVendorsReport ? 'ALL UPLOADED VENDORS' : (client?.clientName || 'Client');
  const reportMonth = template.reportMonth || 'Sep 26';
  const reportHeaderRight = isAllVendorsReport ? `Consolidated Assessment -${reportMonth}` : `Vendor Assessment Report -${reportMonth}`;

  // Helper to draw Header & Footer on each page
  const drawPageHeaderAndFooter = (pageDoc, isFirstPage) => {
    // Header Left: Client Logo or Client Name
    if (clientLogoDataUrl) {
      try {
        let fmt = 'PNG';
        if (clientLogoDataUrl.startsWith('data:image/jpeg') || clientLogoDataUrl.startsWith('data:image/jpg')) fmt = 'JPEG';
        else if (clientLogoDataUrl.startsWith('data:image/webp')) fmt = 'WEBP';
        pageDoc.addImage(clientLogoDataUrl, fmt, 40, 20, 110, 36);
      } catch {
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(13);
        pageDoc.setTextColor(40, 18, 77);
        pageDoc.text(clientName.toUpperCase(), 40, 42);
      }
    } else {
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(13);
      pageDoc.setTextColor(40, 18, 77);
      pageDoc.text(clientName.toUpperCase(), 40, 42);
    }

    // Header Right: Vendor Assessment Report -Month
    pageDoc.setFont('helvetica', 'normal');
    pageDoc.setFontSize(11);
    pageDoc.setTextColor(51, 65, 85);
    pageDoc.text(reportHeaderRight, pageWidth - 40, 42, { align: 'right' });

    // Header dividing line
    pageDoc.setDrawColor(226, 232, 240);
    pageDoc.setLineWidth(0.75);
    pageDoc.line(40, 62, pageWidth - 40, 62);

    // Footer: Score category legend
    pageDoc.setFont('helvetica', 'normal');
    pageDoc.setFontSize(7.5);
    pageDoc.setTextColor(71, 85, 105);
    pageDoc.text('Score Categories:  GRC < 20 Good   |   20 < GRC < 30 Careful category   |   GRC > 30 Risky category', pageWidth / 2, pageHeight - 34, { align: 'center' });

    // Footer: Custom or default footer logo
    if (scrapLogoDataUrl) {
      try {
        let fmt = 'PNG';
        if (scrapLogoDataUrl.startsWith('data:image/jpeg') || scrapLogoDataUrl.startsWith('data:image/jpg')) fmt = 'JPEG';
        else if (scrapLogoDataUrl.startsWith('data:image/webp')) fmt = 'WEBP';
        pageDoc.addImage(scrapLogoDataUrl, fmt, (pageWidth - 76) / 2, pageHeight - 22, 76, 18);
      } catch {
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(8);
        pageDoc.setTextColor(2, 132, 199);
        pageDoc.text(template.companyName || 'ScrapDMS', pageWidth / 2, pageHeight - 12, { align: 'center' });
      }
    } else {
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(8);
      pageDoc.setTextColor(2, 132, 199);
      pageDoc.text(template.companyName || 'ScrapDMS', pageWidth / 2, pageHeight - 12, { align: 'center' });
    }
  };

  // ── PAGE 1: Executive Observations & Disclaimer ────────────────────────────
  drawPageHeaderAndFooter(doc, true);

  let curY = 88;

  // Salutation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(template.salutation, 40, curY);
  curY += 18;

  // Intro text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(template.introText, 40, curY);
  curY += 20;

  // Key Observations list
  template.observations.forEach((obs, index) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const numPrefix = `${index + 1}.  ${obs.title} – `;
    doc.text(numPrefix, 45, curY);
    const prefixWidth = doc.getTextWidth(numPrefix);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const wrappedDesc = doc.splitTextToSize(obs.text, pageWidth - 90 - prefixWidth);

    if (wrappedDesc.length > 0) {
      doc.text(wrappedDesc[0], 45 + prefixWidth, curY);
      for (let i = 1; i < wrappedDesc.length; i++) {
        curY += 13;
        doc.text(wrappedDesc[i], 45, curY);
      }
    }
    curY += 16;
  });

  curY += 8;

  // Disclaimer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(template.disclaimerTitle, 40, curY);
  curY += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const discLines1 = doc.splitTextToSize(template.disclaimerP1, pageWidth - 80);
  doc.text(discLines1, 40, curY);
  curY += discLines1.length * 11 + 6;

  const discLines2 = doc.splitTextToSize(template.disclaimerP2, pageWidth - 80);
  doc.text(discLines2, 40, curY);
  curY += discLines2.length * 11 + 14;

  // Regards & Signoff
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(template.regardsPrefix, 40, curY);
  curY += 13;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(template.companyName, 40, curY);
  curY += 13;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(template.managerTitle, 40, curY);

  // ── PAGE 2: Executive Summary (GSTR-3B Risky Vendors & Recommended Actions) ──
  doc.addPage('a4', 'landscape');
  drawPageHeaderAndFooter(doc, false);

  let execY = 82;

  // Title: Executive Summary:
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(59, 24, 95); // Deep purple
  doc.text('Executive Summary:', 40, execY);
  execY += 16;

  // Description text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const execIntro = "During the compliance review, it was observed that some vendors have regularly delayed their GSTR-3B returns within the prescribed timelines. Therefore, caution should be exercised while releasing payments or placing new purchase orders with such vendors.";
  const wrappedExecIntro = doc.splitTextToSize(execIntro, pageWidth - 80);
  doc.text(wrappedExecIntro, 40, execY);
  execY += wrappedExecIntro.length * 12 + 10;

  // Section: Summary :
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Summary :', 40, execY);
  execY += 10;

  // Filter risky vendors with GSTR-3B delay > 2
  const gstr3bRiskyVendors = vendors.filter(v => {
    const n = typeof v.gstr3bVal === 'number' ? v.gstr3bVal : parseInt(v.gstr3bVal, 10);
    return !isNaN(n) && n > 2;
  });

  const summaryHeaders = ['S.No', 'Supplier Name', 'Number of times GSTR-3B filing delay', 'Month'];
  const summaryRows = gstr3bRiskyVendors.length > 0
    ? gstr3bRiskyVendors.map((v, idx) => {
        let vendorNameText = v.companyName;
        if (isAllVendorsReport && v.clientName) {
          vendorNameText = `[${v.clientName}] ${v.companyName}`;
        }
        return [
          idx + 1,
          vendorNameText,
          `${v.gstr3bVal}`,
          v.gstr3bMonths || '—'
        ];
      })
    : [
        ['—', 'No vendors identified with GSTR-3B delay greater than 2', '—', '—']
      ];

  autoTable(doc, {
    head: [summaryHeaders],
    body: summaryRows,
    startY: execY,
    margin: { top: 66, bottom: 48, left: 40, right: 40 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3.2,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [59, 24, 95], // Deep purple header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 42, halign: 'center' }, // S.No
      1: { cellWidth: 290, halign: 'left', fontStyle: 'bold' }, // Supplier Name
      2: { cellWidth: 200, halign: 'center', textColor: [220, 38, 38], fontStyle: 'bold' }, // Number of times GSTR-3B filing delay
      3: { cellWidth: 230, halign: 'center', textColor: [220, 38, 38] } // Month
    },
    didDrawPage: () => {
      drawPageHeaderAndFooter(doc, false);
    }
  });

  let afterTableY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : execY + 40;

  // Check if there is enough space on this page for the Recommended Actions section (~140pt)
  if (afterTableY > pageHeight - 160) {
    doc.addPage('a4', 'landscape');
    drawPageHeaderAndFooter(doc, false);
    afterTableY = 82;
  }

  // Section: Recommended Actions:
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Recommended Actions:', 40, afterTableY);
  afterTableY += 14;

  // Subsection: Vendors with a one-time delay in GSTR-3B filing
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Vendors with a one-time delay in GSTR-3B filing', 45, afterTableY);
  afterTableY += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('o  Review the vendor\'s compliance history.', 55, afterTableY); afterTableY += 11;
  doc.text('o  Seek a written justification for the delayed filing.', 55, afterTableY); afterTableY += 11;
  doc.text('o  Continue monitoring their compliance status in subsequent months.', 55, afterTableY); afterTableY += 16;

  // Subsection: Vendors with repeated delays (more than one occurrence)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Vendors with repeated delays (more than one occurrence)', 45, afterTableY);
  afterTableY += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('o  Conduct a detailed discussion with the vendor to understand the reasons for recurring non-compliance.', 55, afterTableY); afterTableY += 11;
  doc.text('o  Assess the potential GST and compliance risks associated with continued business transactions.', 55, afterTableY); afterTableY += 11;
  doc.text('o  Consider obtaining a corrective action plan and management commitment for timely future filings.', 55, afterTableY); afterTableY += 11;
  doc.text('o  Exercise additional caution before releasing payments or issuing new purchase orders until satisfactory clarification is received.', 55, afterTableY); afterTableY += 16;

  // Final Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Regular monitoring of vendor GST compliance is recommended to mitigate input tax credit (ITC) and regulatory risks.', 40, afterTableY);

  // ── PAGE 3+: Vendors Table ────────────────────────────────────────────────
  doc.addPage('a4', 'landscape');

  // Warning statement strictly above table start on Page 2 (never in table header)
  let tableStartY = 66;
  if (template.tableWarning && template.tableWarning.trim()) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(18, 62, pageWidth - 36, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(220, 38, 38);
    doc.text(template.tableWarning.trim(), 24, 71.5);
    tableStartY = 82;
  }

  // Prepare table columns & data matching website exact styling
  const tableHeaders = [
    'Sl. No.',
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
    'Score'
  ];

  const tableBody = vendors.map((v, idx) => {
    const isTrader = (v.coreActivity || '').toLowerCase().includes('trader');
    const isPropOrPartner = ['proprietorship', 'partnership', 'huf', 'hindu undivided family'].some(t =>
      (v.gstType || '').toLowerCase().includes(t)
    );
    const isIndividualFirmOrTrader = isTrader || isPropOrPartner;
    const showRedCross = isIndividualFirmOrTrader && v.gstr3bVal > 2;

    // Clean text prefixes: avoid unicode emojis/bullets that cause %Ï garbling in PDF
    let compText = '';
    if (isAllVendorsReport && v.clientName) {
      compText += `[${v.clientName}] `;
    }
    if (v.isRisky || showRedCross) compText += '[Risky] ';
    compText += v.companyName;
    const companyDisplay = compText;

    // GSTR1 cell
    let gstr1Display = `${v.gstr1Val}`;
    if (v.gstr1Months) gstr1Display += `  ${v.gstr1Months}`;

    // GSTR3B cell
    let gstr3bDisplay = (v.isGstr3bMissing || v.gstr3bVal === null || v.gstr3bVal === undefined || v.gstr3bVal === 'N/A') ? 'N/A' : `${v.gstr3bVal}`;
    if (!v.isGstr3bMissing && v.gstr3bVal !== 'N/A' && v.gstr3bMonths) gstr3bDisplay += `  ${v.gstr3bMonths}`;

    return [
      idx + 1,
      companyDisplay,
      v.gstin,
      v.gstType || 'Partnership',
      v.ageDisplay,
      v.gstStatus || 'Active',
      gstr1Display,
      gstr3bDisplay,
      v.gstr7Text || 'N/A',
      v.aadhaarValidation || 'N/A',
      v.coreActivity || 'Manufacturer',
      v.aggregateTurnover || 'N/A',
      v.grcScore ?? 'N/A'
    ];
  });

  autoTable(doc, {
    head: [tableHeaders],
    body: tableBody,
    startY: tableStartY,
    margin: { top: 66, bottom: 48, left: 18, right: 18 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.8,
      cellPadding: 2.2,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [59, 24, 95], // Website deep purple header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },  // Sl. No.
      1: { 
        cellWidth: 135,
        cellPadding: { top: 2.2, bottom: 2.2, left: 14, right: 2.2 }
      },                                      // Company Name
      2: { cellWidth: 78, halign: 'center' },  // GSTN
      3: { cellWidth: 60, halign: 'center' },  // Type
      4: { cellWidth: 20, halign: 'center' },  // Age
      5: { cellWidth: 42, halign: 'center' },  // GST Status
      6: { cellWidth: 48, halign: 'center' },  // GSTR1
      7: { cellWidth: 62, halign: 'center' },  // GSTR3B (Delayed)
      8: { cellWidth: 78, halign: 'center' },  // GSTR7R
      9: { cellWidth: 50, halign: 'center' },  // Aadhaar Authenticated
      10: { cellWidth: 78, halign: 'center' }, // Core Activity
      11: { cellWidth: 60, halign: 'center' }, // Turn over
      12: { cellWidth: 48, halign: 'center' }  // Score
    },
    didDrawPage: (data) => {
      drawPageHeaderAndFooter(doc, false);
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const v = vendors[data.row.index];
        if (!v) return;

        // Native vector circular dot in Column 1 (Company Name)
        if (data.column.index === 1) {
          const dotColor = hexToRgb(v.companyDotColorHex || '#10b981');
          doc.setFillColor(dotColor.r, dotColor.g, dotColor.b);
          const cx = data.cell.x + 6.8;
          const lineCount = Array.isArray(data.cell.text) ? data.cell.text.length : 1;
          const cy = (data.cell.y + data.cell.height / 2) - ((lineCount - 1) * 4.2);
          doc.circle(cx, cy, 3.0, 'F');
        }

        // Native vector circular dot in Column 6 (GSTR1) positioned right before centered text
        if (data.column.index === 6) {
          const dotColor = hexToRgb(v.gstr1DotColorHex || '#10b981');
          doc.setFillColor(dotColor.r, dotColor.g, dotColor.b);
          const lines = Array.isArray(data.cell.text) ? data.cell.text : [data.cell.text || ''];
          const firstLine = lines[0] || '';
          const textW = doc.getTextWidth(firstLine);
          const cellCenterX = data.cell.x + data.cell.width / 2;
          const cx = Math.max(data.cell.x + 3.5, cellCenterX - (textW / 2) - 4.5);
          const lineCount = lines.length;
          const cy = (data.cell.y + data.cell.height / 2) - ((lineCount - 1) * 3.8);
          doc.circle(cx, cy, 2.3, 'F');
        }
      }
    },
    didParseCell: (data) => {
      // 1. HEADER ROW: Strictly enforce pure white text, bold font, and purple background for all headers
      if (data.section === 'head') {
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fillColor = [59, 24, 95];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'center';
        return;
      }

      // Guard: Only apply body cell styles below to the body section
      if (data.section !== 'body') return;

      const rowIdx = data.row.index;
      const v = vendors[rowIdx];
      if (!v) return;

      // Ensure body cells in column 1 maintain left padding for dot
      if (data.column.index === 1) {
        data.cell.styles.cellPadding = { top: 2.2, bottom: 2.2, left: 14, right: 2.2 };
      }

      // Scenario 9 or missing GSTR-3B: Critical risk whole row red
      if (v.isEntireRowRed || v.isGstr3bMissing) {
        data.cell.styles.fillColor = [220, 38, 38];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        return;
      }

      // Column 5: GST Status Active in green
      if (data.column.index === 5 && (v.gstStatus || '').toLowerCase() === 'active') {
        data.cell.styles.textColor = [22, 163, 74];
        data.cell.styles.fontStyle = 'bold';
      }

      // Column 7: GSTR-3B cell background coloring
      if (data.column.index === 7) {
        if (v.gstr3bVal > 2) {
          data.cell.styles.fillColor = [254, 202, 202]; // Soft red
          data.cell.styles.textColor = [153, 27, 27];
          data.cell.styles.fontStyle = 'bold';
        } else if (v.gstr3bVal >= 1) {
          data.cell.styles.fillColor = [254, 240, 138]; // Soft yellow
          data.cell.styles.textColor = [113, 63, 18];
          data.cell.styles.fontStyle = 'bold';
        }
      }

      // Column 8: GSTR-7 N/A soft red badge
      if (data.column.index === 8 && (v.gstr7Text || '').toLowerCase() === 'n/a') {
        data.cell.styles.textColor = [220, 38, 38];
      }

      // Column 9: Aadhaar No soft red badge
      if (data.column.index === 9 && (v.aadhaarValidation || '').toLowerCase() === 'no') {
        data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = 'bold';
      }

      // Column 4: Age < 2 soft blue
      if (data.column.index === 4 && typeof v.ageDisplay === 'number' && v.ageDisplay < 2) {
        data.cell.styles.fillColor = [219, 234, 254];
        data.cell.styles.textColor = [30, 64, 175];
      }

      // Column 11: Low turnover under 3 Cr soft yellow
      if (data.column.index === 11 && v.isLowTurnover) {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
      }
    }
  });

  const fileName = `Vendor_Assessment_Report_${clientName.replace(/\s+/g, '_')}_${reportMonth.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};

// ── EXPORT TO DOCX (100% EDITABLE IN WORD / GOOGLE DOCS) ─────────────────────
export const exportReportToDocx = async ({
  client,
  vendors,
  template,
  clientLogoDataUrl
}) => {
  const scrapLogoDataUrl = template.footerLogoDataUrl || createScrapDmsLogoDataUrl();
  const scrapLogoBytes = dataUrlToUint8Array(scrapLogoDataUrl);
  const clientLogoBytes = dataUrlToUint8Array(clientLogoDataUrl);

  const isAllVendorsReport = Boolean(client?.isAllVendors || client?.id === 'ALL');
  const clientName = isAllVendorsReport ? 'ALL UPLOADED VENDORS' : (client?.clientName || 'Client');
  const reportMonth = template.reportMonth || 'Sep 26';
  const reportHeaderRight = isAllVendorsReport ? `Consolidated Assessment -${reportMonth}` : `Vendor Assessment Report -${reportMonth}`;

  // Header Component for DOCX (Client logo on left, Report Month on right)
  const docHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          ...(clientLogoBytes
            ? [
                new ImageRun({
                  data: clientLogoBytes,
                  transformation: { width: 110, height: 35 }
                }),
                new TextRun({ text: '\t\t\t\t' })
              ]
            : [
                new TextRun({
                  text: clientName.toUpperCase(),
                  bold: true,
                  size: 22,
                  color: '28124D'
                }),
                new TextRun({ text: '\t\t\t\t' })
              ]),
          new TextRun({
            text: reportHeaderRight,
            bold: false,
            size: 19,
            color: '475569'
          })
        ],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: 'E2E8F0' }
        }
      })
    ]
  });

  // Footer Component for DOCX (Score Categories & ScrapDMS logo)
  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 60 },
        children: [
          new TextRun({ text: 'Score Categories:  GRC < 20 Good   |   20 < GRC < 30 Careful category   |   GRC > 30 Risky category', size: 15, color: '64748B' })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          ...(scrapLogoBytes
            ? [
                new ImageRun({
                  data: scrapLogoBytes,
                  transformation: { width: 85, height: 24 }
                })
              ]
            : [
                new TextRun({
                  text: 'ScrapDMS',
                  bold: true,
                  size: 17,
                  color: '0284C7'
                })
              ])
        ]
      })
    ]
  });

  // Page 1: Cover / Observations Paragraphs
  const page1Children = [
    new Paragraph({
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: template.salutation,
          bold: true,
          size: 22,
          color: '1E293B'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: template.introText,
          size: 20,
          color: '334155'
        })
      ]
    }),
    // 7 Observations
    ...template.observations.flatMap((obs, idx) => [
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: `${idx + 1}.  ${obs.title} – `,
            bold: true,
            size: 20,
            color: '0F172A'
          }),
          new TextRun({
            text: obs.text,
            size: 19,
            color: '334155'
          })
        ]
      })
    ]),
    new Paragraph({
      spacing: { before: 240, after: 100 },
      children: [
        new TextRun({
          text: template.disclaimerTitle,
          bold: true,
          size: 21,
          color: '0F172A'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: template.disclaimerP1,
          size: 18,
          color: '64748B'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: template.disclaimerP2,
          size: 18,
          color: '64748B'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: template.regardsPrefix,
          size: 20,
          color: '1E293B'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: template.companyName,
          bold: true,
          size: 20,
          color: '0284C7'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: template.managerTitle,
          size: 19,
          color: '64748B'
        })
      ]
    })
  ];

  // ── Section 2: Executive Summary (GSTR-3B Risky Vendors & Recommended Actions) ──
  const gstr3bRiskyVendors = vendors.filter(v => {
    const n = typeof v.gstr3bVal === 'number' ? v.gstr3bVal : parseInt(v.gstr3bVal, 10);
    return !isNaN(n) && n > 2;
  });

  const execSummaryHeaders = ['S.No', 'Supplier Name', 'Number of times GSTR-3B filing delay', 'Month'];
  const execSummaryHeaderRow = new TableRow({
    tableHeader: true,
    children: execSummaryHeaders.map((title, i) =>
      new TableCell({
        width: i === 0 ? { size: 8, type: WidthType.PERCENTAGE }
             : i === 1 ? { size: 40, type: WidthType.PERCENTAGE }
             : i === 2 ? { size: 28, type: WidthType.PERCENTAGE }
             : { size: 24, type: WidthType.PERCENTAGE },
        shading: { fill: '3B185F', type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 70, right: 70 },
        children: [
          new Paragraph({
            alignment: i === 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 18,
                color: 'FFFFFF'
              })
            ]
          })
        ]
      })
    )
  });

  const execSummaryDataRows = gstr3bRiskyVendors.length > 0
    ? gstr3bRiskyVendors.map((v, idx) => {
        let vendorNameText = v.companyName;
        if (isAllVendorsReport && v.clientName) {
          vendorNameText = `[${v.clientName}] ${v.companyName}`;
        }
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${idx + 1}`, size: 17, color: '1E293B' })]
                })
              ]
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: vendorNameText, bold: true, size: 17, color: '0F172A' })]
                })
              ]
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${v.gstr3bVal}`, bold: true, size: 17, color: 'DC2626' })]
                })
              ]
            }),
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: v.gstr3bMonths || '—', size: 17, color: 'DC2626' })]
                })
              ]
            })
          ]
        });
      })
    : [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: '—', size: 17, color: '64748B' })]
                })
              ]
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: 'No vendors identified with GSTR-3B delay greater than 2', italics: true, size: 17, color: '64748B' })]
                })
              ]
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: '—', size: 17, color: '64748B' })]
                })
              ]
            }),
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: '—', size: 17, color: '64748B' })]
                })
              ]
            })
          ]
        })
      ];

  const execSummaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [execSummaryHeaderRow, ...execSummaryDataRows]
  });

  const execSummaryDocxChildren = [
    new Paragraph({
      spacing: { before: 180, after: 120 },
      children: [
        new TextRun({
          text: 'Executive Summary:',
          bold: true,
          size: 26,
          color: '3B185F'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: 'During the compliance review, it was observed that some vendors have regularly delayed their GSTR-3B returns within the prescribed timelines. Therefore, caution should be exercised while releasing payments or placing new purchase orders with such vendors.',
          size: 20,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 100, after: 120 },
      children: [
        new TextRun({
          text: 'Summary :',
          bold: true,
          size: 22,
          color: '1E293B'
        })
      ]
    }),
    execSummaryTable,
    new Paragraph({
      spacing: { before: 240, after: 100 },
      children: [
        new TextRun({
          text: 'Recommended Actions:',
          bold: true,
          size: 22,
          color: '1E293B'
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 80, after: 50 },
      children: [
        new TextRun({
          text: 'Vendors with a one-time delay in GSTR-3B filing',
          bold: true,
          size: 20,
          color: '0F172A'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'o  Review the vendor\'s compliance history.',
          size: 19,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'o  Seek a written justification for the delayed filing.',
          size: 19,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'o  Continue monitoring their compliance status in subsequent months.',
          size: 19,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 80, after: 50 },
      children: [
        new TextRun({
          text: 'Vendors with repeated delays (more than one occurrence)',
          bold: true,
          size: 20,
          color: '0F172A'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'o  Conduct a detailed discussion with the vendor to understand the reasons for recurring non-compliance.',
          size: 19,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'o  Assess the potential GST and compliance risks associated with continued business transactions.',
          size: 19,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'o  Consider obtaining a corrective action plan and management commitment for timely future filings.',
          size: 19,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: 'o  Exercise additional caution before releasing payments or issuing new purchase orders until satisfactory clarification is received.',
          size: 19,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 100, after: 80 },
      children: [
        new TextRun({
          text: 'Regular monitoring of vendor GST compliance is recommended to mitigate input tax credit (ITC) and regulatory risks.',
          italics: true,
          size: 19,
          color: '64748B'
        })
      ]
    })
  ];

  // Callout warning right before table
  const warningParagraph = new Paragraph({
    spacing: { before: 200, after: 140 },
    children: [
      new TextRun({
        text: `[!]  ${template.tableWarning}`,
        bold: true,
        size: 19,
        color: 'DC2626'
      })
    ]
  });

  // Table Headers
  const tableHeaders = [
    'Sl. No.',
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
    'Score'
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: tableHeaders.map(title =>
      new TableCell({
        shading: { fill: '3B185F', type: ShadingType.CLEAR }, // Deep Purple Header
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 110, bottom: 110, left: 70, right: 70 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 17,
                color: 'FFFFFF'
              })
            ]
          })
        ]
      })
    )
  });

  // Table Data Rows
  const dataRows = vendors.map((v, idx) => {
    const isTrader = (v.coreActivity || '').toLowerCase().includes('trader');
    const isPropOrPartner = ['proprietorship', 'partnership', 'huf', 'hindu undivided family'].some(t =>
      (v.gstType || '').toLowerCase().includes(t)
    );
    const isIndividualFirmOrTrader = isTrader || isPropOrPartner;
    const showRedCross = isIndividualFirmOrTrader && v.gstr3bVal > 2;

    const isRowRed = v.isEntireRowRed || v.isGstr3bMissing;
    const rowBg = isRowRed ? 'DC2626' : undefined;
    const rowTextColor = isRowRed ? 'FFFFFF' : '1E293B';

    // Cell GSTR3B background
    let gstr3bCellBg = rowBg;
    if (!isRowRed) {
      if (v.gstr3bVal > 2) gstr3bCellBg = 'FECACA';
      else if (v.gstr3bVal >= 1) gstr3bCellBg = 'FEF08A';
    }

    // Company Name formatted (Left-aligned for readability, vertically centered)
    const compChildren = [];
    if (isAllVendorsReport && v.clientName) {
      compChildren.push(new TextRun({ text: `[${v.clientName}] `, bold: true, color: isRowRed ? 'FFFFFF' : '4F46E5', size: 16 }));
    }
    if (v.isRisky || showRedCross) {
      compChildren.push(new TextRun({ text: '[Risky] ', bold: true, color: isRowRed ? 'FFFFFF' : 'DC2626', size: 17 }));
    }
    const compDotColor = (v.companyDotColorHex || '10B981').replace('#', '');
    compChildren.push(new TextRun({ text: `● `, bold: true, color: isRowRed ? 'FFFFFF' : compDotColor, size: 22 }));
    compChildren.push(new TextRun({ text: v.companyName, bold: isRowRed, color: rowTextColor, size: 17 }));

    // GSTR1 Cell formatted (Centered in cell)
    const gstr1DotColor = (v.gstr1DotColorHex || '10B981').replace('#', '');
    const gstr1Children = [
      new TextRun({ text: `● `, bold: true, color: isRowRed ? 'FFFFFF' : gstr1DotColor, size: 20 }),
      new TextRun({ text: `${v.gstr1Val}`, bold: true, color: rowTextColor, size: 17 })
    ];
    if (v.gstr1Months) {
      gstr1Children.push(new TextRun({ text: `  ${v.gstr1Months}`, bold: true, color: isRowRed ? 'FFFFFF' : 'DC2626', size: 16 }));
    }

    // GSTR3B Cell formatted (Centered in cell)
    const gstr3bChildren = (v.isGstr3bMissing || v.gstr3bVal === null || v.gstr3bVal === undefined || v.gstr3bVal === 'N/A') ? [
      new TextRun({ text: 'N/A', bold: true, color: rowTextColor, size: 17 })
    ] : [
      new TextRun({ text: `${v.gstr3bVal}`, bold: true, color: rowTextColor, size: 17 }),
      ...(v.gstr3bMonths ? [new TextRun({ text: `  ${v.gstr3bMonths}`, bold: true, color: isRowRed ? 'FFFFFF' : 'DC2626', size: 16 })] : [])
    ];

    const cellMargins = { top: 90, bottom: 90, left: 60, right: 60 };

    return new TableRow({
      children: [
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: compChildren })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.gstin, size: 16, font: 'Courier New', color: rowTextColor })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.gstType || 'Partnership', size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : (typeof v.ageDisplay === 'number' && v.ageDisplay < 2 ? { fill: 'DBEAFE', type: ShadingType.CLEAR } : undefined),
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${v.ageDisplay}`, size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.gstStatus || 'Active', bold: true, size: 17, color: v.isEntireRowRed ? 'FFFFFF' : '16A34A' })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: gstr1Children })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: gstr3bCellBg ? { fill: gstr3bCellBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: gstr3bChildren })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.gstr7Text || 'N/A', size: 17, color: (v.gstr7Text === 'N/A' && !v.isEntireRowRed) ? 'DC2626' : rowTextColor })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.aadhaarValidation || 'N/A', bold: (v.aadhaarValidation || '').toLowerCase() === 'no', size: 17, color: (v.aadhaarValidation || '').toLowerCase() === 'no' && !v.isEntireRowRed ? 'DC2626' : rowTextColor })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.coreActivity || 'Manufacturer', size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : (v.isLowTurnover ? { fill: 'FEF3C7', type: ShadingType.CLEAR } : undefined),
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.aggregateTurnover || 'N/A', size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${v.grcScore ?? 'N/A'}`, size: 17, color: rowTextColor })] })]
        })
      ]
    });
  });

  const vendorTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows]
  });

  const scoreLegendDocxParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 120 },
    children: [
      new TextRun({ text: 'Score Categories:  ', bold: true, size: 17, color: '334155' }),
      new TextRun({ text: 'GRC < 20: Good   |   ', bold: true, size: 17, color: '16A34A' }),
      new TextRun({ text: '20 < GRC < 30: Careful category   |   ', bold: true, size: 17, color: 'D97706' }),
      new TextRun({ text: 'GRC > 30: Risky category', bold: true, size: 17, color: 'DC2626' })
    ]
  });

  const doc = new Document({
    sections: [
      // Section 1: Page 1 Cover & Observations
      {
        properties: {
          page: {
            size: { orientation: 'landscape' },
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        headers: { default: docHeader },
        footers: { default: docFooter },
        children: page1Children
      },
      // Section 2: Executive Summary (GSTR-3B Risky Vendors & Recommended Actions)
      {
        properties: {
          page: {
            size: { orientation: 'landscape' },
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        headers: { default: docHeader },
        footers: { default: docFooter },
        children: execSummaryDocxChildren
      },
      // Section 3: Table Section (Landscape for optimal table readability)
      {
        properties: {
          page: {
            size: { orientation: 'landscape' },
            margin: { top: 720, bottom: 720, left: 500, right: 500 }
          }
        },
        headers: { default: docHeader },
        footers: { default: docFooter },
        children: [warningParagraph, vendorTable, scoreLegendDocxParagraph]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `Vendor_Assessment_Report_${clientName.replace(/\s+/g, '_')}_${reportMonth.replace(/\s+/g, '_')}.docx`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
