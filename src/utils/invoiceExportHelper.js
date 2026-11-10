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
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType
} from 'docx';
import { loadInvoiceAssets, dataUrlToUint8Array } from './invoiceAssets';
import { formatIndianCurrency } from './numberToWords';

/**
 * Generates and downloads the Invoice as a high-quality PDF
 */
export async function exportInvoiceToPdf(invoiceData) {
  const assets = await loadInvoiceAssets();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const leftMargin = 40;
  const rightMargin = 40;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 515.28 pt

  let curY = 38;

  // 1. Top Header Row: Supplier GSTN on left, ScrapDMS Logo on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`GSTN: ${invoiceData.supplierGstin || '06AANHD7145Q1ZN'}`, leftMargin, curY + 16);

  if (assets.headerLogoDataUrl) {
    try {
      doc.addImage(assets.headerLogoDataUrl, 'JPEG', pageWidth - rightMargin - 120, curY - 5, 120, 36);
    } catch (e) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(2, 132, 199);
      doc.text('ScrapDMS', pageWidth - rightMargin, curY + 16, { align: 'right' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(2, 132, 199);
    doc.text('ScrapDMS', pageWidth - rightMargin, curY + 16, { align: 'right' });
  }

  curY += 46;

  // Horizontal divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(leftMargin, curY, pageWidth - rightMargin, curY);

  curY += 24;

  // 2. Title: TAX INVOICE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('TAX INVOICE', pageWidth / 2, curY, { align: 'center' });

  curY += 26;

  // 3. Side-by-Side Cards: BILL TO (Left) & Invoice Details (Right)
  const colWidth = (contentWidth - 16) / 2;
  const rightColX = leftMargin + colWidth + 16;
  const boxStartY = curY;

  // --- Left: BILL TO ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('BILL TO :', leftMargin, curY);
  curY += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Customer Name: ', leftMargin, curY);
  const cNameWidth = doc.getTextWidth('Customer Name: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const custNameStr = invoiceData.customerName.startsWith('M/s') ? invoiceData.customerName : `M/s ${invoiceData.customerName}`;
  const splitCustName = doc.splitTextToSize(custNameStr, colWidth - cNameWidth);
  doc.text(splitCustName, leftMargin + cNameWidth, curY);
  curY += splitCustName.length * 12 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Customer GSTN: ', leftMargin, curY);
  const cGstnWidth = doc.getTextWidth('Customer GSTN: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(invoiceData.customerGstin || 'N/A', leftMargin + cGstnWidth, curY);
  curY += 16;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Address: ', leftMargin, curY);
  const cAddrWidth = doc.getTextWidth('Address: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const splitAddress = doc.splitTextToSize(invoiceData.customerAddress || 'N/A', colWidth - cAddrWidth);
  doc.text(splitAddress, leftMargin + cAddrWidth, curY);
  const leftEndY = curY + splitAddress.length * 11;

  // --- Right: Invoice Details ---
  let rY = boxStartY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Invoice Details:', rightColX, rY);
  rY += 15;

  const renderDetailRow = (label, val) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(label, rightColX, rY);
    const lWidth = doc.getTextWidth(label);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(String(val || ''), rightColX + lWidth, rY);
    rY += 15;
  };

  renderDetailRow('Nature of Supply: ', invoiceData.natureOfSupply);
  renderDetailRow('SAC Code: ', invoiceData.sacCode);
  renderDetailRow('Invoice No: ', invoiceData.invoiceNo);
  renderDetailRow('Invoice Date: ', invoiceData.invoiceDate);
  renderDetailRow('Billing Period: ', invoiceData.billingPeriod);

  curY = Math.max(leftEndY, rY) + 18;

  // 4. Line Items Table
  const isInterState = invoiceData.isInterState;
  const taxHeader = isInterState ? `IGST ${invoiceData.igstRate}%` : `GST 18%`;

  const tableHeaders = ['Sr.', 'Description', 'Price', 'Discount', 'Final Rate', taxHeader, 'Total'];
  const tableRows = [
    [
      '1',
      invoiceData.itemDescription || 'ScrapDMS SaaS Platform Monthly Subscription',
      formatIndianCurrency(invoiceData.price),
      invoiceData.discountPercent ? `${invoiceData.discountPercent}%` : '0%',
      formatIndianCurrency(invoiceData.finalRate),
      formatIndianCurrency(invoiceData.taxAmount),
      formatIndianCurrency(invoiceData.totalAmount)
    ]
  ];

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: curY,
    margin: { left: leftMargin, right: rightMargin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 7,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.75,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.75
    },
    columnStyles: {
      0: { cellWidth: 35, halign: 'center' },
      1: { cellWidth: 195 },
      2: { cellWidth: 55, halign: 'right' },
      3: { cellWidth: 55, halign: 'center' },
      4: { cellWidth: 58, halign: 'right' },
      5: { cellWidth: 55, halign: 'right' },
      6: { cellWidth: 62, halign: 'right', fontStyle: 'bold' }
    }
  });

  curY = doc.lastAutoTable.finalY + 12;

  // 5. Currency Note & Amount in Words
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('*All prices and amounts are in Indian Rupees (₹)', leftMargin, curY);

  curY += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Amount in Words: ', leftMargin, curY);
  const wordsPrefixW = doc.getTextWidth('Amount in Words: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(invoiceData.amountInWords || '', leftMargin + wordsPrefixW, curY);

  curY += 22;

  // 6. Payment Details Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Payment Details :', leftMargin, curY);

  curY += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Payment to be made to our company current account mentioned below :', leftMargin, curY);

  curY += 14;
  const bankDetailsStr = `Bank Name: ${invoiceData.bankName || 'IDFC FIRST'}    Account Name: ${invoiceData.accountName || 'SCRAPDMS'}    Account No.: ${invoiceData.accountNo || '10252673565'}    IFSC: ${invoiceData.ifsc || 'IDFB0020144'}`;
  doc.text(bankDetailsStr, leftMargin, curY);

  curY += 13;
  doc.text(`Branch : ${invoiceData.branch || 'Gurgaon Rosewood City, sector 49 , Gurugram'}`, leftMargin, curY);

  curY += 20;

  // 7. Notes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Note:', leftMargin, curY);

  curY += 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('• A detailed report of all generated trips can be downloaded from the web portal using your registered admin login.', leftMargin, curY);
  curY += 11;
  doc.text('• On request, the same report can be shared via a separate email containing a secure download link.', leftMargin, curY);
  curY += 11;
  doc.text('• All payments are due within 7 days from the date of invoice.', leftMargin, curY);

  curY += 26;

  // 8. Signatory & Support Section
  const queryY = curY + 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('For any query, please contact support@scrapdms.com.', leftMargin, queryY);

  // Right Signatory Block: Stamp & Signature
  const stampWidth = 85;
  const stampHeight = 85;
  const stampX = pageWidth - rightMargin - 110;
  const stampY = curY - 10;

  if (assets.stampDataUrl) {
    try {
      doc.addImage(assets.stampDataUrl, 'PNG', stampX, stampY, stampWidth, stampHeight);
    } catch (e) {
      console.warn('Could not draw stamp:', e);
    }
  }

  // Draw signature over/beside stamp authentically as in docx
  if (assets.signatureDataUrl) {
    try {
      doc.addImage(assets.signatureDataUrl, 'JPEG', stampX + 5, stampY + 28, 85, 32);
    } catch (e) {
      console.warn('Could not draw signature:', e);
    }
  }

  // For ScrapDMS label below stamp
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('For ScrapDMS', stampX + 15, stampY + stampHeight + 12);

  // File download name
  const cleanInvNo = (invoiceData.invoiceNo || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClient = (invoiceData.customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Invoice_${cleanInvNo}_${cleanClient}.pdf`;
  doc.save(fileName);
}

/**
 * Generates and downloads the Invoice as an editable Microsoft Word DOCX file
 */
export async function exportInvoiceToDocx(invoiceData) {
  const assets = await loadInvoiceAssets();

  const isInterState = invoiceData.isInterState;
  const taxHeader = isInterState ? `IGST ${invoiceData.igstRate}%` : `GST 18%`;

  // Header Table / Paragraph
  const headerChildren = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: 'E2E8F0' },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `GSTN: ${invoiceData.supplierGstin || '06AANHD7145Q1ZN'}`,
                      bold: true,
                      size: 20,
                      color: '1E293B'
                    })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: assets.headerLogoBytes
                    ? [
                        new ImageRun({
                          data: assets.headerLogoBytes,
                          transformation: { width: 130, height: 40 }
                        })
                      ]
                    : [
                        new TextRun({
                          text: 'ScrapDMS',
                          bold: true,
                          size: 26,
                          color: '0284C7'
                        })
                      ]
                })
              ]
            })
          ]
        })
      ]
    })
  ];

  // Document Body Paragraphs
  const bodyElements = [
    // Spacing
    new Paragraph({ spacing: { before: 200, after: 120 } }),

    // Title: TAX INVOICE
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 260 },
      children: [
        new TextRun({
          text: 'TAX INVOICE',
          bold: true,
          size: 28,
          color: '0F172A'
        })
      ]
    }),

    // Bill To & Invoice Details Table (Side-by-side)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
      },
      rows: [
        new TableRow({
          children: [
            // Left: BILL TO
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              margins: { right: 140 },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: 'BILL TO :', bold: true, size: 21, color: '0F172A' })]
                }),
                new Paragraph({
                  spacing: { after: 50 },
                  children: [
                    new TextRun({ text: 'Customer Name: ', bold: true, size: 19, color: '0F172A' }),
                    new TextRun({ text: invoiceData.customerName, size: 19, color: '334155' })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 50 },
                  children: [
                    new TextRun({ text: 'Customer GSTN: ', bold: true, size: 19, color: '0F172A' }),
                    new TextRun({ text: invoiceData.customerGstin || 'N/A', size: 19, color: '334155' })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun({ text: 'Address: ', bold: true, size: 19, color: '0F172A' }),
                    new TextRun({ text: invoiceData.customerAddress || 'N/A', size: 18, color: '475569' })
                  ]
                })
              ]
            }),
            // Right: Invoice Details
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: 'Invoice Details:', bold: true, size: 21, color: '0F172A' })]
                }),
                new Paragraph({
                  spacing: { after: 50 },
                  children: [
                    new TextRun({ text: 'Nature of Supply: ', bold: true, size: 19, color: '0F172A' }),
                    new TextRun({ text: invoiceData.natureOfSupply, size: 19, color: '334155' })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 50 },
                  children: [
                    new TextRun({ text: 'SAC Code: ', bold: true, size: 19, color: '0F172A' }),
                    new TextRun({ text: invoiceData.sacCode, size: 19, color: '334155' })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 50 },
                  children: [
                    new TextRun({ text: 'Invoice No: ', bold: true, size: 19, color: '0F172A' }),
                    new TextRun({ text: invoiceData.invoiceNo, size: 19, color: '334155' })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 50 },
                  children: [
                    new TextRun({ text: 'Invoice Date: ', bold: true, size: 19, color: '0F172A' }),
                    new TextRun({ text: invoiceData.invoiceDate, size: 19, color: '334155' })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun({ text: 'Billing Period: ', bold: true, size: 19, color: '0F172A' }),
                    new TextRun({ text: invoiceData.billingPeriod, size: 19, color: '334155' })
                  ]
                })
              ]
            })
          ]
        })
      ]
    }),

    new Paragraph({ spacing: { after: 160 } }),

    // Items Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // Header
        new TableRow({
          tableHeader: true,
          children: [
            'Sr.',
            'Description',
            'Price',
            'Discount',
            'Final Rate',
            taxHeader,
            'Total'
          ].map((title, i) =>
            new TableCell({
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 120, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: i === 0 || i === 3 ? AlignmentType.CENTER : i >= 2 ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  children: [new TextRun({ text: title, bold: true, size: 18, color: '0F172A' })]
                })
              ]
            })
          )
        }),
        // Data Row
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 140, bottom: 140, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '1', size: 18 })] })]
            }),
            new TableCell({
              margins: { top: 140, bottom: 140, left: 80, right: 80 },
              children: [new Paragraph({ children: [new TextRun({ text: invoiceData.itemDescription, size: 18, bold: true })] })]
            }),
            new TableCell({
              margins: { top: 140, bottom: 140, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIndianCurrency(invoiceData.price), size: 18 })] })]
            }),
            new TableCell({
              margins: { top: 140, bottom: 140, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: invoiceData.discountPercent ? `${invoiceData.discountPercent}%` : '0%', size: 18 })] })]
            }),
            new TableCell({
              margins: { top: 140, bottom: 140, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIndianCurrency(invoiceData.finalRate), size: 18 })] })]
            }),
            new TableCell({
              margins: { top: 140, bottom: 140, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIndianCurrency(invoiceData.taxAmount), size: 18 })] })]
            }),
            new TableCell({
              margins: { top: 140, bottom: 140, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIndianCurrency(invoiceData.totalAmount), size: 18, bold: true })] })]
            })
          ]
        })
      ]
    }),

    // Currency note
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: '*All prices and amounts are in Indian Rupees (₹)',
          italics: true,
          size: 17,
          color: '64748B'
        })
      ]
    }),

    // Amount in Words
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({ text: 'Amount in Words: ', bold: true, size: 19, color: '0F172A' }),
        new TextRun({ text: invoiceData.amountInWords || '', size: 19, color: '1E293B' })
      ]
    }),

    // Payment Details Box
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Payment Details :', bold: true, size: 20, color: '0F172A' })]
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'Payment to be made to our company current account mentioned below :',
          size: 18,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: `Bank Name: ${invoiceData.bankName || 'IDFC FIRST'}    Account Name: ${invoiceData.accountName || 'SCRAPDMS'}    Account No.: ${invoiceData.accountNo || '10252673565'}    IFSC: ${invoiceData.ifsc || 'IDFB0020144'}`,
          size: 18,
          color: '1E293B'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: `Branch : ${invoiceData.branch || 'Gurgaon Rosewood City, sector 49 , Gurugram'}`,
          size: 18,
          color: '475569'
        })
      ]
    }),

    // Note Section
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Note:', bold: true, size: 19, color: '0F172A' })]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: '• A detailed report of all generated trips can be downloaded from the web portal using your registered admin login.',
          size: 17,
          color: '475569'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: '• On request, the same report can be shared via a separate email containing a secure download link.',
          size: 17,
          color: '475569'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: '• All payments are due within 7 days from the date of invoice.',
          size: 17,
          color: '475569'
        })
      ]
    }),

    // Signatory and Support Contact Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
      },
      rows: [
        new TableRow({
          children: [
            // Left query contact
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              verticalAlign: 'bottom',
              children: [
                new Paragraph({
                  spacing: { before: 100 },
                  children: [
                    new TextRun({
                      text: 'For any query, please contact support@scrapdms.com.',
                      size: 18,
                      color: '475569'
                    })
                  ]
                })
              ]
            }),
            // Right Stamp & Signature
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    ...(assets.stampBytes
                      ? [
                          new ImageRun({
                            data: assets.stampBytes,
                            transformation: { width: 95, height: 95 }
                          })
                        ]
                      : []),
                    ...(assets.signatureBytes
                      ? [
                          new ImageRun({
                            data: assets.signatureBytes,
                            transformation: { width: 85, height: 32 }
                          })
                        ]
                      : [])
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 60 },
                  children: [
                    new TextRun({
                      text: 'For ScrapDMS',
                      bold: true,
                      size: 19,
                      color: '0F172A'
                    })
                  ]
                })
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
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: [...headerChildren, ...bodyElements]
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
