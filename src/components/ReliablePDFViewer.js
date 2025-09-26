import React, { useRef, useEffect, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const ReliablePDFViewer = React.forwardRef(({ 
  pdfBytes, 
  variables = {}, 
  currentPage = 1, 
  onPageChange,
  onVariablesDetected 
}, ref) => {
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [textItems, setTextItems] = useState([]);
  // Keep a SAFE, non-detached copy of the PDF bytes for export
  const safePdfBytesRef = useRef(null);

  console.log('ReliablePDFViewer: Rendered with:', {
    hasPdfBytes: !!pdfBytes,
    pdfBytesLength: pdfBytes?.byteLength || 0,
    pdfBytesType: typeof pdfBytes,
    variablesCount: Object.keys(variables).length
  });

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      console.log('ReliablePDFViewer: loadPDF called with:', {
        hasPdfBytes: !!pdfBytes,
        pdfBytesLength: pdfBytes?.byteLength || 0,
        pdfBytesType: typeof pdfBytes
      });
      
      if (!pdfBytes) {
        console.log('ReliablePDFViewer: No PDF bytes provided');
        return;
      }

      setIsLoading(true);
      try {
        // Handle different data types
        let pdfData = pdfBytes instanceof Uint8Array ? pdfBytes : (pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes) : null);
        if (!pdfData) {
          throw new Error('Unsupported pdfBytes type');
        }

        // Store a SAFE copy for export so worker transfer won't detach it
        safePdfBytesRef.current = pdfData.slice();

        console.log('ReliablePDFViewer: Processing PDF data:', {
          originalType: typeof pdfBytes,
          isUint8Array: pdfBytes instanceof Uint8Array,
          isArrayBuffer: pdfBytes instanceof ArrayBuffer,
          dataLength: pdfData?.byteLength || pdfData?.length || 0
        });
        // Pass a CLONE into pdf.js so the transferred buffer does not detach our safe copy
        const viewerBytes = new Uint8Array(pdfData);
        const pdfDoc = await pdfjs.getDocument({ data: viewerBytes }).promise;
        setPdfDocument(pdfDoc);
        setTotalPages(pdfDoc.numPages);

        // Extract variables from PDF text
        await extractVariablesFromPDF(pdfDoc);

        if (onPageChange) {
          onPageChange(1, pdfDoc.numPages);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [pdfBytes]);

  // Extract variables from PDF text
  const extractVariablesFromPDF = async (pdfDoc) => {
    const detectedVariables = {};
    
    try {
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        
        // Find all bracketed placeholders
        const matches = pageText.match(/\[([^\]]+)\]/g);
        if (matches) {
          matches.forEach(match => {
            const varName = match.slice(1, -1).trim();
            if (varName) {
              detectedVariables[varName] = '';
            }
          });
        }
      }

      console.log('Detected variables from PDF:', detectedVariables);
      
      if (onVariablesDetected && Object.keys(detectedVariables).length > 0) {
        onVariablesDetected(detectedVariables);
      }
    } catch (error) {
      console.error('Error extracting variables:', error);
    }
  };

  // Render PDF page with text replacement
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDocument || !canvasRef.current) return;

      try {
        const page = await pdfDocument.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;

        // Render original PDF first
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;

        // Get text content for replacement
        const textContent = await page.getTextContent();
        setTextItems(textContent.items);

        // Apply text replacements using a much simpler approach
        await applySimpleTextReplacements(context, textContent, viewport);

      } catch (error) {
        console.error('Error rendering page:', error);
      }
    };

    renderPage();
  }, [pdfDocument, currentPage, variables]);

  // Simple text replacement approach
  const applySimpleTextReplacements = async (context, textContent, viewport, options = {}) => {
    console.log('Applying precise text replacements for placeholder tokens...');
    const eraseMode = options.eraseMode || 'white'; // 'white' or 'destination-out'
    const useDestOut = eraseMode === 'destination-out';

    // Ensure predictable transform state
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);

    const placeholderRegex = /\[([^\]]+)\]/g;

    textContent.items.forEach((item) => {
      const fullText = item?.str || '';
      if (!fullText) return;

      // Collect matches in this run
      let foundAny = false;

      placeholderRegex.lastIndex = 0;
      const matches = [...fullText.matchAll(placeholderRegex)];
      if (matches.length === 0) return;

      const validMatches = matches
        .map(m => ({ m, idx: m.index ?? fullText.indexOf(m[0]), field: (m[1] || '').trim() }))
        .filter(({ field }) => {
          const v = getVariableValue(field, variables);
          return v !== undefined && v !== null && String(v).trim() !== '';
        });
      if (validMatches.length === 0) return;
      foundAny = true;

      if (!foundAny) return;

      // Prepare drawing in the item's own transformed space
      const m = pdfjs.Util.transform(viewport.transform, item.transform);

      // Draw in item space at exact baseline
      context.save();
      context.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      // Flip Y because canvas coordinates increase downward while PDF text baseline increases upward
      context.transform(1, 0, 0, -1, 0, 0);

      // Use 1px font and let the transform scale it appropriately
      const fontFamily = getFontFamily(item.fontName);
      context.font = `1px ${fontFamily}`;
      context.textBaseline = 'alphabetic';

      // For each placeholder token, erase only that token area and draw the replacement
      validMatches.forEach(({ m, idx, field }) => {
        const before = fullText.slice(0, idx);
        const tokenStr = m[0];
        const value = String(getVariableValue(field, variables));
        const beforeW = context.measureText(before).width;
        const tokenMetrics = context.measureText(tokenStr);
        const tokenW = tokenMetrics.width;
        const ascent = tokenMetrics.actualBoundingBoxAscent || 0.8;
        const descent = tokenMetrics.actualBoundingBoxDescent || 0.2;
        const pad = 0.02;

        // Erase token region: either paint white or punch a transparent hole (destination-out)
        if (useDestOut) {
          const prev = context.globalCompositeOperation;
          context.globalCompositeOperation = 'destination-out';
          context.fillRect(beforeW - pad, -ascent - pad, tokenW + 2 * pad, (ascent + descent) + 2 * pad);
          context.globalCompositeOperation = prev;
        } else {
          context.fillStyle = '#ffffff';
          context.fillRect(beforeW - pad, -ascent - pad, tokenW + 2 * pad, (ascent + descent) + 2 * pad);
        }

        // Draw replacement at the exact token start
        context.fillStyle = '#000000';
        context.fillText(value, beforeW, 0);
      });

      context.restore();
      console.log('✅ Replaced tokens in run');
    });

    // Second pass: handle placeholders split across multiple items like "[", "Candidate Name", "]"
    const items = textContent.items;
    for (let i = 0; i < items.length; i++) {
      const text = items[i].str || '';
      let searchFrom = 0;
      while (true) {
        const openPos = text.indexOf('[', searchFrom);
        if (openPos === -1) break;

        const closeSame = text.indexOf(']', openPos + 1);
        if (closeSame !== -1) {
          // handled in pass 1 by redrawing run
          searchFrom = openPos + 1;
          continue;
        }

        // Accumulate segments until we find a closing bracket
        let acc = text.substring(openPos);
        const segs = [{ index: i, start: openPos, end: text.length }];
        let j = i + 1;
        let found = false;
        for (; j < items.length; j++) {
          const t = items[j].str || '';
          const endPos = t.indexOf(']');
          if (endPos !== -1) {
            segs.push({ index: j, start: 0, end: endPos + 1 });
            acc += t.substring(0, endPos + 1);
            found = true;
            break;
          } else {
            segs.push({ index: j, start: 0, end: t.length });
            acc += t;
          }
        }

        if (!found) break; // no closing bracket

        const fieldInside = acc.replace(/^\[/, '').replace(/\]$/, '').trim();
        const value = getVariableValue(fieldInside, variables);
        if (!value) {
          searchFrom = openPos + 1;
          continue;
        }

        // 1) Erase all contributing segments in their own item space
        segs.forEach(seg => {
          const itemSeg = items[seg.index];
          const mSeg = pdfjs.Util.transform(viewport.transform, itemSeg.transform);
          const before = (itemSeg.str || '').substring(0, seg.start);
          const part = (itemSeg.str || '').substring(seg.start, seg.end);

          const ctx = context;
          ctx.save();
          ctx.setTransform(mSeg[0], mSeg[1], mSeg[2], mSeg[3], mSeg[4], mSeg[5]);
          // Unflip Y to make baseline calculations easier
          ctx.transform(1, 0, 0, -1, 0, 0);
          ctx.font = `1px ${getFontFamily(itemSeg.fontName)}`;
          ctx.textBaseline = 'alphabetic';
          const beforeW = ctx.measureText(before).width;
          const partMetrics = ctx.measureText(part);
          const partW = partMetrics.width;
          const ascent = partMetrics.actualBoundingBoxAscent || 0.8;
          const descent = partMetrics.actualBoundingBoxDescent || 0.2;
          const pad = 0.02;
        if (useDestOut) {
          const prev = ctx.globalCompositeOperation;
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillRect(beforeW - pad, -ascent - pad, partW + 2 * pad, (ascent + descent) + 2 * pad);
          ctx.globalCompositeOperation = prev;
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(beforeW - pad, -ascent - pad, partW + 2 * pad, (ascent + descent) + 2 * pad);
        }
        ctx.restore();
      });

      // 2) Draw the replacement value at the starting segment baseline, offset by preceding chars
      const firstItem = items[i];
      const mStart = pdfjs.Util.transform(viewport.transform, firstItem.transform);
      context.save();
      context.setTransform(mStart[0], mStart[1], mStart[2], mStart[3], mStart[4], mStart[5]);
      context.transform(1, 0, 0, -1, 0, 0);
      context.font = `1px ${getFontFamily(firstItem.fontName)}`;
      context.textBaseline = 'alphabetic';
      const beforeStart = (firstItem.str || '').substring(0, openPos);
      const offset = context.measureText(beforeStart).width;
      context.fillStyle = '#000000';
      context.fillText(String(value), offset, 0);
      context.restore();

        searchFrom = openPos + 1;
        i = j; // skip processed items
      }
    }

    context.restore();
  };

  // Map PDF font names to web-safe fonts
  const getFontFamily = (pdfFontName) => {
    const map = {
      'Times': 'Times, serif',
      'TimesRoman': 'Times, serif',
      'Times-Roman': 'Times, serif',
      'Times-Bold': 'Times, serif',
      'Times-Italic': 'Times, serif',
      'Helvetica': 'Arial, sans-serif',
      'Helvetica-Bold': 'Arial, sans-serif',
      'Helvetica-Oblique': 'Arial, sans-serif',
      'Arial': 'Arial, sans-serif',
      'Arial-Bold': 'Arial, sans-serif',
      'Courier': 'Courier New, monospace'
    };
    if (!pdfFontName) return 'Arial, sans-serif';
    for (const k of Object.keys(map)) {
      if (pdfFontName.includes(k)) return map[k];
    }
    return 'Arial, sans-serif';
  };

  // Flexible variable lookup to match different naming styles
  const getVariableValue = (field, vars) => {
    if (!vars) return '';
    // Direct exact hit first
    if (vars[field] !== undefined && vars[field] !== null && String(vars[field]).length > 0) return vars[field];

    const keys = Object.keys(vars);
    const norm = (s) => String(s).replace(/[\s_\-\/\\]/g, '').toLowerCase();
    const fieldNorm = norm(field);

    // Case-insensitive or normalized equality
    let key = keys.find(k => k.toLowerCase() === field.toLowerCase());
    if (!key) key = keys.find(k => norm(k) === fieldNorm);

    // Try underscore/uppercase variant including slashes
    if (!key) {
      const alt = field.replace(/[\s\/\-]+/g, '_').toUpperCase();
      key = keys.find(k => k.toUpperCase() === alt);
    }

    // Synonyms mapping for common field names in PDFs
    if (!key) {
      const synonyms = {
        'Proposed Start Date': ['Start Date', 'PROPOSED_START_DATE', 'START_DATE', 'ProposedStartDate', 'StartDate'],
        'Client/Customer Name': ['Client Customer Name', 'CLIENT/CUSTOMER NAME', 'CLIENT_CUSTOMER_NAME', 'Client Name', 'CLIENT_NAME', 'Customer Name', 'CUSTOMER_NAME'],
        'Job Title': ['JOB_TITLE', 'JobTitle'],
        'Candidate Name': ['CANDIDATE_NAME', 'CandidateName']
      };
      const candidates = [field, ...(synonyms[field] || [])];
      for (const cand of candidates) {
        const cx = keys.find(k => k.toLowerCase() === cand.toLowerCase());
        if (cx) { key = cx; break; }
        const cn = keys.find(k => norm(k) === norm(cand));
        if (cn) { key = cn; break; }
        const cu = keys.find(k => k.toUpperCase() === cand.replace(/[\s\/\-]+/g, '_').toUpperCase());
        if (cu) { key = cu; break; }
      }
    }

    return key ? vars[key] : '';
  };

  // Export PDF with variables: write replacements directly into a new PDF using pdf-lib
  const exportPDF = async () => {
    if (!pdfBytes) throw new Error('No PDF loaded');
    if (!pdfDocument) throw new Error('PDF not initialized');

    try {
      // Prefer the safe, non-detached copy
      const baseBytes = safePdfBytesRef.current || (pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes));

      // Validate header before loading
      const bytesUA = baseBytes instanceof Uint8Array ? baseBytes : new Uint8Array(baseBytes);
      const hdr = String.fromCharCode(...bytesUA.subarray(0, 4));
      if (!hdr.startsWith('%PDF')) {
        console.warn('exportPDF: baseBytes missing %PDF header, returning original bytes');
        return baseBytes;
      }

      // Rasterized, pixel-perfect export: render each page with pdf.js and overlays,
      // then embed as PNG into a fresh PDF to preserve exact visual layout.
      const srcDoc = await PDFDocument.load(bytesUA);
      const outDoc = await PDFDocument.create();
      const srcPages = srcDoc.getPages();
      const numPages = srcPages.length;

      const rasterScale = 3.0; // Higher DPI for extra crisp text

      const dataURLToUint8 = (dataURL) => {
        const base64 = dataURL.split(',')[1];
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
      };

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const srcPage = srcPages[pageNum - 1];
        const { width: pageW, height: pageH } = srcPage.getSize();

        const jsPage = await pdfDocument.getPage(pageNum);
        const viewport = jsPage.getViewport({ scale: rasterScale });

        const offscreen = document.createElement('canvas');
        offscreen.width = viewport.width;
        offscreen.height = viewport.height;
        const ctx = offscreen.getContext('2d');

        await jsPage.render({ canvasContext: ctx, viewport }).promise;

        const textContent = await jsPage.getTextContent();
        await applySimpleTextReplacements(ctx, textContent, viewport, { eraseMode: 'destination-out' });

        const pngBytes = dataURLToUint8(offscreen.toDataURL('image/png'));
        const pngImage = await outDoc.embedPng(pngBytes);
        const outPage = outDoc.addPage([pageW, pageH]);
        outPage.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: pageW,
          height: pageH
        });
      }

      const out = await outDoc.save();
      if (!out || out.length === 0) throw new Error('PDF generation produced empty output');
      return out;
    } catch (e) {
      console.error('exportPDF error, returning original PDF bytes:', e);
      const fallback = safePdfBytesRef.current || (pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes));
      return fallback;
    }
  };

  // Expose export function to parent
  React.useImperativeHandle(ref, () => ({
    exportPDF
  }), [pdfBytes, variables]);

  if (isLoading) {
    return (
      <div className="pdf-loading">
        <div className="spinner"></div>
        <p>Loading PDF...</p>
      </div>
    );
  }

  if (!pdfDocument) {
    return (
      <div className="pdf-placeholder">
        <p>No PDF loaded</p>
      </div>
    );
  }

  return (
    <div className="reliable-pdf-viewer">
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          height: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      />

      {totalPages > 1 && (
        <div className="page-navigation" style={{ marginTop: '10px', textAlign: 'center' }}>
          <button
            onClick={() => onPageChange && onPageChange(Math.max(1, currentPage - 1), totalPages)}
            disabled={currentPage <= 1}
            className="btn btn-sm"
          >
            Previous
          </button>
          <span className="page-info" style={{ margin: '0 10px' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange && onPageChange(Math.min(totalPages, currentPage + 1), totalPages)}
            disabled={currentPage >= totalPages}
            className="btn btn-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
});

export default ReliablePDFViewer;
