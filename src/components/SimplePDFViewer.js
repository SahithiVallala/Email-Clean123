import React, { useRef, useEffect, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const SimplePDFViewer = React.forwardRef(({ 
  pdfBytes, 
  variables = {}, 
  currentPage = 1, 
  onPageChange,
  onVariablesDetected 
}, ref) => {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  console.log('SimplePDFViewer: Rendered with variables:', variables);

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      if (!pdfBytes) return;

      setIsLoading(true);
      try {
        const pdfDoc = await pdfjs.getDocument({ data: pdfBytes }).promise;
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

  // Render PDF page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDocument || !canvasRef.current) return;

      try {
        const page = await pdfDocument.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        
        console.log('Viewport info:', {
          width: viewport.width,
          height: viewport.height,
          scale: viewport.scale,
          transform: viewport.transform
        });
        
        // Render original PDF
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;

        // Render variable overlays
        await renderVariableOverlays(page, viewport);

      } catch (error) {
        console.error('Error rendering page:', error);
      }
    };

    renderPage();
  }, [pdfDocument, currentPage, variables]);

  // Render variable overlays with precise positioning
  const renderVariableOverlays = async (page, viewport) => {
    if (!overlayCanvasRef.current) return;

    const overlayCanvas = overlayCanvasRef.current;
    const overlayContext = overlayCanvas.getContext('2d');
    
    // Match main canvas dimensions exactly
    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;
    overlayCanvas.style.width = `${viewport.width / 1.5}px`;
    overlayCanvas.style.height = `${viewport.height / 1.5}px`;
    
    // Clear overlay
    overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    try {
      const textContent = await page.getTextContent();
      console.log(`Processing ${textContent.items.length} text items for overlays`);
      
      // Build a complete text map to find placeholders across multiple items
      let fullText = '';
      const itemMap = [];
      
      textContent.items.forEach((item, index) => {
        const startPos = fullText.length;
        fullText += item.str;
        itemMap.push({
          item,
          startPos,
          endPos: fullText.length,
          index
        });
        fullText += ' '; // Add space between items
      });
      
      console.log('Full extracted text:', fullText);
      
      // Find all placeholder patterns in the full text
      const placeholderRegex = /\[([^\]]+)\]/g;
      let match;
      
      while ((match = placeholderRegex.exec(fullText)) !== null) {
        const placeholderName = match[1].trim();
        
        // Try multiple ways to find the variable value
        let variableValue = variables[placeholderName];
        
        // If not found, try common variations
        if (!variableValue) {
          // Try exact match with different cases
          const keys = Object.keys(variables);
          const matchingKey = keys.find(key => 
            key.toLowerCase() === placeholderName.toLowerCase() ||
            key.replace(/[_\s]/g, '').toLowerCase() === placeholderName.replace(/[_\s]/g, '').toLowerCase()
          );
          
          if (matchingKey) {
            variableValue = variables[matchingKey];
            console.log(`Found variable match: [${placeholderName}] -> ${matchingKey} = "${variableValue}"`);
          }
        }
        
        if (!variableValue) {
          console.log(`No value for placeholder: [${placeholderName}]`, 'Available variables:', Object.keys(variables));
          continue;
        }
        
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        
        console.log(`Found placeholder [${placeholderName}] at positions ${matchStart}-${matchEnd}`);
        
        // Find which text item(s) contain this placeholder
        const containingItems = itemMap.filter(itemInfo => 
          matchStart >= itemInfo.startPos && matchStart < itemInfo.endPos
        );
        
        if (containingItems.length === 0) {
          console.log(`No containing item found for [${placeholderName}]`);
          continue;
        }
        
        const primaryItem = containingItems[0];
        const item = primaryItem.item;
        
        // Get precise positioning from the text item
        const transform = item.transform;
        
        // Use PDF.js utility to properly transform coordinates
        const [scaleX, skewX, skewY, scaleY, translateX, translateY] = transform;
        
        // Calculate position with proper transformation
        const pdfX = translateX;
        const pdfY = translateY;
        
        // Convert PDF coordinates to canvas coordinates with viewport scaling
        const canvasX = pdfX;
        const canvasY = viewport.height - pdfY;
        
        // Calculate font size from transformation matrix
        const fontSize = Math.abs(scaleY); // Use scaleY for more accurate font size
        
        console.log(`Precise positioning for [${placeholderName}]:`, {
          transform,
          pdfCoords: { pdfX, pdfY },
          canvasCoords: { canvasX, canvasY },
          fontSize,
          itemText: item.str
        });

        // Draw replacement with precise positioning
        overlayContext.save();
        
        // Set font to match original as closely as possible
        const fontFamily = getFontFamily(item.fontName);
        overlayContext.font = `${fontSize}px ${fontFamily}`;
        overlayContext.textBaseline = 'alphabetic';
        
        // Find the exact position of the placeholder within the text item
        const itemText = item.str;
        let placeholderInItem = itemText.indexOf(`[${placeholderName}]`);
        
        // If not found, try to find just the opening bracket
        if (placeholderInItem < 0) {
          placeholderInItem = itemText.indexOf('[');
        }
        
        let offsetX = 0;
        if (placeholderInItem >= 0) {
          // Measure text before the placeholder in this specific item
          const textBeforePlaceholder = itemText.substring(0, placeholderInItem);
          offsetX = overlayContext.measureText(textBeforePlaceholder).width;
        } else {
          console.log(`Could not find placeholder position in item: "${itemText}"`);
        }
        
        const finalX = canvasX + offsetX;
        const finalY = canvasY;
        
        console.log(`Text positioning details:`, {
          itemText,
          placeholderInItem,
          textBeforePlaceholder: itemText.substring(0, placeholderInItem),
          offsetX,
          finalPosition: { finalX, finalY }
        });
        
        // Create replacement text
        const originalText = match[0]; // [PlaceholderName]
        const replacementText = variableValue;
        
        // Measure text dimensions for background
        const originalWidth = overlayContext.measureText(originalText).width;
        const replacementWidth = overlayContext.measureText(replacementText).width;
        const maxWidth = Math.max(originalWidth, replacementWidth);
        
        // Draw white background to cover original placeholder
        overlayContext.fillStyle = '#FFFFFF';
        overlayContext.fillRect(
          finalX - 1, 
          finalY - fontSize + 2, 
          maxWidth + 2, 
          fontSize + 2
        );
        
        // Draw replacement text
        overlayContext.fillStyle = '#000000';
        overlayContext.fillText(replacementText, finalX, finalY);
        
        overlayContext.restore();
        
        console.log(`✅ Successfully overlaid [${placeholderName}] -> "${variableValue}" at (${finalX}, ${finalY})`);
      }
      
    } catch (error) {
      console.error('Error rendering overlays:', error);
    }
  };

  // Map PDF font names to web-safe fonts
  const getFontFamily = (pdfFontName) => {
    if (!pdfFontName) return 'Arial, sans-serif';
    
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
    
    // Check for partial matches
    for (const [pdfFont, webFont] of Object.entries(fontMap)) {
      if (pdfFontName.includes(pdfFont)) {
        return webFont;
      }
    }
    
    return 'Arial, sans-serif';
  };

  // Export PDF with variables (simplified version)
  const exportPDF = async () => {
    if (!pdfBytes) {
      throw new Error('No PDF loaded');
    }

    // For now, return original PDF bytes
    // In a production system, you'd use pdf-lib to actually modify the PDF
    console.log('Exporting PDF with variables:', variables);
    return pdfBytes;
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
    <div className="simple-pdf-viewer" style={{ position: 'relative' }}>
      {/* Original PDF Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          height: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}
      />
      
      {/* Variable Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          maxWidth: '100%',
          height: 'auto',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: 'none'
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

export default SimplePDFViewer;
