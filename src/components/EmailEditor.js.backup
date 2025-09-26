import { extractTextWithNLP } from '../services/pdfContentExtractor';
import { syncCompliancePhrases } from '../services/legalDictionary';
import { ensureComplianceClauses, buildVariablesFromEntities } from '../services/complianceAutoInsert';
// Full-Featured EmailEditor with Professional Preview and Exact Positioning
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, FileText, Settings, AlertCircle, RefreshCw, Shield, Edit3, ArrowLeft, BookOpen } from 'lucide-react';
import pdfTemplateService from '../services/pdfTemplateService';
import { extractTextFromPDF } from '../services/pdfContentExtractor';
import ComplianceAnalysis from './compliance/ComplianceAnalysis';
import { COMPLIANCE_RULES } from './compliance/complianceRules';
import EnhancedPDFViewer from './EnhancedPDFViewer';
import EntitiesPanel from './EntitiesPanel';
import * as pdfjs from 'pdfjs-dist';
import '../styles/preview.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const EmailEditor = ({ template, onBack }) => {
  const [templateContent, setTemplateContent] = useState(template?.content || '');
  const [activeTab, setActiveTab] = useState('variables');
  const [extractedEntities, setExtractedEntities] = useState([]);
  const [variables, setVariables] = useState({});
  const [stateConfig, setStateConfig] = useState({
    selectedState: 'CA',
    stateBlocks: {}
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [previewPdfBytes, setPreviewPdfBytes] = useState(null);
  const [uploadedPdfBytes, setUploadedPdfBytes] = useState(null);
  const [previewMode, setPreviewMode] = useState('original'); // prefer exact view when possible
  const [pdfJsViewerAvailable, setPdfJsViewerAvailable] = useState(false);
  // Enhanced PDF viewer states
  const [importedPdfBytes, setImportedPdfBytes] = useState(null);
  const [isPdfImported, setIsPdfImported] = useState(false);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  // Use refs to store PDF data to avoid async state issues
  const importedPdfBytesRef = useRef(null);
  const isPdfImportedRef = useRef(false);
  const [pdfImportKey, setPdfImportKey] = useState(0);

  // Compliance system states
  const [complianceFlags, setComplianceFlags] = useState({});
  const [sentences, setSentences] = useState([]);
  const [showRulesManager, setShowRulesManager] = useState(false);
  const [currentRules, setCurrentRules] = useState(COMPLIANCE_RULES);
  const [newRuleData, setNewRuleData] = useState('');
  // Variables UX enhancements
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [variableSearch, setVariableSearch] = useState('');

  // Use ref to store current URL for cleanup without causing re-renders
  const currentPreviewUrlRef = useRef(null);
  const pdfDocumentRef = useRef(null);
  const canvasRef = useRef(null);
  const pdfViewportContainerRef = useRef(null);
  const variableChangeTimerRef = useRef(null);
  const enhancedPdfViewerRef = useRef(null);

  const US_STATES = [
    { code: 'CA', name: 'California' }, { code: 'NY', name: 'New York' }, 
    { code: 'TX', name: 'Texas' }, { code: 'FL', name: 'Florida' },
    { code: 'WA', name: 'Washington' }, { code: 'IL', name: 'Illinois' }
  ];

  // Professional PDF generation with enhanced error handling
  const generateProfessionalPreview = useCallback(async () => {
    if (!templateLoaded) {
      console.log('Template not loaded yet, skipping preview generation');
      return;
    }

    // Extract text for compliance analysis from template
    if (templateContent && sentences.length === 0) {
      const splitSentences = templateContent
        .split(/[.!?]+/)
        .filter(sentence => sentence.trim().length > 10)
        .map((sentence, index) => ({
          id: `sentence_${index}`,
          text: sentence.trim(),
          section: Math.floor(index / 3) + 1
        }));
      
      setSentences(splitSentences);
      console.log('Template text extracted for compliance analysis:', splitSentences.length, 'sentences');
    }

    // If user prefers exact-fidelity original PDF preview, render uploaded bytes directly
    if (previewMode === 'original' && uploadedPdfBytes) {
      try {
        const pdfDoc = await pdfjs.getDocument({ data: uploadedPdfBytes }).promise;
        pdfDocumentRef.current = pdfDoc;
        const numPages = pdfDoc.numPages || 1;
        setTotalPages(numPages);
        setCurrentPage(prev => Math.min(prev || 1, numPages));
        setPreviewPdfBytes(uploadedPdfBytes);
        const blob = new Blob([uploadedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (currentPreviewUrlRef.current) URL.revokeObjectURL(currentPreviewUrlRef.current);
        currentPreviewUrlRef.current = url;
        setPreviewPdfUrl(url);
        return;
      } catch (e) {
        console.warn('Failed to render original PDF bytes, falling back to generated preview:', e);
      }
    }

    if (!templateContent || !templateContent.trim()) {
      console.log('No content available, skipping preview generation');
      setPreviewPdfUrl(null);
      setPreviewError('No content to preview. Please add content to the template.');
      return;
    }

    try {
      console.log('Generating professional PDF preview...');
      setIsLoadingPreview(true);
      setPreviewError(null);
      
      // Clean up previous URL to prevent memory leaks
      if (currentPreviewUrlRef.current) {
        URL.revokeObjectURL(currentPreviewUrlRef.current);
        currentPreviewUrlRef.current = null;
      }
      
      const pdfBytes = await pdfTemplateService.generatePDF(
        templateContent, 
        variables, 
        stateConfig.stateBlocks, 
        stateConfig.selectedState
      );
      
      if (pdfBytes && pdfBytes.length > 0) {
        // Get total pages to support minimal custom pagination
        try {
          const pdfDoc = await pdfjs.getDocument({ data: pdfBytes }).promise;
          const numPages = pdfDoc.numPages || 1;
          pdfDocumentRef.current = pdfDoc;
          setTotalPages(numPages);
          setCurrentPage(prev => Math.min(prev || 1, numPages));
        } catch (e) {
          console.warn('Unable to read PDF page count for preview:', e);
          setTotalPages(1);
          setCurrentPage(1);
        }
        setPreviewPdfBytes(pdfBytes);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        currentPreviewUrlRef.current = url;
        setPreviewPdfUrl(url);
        console.log('Professional PDF preview generated successfully, size:', pdfBytes.length, 'bytes');
      } else {
        console.error('PDF generation returned empty or invalid data');
        setPreviewError('PDF generation failed: Empty data returned');
        setPreviewPdfUrl(null);
      }
    } catch (error) {
      console.error('Failed to generate professional preview PDF:', error);
      setPreviewError(`Failed to generate PDF preview: ${error.message}`);
      setPreviewPdfUrl(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [templateLoaded, templateContent, variables, stateConfig.stateBlocks, stateConfig.selectedState]);

  // Initialize professional PDF template
  const initializeProfessionalTemplate = useCallback(async () => {
    try {
      console.log('Initializing professional PDF template...');
      setIsLoadingPreview(true);
      setPreviewError(null);
      
      const success = await pdfTemplateService.loadTemplate('/letterhead.pdf');
      setTemplateLoaded(success);
      
      if (success) {
        console.log('Professional PDF template loaded successfully');

        // Explicitly set safer margins to prevent letterhead overlap
        try {
          pdfTemplateService.setProfessionalContentArea(0.22, 0.15, 0.10);
          const layoutInfo = pdfTemplateService.getProfessionalLayoutInfo();
          if (layoutInfo) {
            console.log('Professional layout configured (post-set):', layoutInfo);
          }
        } catch (e) {
          console.warn('Failed to set professional content area:', e);
        }
      } else {
        console.error('Failed to load professional PDF template');
        setPreviewError('Failed to load PDF template. Please check if letterhead.pdf exists in the public folder.');
      }
    } catch (error) {
      console.error('Error loading professional PDF template:', error);
      setPreviewError(`Error loading PDF template: ${error.message}`);
      setTemplateLoaded(false);
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  // Compliance analysis functions
  const determineSectionNumber = (text) => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('at-will') || lowerText.includes('terminate employment')) return 5;
    if (lowerText.includes('confidentiality') || lowerText.includes('intellectual property')) return 6;
    if (lowerText.includes('employment agreement') || lowerText.includes('competitive')) return 8;
    if (lowerText.includes('arbitration') || lowerText.includes('dispute')) return 10;
    if (lowerText.includes('benefits') || lowerText.includes('health')) return 3;
    if (lowerText.includes('pre-employment') || lowerText.includes('background')) return 7;
    if (lowerText.includes('compensation') || lowerText.includes('salary')) return 2;
    
    return 0;
  };

  // Build a quick index of variables and where they appear, and whether they are inside flagged sentences
  const variableMeta = React.useMemo(() => {
    const meta = {};
    // Initialize all variables with default meta
    Object.keys(variables || {}).forEach(v => {
      meta[v] = { occurrences: 0, flaggedOccurrences: 0 };
    });
    if (!template?.content) return meta;

    // Map sentence id to text and flags
    const flaggedSentenceIds = new Set(Object.keys(complianceFlags || {}));

    // For each sentence, count occurrences per variable
    sentences.forEach(s => {
      const text = s.text || '';
      Object.keys(variables || {}).forEach(v => {
        const pattern = new RegExp(`\\[\\s*${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\]`, 'g');
        const matches = text.match(pattern);
        if (matches && matches.length) {
          meta[v].occurrences += matches.length;
          if (flaggedSentenceIds.has(s.id)) {
            meta[v].flaggedOccurrences += matches.length;
          }
        }
      });
    });
    return meta;
  }, [variables, sentences, complianceFlags, template?.content]);

  const getComplianceSummary = () => {
    const summary = { error: 0, warning: 0, info: 0 };
    Object.values(complianceFlags).flat().forEach(flag => {
      if (flag.severity) summary[flag.severity]++;
    });
    return summary;
  };

  const generateComplianceReport = () => {
    const summary = getComplianceSummary();
    const allFlags = Object.values(complianceFlags).flat();
    
    const report = {
      template: template?.title || 'Offer Letter',
      state: stateConfig.selectedState,
      timestamp: new Date().toISOString(),
      summary,
      totalIssues: allFlags.length,
      criticalIssues: allFlags.filter(f => f.severity === 'error'),
      warnings: allFlags.filter(f => f.severity === 'warning'),
      details: complianceFlags,
      professionalLayoutInfo: pdfTemplateService.getProfessionalLayoutInfo()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${stateConfig.selectedState}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddRule = () => {
    try {
      const parsedRule = JSON.parse(newRuleData);
      
      const updatedRules = { ...currentRules };
      if (!updatedRules[stateConfig.selectedState]) {
        updatedRules[stateConfig.selectedState] = { 
          state: stateConfig.selectedState,
          rules: {} 
        };
      }
      
      Object.assign(updatedRules[stateConfig.selectedState].rules, parsedRule);
      setCurrentRules(updatedRules);
      setNewRuleData('');
      
      alert(`Successfully added rule(s) for ${stateConfig.selectedState}!`);
    } catch (error) {
      alert('Invalid JSON format. Please check the rule format.');
    }
  };

  // Initialize template and compliance analysis
  useEffect(() => {
    const initializeAll = async () => {
      // Initialize PDF template
      await initializeProfessionalTemplate();

      // Split sentences for compliance analysis
      const splitSentences = template.content
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0)
        .map((text, index) => ({
          id: `sentence-${index}`,
          text: text.trim(),
          section: determineSectionNumber(text)
        }));
      
      setSentences(splitSentences);

      // Extract variables
      const extractVariables = (content) => {
        const variableMatches = content.match(/\[([^\]]+)\]/g);
        if (!variableMatches) return {};
        
        const extractedVars = {};
        variableMatches.forEach(match => {
          let varName = match.slice(1, -1).trim();
          if (varName) extractedVars[varName] = '';
        });
        return extractedVars;
      };

      const extractedVars = extractVariables(template.content);
      setVariables(extractedVars);
    };

    initializeAll();
  }, [template.content, initializeProfessionalTemplate]);

  // Generate preview with professional formatting
  useEffect(() => {
    if (template?.content && typeof template.content === 'string') {
      setTemplateContent(template.content);
    }
  }, [template]);
  useEffect(() => {
    if (templateLoaded) {
      const timeoutId = setTimeout(generateProfessionalPreview, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [templateLoaded, generateProfessionalPreview]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (currentPreviewUrlRef.current) {
        URL.revokeObjectURL(currentPreviewUrlRef.current);
        currentPreviewUrlRef.current = null;
      }
      if (pdfDocumentRef.current) {
        try { pdfDocumentRef.current.destroy(); } catch {}
        pdfDocumentRef.current = null;
      }
    };
  }, []);

  // Render PDF.js canvas when bytes or page change
  useEffect(() => {
    const renderPage = async () => {
      if (!previewPdfBytes || !canvasRef.current) return;

      try {
        let pdfDoc = pdfDocumentRef.current;
        if (!pdfDoc) {
          pdfDoc = await pdfjs.getDocument({ data: previewPdfBytes }).promise;
          pdfDocumentRef.current = pdfDoc;
          setTotalPages(pdfDoc.numPages || 1);
          setCurrentPage(prev => Math.min(prev || 1, pdfDoc.numPages || 1));
        }

        const safePage = Math.min(Math.max(1, currentPage || 1), pdfDoc.numPages || 1);
        const page = await pdfDoc.getPage(safePage);

        // Determine scale to fit container width
        const container = pdfViewportContainerRef.current;
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = container ? container.clientWidth - 4 : viewport.width;
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);

        const renderContext = { canvasContext: context, viewport: scaledViewport }; 
        await page.render(renderContext).promise;
      } catch (err) {
        console.error('PDF.js render error:', err);
      }
    };

    renderPage();
  }, [previewPdfBytes, currentPage]);


  // Detect if bundled PDF.js viewer is available at /pdfjs/web/viewer.html
  useEffect(() => {
    const checkViewer = async () => {
      try {
        const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
        const path = `${base}/pdfjs/web/viewer.html`;
        const res = await fetch(path, { method: 'GET' });
        if (!res.ok) { setPdfJsViewerAvailable(false); return; }
        const html = await res.text();
        // Heuristic: official viewer contains this title
        const isViewer = /<title>\s*PDF\.js viewer\s*<\/title>/i.test(html);
        setPdfJsViewerAvailable(isViewer);
      } catch {
        setPdfJsViewerAvailable(false);
      }
    };
    checkViewer();
  }, []);

  // Analyze compliance
  // Sync compliance phrases for the selected state into the backend (EntityRuler)
// This ensures your LEGAL_POLICY detections match the rules in COMPLIANCE_RULES.
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      // Example: when selectedState is 'CA', this collects CA flaggedPhrases
      // and pushes them to the Python API as LEGAL_POLICY patterns.
      const res = await syncCompliancePhrases(stateConfig.selectedState);
      if (!cancelled) {
        console.log('Synced compliance phrases for', stateConfig.selectedState, res);
      }
    } catch (e) {
      if (!cancelled) {
        console.warn('Failed to sync compliance phrases:', e);
      }
    }
  })();
  return () => { cancelled = true; };
}, [stateConfig.selectedState]);

  useEffect(() => {
    console.log('Compliance analysis running:', {
      sentencesCount: sentences.length,
      selectedState: stateConfig.selectedState,
      hasRules: !!currentRules[stateConfig.selectedState]
    });
    
    const newFlags = {};
    sentences.forEach(sentence => {
      const stateRules = currentRules[stateConfig.selectedState]?.rules || {};
      const lowerText = sentence.text.toLowerCase();
      const flags = [];

      Object.keys(stateRules).forEach(ruleKey => {
        const rule = stateRules[ruleKey];
        if (rule.flaggedPhrases) {
          const hasMatch = rule.flaggedPhrases.some(phrase => 
            lowerText.includes(phrase.toLowerCase())
          );
          if (hasMatch) {
            flags.push({ 
              type: ruleKey, 
              severity: rule.severity, 
              message: rule.message,
              suggestion: rule.suggestion,
              alternativeLanguage: rule.alternativeLanguage,
              lawReference: rule.lawReference
            });
          }
        }
      });

      if (flags.length > 0) {
        newFlags[sentence.id] = flags;
      }
    });
    
    console.log('Compliance analysis completed:', {
      totalFlags: Object.keys(newFlags).length,
      errorCount: Object.values(newFlags).flat().filter(f => f.severity === 'error').length,
      warningCount: Object.values(newFlags).flat().filter(f => f.severity === 'warning').length
    });
    
    setComplianceFlags(newFlags);
  }, [sentences, stateConfig.selectedState, currentRules]);

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      let bytesToDownload = null;
      
      if (isPdfImported && enhancedPdfViewerRef.current) {
        // Export enhanced PDF with variable updates
        bytesToDownload = await enhancedPdfViewerRef.current.exportPDF();
      } else if (template && template.content) {
        // Generate from template
        bytesToDownload = await pdfTemplateService.generatePDF(
          template.content,
          variables,
          stateConfig.stateBlocks,
          stateConfig.selectedState
        );
      } else {
        alert('No content available to generate PDF.');
        setIsGenerating(false);
        return;
      }
      
      const blob = new Blob([bytesToDownload], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isPdfImported ? 'Updated_Offer_Letter.pdf' : 'Offer_Letter.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVariableChange = (varName, value) => {
    setVariables(prev => ({ ...prev, [varName]: value }));
    // Debounce preview refresh for a smoother HR workflow
    if (variableChangeTimerRef.current) {
      clearTimeout(variableChangeTimerRef.current);
    }
    variableChangeTimerRef.current = setTimeout(() => {
      generateProfessionalPreview();
    }, 400);
  };

  const handleStateChange = (state) => {
    setStateConfig(prev => ({ ...prev, selectedState: state }));
  };

  // Handle variables detected from imported PDF
  const handleVariablesDetected = (detectedVariables) => {
    setVariables(prev => ({ ...prev, ...detectedVariables }));
    console.log('Variables detected from PDF:', detectedVariables);
  };

  // Extract text for compliance analysis from imported PDF
  const extractTextForCompliance = async (arrayBuffer) => {
    try {
      const pdfDocument = await pdfjs.getDocument(arrayBuffer).promise;
      let pdfText = '';

      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        pdfText += pageText + ' ';
      }

      // Split into sentences for compliance analysis
      const splitSentences = pdfText
        .split(/[.!?]+/)
        .filter(sentence => sentence.trim().length > 10)
        .map((sentence, index) => ({
          id: `sentence_${index}`,
          text: sentence.trim(),
          section: Math.floor(index / 3) + 1 // Group sentences into sections
        }));

      setSentences(splitSentences);
      console.log('Text extracted for compliance analysis:', splitSentences.length, 'sentences');
    } catch (error) {
      console.error('Error extracting text for compliance:', error);
    }
  };

  // Handle page changes in PDF viewer
  const handlePageChange = (newPage, totalPages) => {
    setCurrentPage(newPage);
    setTotalPages(totalPages);
  };

  // Debug state changes
  useEffect(() => {
    console.log('State changed:', {
      isPdfImported,
      hasImportedPdfBytes: !!importedPdfBytes,
      importedPdfBytesLength: importedPdfBytes?.byteLength || 0,
      pdfImportKey
    });
  }, [isPdfImported, importedPdfBytes, pdfImportKey]);

  // Force re-render when PDF is imported
  useEffect(() => {
    if (isPdfImported && importedPdfBytes) {
      console.log('PDF imported - forcing re-render');
      // Force a re-render by updating a dummy state
      setTimeout(() => {
        console.log('Checking state after delay:', {
          hasImportedPdfBytes: !!importedPdfBytes,
          importedPdfBytesLength: importedPdfBytes?.byteLength || 0
        });
      }, 10);
    }
  }, [isPdfImported, importedPdfBytes]);

  const handleRefreshPreview = () => {
    generateProfessionalPreview();
  };

  // Professional Compliance Summary Component
  const ComplianceSummaryPanel = ({ summary, selectedState }) => {
    const total = summary.error + summary.warning + summary.info;
    
    if (total === 0) {
      return (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          padding: '12px 16px',
          borderRadius: '8px',
          margin: '12px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Shield size={18} style={{ color: '#28a745' }} />
          <span style={{ fontWeight: '600' }}>
            No compliance issues detected for {selectedState}
          </span>
        </div>
      );
    }

    return (
      <div style={{
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        padding: '16px',
        borderRadius: '8px',
        margin: '12px 0'
      }}>
        <h4 style={{ 
          margin: '0 0 12px 0', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          color: '#856404'
        }}>
          <Shield size={18} />
          Compliance Status for {selectedState}:
        </h4>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {summary.error > 0 && (
            <span style={{ 
              backgroundColor: '#f8d7da',
              padding: '6px 12px',
              borderRadius: '6px',
              color: '#721c24',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              Critical Issues: {summary.error}
            </span>
          )}
          {summary.warning > 0 && (
            <span style={{ 
              backgroundColor: '#fff3e0',
              padding: '6px 12px',
              borderRadius: '6px',
              color: '#ef6c00',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              Warnings: {summary.warning}
            </span>
          )}
          {summary.info > 0 && (
            <span style={{ 
              backgroundColor: '#e8f4f8',
              padding: '6px 12px',
              borderRadius: '6px',
              color: '#0277bd',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              Notices: {summary.info}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderProfessionalPreview = () => (
    <div className="email-preview">
      <div className="preview-header">
        <div className="preview-title">
          <FileText size={20} />
          <span>Professional Offer Letter Preview</span>
        </div>
        <div className="preview-actions">
          <button 
            className="btn btn-secondary"
            onClick={generateComplianceReport}
            style={{ marginRight: '8px' }}
          >
            <Shield size={16} />
            Compliance Report
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleDownloadPDF}
            disabled={isGenerating || !templateLoaded}
          >
            {isGenerating ? (
              <>
                <div className="spinner" style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px'
                }}></div>
                Generating...
              </>
            ) : (
              <>
                <Download size={16} />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
      
      <ComplianceSummaryPanel 
        summary={getComplianceSummary()} 
        selectedState={stateConfig.selectedState} 
      />
      
      <div className="document-view">
        <div className="pdf-preview-container">
          {previewError ? (
            <div className="preview-error">
              <FileText size={48} />
              <h3>Preview Error</h3>
              <p>{previewError}</p>
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button onClick={handleRefreshPreview} className="btn btn-primary">
                  <RefreshCw size={16} />
                  Retry
                </button>
                <button onClick={() => window.location.reload()} className="btn btn-secondary">
                  Refresh Page
                </button>
                {previewPdfUrl && (
                  <a href={previewPdfUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
                    Open in New Tab
                  </a>
                )}
              </div>
            </div>
          ) : isLoadingPreview || isImportingPdf ? (
            <div className="pdf-loading">
              <div className="spinner"></div>
              <p>{isImportingPdf ? 'Importing PDF...' : 'Generating professional PDF preview...'}</p>
              <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>
                {isImportingPdf ? 'Processing PDF structure and extracting variables...' : 'Applying professional formatting and padding...'}
              </p>
            </div>
          ) : isPdfImported || isPdfImportedRef.current ? (
            <div className="pdf-viewport">
              {/* Enhanced PDF viewer with real-time variable updates */}
              {console.log('Rendering EnhancedPDFViewer with:', {
                importedPdfBytes: !!importedPdfBytes,
                importedPdfBytesLength: importedPdfBytes?.byteLength || 0,
                importedPdfBytesRef: !!importedPdfBytesRef.current,
                importedPdfBytesRefLength: importedPdfBytesRef.current?.byteLength || 0,
                isPdfImported,
                isPdfImportedRef: isPdfImportedRef.current,
                variablesCount: Object.keys(variables).length
              })}
              {(importedPdfBytes && importedPdfBytes.byteLength > 0) || (importedPdfBytesRef.current && importedPdfBytesRef.current.byteLength > 0) ? (
                <EnhancedPDFViewer
                  key={`pdf-viewer-${pdfImportKey}`}
                  ref={enhancedPdfViewerRef}
                  pdfBytes={importedPdfBytes || importedPdfBytesRef.current}
                  variables={variables}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  onVariablesDetected={handleVariablesDetected}
                />
              ) : (
                <div className="pdf-placeholder">
                  <p>PDF imported but bytes not available</p>
                  <p style={{ fontSize: '12px', color: '#666' }}>
                    Debug: isPdfImported={isPdfImported.toString()}, isPdfImportedRef={isPdfImportedRef.current.toString()}, hasBytes={!!importedPdfBytes}, hasBytesRef={!!importedPdfBytesRef.current}
                  </p>
                </div>
              )}
            </div>
          ) : previewPdfBytes ? (
            <div className="pdf-viewport" ref={pdfViewportContainerRef}>
              {/* Fallback: canvas rendering via pdf.js */}
              <canvas ref={canvasRef} className="pdf-canvas-full" />
            </div>
          ) : (
            <div className="preview-placeholder">
              <FileText size={48} />
              <h3>No Preview Available</h3>
              <p>Upload an offer letter or check template content</p>
              <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>
                Professional formatting will be applied automatically
              </p>
            </div>
          )}
        </div>
        
        {/* Compliance Analysis Panel */}
        <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Shield size={18} />
              Legal Compliance Analysis ({sentences.length} sentences analyzed):
            </h4>
            
            {sentences.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  fontWeight: 'bold'
                }}>
                  {Object.values(complianceFlags).flat().filter(f => f.severity === 'error').length} Errors
                </span>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#fff3cd',
                  color: '#856404',
                  fontWeight: 'bold'
                }}>
                  {Object.values(complianceFlags).flat().filter(f => f.severity === 'warning').length} Warnings
                </span>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#d1ecf1',
                  color: '#0c5460',
                  fontWeight: 'bold'
                }}>
                  State: {stateConfig.selectedState}
                </span>
              </div>
            )}
          </div>
          
          {sentences.length === 0 && (
            <div style={{
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              textAlign: 'center',
              color: '#6c757d'
            }}>
              <p>No content available for compliance analysis.</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                {isPdfImported ? 
                  'Import a PDF or add template content to analyze compliance.' :
                  'Add template content or import a PDF to analyze compliance.'
                }
              </p>
            </div>
          )}
          {sentences.map((sentence) => (
            <div key={sentence.id} style={{ marginBottom: '16px' }}>
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: complianceFlags[sentence.id] ? 
                  (complianceFlags[sentence.id].some(f => f.severity === 'error') ? '#ffebee' : '#fff3e0') : 
                  '#f8f9fa',
                border: '1px solid #e0e0e0',
                borderLeft: complianceFlags[sentence.id] ? 
                  `4px solid ${complianceFlags[sentence.id].some(f => f.severity === 'error') ? '#dc3545' : '#ffc107'}` : 
                  '4px solid #6c757d'
              }}>
                <strong style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  marginRight: '12px'
                }}>
                  §{sentence.section}
                </strong>
                <span style={{
                  backgroundColor: complianceFlags[sentence.id] ? 
                    (complianceFlags[sentence.id].some(f => f.severity === 'error') ? '#ffcdd2' : '#fff8e1') : 
                    'transparent',
                  padding: complianceFlags[sentence.id] ? '3px 6px' : '0',
                  borderRadius: '3px'
                }}>
                  {sentence.text}
                </span>
              </div>
              
              {complianceFlags[sentence.id] && complianceFlags[sentence.id].map((flag, idx) => (
                <div key={idx} style={{
                  backgroundColor: flag.severity === 'error' ? '#f8d7da' : '#fff3cd',
                  padding: '12px',
                  margin: '8px 0 8px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  borderLeft: `3px solid ${flag.severity === 'error' ? '#dc3545' : '#ffc107'}`
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                    {flag.severity === 'error' ? 'ERROR' : 'WARNING'} - {flag.type.toUpperCase()}
                  </div>
                  <div style={{ marginBottom: '8px' }}>{flag.message}</div>
                  
                  {flag.lawReference && (
                    <div style={{ 
                      backgroundColor: '#e9ecef', 
                      padding: '8px', 
                      borderRadius: '4px',
                      fontSize: '13px',
                      marginBottom: '6px'
                    }}>
                      <strong>Legal Reference:</strong> {flag.lawReference}
                    </div>
                  )}
                  
                  {flag.suggestion && (
                    <div style={{ 
                      backgroundColor: '#d4edda', 
                      padding: '8px', 
                      borderRadius: '4px',
                      fontSize: '13px',
                      marginBottom: '6px'
                    }}>
                      <strong>Suggestion:</strong> {flag.suggestion}
                    </div>
                  )}
                  
                  {flag.alternativeLanguage && (
                    <div style={{ 
                      backgroundColor: '#d1ecf1', 
                      padding: '8px', 
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      <strong>Alternative:</strong> "{flag.alternativeLanguage}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderVariablesTab = () => {
    const search = (variableSearch || '').toLowerCase();
    const entries = Object.entries(variables || {})
      .filter(([k]) => !search || k.toLowerCase().includes(search))
      .filter(([k]) => !showFlaggedOnly || (variableMeta[k]?.flaggedOccurrences > 0));

    return (
      <div className="tab-content">
        {/* Controls */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
          <input
            type="text"
            value={variableSearch}
            onChange={(e) => setVariableSearch(e.target.value)}
            placeholder="Search variables..."
            style={{ flex: '1', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: '6px' }}
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
            <input
              type="checkbox"
              checked={showFlaggedOnly}
              onChange={(e) => setShowFlaggedOnly(e.target.checked)}
            />
            Show variables in flagged sections only
          </label>
        </div>

        <div className="variables-list-invoice-style">
          {entries.length === 0 && (
            <div className="empty-state" style={{ padding: '16px' }}>
              <p>No variables match your filter.</p>
            </div>
          )}
          {entries.map(([key, value]) => (
            <div key={key} className="variable-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 220px', marginRight: '10px' }}>
                <input
                  type="text"
                  value={key}
                  readOnly
                  className="variable-name-input"
                  style={{ padding: '8px' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{variableMeta[key]?.occurrences || 0} use(s)</span>
                  {variableMeta[key]?.flaggedOccurrences > 0 && (
                    <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '999px' }}>
                      {variableMeta[key].flaggedOccurrences} in issues
                    </span>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) => handleVariableChange(key, e.target.value)}
                className="variable-value-input"
                placeholder={`Enter ${key}...`}
                style={{ padding: '8px' }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStateConfigTab = () => (
    <div className="tab-content">
      <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', margin: '10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Shield size={20} /> Legal Compliance Configuration
          </h3>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowRulesManager(!showRulesManager)}
          >
            <BookOpen size={16} />
            {showRulesManager ? 'Hide' : 'Manage'} Rules
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            Select State for Legal Compliance Check:
          </label>
          <select 
            value={stateConfig.selectedState} 
            onChange={(e) => handleStateChange(e.target.value)}
            style={{ 
              padding: '8px 12px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              minWidth: '200px'
            }}
          >
            {US_STATES.map(state => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
          
          <div style={{ marginTop: '8px', color: '#6c757d', fontSize: '0.875rem' }}>
            Rules Last Updated: {currentRules[stateConfig.selectedState]?.lastUpdated || 'Default'}
          </div>
        </div>
        
        {showRulesManager && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '6px', padding: '15px' }}>
            <h4>Add New Compliance Rules for {stateConfig.selectedState}:</h4>
            <textarea
              value={newRuleData}
              onChange={(e) => setNewRuleData(e.target.value)}
              placeholder={`{
  "newRuleName": {
    "severity": "error",
    "message": "Description of the rule",
    "lawReference": "Legal citation",
    "flaggedPhrases": ["phrase1", "phrase2"]
  }
}`}
              rows={10}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '13px',
                marginBottom: '10px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleAddRule} 
                className="btn btn-primary"
                disabled={!newRuleData.trim()}
              >
                Save Rule
              </button>
              <button 
                onClick={() => setShowRulesManager(false)} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>

            <div style={{ marginTop: '20px' }}>
              <h5>Current {stateConfig.selectedState} Rules:</h5>
              {Object.keys(currentRules[stateConfig.selectedState]?.rules || {}).map(ruleName => (
                <div key={ruleName} style={{
                  padding: '8px',
                  marginBottom: '5px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <strong>{ruleName}:</strong> {currentRules[stateConfig.selectedState].rules[ruleName].message}
                  </div>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.75em',
                    backgroundColor: currentRules[stateConfig.selectedState].rules[ruleName].severity === 'error' ? '#dc3545' : '#ffc107',
                    color: currentRules[stateConfig.selectedState].rules[ruleName].severity === 'error' ? 'white' : '#000'
                  }}>
                    {currentRules[stateConfig.selectedState].rules[ruleName].severity.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderEditorPanel = () => (
    <div className="editor-panel">
      <div className="panel-header">
        <h3 className="panel-title">Template Editor</h3>
      </div>
      
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'variables' ? 'active' : ''}`}
          onClick={() => setActiveTab('variables')}
        >
          <Settings size={16} />
          Variables
        </button>
        <button 
          className={`tab-button ${activeTab === 'state' ? 'active' : ''}`}
          onClick={() => setActiveTab('state')}
        >
          <Shield size={16} />
          Compliance
        </button>
        <button
          className={`tab-button`}
          onClick={() => {
            document.getElementById('offerLetterInput').click();
          }}
        >
          <FileText size={16} />
          Import Offer Letter
        </button>
        <input
          type="file"
          id="offerLetterInput"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            console.log('File input onChange triggered', e.target.files);
            handleOfferLetterImport(e);
          }}
        />
      </div>
      
      <div className="tab-content-wrapper">
  {activeTab === 'variables' && (
    <>
      {renderVariablesTab()}

      {/* Entities Panel: edit and apply NLP replacements */}
      <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
      <EntitiesPanel
  entities={extractedEntities}
  variables={variables}
  content={templateContent}
  onVariablesChange={(updated) => {
    setVariables(updated);
    setPreviewMode('generated');                    // ensure we use generated preview
    setTimeout(() => generateProfessionalPreview(), 300);
  }}
  onContentChange={(newContent) => {
    // For imported PDFs, don't replace content - just update variables
    console.log('Content change requested, but keeping original PDF structure');
    // The EnhancedPDFViewer will handle variable overlays automatically
  

  }}
  onAfterApply={() => {
    // Keep the imported PDF and let EnhancedPDFViewer handle variable updates
    console.log('NLP replacement applied - keeping imported PDF structure');
    // Variables will automatically update as overlays on the imported PDF
  }}
/>
      </div>
    </>
  )}
  {activeTab === 'state' && renderStateConfigTab()}
</div>
    </div>
  );

  async function handleOfferLetterImport(event) {
    console.log('handleOfferLetterImport called');
    const file = event.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Use a more reliable approach to read the file
    try {
      setIsImportingPdf(true);
      setPreviewPdfBytes(null);
      setPreviewPdfUrl(null);

      // Method 1: Read as ArrayBuffer directly
      const arrayBuffer = await file.arrayBuffer();

      if (!arrayBuffer) {
        console.error('Failed to read file as ArrayBuffer.');
        alert('Failed to read file. Please try again.');
        setIsImportingPdf(false);
        return;
      }

      // Validate the ArrayBuffer
      if (!(arrayBuffer instanceof ArrayBuffer)) {
        console.error('Not an ArrayBuffer:', typeof arrayBuffer);
        alert('Invalid file format. Please try again.');
        setIsImportingPdf(false);
        return;
      }

      if (arrayBuffer.byteLength === 0) {
        console.error('Empty ArrayBuffer');
        alert('File appears to be empty. Please try again.');
        setIsImportingPdf(false);
        return;
      }

      // Check if it looks like a PDF (starts with %PDF)
      const firstBytes = new Uint8Array(arrayBuffer.slice(0, 4));
      const pdfSignature = String.fromCharCode(...firstBytes);
      console.log('File signature:', pdfSignature);

      if (!pdfSignature.startsWith('%PDF')) {
        console.error('Not a PDF file, signature:', pdfSignature);
        alert('Selected file does not appear to be a PDF. Please select a valid PDF file.');
        setIsImportingPdf(false);
        return;
      }

      console.log('Processing PDF buffer immediately:', {
        byteLength: arrayBuffer.byteLength,
        isArrayBuffer: arrayBuffer instanceof ArrayBuffer
      });

      // Create a master byte array copy to preserve data between operations
      const masterBytes = new Uint8Array(arrayBuffer.byteLength);
      masterBytes.set(new Uint8Array(arrayBuffer));

      console.log('Created master byte array copy:', {
        originalLength: arrayBuffer.byteLength,
        masterLength: masterBytes.byteLength
      });

      // Clone master bytes for specific workflows to avoid buffer detachment
      const viewerBytes = masterBytes.slice();
      const complianceBytes = masterBytes.slice();

      // Persist master bytes in state for rendering/export flows
      setImportedPdfBytes(() => {
        console.log('Setting importedPdfBytes to masterBytes');
        return masterBytes;
      });
      setIsPdfImported(() => {
        console.log('Setting isPdfImported to true');
        return true;
      });
      setCurrentPage(() => {
        console.log('Setting currentPage to 1');
        return 1;
      });
      setPdfImportKey(prev => {
        const newKey = prev + 1;
        console.log('Setting pdfImportKey to:', newKey);
        return newKey;
      });

      // Also set refs for immediate access
      importedPdfBytesRef.current = masterBytes;
      isPdfImportedRef.current = true;

      console.log('State setters called with callbacks and refs set');
      
      // NEW: Perform NLP extraction on the imported PDF and auto-insert compliance clauses
      try {
        const extraction = await extractTextWithNLP(file, {
          performNLP: true,
          extractEntities: true,
          suggestVariables: true,
          replaceEntities: false
        });

        const text = extraction.text || '';
        const entities = extraction?.nlp?.entities?.entities || [];
        const suggestions = extraction?.nlp?.variableSuggestions?.suggestions || {};
        setExtractedEntities(entities);

        // Seed variables from entities and suggestions
        const initialVars = buildVariablesFromEntities(entities);
        setVariables(prev => {
          const merged = { ...prev };
          Object.entries(initialVars).forEach(([k, v]) => { if (!merged[k] && v) merged[k] = v; });
          Object.entries(suggestions).forEach(([varName, data]) => {
            const clean = varName.replace(/^\[|\]$/g, '');
            if (!merged[clean] && data?.current_value) {
              merged[clean] = data.current_value;
            }
          });
          return merged;
        });

        // Auto-insert missing compliance clauses for the selected state
        const { content: ensuredContent, addedClauses } = ensureComplianceClauses(
          text,
          stateConfig.selectedState,
          { modes: { required: true, warnings: true, info: false } }
        );

        if (addedClauses?.length) {
          console.log('Auto-inserted clauses:', addedClauses);
        }

        // Don't update templateContent - keep original PDF structure
// Only use NLP for variable detection, not content replacement
console.log('NLP processing completed - variables detected and seeded');
      } catch (nlpErr) {
        console.warn('NLP processing failed; continuing without NLP:', nlpErr);
      }

      // Process compliance analysis asynchronously with a dedicated copy
      setTimeout(async () => {
        try {
          await extractTextForCompliance(complianceBytes.buffer.slice(0));
          console.log('Compliance analysis completed');
        } catch (error) {
          console.error('Error in compliance analysis:', error);
        }
      }, 0);

      console.log('PDF imported successfully for enhanced viewing', {
        bytesLength: arrayBuffer.byteLength,
        isPdfImported: true
      });
      alert('PDF imported successfully! Variables will be detected automatically.');

      setIsImportingPdf(false);

      // Skip the old processing logic when using enhanced viewer
      return;

      // OLD PROCESSING LOGIC (removed)
      // The previous synchronous text extraction using pdfDocument has been
      // superseded by extractTextWithNLP() and EnhancedPDFViewer. The legacy
      // code referenced an undefined pdfDocument in this scope and caused
      // ESLint errors. If you need the old flow, retrieve a pdfjs document
      // instance locally and reintroduce guarded logic here.
    } catch (error) {
      console.error('Error processing PDF file:', error.message, error.stack);
      alert('Failed to process PDF file: ' + error.message);
      setIsImportingPdf(false);
    }
  }

  return (
    <div className="email-editor">
      <div className="editor-header">
        <div className="editor-header-content">
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to Templates
          </button>
          <h1 className="editor-title">{template.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#64748b' }}>
            {templateLoaded ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }}></div>
                Professional Template Loaded
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626' }}></div>
                Template Loading...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="split-view">
        {renderProfessionalPreview()}
        {renderEditorPanel()}
      </div>
    </div>
  );
};

export default EmailEditor;