import React, { useState, useRef, useEffect } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Edit3, Eye } from 'lucide-react';
import './DirectInlineEditor.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DirectInlineEditor = React.forwardRef(({ 
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
  const [extractedText, setExtractedText] = useState('');
  const [editableContent, setEditableContent] = useState('');
  const [detectedVariables, setDetectedVariables] = useState({});
  const [pdfLayout, setPdfLayout] = useState(null);
  
  // Keep a safe copy of PDF bytes for export
  const safePdfBytesRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);

  console.log('DirectInlineEditor: Rendered with:', {
    hasPdfBytes: !!pdfBytes,
    pdfBytesLength: pdfBytes?.byteLength || 0,
    variablesCount: Object.keys(variables).length,
    isEditMode
  });

  // Load PDF and extract text with layout information
  useEffect(() => {
    const loadPDF = async () => {
      if (!pdfBytes) return;

      setIsLoading(true);
      try {
        let pdfData = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
        safePdfBytesRef.current = pdfData.slice();

        const pdfDoc = await pdfjs.getDocument({ data: pdfData }).promise;
        setPdfDocument(pdfDoc);
        setTotalPages(pdfDoc.numPages);

        // Extract text with layout information
        await extractTextWithLayout(pdfDoc, currentPage);

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

  // Render PDF and extract text when document or page changes
  useEffect(() => {
    if (pdfDocument) {
      renderPDFPage(pdfDocument, currentPage);
      extractTextWithLayout(pdfDocument, currentPage);
    }
  }, [pdfDocument, currentPage]);

  // Render PDF page as background
  const renderPDFPage = async (pdfDoc, pageNum) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
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
    } catch (error) {
      console.error('Error rendering PDF page:', error);
    }
  };

  // Extract text with exact positioning and layout
  const extractTextWithLayout = async (pdfDoc, pageNum) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const textContent = await page.getTextContent();
      
      let fullText = '';
      const layoutInfo = [];
      const detectedVars = {};
      
      // Sort text items by Y position (top to bottom), then X position (left to right)
      const sortedItems = textContent.items.sort((a, b) => {
        const aY = viewport.height - a.transform[5];
        const bY = viewport.height - b.transform[5];
        if (Math.abs(aY - bY) < 5) { // Same line
          return a.transform[4] - b.transform[4]; // Sort by X
        }
        return aY - bY; // Sort by Y
      });
      
      // Group items by lines
      const lines = [];
      let currentLine = [];
      let lastY = null;
      
      sortedItems.forEach(item => {
        const y = viewport.height - item.transform[5];
        
        if (lastY === null || Math.abs(y - lastY) < 5) {
          // Same line
          currentLine.push(item);
        } else {
          // New line
          if (currentLine.length > 0) {
            lines.push([...currentLine]);
          }
          currentLine = [item];
        }
        lastY = y;
      });
      
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      
      // Build text with proper line breaks and spacing
      lines.forEach((line, lineIndex) => {
        let lineText = '';
        line.forEach(item => {
          const text = item.str || '';
          lineText += text;
        });
        
        fullText += lineText;
        if (lineIndex < lines.length - 1) {
          fullText += '\n';
        }
        
        // Check for variables in this line
        const variableMatches = [...lineText.matchAll(/\[([^\]]+)\]/g)];
        variableMatches.forEach(match => {
          const varName = match[1].trim();
          if (!detectedVars[varName]) {
            detectedVars[varName] = variables[varName] || '';
          }
        });
      });
      
      setExtractedText(fullText);
      setEditableContent(fullText);
      setDetectedVariables(detectedVars);
      setPdfLayout({ lines, viewport });
      
      console.log('Extracted text:', fullText);
      console.log('Detected variables:', detectedVars);
      
      if (onVariablesDetected && Object.keys(detectedVars).length > 0) {
        onVariablesDetected(detectedVars);
      }
    } catch (error) {
      console.error('Error extracting text with layout:', error);
    }
  };

  // Handle direct text editing
  const handleContentChange = (newContent) => {
    setEditableContent(newContent);
    
    // Re-extract variables when content changes
    const variableMatches = newContent.match(/\[([^\]]+)\]/g);
    const newVars = {};
    if (variableMatches) {
      variableMatches.forEach(match => {
        const varName = match.slice(1, -1).trim();
        if (varName && !newVars[varName]) {
          newVars[varName] = detectedVariables[varName] || variables[varName] || '';
        }
      });
    }
    
    setDetectedVariables(newVars);
    if (onVariablesDetected) {
      onVariablesDetected(newVars);
    }
  };

  // Handle variable value changes from the variables panel
  const handleVariableChange = (varName, value) => {
    setDetectedVariables(prev => ({ ...prev, [varName]: value }));
    
    // Notify parent component about the change
    if (onVariablesDetected) {
      const updatedVars = { ...detectedVariables, [varName]: value };
      onVariablesDetected(updatedVars);
    }
  };

  // Update variables when they change from parent
  useEffect(() => {
    setDetectedVariables(prevVars => ({ ...prevVars, ...variables }));
  }, [variables]);

  // Get preview content with variables replaced
  const getPreviewContent = () => {
    let result = editableContent;
    
    // Replace variables with their values
    Object.entries({ ...detectedVariables, ...variables }).forEach(([key, value]) => {
      if (value && value.trim()) {
        const regex = new RegExp(`\\[${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
        result = result.replace(regex, value);
      }
    });
    
    return result;
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
      const finalText = getPreviewContent();
      
      // Create new PDF with the edited text
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const { width, height } = page.getSize();
      
      // Split text into lines and draw
      const lines = finalText.split('\n');
      const fontSize = 12;
      const lineHeight = fontSize * 1.4;
      let yPosition = height - 50;
      
      lines.forEach((line) => {
        if (yPosition > 50) {
          const maxWidth = width - 100;
          const words = line.split(' ');
          let currentLine = '';
          
          words.forEach((word) => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const textWidth = font.widthOfTextAtSize(testLine, fontSize);
            
            if (textWidth > maxWidth && currentLine) {
              page.drawText(currentLine, {
                x: 50,
                y: yPosition,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0)
              });
              yPosition -= lineHeight;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          
          if (currentLine && yPosition > 50) {
            page.drawText(currentLine, {
              x: 50,
              y: yPosition,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0)
            });
            yPosition -= lineHeight;
          }
        }
      });
      
      const pdfBytes = await pdfDoc.save();
      return pdfBytes;
    } catch (error) {
      console.error('exportPDF error:', error);
      return safePdfBytesRef.current;
    }
  };

  // Expose functions to parent
  React.useImperativeHandle(ref, () => ({
    exportPDF,
    updateVariable: handleVariableChange
  }), [editableContent, detectedVariables, variables]);

  if (isLoading) {
    return (
      <div className="direct-editor-loading">
        <div className="spinner"></div>
        <p>Loading PDF for direct editing...</p>
      </div>
    );
  }

  if (!pdfDocument) {
    return (
      <div className="direct-editor-placeholder">
        <p>No PDF loaded</p>
      </div>
    );
  }

  return (
    <div className="direct-inline-editor">
      {/* Editor Controls */}
      <div className="direct-editor-controls">
        <button
          className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
          onClick={toggleEditMode}
        >
          {isEditMode ? <Eye size={16} /> : <Edit3 size={16} />}
          {isEditMode ? 'Preview Mode' : 'Edit Mode'}
        </button>
        
        <div className="direct-editor-info">
          <span className="page-info">
            Page {currentPage} of {totalPages} • {Object.keys(detectedVariables).length} variables detected
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="direct-content-area">
        {isEditMode ? (
          <div className="direct-edit-mode">
            <div className="edit-instructions">
              <p>✏️ Edit the text directly. Click inside [placeholders] and modify them character by character.</p>
            </div>
            <div className="text-editor-container">
              <textarea
                value={editableContent}
                onChange={(e) => handleContentChange(e.target.value)}
                className="direct-text-editor"
                placeholder="PDF text will appear here for direct editing..."
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          <div className="direct-preview-mode">
            {/* PDF Background */}
            <div className="pdf-background">
              <canvas
                ref={canvasRef}
                className="pdf-background-canvas"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto'
                }}
              />
            </div>
            
            {/* Text Layer for Visual Display Only */}
            <div 
              ref={textLayerRef}
              className="direct-text-layer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none' // Make it non-interactive
              }}
            >
              <div className="direct-text-content">
                {getPreviewContent().split('\n').map((line, index) => (
                  <div key={index} className="direct-text-line">
                    {line.split(/(\[[^\]]+\])/).map((part, partIndex) => {
                      if (part.match(/^\[[^\]]+\]$/)) {
                        // This is a variable placeholder - show the replaced value
                        const varName = part.slice(1, -1).trim();
                        const value = detectedVariables[varName] || variables[varName];
                        
                        if (value && value.trim()) {
                          // Show the replaced value with highlighting
                          return (
                            <span
                              key={`${index}-${partIndex}`}
                              className="direct-variable-replaced"
                              style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                borderRadius: '2px',
                                padding: '1px 3px',
                                display: 'inline-block',
                                color: '#1f2937',
                                fontWeight: '500'
                              }}
                              title={`${varName}: ${value} (edit from variables panel)`}
                            >
                              {value}
                            </span>
                          );
                        } else {
                          // Show the placeholder with different highlighting
                          return (
                            <span
                              key={`${index}-${partIndex}`}
                              className="direct-variable-placeholder"
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '2px',
                                padding: '1px 3px',
                                display: 'inline-block',
                                color: '#dc2626',
                                fontStyle: 'italic'
                              }}
                              title={`${varName}: Not filled (edit from variables panel)`}
                            >
                              {part}
                            </span>
                          );
                        }
                      } else {
                        // Regular text
                        return (
                          <span key={`${index}-${partIndex}`}>
                            {part}
                          </span>
                        );
                      }
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default DirectInlineEditor;
