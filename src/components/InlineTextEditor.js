import React, { useState, useRef, useEffect } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Edit3, Eye, Download } from 'lucide-react';
import './InlineTextEditor.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const InlineTextEditor = React.forwardRef(({ 
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
  const [editableText, setEditableText] = useState('');
  const [detectedVariables, setDetectedVariables] = useState({});
  
  // Keep a safe copy of PDF bytes for export
  const safePdfBytesRef = useRef(null);
  const textAreaRef = useRef(null);

  console.log('InlineTextEditor: Rendered with:', {
    hasPdfBytes: !!pdfBytes,
    pdfBytesLength: pdfBytes?.byteLength || 0,
    variablesCount: Object.keys(variables).length,
    isEditMode
  });

  // Load PDF and extract text
  useEffect(() => {
    const loadPDF = async () => {
      console.log('InlineTextEditor: loadPDF called with:', {
        hasPdfBytes: !!pdfBytes,
        pdfBytesLength: pdfBytes?.byteLength || 0
      });
      
      if (!pdfBytes) {
        console.log('InlineTextEditor: No PDF bytes provided');
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

        console.log('InlineTextEditor: Processing PDF data:', {
          originalType: typeof pdfBytes,
          isUint8Array: pdfBytes instanceof Uint8Array,
          isArrayBuffer: pdfBytes instanceof ArrayBuffer,
          dataLength: pdfData?.byteLength || pdfData?.length || 0
        });

        // Load PDF document
        const viewerBytes = new Uint8Array(pdfData);
        const pdfDoc = await pdfjs.getDocument({ data: viewerBytes }).promise;
        setPdfDocument(pdfDoc);
        setTotalPages(pdfDoc.numPages);

        // Extract text from all pages
        await extractAllText(pdfDoc);

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

  // Extract text from all pages
  const extractAllText = async (pdfDoc) => {
    try {
      let fullText = '';
      const detectedVars = {};
      
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text items and preserve line structure
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' '); // Normalize whitespace
        
        fullText += pageText + '\n\n';
      }
      
      // Clean up the text
      const cleanText = fullText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
      
      setExtractedText(cleanText);
      setEditableText(cleanText);
      
      // Extract variables from text
      const variableMatches = cleanText.match(/\[([^\]]+)\]/g);
      if (variableMatches) {
        variableMatches.forEach(match => {
          const varName = match.slice(1, -1).trim();
          if (varName && !detectedVars[varName]) {
            detectedVars[varName] = '';
          }
        });
      }
      
      setDetectedVariables(detectedVars);
      
      console.log('Detected variables from PDF:', detectedVars);
      
      if (onVariablesDetected && Object.keys(detectedVars).length > 0) {
        onVariablesDetected(detectedVars);
      }
    } catch (error) {
      console.error('Error extracting text:', error);
    }
  };

  // Handle text changes in edit mode
  const handleTextChange = (e) => {
    const newText = e.target.value;
    setEditableText(newText);
    
    // Re-extract variables when text changes
    const variableMatches = newText.match(/\[([^\]]+)\]/g);
    const newVars = {};
    if (variableMatches) {
      variableMatches.forEach(match => {
        const varName = match.slice(1, -1).trim();
        if (varName && !newVars[varName]) {
          newVars[varName] = variables[varName] || '';
        }
      });
    }
    
    setDetectedVariables(newVars);
    if (onVariablesDetected) {
      onVariablesDetected(newVars);
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    
    if (!isEditMode && textAreaRef.current) {
      // Focus and position cursor at first placeholder when entering edit mode
      setTimeout(() => {
        textAreaRef.current.focus();
        const firstBracket = editableText.indexOf('[');
        if (firstBracket !== -1) {
          textAreaRef.current.setSelectionRange(firstBracket, firstBracket);
        }
      }, 100);
    }
  };

  // Get preview text with variables replaced
  const getPreviewText = () => {
    let result = editableText;
    
    // Replace variables with their values
    Object.entries(variables).forEach(([key, value]) => {
      if (value && value.trim()) {
        const regex = new RegExp(`\\[${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
        result = result.replace(regex, value);
      }
    });
    
    return result;
  };

  // Export PDF with edited text
  const exportPDF = async () => {
    if (!safePdfBytesRef.current) {
      throw new Error('No PDF loaded');
    }

    try {
      const finalText = getPreviewText();
      
      // Create new PDF with the edited text
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // Add a page with the edited text
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const { width, height } = page.getSize();
      
      // Split text into lines and draw
      const lines = finalText.split('\n');
      const fontSize = 12;
      const lineHeight = fontSize * 1.4;
      let yPosition = height - 50; // Start from top with margin
      
      lines.forEach((line) => {
        if (yPosition > 50) { // Leave bottom margin
          // Handle long lines by wrapping them
          const maxWidth = width - 100; // Leave margins
          const words = line.split(' ');
          let currentLine = '';
          
          words.forEach((word) => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const textWidth = font.widthOfTextAtSize(testLine, fontSize);
            
            if (textWidth > maxWidth && currentLine) {
              // Draw current line and start new one
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
          
          // Draw remaining text
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
      // Return original PDF bytes as fallback
      return safePdfBytesRef.current;
    }
  };

  // Expose export function to parent
  React.useImperativeHandle(ref, () => ({
    exportPDF
  }), [variables, editableText]);

  if (isLoading) {
    return (
      <div className="inline-editor-loading">
        <div className="spinner"></div>
        <p>Loading PDF for editing...</p>
      </div>
    );
  }

  if (!pdfDocument) {
    return (
      <div className="inline-editor-placeholder">
        <p>No PDF loaded</p>
      </div>
    );
  }

  return (
    <div className="inline-text-editor">
      {/* Editor Controls */}
      <div className="editor-controls">
        <button
          className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
          onClick={toggleEditMode}
        >
          {isEditMode ? <Eye size={16} /> : <Edit3 size={16} />}
          {isEditMode ? 'Preview Mode' : 'Edit Mode'}
        </button>
        
        <div className="editor-info">
          <span className="page-info">
            {totalPages} page{totalPages !== 1 ? 's' : ''} • {Object.keys(detectedVariables).length} variables detected
          </span>
        </div>
      </div>

      {/* Editor Content */}
      <div className="editor-content">
        {isEditMode ? (
          <div className="edit-mode">
            <div className="edit-instructions">
              <p>✏️ Edit the text directly. Click inside [placeholders] to modify them character by character.</p>
            </div>
            <textarea
              ref={textAreaRef}
              value={editableText}
              onChange={handleTextChange}
              className="text-editor"
              placeholder="PDF text will appear here for editing..."
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="preview-mode">
            <div className="preview-content">
              {getPreviewText().split('\n').map((line, index) => (
                <p key={index} className="preview-line">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default InlineTextEditor;
