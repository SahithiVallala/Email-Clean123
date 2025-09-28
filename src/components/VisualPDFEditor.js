import React, { useState, useRef, useEffect } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Edit3, Eye } from 'lucide-react';
import './VisualPDFEditor.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const VisualPDFEditor = React.forwardRef(({ 
  pdfBytes, 
  variables = {}, 
  currentPage = 1, 
  onPageChange,
  onVariablesDetected 
}, ref) => {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [variablePositions, setVariablePositions] = useState([]);
  const [detectedVariables, setDetectedVariables] = useState({});
  const [canvasScale, setCanvasScale] = useState(1.5);
  
  // Keep a safe copy of PDF bytes for export
  const safePdfBytesRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);

  console.log('VisualPDFEditor: Rendered with:', {
    hasPdfBytes: !!pdfBytes,
    pdfBytesLength: pdfBytes?.byteLength || 0,
    variablesCount: Object.keys(variables).length,
    isEditMode
  });

  // Load PDF and extract variable positions
  useEffect(() => {
    const loadPDF = async () => {
      console.log('VisualPDFEditor: loadPDF called');
      
      if (!pdfBytes) {
        console.log('VisualPDFEditor: No PDF bytes provided');
        return;
      }

      setIsLoading(true);
      try {
        // Handle different data types
        let pdfData = pdfBytes instanceof Uint8Array ? pdfBytes : (pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes) : null);
        if (!pdfData) {
          throw new Error('Unsupported pdfBytes type');
        }

        // Store a safe copy for export
        safePdfBytesRef.current = pdfData.slice();

        // Load PDF document
        const viewerBytes = new Uint8Array(pdfData);
        const pdfDoc = await pdfjs.getDocument({ data: viewerBytes }).promise;
        setPdfDocument(pdfDoc);
        setTotalPages(pdfDoc.numPages);

        // Extract variable positions from current page
        await extractVariablePositions(pdfDoc, currentPage);

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

  // Render PDF page when document or page changes
  useEffect(() => {
    if (pdfDocument && canvasRef.current) {
      renderPDFPage(pdfDocument, currentPage);
      extractVariablePositions(pdfDocument, currentPage);
    }
  }, [pdfDocument, currentPage, canvasScale]);

  // Render PDF page to canvas (preserving exact visual layout)
  const renderPDFPage = async (pdfDoc, pageNum) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: canvasScale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      console.log('PDF page rendered successfully');
    } catch (error) {
      console.error('Error rendering PDF page:', error);
    }
  };

  // Extract variable positions from PDF text
  const extractVariablePositions = async (pdfDoc, pageNum) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: canvasScale });
      const textContent = await page.getTextContent();
      
      const positions = [];
      const detectedVars = {};
      
      // Create a temporary canvas for text measurement
      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      
      textContent.items.forEach((item) => {
        const text = item.str || '';
        if (!text) return;
        
        // Check if this text item contains variables
        const variableMatches = [...text.matchAll(/\[([^\]]+)\]/g)];
        
        if (variableMatches.length > 0) {
          const fontSize = Math.abs(item.transform[0]);
          const fontFamily = item.fontName || 'Arial';
          measureCtx.font = `${fontSize}px ${fontFamily}`;
          
          // Transform coordinates to canvas space
          const transform = pdfjs.Util.transform(viewport.transform, item.transform);
          const x = transform[4];
          const y = transform[5];
          
          variableMatches.forEach((match) => {
            const fullMatch = match[0]; // [Variable Name]
            const varName = match[1].trim(); // Variable Name
            const matchIndex = match.index;
            
            // Calculate position of this specific variable within the text
            const beforeText = text.substring(0, matchIndex);
            const beforeWidth = measureCtx.measureText(beforeText).width;
            const varWidth = measureCtx.measureText(fullMatch).width;
            
            positions.push({
              varName,
              fullMatch,
              x: x + beforeWidth,
              y: viewport.height - y, // Convert to top-origin coordinates
              width: varWidth,
              height: fontSize,
              fontSize,
              fontFamily: getFontFamily(fontFamily)
            });
            
            // Add to detected variables
            if (!detectedVars[varName]) {
              detectedVars[varName] = variables[varName] || '';
            }
          });
        }
      });
      
      setVariablePositions(positions);
      setDetectedVariables(detectedVars);
      
      console.log('Extracted variable positions:', positions);
      
      if (onVariablesDetected && Object.keys(detectedVars).length > 0) {
        onVariablesDetected(detectedVars);
      }
    } catch (error) {
      console.error('Error extracting variable positions:', error);
    }
  };

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
    
    if (!pdfFontName) return 'Arial, sans-serif';
    
    for (const [key, value] of Object.entries(fontMap)) {
      if (pdfFontName.includes(key)) {
        return value;
      }
    }
    
    return 'Arial, sans-serif';
  };

  // Handle variable value changes
  const handleVariableChange = (varName, value) => {
    const updatedVars = { ...detectedVariables, [varName]: value };
    setDetectedVariables(updatedVars);
    
    // Notify parent component
    if (onVariablesDetected) {
      onVariablesDetected(updatedVars);
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  // Export PDF with variable replacements
  const exportPDF = async () => {
    if (!safePdfBytesRef.current) {
      throw new Error('No PDF loaded');
    }

    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(safePdfBytesRef.current);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // For each page, replace variables
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        // Get variable positions for this page (we only have current page positions)
        if (pageIndex + 1 === currentPage) {
          variablePositions.forEach((pos) => {
            const value = detectedVariables[pos.varName] || variables[pos.varName];
            if (value && value.trim()) {
              // Convert canvas coordinates back to PDF coordinates
              const pdfX = (pos.x / canvasScale) * (pageWidth / (canvasRef.current?.width || 1));
              const pdfY = pageHeight - ((pos.y / canvasScale) * (pageHeight / (canvasRef.current?.height || 1)));
              
              // First, cover the original text with a white rectangle
              page.drawRectangle({
                x: pdfX - 2,
                y: pdfY - (pos.fontSize * 0.8),
                width: pos.width + 4,
                height: pos.fontSize + 4,
                color: rgb(1, 1, 1) // White
              });
              
              // Then draw the new text
              page.drawText(value, {
                x: pdfX,
                y: pdfY,
                size: pos.fontSize * 0.75, // Adjust size for PDF coordinates
                font: font,
                color: rgb(0, 0, 0)
              });
            }
          });
        }
      }
      
      const pdfBytes = await pdfDoc.save();
      return pdfBytes;
    } catch (error) {
      console.error('exportPDF error:', error);
      // Return original PDF bytes as fallback
      return safePdfBytesRef.current;
    }
  };

  // Expose export function to parent
  React.useImperativeHandle(ref, () => ({
    exportPDF
  }), [variablePositions, detectedVariables, variables]);

  if (isLoading) {
    return (
      <div className="visual-editor-loading">
        <div className="spinner"></div>
        <p>Loading PDF for visual editing...</p>
      </div>
    );
  }

  if (!pdfDocument) {
    return (
      <div className="visual-editor-placeholder">
        <p>No PDF loaded</p>
      </div>
    );
  }

  return (
    <div className="visual-pdf-editor">
      {/* Editor Controls */}
      <div className="visual-editor-controls">
        <button
          className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
          onClick={toggleEditMode}
        >
          {isEditMode ? <Eye size={16} /> : <Edit3 size={16} />}
          {isEditMode ? 'View Mode' : 'Edit Mode'}
        </button>
        
        <div className="visual-editor-info">
          <span className="page-info">
            Page {currentPage} of {totalPages} • {variablePositions.length} variables found
          </span>
        </div>
      </div>

      {/* PDF Canvas with Variable Overlays */}
      <div className="pdf-container" ref={containerRef}>
        {/* Original PDF Canvas (preserves exact layout) */}
        <canvas
          ref={canvasRef}
          className="pdf-canvas"
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto'
          }}
        />
        
        {/* Transparent Variable Input Overlays */}
        {isEditMode && (
          <div 
            ref={overlayRef}
            className="variable-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: canvasRef.current?.style.width || '100%',
              height: canvasRef.current?.style.height || '100%',
              pointerEvents: 'none'
            }}
          >
            {variablePositions.map((pos, index) => (
              <input
                key={`${pos.varName}-${index}`}
                type="text"
                value={detectedVariables[pos.varName] || variables[pos.varName] || ''}
                onChange={(e) => handleVariableChange(pos.varName, e.target.value)}
                className="variable-input"
                style={{
                  position: 'absolute',
                  left: `${pos.x}px`,
                  top: `${pos.y - pos.fontSize * 0.8}px`,
                  width: `${Math.max(pos.width, 100)}px`,
                  height: `${pos.fontSize}px`,
                  fontSize: `${pos.fontSize}px`,
                  fontFamily: pos.fontFamily,
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '2px',
                  padding: '0 2px',
                  pointerEvents: 'auto',
                  zIndex: 10
                }}
                placeholder={pos.varName}
                title={`Edit ${pos.varName}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default VisualPDFEditor;
