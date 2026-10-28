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
  ShadingType
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
    tableWarning: 'Please review these vendors, as their GSTR filing patterns appear to be repetitive in nature and may require further assessment.'
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

// ── EXPORT TO PDF ────────────────────────────────────────────────────────────
export const exportReportToPdf = async ({
  client,
  vendors,
  template,
  clientLogoDataUrl
}) => {
  const scrapLogoDataUrl = createScrapDmsLogoDataUrl();
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const clientName = client?.clientName || 'Client';
  const reportMonth = template.reportMonth || 'Sep 26';
  const reportHeaderRight = `Vendor Assessment Report -${reportMonth}`;

  // Helper to draw Header & Footer on each page
  const drawPageHeaderAndFooter = (pageDoc, isFirstPage) => {
    // Header Left: Client Logo or Client Name
    if (clientLogoDataUrl) {
      try {
        pageDoc.addImage(clientLogoDataUrl, 'PNG', 40, 20, 110, 36);
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

    // Footer: ScrapDMS Logo & branding centered
    if (scrapLogoDataUrl) {
      try {
        pageDoc.addImage(scrapLogoDataUrl, 'PNG', (pageWidth - 90) / 2, pageHeight - 48, 90, 26);
      } catch {
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.setFontSize(9);
        pageDoc.setTextColor(2, 132, 199);
        pageDoc.text('ScrapDMS', pageWidth / 2, pageHeight - 28, { align: 'center' });
      }
    } else {
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setFontSize(9);
      pageDoc.setTextColor(2, 132, 199);
      pageDoc.text('ScrapDMS', pageWidth / 2, pageHeight - 28, { align: 'center' });
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

  // ── PAGE 2+: Vendors Table ────────────────────────────────────────────────
  doc.addPage('a4', 'landscape');

  // Prepare table columns & data matching website exact styling
  const tableHeaders = [
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
    'Score'
  ];

  const tableBody = vendors.map((v, idx) => {
    const isTrader = (v.coreActivity || '').toLowerCase().includes('trader');
    const isPropOrPartner = ['proprietorship', 'partnership', 'huf', 'hindu undivided family'].some(t =>
      (v.gstType || '').toLowerCase().includes(t)
    );
    const isIndividualFirmOrTrader = isTrader || isPropOrPartner;
    const showRedCross = isIndividualFirmOrTrader && v.gstr3bVal > 2;

    // Badges / Prefixes
    let compPrefix = '';
    if (v.isRisky) compPrefix += '[Risky] ';
    compPrefix += v.companyDotSymbol + ' ';
    if (showRedCross) compPrefix += '❌ ';

    // GSTR1 cell
    let gstr1Display = `${v.gstr1DotSymbol} ${v.gstr1Val}`;
    if (v.gstr1Months) gstr1Display += `  ${v.gstr1Months}`;

    // GSTR3B cell
    let gstr3bDisplay = `${v.gstr3bVal}`;
    if (v.gstr3bMonths) gstr3bDisplay += `  ${v.gstr3bMonths}`;

    return [
      idx + 1,
      compPrefix + v.companyName,
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

  // Callout warning message right above table start
  const warningText = `❌  ${template.tableWarning}`;

  autoTable(doc, {
    head: [tableHeaders],
    body: tableBody,
    startY: 85,
    margin: { top: 72, bottom: 58, left: 24, right: 24 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 3.5,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [59, 24, 95], // Website deep purple header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center' }, // Sl. No.
      1: { cellWidth: 145 },                  // Company Name
      2: { cellWidth: 88, font: 'courier' }, // GSTN
      3: { cellWidth: 70 },                  // Type
      4: { cellWidth: 26, halign: 'center' }, // Age
      5: { cellWidth: 50, halign: 'center' }, // Status
      6: { cellWidth: 62 },                  // GSTR1
      7: { cellWidth: 70 },                  // GSTR3B
      8: { cellWidth: 70 },                  // GSTR7R
      9: { cellWidth: 50, halign: 'center' }, // Aadhaar
      10: { cellWidth: 75 },                 // Core Activity
      11: { cellWidth: 58 },                 // Turnover
      12: { cellWidth: 32, halign: 'center' } // Score
    },
    didDrawPage: (data) => {
      drawPageHeaderAndFooter(doc, false);

      // On table's first page, draw the warning statement above the table
      if (data.pageNumber === 2) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(220, 38, 38);
        doc.text(warningText, 26, 76);
      }
    },
    didParseCell: (data) => {
      const rowIdx = data.row.index;
      const v = vendors[rowIdx];
      if (!v) return;

      // Scenario 9: Critical risk whole row red
      if (v.isEntireRowRed) {
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
  const scrapLogoDataUrl = createScrapDmsLogoDataUrl();
  const scrapLogoBytes = dataUrlToUint8Array(scrapLogoDataUrl);
  const clientLogoBytes = dataUrlToUint8Array(clientLogoDataUrl);

  const clientName = client?.clientName || 'Client';
  const reportMonth = template.reportMonth || 'Sep 26';
  const reportHeaderRight = `Vendor Assessment Report -${reportMonth}`;

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

  // Footer Component for DOCX (ScrapDMS logo centered)
  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          ...(scrapLogoBytes
            ? [
                new ImageRun({
                  data: scrapLogoBytes,
                  transformation: { width: 90, height: 26 }
                })
              ]
            : [
                new TextRun({
                  text: 'ScrapDMS',
                  bold: true,
                  size: 18,
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

  // Callout warning right before table
  const warningParagraph = new Paragraph({
    spacing: { before: 200, after: 140 },
    children: [
      new TextRun({
        text: `❌  ${template.tableWarning}`,
        bold: true,
        size: 19,
        color: 'DC2626'
      })
    ]
  });

  // Table Headers
  const tableHeaders = [
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
    'Score'
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: tableHeaders.map(title =>
      new TableCell({
        shading: { fill: '3B185F', type: ShadingType.CLEAR }, // Deep Purple Header
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
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

    const rowBg = v.isEntireRowRed ? 'DC2626' : undefined;
    const rowTextColor = v.isEntireRowRed ? 'FFFFFF' : '1E293B';

    // Cell GSTR3B background
    let gstr3bCellBg = rowBg;
    if (!v.isEntireRowRed) {
      if (v.gstr3bVal > 2) gstr3bCellBg = 'FECACA';
      else if (v.gstr3bVal >= 1) gstr3bCellBg = 'FEF08A';
    }

    // Company Name formatted
    const compChildren = [];
    if (v.isRisky) {
      compChildren.push(new TextRun({ text: '[Risky] ', bold: true, color: v.isEntireRowRed ? 'FFFFFF' : 'DC2626', size: 17 }));
    }
    compChildren.push(new TextRun({ text: `${v.companyDotSymbol} `, bold: true, color: v.isEntireRowRed ? 'FFFFFF' : v.companyDotColorHex, size: 19 }));
    if (showRedCross) {
      compChildren.push(new TextRun({ text: '❌ ', bold: true, color: v.isEntireRowRed ? 'FFFFFF' : 'DC2626', size: 17 }));
    }
    compChildren.push(new TextRun({ text: v.companyName, bold: v.isEntireRowRed, color: rowTextColor, size: 17 }));

    // GSTR1 Cell formatted
    const gstr1Children = [
      new TextRun({ text: `${v.gstr1DotSymbol} `, bold: true, color: v.isEntireRowRed ? 'FFFFFF' : v.gstr1DotColorHex, size: 19 }),
      new TextRun({ text: `${v.gstr1Val}`, bold: true, color: rowTextColor, size: 17 })
    ];
    if (v.gstr1Months) {
      gstr1Children.push(new TextRun({ text: `  ${v.gstr1Months}`, bold: true, color: v.isEntireRowRed ? 'FFFFFF' : 'DC2626', size: 16 }));
    }

    // GSTR3B Cell formatted
    const gstr3bChildren = [
      new TextRun({ text: `${v.gstr3bVal}`, bold: true, color: rowTextColor, size: 17 })
    ];
    if (v.gstr3bMonths) {
      gstr3bChildren.push(new TextRun({ text: `  ${v.gstr3bMonths}`, bold: true, color: v.isEntireRowRed ? 'FFFFFF' : 'DC2626', size: 16 }));
    }

    return new TableRow({
      children: [
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ children: compChildren })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text: v.gstin, size: 16, font: 'Courier New', color: rowTextColor })] })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text: v.gstType || 'Partnership', size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : (typeof v.ageDisplay === 'number' && v.ageDisplay < 2 ? { fill: 'DBEAFE', type: ShadingType.CLEAR } : undefined),
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${v.ageDisplay}`, size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.gstStatus || 'Active', bold: true, size: 17, color: v.isEntireRowRed ? 'FFFFFF' : '16A34A' })] })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ children: gstr1Children })]
        }),
        new TableCell({
          shading: gstr3bCellBg ? { fill: gstr3bCellBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ children: gstr3bChildren })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text: v.gstr7Text || 'N/A', size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.aadhaarValidation || 'N/A', bold: (v.aadhaarValidation || '').toLowerCase() === 'no', size: 17, color: (v.aadhaarValidation || '').toLowerCase() === 'no' && !v.isEntireRowRed ? 'DC2626' : rowTextColor })] })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text: v.coreActivity || 'Manufacturer', size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
          shading: rowBg ? { fill: rowBg, type: ShadingType.CLEAR } : (v.isLowTurnover ? { fill: 'FEF3C7', type: ShadingType.CLEAR } : undefined),
          children: [new Paragraph({ children: [new TextRun({ text: v.aggregateTurnover || 'N/A', size: 17, color: rowTextColor })] })]
        }),
        new TableCell({
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

  const doc = new Document({
    sections: [
      // Section 1: Page 1 Cover & Observations (Portrait or Landscape)
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        headers: { default: docHeader },
        footers: { default: docFooter },
        children: page1Children
      },
      // Section 2: Table Section (Landscape for optimal table readability)
      {
        properties: {
          page: {
            size: { orientation: 'landscape' },
            margin: { top: 720, bottom: 720, left: 500, right: 500 }
          }
        },
        headers: { default: docHeader },
        footers: { default: docFooter },
        children: [warningParagraph, vendorTable]
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
