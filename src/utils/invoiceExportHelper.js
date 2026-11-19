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
  Footer,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign
} from 'docx';
import { loadInvoiceAssets, dataUrlToUint8Array } from './invoiceAssets';
import { formatIndianCurrency } from './numberToWords';

/**
 * Generates and downloads the Invoice as a high-quality PDF matching the ScrapDMS Word template
 */
export async function exportInvoiceToPdf(invoiceData) {
  const assets = await loadInvoiceAssets();

  // Auto-resolve client logo by GSTIN if not already provided as Data URL
  let clientLogoDataUrl = invoiceData.clientLogoDataUrl || null;
  if (!clientLogoDataUrl && invoiceData.customerGstin) {
    try {
      const gstin = invoiceData.customerGstin.trim().toUpperCase();
      const res = await fetch(`/api/admin/clients/logo/by-gstin/${encodeURIComponent(gstin)}`);
      if (res.ok) {
        const blob = await res.blob();
        clientLogoDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn('Could not auto-fetch client logo by GSTIN for invoice:', e);
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const leftMargin = 48;
  const rightMargin = 48;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 499.28 pt

  // Exact template colors from Ajar_Amar__invoice.docx
  const BLUE_TITLE = [84, 141, 212];   // #548DD4 (ScrapDMS, Payment Details)
  const BLUE_HEADING = [79, 129, 189]; // #4F81BD (BILL TO, Invoice Details)
  const NAVY_DARK = [23, 54, 93];      // #17365D (TAX INVOICE)
  const NAVY_TEXT = [15, 36, 62];      // #0F243E (GSTN, Footer)
  const BLACK = [0, 0, 0];

  let curY = 32;

  // 1. Top Header Band:
  //    Left: Supplier GSTN & Udyam | Center: ScrapDMS (Blue) + TAX INVOICE | Right: ScrapDMS Logo (unstretched 1.501:1)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY_TEXT);
  doc.text('GSTN: ', leftMargin, curY + 16);
  const gstnLabelW = doc.getTextWidth('GSTN: ');
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.supplierGstin || '06AANHD7145Q1ZN', leftMargin + gstnLabelW, curY + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('Udyam: ', leftMargin, curY + 31);
  const udyamLabelW = doc.getTextWidth('Udyam: ');
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.supplierUdyam || 'UDYAM-HR-05-0154507', leftMargin + udyamLabelW, curY + 31);

  // Preserve exact logo aspect ratio (581 x 387 = 1.501 : 1)
  const logoW = 72;
  const logoH = 48;
  if (assets.headerLogoDataUrl) {
    try {
      doc.addImage(assets.headerLogoDataUrl, 'JPEG', pageWidth - rightMargin - logoW, curY, logoW, logoH);
    } catch (e) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...BLUE_TITLE);
      doc.text('ScrapDMS', pageWidth - rightMargin, curY + 18, { align: 'right' });
    }
  }

  // Center Title: ScrapDMS (Blue #548DD4) + TAX INVOICE directly underneath (#17365D)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...BLUE_TITLE);
  doc.text('ScrapDMS', pageWidth / 2, curY + 24, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...NAVY_DARK);
  doc.text('TAX INVOICE', pageWidth / 2, curY + 46, { align: 'center' });

  // Light blue header divider line matching template
  doc.setDrawColor(198, 217, 241);
  doc.setLineWidth(0.8);
  doc.line(leftMargin, curY + 62, pageWidth - rightMargin, curY + 62);

  curY += 80;

  // 2. BILL TO Section (Row 1 - Full Width, Blue Heading #4F81BD)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...BLUE_HEADING);
  doc.text('BILL TO:', leftMargin, curY);

  // If customer logo is mapped, render it neatly on the right side across BILL TO
  if (clientLogoDataUrl) {
    try {
      let fmt = 'PNG';
      if (clientLogoDataUrl.startsWith('data:image/jpeg') || clientLogoDataUrl.startsWith('data:image/jpg')) fmt = 'JPEG';
      else if (clientLogoDataUrl.startsWith('data:image/webp')) fmt = 'WEBP';
      const cLogoW = 90;
      const cLogoH = 40;
      doc.addImage(clientLogoDataUrl, fmt, pageWidth - rightMargin - cLogoW, curY - 14, cLogoW, cLogoH);
    } catch (e) {
      console.warn('Could not add client logo to PDF invoice:', e);
    }
  }

  curY += 18;

  const custNameStr = (invoiceData.customerName || '').trim().toLowerCase().startsWith('m/s')
    ? invoiceData.customerName
    : `M/s ${invoiceData.customerName || ''}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);

  doc.text(`Customer Name: ${custNameStr}`, leftMargin, curY);
  curY += 15;

  doc.text(`Customer GSTN: ${invoiceData.customerGstin || 'N/A'}`, leftMargin, curY);
  curY += 15;

  const addrWidth = clientLogoDataUrl ? contentWidth - 100 : contentWidth;
  const splitAddress = doc.splitTextToSize(`Address: ${invoiceData.customerAddress || 'N/A'}`, addrWidth);
  doc.text(splitAddress, leftMargin, curY);
  curY += splitAddress.length * 14 + 10;

  // 3. Invoice Details Section (Row 2 - Directly below BILL TO, Blue Heading #4F81BD)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...BLUE_HEADING);
  doc.text('Invoice Details:', leftMargin, curY);
  curY += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);

  const invoiceMetaLines = [
    `Nature of Supply: ${invoiceData.natureOfSupply || ''}`,
    `SAC Code: ${invoiceData.sacCode || ''}`,
    `Invoice No: ${invoiceData.invoiceNo || ''}`,
    `Invoice Date: ${invoiceData.invoiceDate || ''}`,
    `Billing Period: ${invoiceData.billingPeriod || ''}`
  ];

  if (invoiceData.poNumber && invoiceData.poNumber.trim()) {
    invoiceMetaLines.push(`PO Number: ${invoiceData.poNumber.trim()}`);
  }
  if (invoiceData.poDate && invoiceData.poDate.trim()) {
    invoiceMetaLines.push(`PO Date: ${invoiceData.poDate.trim()}`);
  }

  invoiceMetaLines.forEach((line) => {
    doc.text(line, leftMargin, curY);
    curY += 15;
  });

  curY += 10;

  // 4. Line Items Table (Centered columns, clean grid matching docx TableGrid)
  const isInterState = invoiceData.isInterState;
  const taxHeader = isInterState ? `IGST ${invoiceData.igstRate}%` : 'GST 18%';

  const hasDiscount = Boolean(
    invoiceData.discountPercent !== null &&
    invoiceData.discountPercent !== undefined &&
    invoiceData.discountPercent !== '' &&
    parseFloat(invoiceData.discountPercent) > 0
  );

  let tableHeaders;
  let tableRows;
  let columnStyles;

  if (hasDiscount) {
    tableHeaders = ['Sr.', 'Description', 'Price', 'Discount', 'Final Rate', taxHeader, 'Total'];
    tableRows = [
      [
        '1',
        invoiceData.itemDescription || 'ScrapDMS SaaS Platform Monthly Subscription',
        formatIndianCurrency(invoiceData.price),
        `${invoiceData.discountPercent}%`,
        formatIndianCurrency(invoiceData.finalRate),
        formatIndianCurrency(invoiceData.taxAmount),
        formatIndianCurrency(invoiceData.totalAmount)
      ]
    ];
    columnStyles = {
      0: { cellWidth: 42 },
      1: { cellWidth: 147 },
      2: { cellWidth: 62 },
      3: { cellWidth: 60 },
      4: { cellWidth: 64 },
      5: { cellWidth: 62 },
      6: { cellWidth: 62 }
    };
  } else {
    tableHeaders = ['Sr.', 'Description', 'Price', 'Final Rate', taxHeader, 'Total'];
    tableRows = [
      [
        '1',
        invoiceData.itemDescription || 'ScrapDMS SaaS Platform Monthly Subscription',
        formatIndianCurrency(invoiceData.price),
        formatIndianCurrency(invoiceData.finalRate),
        formatIndianCurrency(invoiceData.taxAmount),
        formatIndianCurrency(invoiceData.totalAmount)
      ]
    ];
    columnStyles = {
      0: { cellWidth: 42 },
      1: { cellWidth: 207 },
      2: { cellWidth: 62 },
      3: { cellWidth: 64 },
      4: { cellWidth: 62 },
      5: { cellWidth: 62 }
    };
  }

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: curY,
    margin: { left: leftMargin, right: rightMargin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 6,
      textColor: [0, 0, 0],
      lineColor: [100, 116, 139],
      lineWidth: 0.6,
      halign: 'center',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'normal',
      halign: 'center',
      valign: 'middle',
      lineColor: [100, 116, 139],
      lineWidth: 0.6
    },
    columnStyles
  });

  curY = doc.lastAutoTable.finalY + 11;

  // 5. Currency Note & Amount in Words
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.text('*All prices and amounts are in Indian Rupees (INR)', leftMargin, curY);

  curY += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);
  const wordsText = `Amount in Words: ${invoiceData.amountInWords || ''}`;
  const splitWords = doc.splitTextToSize(wordsText, contentWidth);
  doc.text(splitWords, leftMargin, curY);
  curY += splitWords.length * 14 + 12;

  // 6. Payment Details (Blue Heading #548DD4)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(...BLUE_TITLE);
  doc.text('Payment Details:', leftMargin, curY);
  curY += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text('Payment to be made to our company current account mentioned below :', leftMargin, curY);
  curY += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);

  const bankLines = [
    `Bank Name: ${invoiceData.bankName || 'IDFC FIRST'}`,
    `Account Name: ${invoiceData.accountName || 'SCRAPDMS'}`,
    `Account No.: ${invoiceData.accountNo || '10252673565'}`,
    `IFSC: ${invoiceData.ifsc || 'IDFB0020144'}`,
    `Branch : ${invoiceData.branch || 'Gurgaon Rosewood City, sector 49 , Gurugram'}`
  ];

  bankLines.forEach((line) => {
    doc.text(line, leftMargin, curY);
    curY += 14;
  });

  curY += 10;

  // 7. Note Section
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);
  doc.text('Note:', leftMargin, curY);
  curY += 14;

  const noteBullets = [
    '•  A detailed report of all generated trips can be downloaded from the web portal using your registered admin login.',
    '•  On request, the same report can be shared via a separate email containing a secure download link.',
    '•  All payments are due within 7 days from the date of invoice.'
  ];
  doc.setFontSize(9.5);
  noteBullets.forEach((bullet) => {
    const lines = doc.splitTextToSize(bullet, contentWidth - 10);
    doc.text(lines, leftMargin + 10, curY);
    curY += lines.length * 12 + 2;
  });

  curY += 10;

  // 1-move this to above: Contact query right below Note section
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...BLACK);
  doc.text('For any query, please contact support@scrapdms.com.', leftMargin, curY);
  curY += 22;

  // 8. Signatory Area:
  // - 2-For Scrapdms to left side
  // - 3-signed just above the For Scrapdms
  // - 4-Stamp in middle and remove the background from stamp
  const stampSize = 82; // 1:1 ratio
  const stampX = (pageWidth - stampSize) / 2; // Centered in the middle of page
  const stampY = curY - 6;

  // Left side signature and "For ScrapDMS"
  const sigW = 86;
  const sigH = 33; // 2.595:1 ratio
  const sigX = leftMargin;
  const sigY = curY;

  if (assets.signatureDataUrl) {
    try {
      doc.addImage(assets.signatureDataUrl, 'PNG', sigX, sigY, sigW, sigH);
    } catch (e) {
      console.warn('Could not draw signature:', e);
    }
  }

  // Centered Stamp with transparent background
  if (assets.stampDataUrl) {
    try {
      doc.addImage(assets.stampDataUrl, 'PNG', stampX, stampY, stampSize, stampSize);
    } catch (e) {
      console.warn('Could not draw stamp:', e);
    }
  }

  // "For ScrapDMS" on the left side, directly below the signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text('For ScrapDMS', leftMargin, sigY + sigH + 16);

  // 9. Page Footer matching footer1.xml
  const footerY = pageHeight - 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY_TEXT);
  doc.text(
    '1st Floor, AltF MPD Tower, Golf Course Road, Sector 43, Gurugram, Haryana - 122002',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(
    `Phone: +91-9910760600 || Email: contact@scrapdms.com || GSTN: ${invoiceData.supplierGstin || '06AANHD7145Q1ZN'}`,
    pageWidth / 2,
    footerY + 12,
    { align: 'center' }
  );

  // File download name
  const cleanInvNo = (invoiceData.invoiceNo || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClient = (invoiceData.customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Invoice_${cleanInvNo}_${cleanClient}.pdf`);
}

