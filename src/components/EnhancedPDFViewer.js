import React, { useRef, useEffect, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Configure PDF.js worker - use a more reliable approach
try {
  // Try to disable worker entirely - this often resolves loading issues
  console.log('EnhancedPDFViewer: Attempting to disable PDF.js worker...');
  pdfjs.GlobalWorkerOptions.workerSrc = undefined;
  pdfjs.GlobalWorkerOptions.disableWorker = true;

  console.log('EnhancedPDFViewer: Worker disabled successfully');
} catch (error) {
  console.error('EnhancedPDFViewer: Failed to disable worker:', error);
  try {
    // Fallback: try a specific CDN version
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    console.log('EnhancedPDFViewer: Using CDN worker as fallback');
  } catch (error2) {
    console.error('EnhancedPDFViewer: All worker configuration attempts failed:', error2);
  }
}

const EnhancedPDFViewer = React.forwardRef(({ 
  pdfBytes, 
  variables = {}, 
  currentPage = 1, 
  onPageChange,
  onVariablesDetected 
}, ref) => {
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [variablePositions, setVariablePositions] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Debug props
  console.log('EnhancedPDFViewer: Component rendered with props', {
    hasPdfBytes: !!pdfBytes,
    pdfBytesLength: pdfBytes?.byteLength || 0,
    variablesCount: Object.keys(variables).length,
    currentPage
  });

  // Load PDF and extract structure
  useEffect(() => {
    const loadPDF = async () => {
      console.log('EnhancedPDFViewer: loadPDF called', {
        hasPdfBytes: !!pdfBytes,
        pdfBytesLength: pdfBytes?.byteLength || 0
      });
      // Note: Placeholder spanning logic is handled inside customTextReplacement()

      if (!pdfBytes) {
        console.log('EnhancedPDFViewer: No PDF bytes provided');
        return;
      }

      // Normalize input into Uint8Array for safe cloning
      let pdfByteArray = null;
      if (pdfBytes instanceof Uint8Array) {
        pdfByteArray = pdfBytes;
      } else if (pdfBytes instanceof ArrayBuffer) {
        pdfByteArray = new Uint8Array(pdfBytes);
      } else {
        console.error('EnhancedPDFViewer: Unsupported pdfBytes type:', typeof pdfBytes);
        return;
      }

      if (pdfByteArray.byteLength === 0) {
        console.error('EnhancedPDFViewer: Empty ArrayBuffer - might be detached');
        return;
      }

      // Check PDF signature
      try {
        const signatureBytes = pdfByteArray.subarray(0, 4);
        const firstBytes = new Uint8Array(signatureBytes);
        const signature = String.fromCharCode(...firstBytes);
        console.log('EnhancedPDFViewer: PDF signature check:', signature);

        if (!signature.startsWith('%PDF')) {
          console.error('EnhancedPDFViewer: Invalid PDF signature:', signature);
          return;
        }
      } catch (error) {
        console.error('EnhancedPDFViewer: Error checking PDF signature:', error);
        return;
      }

      setIsLoading(true);
      try {
        console.log('EnhancedPDFViewer: Loading PDF with pdfjs...');
        console.log('EnhancedPDFViewer: Current worker src:', pdfjs.GlobalWorkerOptions.workerSrc);

        // Clone byte array to avoid buffer detachment when pdf.js transfers ownership
        const pdfDataClone = pdfByteArray.slice();
        const pdfDoc = await pdfjs.getDocument({ data: pdfDataClone }).promise;
        console.log('EnhancedPDFViewer: PDF loaded successfully', {
          numPages: pdfDoc.numPages
        });

        setPdfDocument(pdfDoc);
        setTotalPages(pdfDoc.numPages);

        // Extract variables from all pages
        await extractVariablesFromAllPages(pdfDoc);

        if (onPageChange) {
          onPageChange(1, pdfDoc.numPages);
        }
      } catch (error) {
        console.error('EnhancedPDFViewer: Error loading PDF:', error);
        console.error('EnhancedPDFViewer: Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });

        // Try without worker as fallback
        if (error.message.includes('worker') || error.message.includes('Failed to load resource')) {
          console.log('EnhancedPDFViewer: Trying without worker...');
          const originalWorkerSrc = pdfjs.GlobalWorkerOptions.workerSrc;
          try {
            // Disable worker
            pdfjs.GlobalWorkerOptions.workerSrc = undefined;

            const fallbackClone = pdfByteArray.slice();
            const pdfDoc = await pdfjs.getDocument({ data: fallbackClone, disableWorker: true }).promise;
            console.log('EnhancedPDFViewer: PDF loaded without worker successfully', {
              numPages: pdfDoc.numPages
            });

            setPdfDocument(pdfDoc);
            setTotalPages(pdfDoc.numPages);

            // Extract variables from all pages
            await extractVariablesFromAllPages(pdfDoc);

            if (onPageChange) {
              onPageChange(1, pdfDoc.numPages);
            }

            // Restore worker setting
            pdfjs.GlobalWorkerOptions.workerSrc = originalWorkerSrc;
          } catch (fallbackError) {
            console.error('EnhancedPDFViewer: Fallback also failed:', fallbackError);
            // Restore worker setting
            pdfjs.GlobalWorkerOptions.workerSrc = originalWorkerSrc;
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [pdfBytes]);

  // Extract variables using NLP service for precise positioning
  const extractVariablesFromAllPages = async (pdfDoc) => {
    const allVariables = {};
    const allPositions = new Map();

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.5 });
        
        // Extract full page text for NLP processing
        const pageText = textContent.items.map(item => item.str).join(' ');
        console.log(`Page ${pageNum} text:`, pageText);
        
        // Use NLP service to find entities with precise positions
        const nlpResponse = await fetch('http://127.0.0.1:5000/api/extract-entities-with-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pageText })
        });
        
        if (!nlpResponse.ok) {
          throw new Error(`NLP service error: ${nlpResponse.status}`);
        }
        
        const nlpResult = await nlpResponse.json();
        console.log(`🤖 NLP detected entities on page ${pageNum}:`, nlpResult);
        
        const pagePositions = [];
        
        // Map NLP entities to PDF coordinates
        if (nlpResult.data && nlpResult.data.entities) {
          nlpResult.data.entities.forEach(entity => {
            // Find the text item that contains this entity
            let charOffset = 0;
            let foundItem = null;
            let itemIndex = -1;
            
            for (let i = 0; i < textContent.items.length; i++) {
              const item = textContent.items[i];
              const itemText = item.str;
              const itemStart = charOffset;
              const itemEnd = charOffset + itemText.length;
              
              // Check if entity falls within this text item
              if (entity.start_char >= itemStart && entity.start_char < itemEnd) {
                foundItem = item;
                itemIndex = i;
                break;
              }
              
              charOffset += itemText.length + 1; // +1 for space between items
            }
            
            if (foundItem) {
              const transform = foundItem.transform;
              const x = transform[4];
              const y = transform[5];
              const fontSize = Math.abs(transform[0]);
              
              // Calculate position within the text item
              const localOffset = entity.start_char - charOffset + foundItem.str.length;
              const charWidth = fontSize * 0.6;
              const entityX = x + (localOffset * charWidth);
              
              // Create clean variable name from entity label
              const variableName = entity.label.replace(/[^A-Z_]/g, '');
              
              // Store variable with empty string as default value
              allVariables[variableName] = '';
              
              console.log(`🎯 NLP found entity: "${entity.text}" → ${variableName} at (${entityX}, ${y})`);
              
              pagePositions.push({
                variableName,
                originalText: foundItem.str,
                variablePattern: entity.text,
                fieldText: entity.text,
                x: entityX,
                y: y,
                fontSize,
                fontName: foundItem.fontName || 'Arial',
                width: entity.text.length * charWidth,
                height: fontSize,
                textItemIndex: itemIndex,
                entityLabel: entity.label,
                startChar: entity.start_char,
                endChar: entity.end_char
              });
            }
          });
        }
        
        allPositions.set(pageNum, pagePositions);
        console.log(`Page ${pageNum}: NLP found ${pagePositions.length} editable fields`);
      } catch (error) {
        console.error(`Error extracting variables from page ${pageNum}:`, error);
        // Fallback to manual detection if NLP fails
        console.log('Falling back to manual bracket detection...');
        // Add fallback logic here if needed
      }
    }

    setVariablePositions(allPositions);
    
    console.log('🔍 NLP detected variables:', allVariables);
    console.log('🔍 Variable positions:', allPositions);
    
    // Notify parent component about detected variables
    if (onVariablesDetected && Object.keys(allVariables).length > 0) {
      console.log('📤 Sending detected variables to parent:', allVariables);
      onVariablesDetected(allVariables);
    }
  };

  // Helper function to find variable value for a field
  const findVariableForField = (fieldText, variables) => {
    // Try direct match first
    if (variables[fieldText]) return variables[fieldText];
    
    // Try common mappings
    const fieldMappings = {
      'Candidate Name': 'CANDIDATE_NAME',
      'Job Title': 'JOB_TITLE', 
      'Company Name': 'COMPANY_NAME',
      'Address': 'ADDRESS',
      'Amount': 'SALARY_AMOUNT',
      'Start Date': 'START_DATE',
      'Proposed Start Date': 'START_DATE'
    };
    
    const mappedKey = fieldMappings[fieldText];
    if (mappedKey && variables[mappedKey]) return variables[mappedKey];
    
    // Try case-insensitive search
    const keys = Object.keys(variables);
    const match = keys.find(key => 
      key.toLowerCase() === fieldText.toLowerCase() ||
      key.toLowerCase().replace(/_/g, ' ') === fieldText.toLowerCase()
    );
    
    return match ? variables[match] : null;
  };

  // Helper function to validate values
  const hasValidValue = (value) => {
    return value !== null && 
           value !== undefined && 
           value !== '' && 
           !String(value).startsWith('[') && 
           String(value).trim().length > 0;
  };

  // Custom regex-based text replacement with precise positioning
  const customTextReplacement = async (page, context, viewport, variables) => {
    console.log('🔧 customTextReplacement called with:');
    console.log('  - variables:', variables);
    console.log('  - variables type:', typeof variables);
    console.log('  - variables keys:', Object.keys(variables || {}));
    
    try {
      const textContent = await page.getTextContent();
      console.log('📄 Got text content with', textContent.items.length, 'items');
      
      // Define regex patterns for common placeholders
      const placeholderPatterns = [
        { regex: /\[Candidate\s*Name\]/gi, variable: 'Candidate Name' },
        { regex: /\[Job\s*Title\]/gi, variable: 'Job Title' },
        { regex: /\[Company\s*Name\]/gi, variable: 'Company Name' },
        { regex: /\[Address\]/gi, variable: 'Address' },
        { regex: /\[Department\]/gi, variable: 'Department' },
        { regex: /\[Start\s*Date\]/gi, variable: 'Start Date' },
        { regex: /\[Proposed\s*Start\s*Date\]/gi, variable: 'Start Date' },
        { regex: /\[Amount\]/gi, variable: 'Amount' },
        { regex: /\[Insert\s*Date\]/gi, variable: 'Insert Date' },
        { regex: /\[Client\s*Customer\s*Name\]/gi, variable: 'Company Name' },
        { regex: /\[Semi\s*Monthly\]/gi, variable: 'Period' },
        { regex: /\[Start\s*Time\]/gi, variable: 'Start Time' },
        { regex: /\[End\s*Time\]/gi, variable: 'End Time' },
        { regex: /\[Days\s*of\s*Week\]/gi, variable: 'Days of Week' }
      ];

      console.log('🔍 Starting custom regex replacement...');
      
      // Process each text item: draw only the placeholder spans (no full-line clearing)
      textContent.items.forEach((item, index) => {
        if (!item.str || !item.str.trim()) return;
        const originalText = item.str;
        let composedText = originalText; // final text after replacing placeholders (missing values removed)

        // Prepare drawing context in item space
        const m = pdfjs.Util.transform(viewport.transform, item.transform);
        context.save();
        context.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        context.transform(1, 0, 0, -1, 0, 0); // unflip Y
        const fontFamily = getFontFamily(item.fontName);
        context.font = `1px ${fontFamily}`;
        context.textBaseline = 'alphabetic';

        // For each known placeholder pattern, clear only that substring and draw replacement
        let foundAny = false;
        const baselineNudge = -0.005; // very small upward nudge
        const pad = 0.003; // minimal padding around glyphs

        placeholderPatterns.forEach(pattern => {
          pattern.regex.lastIndex = 0;
          const matches = [...originalText.matchAll(pattern.regex)];
          if (matches.length === 0) return;

          const value = findVariableForField(pattern.variable, variables);
          const hasValue = value && hasValidValue(value);

          // Build composed text: replace with value or remove entirely
          const replacement = hasValue ? String(value) : '';
          pattern.regex.lastIndex = 0;
          composedText = composedText.replace(pattern.regex, replacement);

          matches.forEach(() => {
            // Mark that this run has a placeholder; we will redraw the whole run once below.
            foundAny = true;
          });
        });

        context.restore();

        // If we touched any placeholder in this run, redraw the entire run once to avoid gaps
        if (foundAny && composedText !== originalText) {
          const m2 = pdfjs.Util.transform(viewport.transform, item.transform);
          const padAll = 0.002;
          const baselineNudgeAll = 0; // align exactly on baseline
          const fontFamily2 = getFontFamily(item.fontName);

          context.save();
          context.setTransform(m2[0], m2[1], m2[2], m2[3], m2[4], m2[5]);
          context.transform(1, 0, 0, -1, 0, 0);
          context.font = `1px ${fontFamily2}`;
          context.textBaseline = 'alphabetic';

          const origM = context.measureText(originalText);
          const compM = context.measureText(composedText);
          const width = Math.max(origM.width, compM.width);
          const ascent = compM.actualBoundingBoxAscent || 0.75;
          const descent = compM.actualBoundingBoxDescent || 0.05;
          // Erase original run using destination-out so background shows through (no white patch)
          const prevOp = context.globalCompositeOperation;
          context.globalCompositeOperation = 'destination-out';
          context.fillRect(-padAll, -ascent - padAll, width + 2*padAll, (ascent + descent) + 2*padAll);
          context.globalCompositeOperation = prevOp;
          context.fillStyle = '#000000';
          context.fillText(composedText, 0, baselineNudgeAll);
          context.restore();
        }

        if (!foundAny && (originalText.includes('[') || originalText.includes(']'))) {
          console.log(`⚠️ Unmatched bracketed text (spans multiple items?): "${originalText}"`);
        }
      });
      
      // Second pass: handle placeholders split across multiple items like "[", "Client/Customer", "Name]"
      const items = textContent.items;
      for (let i = 0; i < items.length; i++) {
        const text = items[i].str || '';
        let searchFrom = 0;
        while (true) {
          const openPos = text.indexOf('[', searchFrom);
          if (openPos === -1) break;

          // If closing bracket exists in same item, it was handled above
          const closeSame = text.indexOf(']', openPos + 1);
          if (closeSame !== -1) {
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
          const value = findVariableForField(fieldInside, variables);
          if (!value || !hasValidValue(value)) {
            searchFrom = openPos + 1;
            continue;
          }

          // Clear all contributing segments in their own item space
          segs.forEach(seg => {
            const itemSeg = items[seg.index];
            const mSeg = pdfjs.Util.transform(viewport.transform, itemSeg.transform);
            const fontFamily = getFontFamily(itemSeg.fontName);
            const before = (itemSeg.str || '').substring(0, seg.start);
            const part = (itemSeg.str || '').substring(seg.start, seg.end);

            const ctx = context;
            ctx.save();
            ctx.setTransform(mSeg[0], mSeg[1], mSeg[2], mSeg[3], mSeg[4], mSeg[5]);
            ctx.transform(1, 0, 0, -1, 0, 0); // unflip Y
            ctx.font = `1px ${fontFamily}`;
            ctx.textBaseline = 'alphabetic';
            const beforeW = ctx.measureText(before).width;
            const partMetrics = ctx.measureText(part);
            const partW = partMetrics.width;
            const ascent = partMetrics.actualBoundingBoxAscent || 0.75;
            const descent = partMetrics.actualBoundingBoxDescent || 0.05;
            const pad = 0.003;
            // Erase region so background shows through
            const prevOp = ctx.globalCompositeOperation;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillRect(beforeW - pad, -ascent - pad, partW + 2*pad, (ascent + descent) + 2*pad);
            ctx.globalCompositeOperation = prevOp;
            ctx.restore();
          });

          // Draw the replacement value at the starting segment baseline, offset by preceding chars
          const firstItem = items[i];
          const mStart = pdfjs.Util.transform(viewport.transform, firstItem.transform);
          context.save();
          context.setTransform(mStart[0], mStart[1], mStart[2], mStart[3], mStart[4], mStart[5]);
          context.transform(1, 0, 0, -1, 0, 0);
          context.font = `1px ${getFontFamily(firstItem.fontName)}`;
          context.textBaseline = 'alphabetic';
          const beforeStart = (firstItem.str || '').substring(0, openPos);
          const offset = context.measureText(beforeStart).width;
          const baselineNudge = -0.005;
          context.fillStyle = '#000000';
          context.fillText(value, offset, baselineNudge);
          context.restore();

          searchFrom = openPos + 1;
          i = j; // skip processed items
        }
      }
      
    } catch (error) {
      console.error('Error in custom text replacement:', error);
    }
  };

  // Render PDF page with variable overlays
  useEffect(() => {
    const renderPage = async () => {
      console.log('EnhancedPDFViewer: renderPage called', {
        hasPdfDocument: !!pdfDocument,
        hasCanvas: !!canvasRef.current,
        currentPage
      });
      
      if (!pdfDocument || !canvasRef.current) {
        console.log('EnhancedPDFViewer: Missing requirements for rendering');
        return;
      }

      try {
        const page = await pdfDocument.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Set canvas dimensions for high DPI
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // Lines 244-245:
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;

        // Render original PDF first
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;

        // Custom regex-based text replacement approach
        console.log('🚀 About to call customTextReplacement with variables:', variables);
        console.log('🚀 Variables keys:', Object.keys(variables));
        console.log('🚀 Variables values:', Object.values(variables));
        
        await customTextReplacement(page, context, viewport, variables);
        
        console.log('🏁 Finished customTextReplacement');

        console.log(`✅ Rendered page ${currentPage} with overlay replacements`);

      } catch (error) {
        console.error('Error rendering page:', error);
      }
    };

    renderPage();
  }, [pdfDocument, currentPage, variables, variablePositions]);

  // Map PDF font names to web-safe fonts
  const getFontFamily = (pdfFontName) => {
    const fontMap = {
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
    return fontMap[pdfFontName] || 'Arial, sans-serif';
  };

  // Export PDF with variable substitutions
  const exportPDF = async () => {
    if (!pdfBytes) {
      throw new Error('No PDF loaded');
    }

    try {
      // Load original PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // Embed fonts
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);

      // Process each page
      for (let pageNum = 1; pageNum <= pages.length; pageNum++) {
        const page = pages[pageNum - 1];
        const { width: pageWidth, height: pageHeight } = page.getSize();
        const pageVariables = variablePositions.get(pageNum) || [];

        pageVariables.forEach(varInfo => {
          const variableValue = variables[varInfo.variableName];
          if (variableValue !== undefined && variableValue !== '') {
            // Convert coordinates from canvas to PDF space
            const pdfX = varInfo.x / 2; // Scale down from high DPI
            const pdfY = pageHeight - (varInfo.y / 2);

            // Choose appropriate font
            let font = helvetica;
            if (varInfo.fontName.includes('Bold')) {
              font = helveticaBold;
            } else if (varInfo.fontName.includes('Times')) {
              font = timesRoman;
            }

            // Draw updated text directly over the original
            const updatedText = varInfo.originalText.replace(
              varInfo.variablePattern,
              variableValue
            );

            page.drawText(updatedText, {
              x: pdfX,
              y: pdfY,
              size: varInfo.fontSize / 2,
              font: font,
              color: rgb(0, 0, 0),
            });
          }
        });
      }

      // Generate and return PDF bytes
      const pdfBytesOutput = await pdfDoc.save();
      return pdfBytesOutput;
    } catch (error) {
      console.error('Error exporting PDF:', error);
      throw error;
    }
  };

  // Expose export function to parent
  React.useImperativeHandle(ref, () => ({
    exportPDF
  }), [pdfBytes, variables, variablePositions]);

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
        <p style={{ fontSize: '12px', color: '#666' }}>
          Debug: pdfBytes={!!pdfBytes}, loading={isLoading}
        </p>
      </div>
    );
  }

  return (
    <div className="enhanced-pdf-viewer">
      <canvas
        ref={canvasRef}
        className="pdf-canvas-enhanced"
        style={{
          maxWidth: '100%',
          height: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      />
      {totalPages > 1 && (
        <div className="page-navigation">
          <button
            onClick={() => onPageChange && onPageChange(Math.max(1, currentPage - 1), totalPages)}
            disabled={currentPage <= 1}
            className="btn btn-sm"
          >
            Previous
          </button>
          <span className="page-info">
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

export default EnhancedPDFViewer;