/**
 * Generates and downloads the Invoice as an editable Microsoft Word DOCX file
 * matching Ajar_Amar__invoice.docx layout, colors, and proportions.
 */
export async function exportInvoiceToDocx(invoiceData) {
  const assets = await loadInvoiceAssets();

  // Auto-resolve client logo bytes by GSTIN if not provided
  let clientLogoBytes = invoiceData.clientLogoBytes || null;
  if (!clientLogoBytes) {
    let cDataUrl = invoiceData.clientLogoDataUrl || null;
    if (!cDataUrl && invoiceData.customerGstin) {
      try {
        const gstin = invoiceData.customerGstin.trim().toUpperCase();
        const res = await fetch(`/api/admin/clients/logo/by-gstin/${encodeURIComponent(gstin)}`);
        if (res.ok) {
          const blob = await res.blob();
          cDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn('Could not auto-fetch client logo by GSTIN for docx invoice:', e);
      }
    }
    if (cDataUrl) {
      clientLogoBytes = dataUrlToUint8Array(cDataUrl);
    }
  }

  const isInterState = invoiceData.isInterState;
  const taxHeader = isInterState ? `IGST ${invoiceData.igstRate}%` : 'GST 18%';

  const hasDiscount = Boolean(
    invoiceData.discountPercent !== null &&
    invoiceData.discountPercent !== undefined &&
    invoiceData.discountPercent !== '' &&
    parseFloat(invoiceData.discountPercent) > 0
  );

  const docxTableHeaders = hasDiscount
    ? ['Sr.', 'Description', 'Price', 'Discount', 'Final Rate', taxHeader, 'Total']
    : ['Sr.', 'Description', 'Price', 'Final Rate', taxHeader, 'Total'];

  const docxTableValues = hasDiscount
    ? [
        '1',
        invoiceData.itemDescription || 'ScrapDMS SaaS Platform Monthly Subscription',
        formatIndianCurrency(invoiceData.price),
        `${invoiceData.discountPercent}%`,
        formatIndianCurrency(invoiceData.finalRate),
        formatIndianCurrency(invoiceData.taxAmount),
        formatIndianCurrency(invoiceData.totalAmount)
      ]
    : [
        '1',
        invoiceData.itemDescription || 'ScrapDMS SaaS Platform Monthly Subscription',
        formatIndianCurrency(invoiceData.price),
        formatIndianCurrency(invoiceData.finalRate),
        formatIndianCurrency(invoiceData.taxAmount),
        formatIndianCurrency(invoiceData.totalAmount)
      ];

  const custNameStr = (invoiceData.customerName || '').trim().toLowerCase().startsWith('m/s')
    ? invoiceData.customerName
    : `M/s ${invoiceData.customerName || ''}`;

  const noBorders = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE }
  };

  // Document Footer matching footer1.xml
  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: '1st Floor, AltF MPD Tower, Golf Course Road, Sector 43, Gurugram, Haryana – 122002',
            size: 20,
            color: '0F243E'
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [
          new TextRun({ text: 'Phone: ', bold: true, size: 20, color: '0F243E' }),
          new TextRun({ text: '+91-9910760600 || Email: contact@scrapdms.com || ', size: 20, color: '0F243E' }),
          new TextRun({ text: 'GSTN:', bold: true, size: 20, color: '0F243E' }),
          new TextRun({ text: ` ${invoiceData.supplierGstin || '06AANHD7145Q1ZN'}`, size: 20, color: '0F243E' })
        ]
      })
    ]
  });

  const bodyElements = [
    // Top Header Band: GSTN (Left) | ScrapDMS + TAX INVOICE (Center) | Logo (Right, unstretched 1.501:1)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 38, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.TOP,
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 0 },
                  children: [
                    new TextRun({ text: 'GSTN: ', bold: true, size: 19, color: '0F243E' }),
                    new TextRun({ text: invoiceData.supplierGstin || '06AANHD7145Q1ZN', size: 19, color: '0F243E' })
                  ]
                }),
                new Paragraph({
                  spacing: { before: 40, after: 0 },
                  children: [
                    new TextRun({ text: 'Udyam: ', bold: true, size: 19, color: '0F243E' }),
                    new TextRun({
                      text: (invoiceData.supplierUdyam || 'UDYAM-HR-05-0154507').replace(/-/g, '\u2011'),
                      size: 19,
                      color: '0F243E'
                    })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 36, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 20 },
                  children: [
                    new TextRun({
                      text: 'ScrapDMS',
                      bold: true,
                      size: 52, // 26pt
                      color: '548DD4'
                    })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: 'TAX INVOICE',
                      bold: true,
                      size: 34, // 17pt
                      color: '17365D'
                    })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 26, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.TOP,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 0, after: 0 },
                  children: assets.headerLogoBytes
                    ? [
                        new ImageRun({
                          data: assets.headerLogoBytes,
                          transformation: { width: 84, height: 56 } // Exact 1.500:1 ratio (581x387)
                        })
                      ]
                    : [
                        new TextRun({ text: 'ScrapDMS', bold: true, size: 28, color: '548DD4' })
                      ]
                })
              ]
            })
          ]
        })
      ]
    }),

    new Paragraph({
      border: {
        bottom: {
          color: 'C6D9F1',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      },
      spacing: { before: 80, after: 120 }
    }),

    // Row 1: BILL TO (If client logo exists, two-column layout; otherwise clean paragraphs)
    ...(clientLogoBytes ? [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE }
                },
                children: [
                  new Paragraph({
                    spacing: { after: 60 },
                    children: [new TextRun({ text: 'BILL TO:', bold: true, size: 32, color: '4F81BD' })]
                  }),
                  new Paragraph({
                    spacing: { after: 30 },
                    children: [new TextRun({ text: `Customer Name: ${custNameStr}`, size: 22, color: '000000' })]
                  }),
                  new Paragraph({
                    spacing: { after: 30 },
                    children: [new TextRun({ text: `Customer GSTN: ${invoiceData.customerGstin || 'N/A'}`, size: 22, color: '000000' })]
                  }),
                  new Paragraph({
                    spacing: { after: 140 },
                    children: [new TextRun({ text: `Address: ${invoiceData.customerAddress || 'N/A'}`, size: 22, color: '000000' })]
                  })
                ]
              }),
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE }
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new ImageRun({
                        data: clientLogoBytes,
                        transformation: { width: 120, height: 48 }
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    ] : [
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: 'BILL TO:', bold: true, size: 32, color: '4F81BD' })]
      }),
      new Paragraph({
        spacing: { after: 30 },
        children: [
          new TextRun({ text: `Customer Name: ${custNameStr}`, size: 22, color: '000000' })
        ]
      }),
      new Paragraph({
        spacing: { after: 30 },
        children: [
          new TextRun({ text: `Customer GSTN: ${invoiceData.customerGstin || 'N/A'}`, size: 22, color: '000000' })
        ]
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({ text: `Address: ${invoiceData.customerAddress || 'N/A'}`, size: 22, color: '000000' })
        ]
      })
    ]),

    // Row 2: Invoice Details (Directly below BILL TO, blue heading #4F81BD)
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Invoice Details:', bold: true, size: 32, color: '4F81BD' })]
    }),
    new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: `Nature of Supply: ${invoiceData.natureOfSupply || ''}`, size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: `SAC Code: ${invoiceData.sacCode || ''}`, size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: `Invoice No: ${invoiceData.invoiceNo || ''}`, size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: `Invoice Date: ${invoiceData.invoiceDate || ''}`, size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: (invoiceData.poNumber || invoiceData.poDate) ? 30 : 180 },
      children: [new TextRun({ text: `Billing Period: ${invoiceData.billingPeriod || ''}`, size: 22, color: '000000' })]
    }),
    ...(invoiceData.poNumber && invoiceData.poNumber.trim() ? [
      new Paragraph({
        spacing: { after: (invoiceData.poDate && invoiceData.poDate.trim()) ? 30 : 180 },
        children: [new TextRun({ text: `PO Number: ${invoiceData.poNumber.trim()}`, size: 22, color: '000000' })]
      })
    ] : []),
    ...(invoiceData.poDate && invoiceData.poDate.trim() ? [
      new Paragraph({
        spacing: { after: 180 },
        children: [new TextRun({ text: `PO Date: ${invoiceData.poDate.trim()}`, size: 22, color: '000000' })]
      })
    ] : []),

    // Items Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: docxTableHeaders.map((title) =>
            new TableCell({
              shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: title, size: 20, color: '000000' })]
                })
              ]
            })
          )
        }),
        new TableRow({
          children: docxTableValues.map((val) =>
            new TableCell({
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: String(val), size: 20, color: '000000' })]
                })
              ]
            })
          )
        })
      ]
    }),

    // Currency note
    new Paragraph({
      spacing: { before: 80, after: 140 },
      children: [
        new TextRun({
          text: '*All prices and amounts are in Indian Rupees (₹)',
          size: 16,
          color: '000000'
        })
      ]
    }),

    // Amount in Words
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({ text: `Amount in Words: ${invoiceData.amountInWords || ''}`, size: 22, color: '000000' })
      ]
    }),

    // Payment Details (Blue Heading #548DD4)
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Payment Details:', bold: true, size: 28, color: '548DD4' })]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'Payment to be made to our company current account mentioned below :',
          bold: true,
          size: 24,
          color: '000000'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: `Bank Name: ${invoiceData.bankName || 'IDFC FIRST'}`, size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: `Account Name: ${invoiceData.accountName || 'SCRAPDMS'}`, size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: `Account No.: ${invoiceData.accountNo || '10252673565'}`, size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: `IFSC: ${invoiceData.ifsc || 'IDFB0020144'}`, size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: `Branch : ${invoiceData.branch || 'Gurgaon Rosewood City, sector 49 , Gurugram'}`, size: 22, color: '000000' })]
    }),

    // Note Section
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: 'Note:', size: 22, color: '000000' })]
    }),
    new Paragraph({
      spacing: { after: 20 },
      indent: { left: 360 },
      children: [
        new TextRun({
          text: '•  A detailed report of all generated trips can be downloaded from the web portal using your registered admin login.',
          size: 20,
          color: '000000'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 20 },
      indent: { left: 360 },
      children: [
        new TextRun({
          text: '•  On request, the same report can be shared via a separate email containing a secure download link.',
          size: 20,
          color: '000000'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 20 },
      indent: { left: 360 },
      children: [
        new TextRun({
          text: '•  All payments are due within 7 days from the date of invoice.',
          size: 20,
          color: '000000'
        })
      ]
    }),

    // 1-move this to above: Contact query right below Note section
    new Paragraph({
      spacing: { before: 80, after: 180 },
      children: [
        new TextRun({
          text: 'For any query, please contact support@scrapdms.com.',
          size: 20,
          color: '000000'
        })
      ]
    }),

    // Signatory Area:
    // 2-For Scrapdms to left side
    // 3-signed just above the For Scrapdms
    // 4-Stamp in middle and remove the background from stamp
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            // Left Column (35%): Signature on top, For ScrapDMS directly below
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.BOTTOM,
              children: [
                ...(assets.signatureBytes
                  ? [
                      new Paragraph({
                        spacing: { after: 80 },
                        children: [
                          new ImageRun({
                            data: assets.signatureBytes,
                            transformation: { width: 86, height: 33 } // 2.595:1 ratio
                          })
                        ]
                      })
                    ]
                  : []),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'For ScrapDMS',
                      size: 22,
                      color: '000000'
                    })
                  ]
                })
              ]
            }),

            // Middle Column (30%): Stamp centered horizontally
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    ...(assets.stampBytes
                      ? [
                          new ImageRun({
                            data: assets.stampBytes,
                            transformation: { width: 88, height: 88 } // 1:1 ratio
                          })
                        ]
                      : [])
                  ]
                })
              ]
            }),

            // Right Column (35%): Empty spacer to balance center alignment
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                new Paragraph({ children: [] })
              ]
            })
          ]
        })
      ]
    })
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 900, left: 1080, right: 1080, footer: 450 }
          }
        },
        footers: { default: docFooter },
        children: bodyElements
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanInvNo = (invoiceData.invoiceNo || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClient = (invoiceData.customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `Invoice_${cleanInvNo}_${cleanClient}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
