

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
import DirectInlineEditor from './DirectInlineEditor';
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
  
  // Natural language rule input states
  const [ruleInputMode, setRuleInputMode] = useState('natural');
  const [naturalRuleForm, setNaturalRuleForm] = useState({
    name: '',
    severity: 'error',
    description: '',
    lawReference: '',
    flaggedPhrases: ''
  });
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

  // Natural language rule processing
  const generateJSONFromNaturalLanguage = () => {
    if (!naturalRuleForm.name.trim() || !naturalRuleForm.description.trim()) {
      return '// Fill in the form above to see the generated JSON';
    }

    const ruleKey = naturalRuleForm.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const flaggedPhrasesArray = naturalRuleForm.flaggedPhrases
      .split(',')
      .map(phrase => phrase.trim())
      .filter(phrase => phrase.length > 0);

    const ruleObject = {
      [ruleKey]: {
        severity: naturalRuleForm.severity,
        message: naturalRuleForm.description,
        ...(naturalRuleForm.lawReference && { lawReference: naturalRuleForm.lawReference }),
        ...(flaggedPhrasesArray.length > 0 && { flaggedPhrases: flaggedPhrasesArray })
      }
    };

    return JSON.stringify(ruleObject, null, 2);
  };

  const handleAddNaturalRule = () => {
    if (!naturalRuleForm.name.trim() || !naturalRuleForm.description.trim()) {
      alert('Please fill in the rule name and description.');
      return;
    }

    try {
      const jsonString = generateJSONFromNaturalLanguage();
      const parsedRule = JSON.parse(jsonString);
      
      const updatedRules = { ...currentRules };
      if (!updatedRules[stateConfig.selectedState]) {
        updatedRules[stateConfig.selectedState] = { 
          state: stateConfig.selectedState,
          rules: {} 
        };
      }
      
      Object.assign(updatedRules[stateConfig.selectedState].rules, parsedRule);
      setCurrentRules(updatedRules);
      
      // Reset form
      setNaturalRuleForm({
        name: '',
        severity: 'error',
        description: '',
        lawReference: '',
        flaggedPhrases: ''
      });
      
      alert(`Rule created successfully for ${stateConfig.selectedState}!`);
    } catch (error) {
      alert('Error creating rule. Please check your input.');
    }
  };

  const applySuggestion = (suggestionType) => {
    const suggestions = {
      overtime: {
        name: 'Overtime Pay Requirements',
        severity: 'error',
        description: 'Employees must receive overtime pay at 1.5x their regular rate for hours worked over 40 per week.',
        lawReference: 'Fair Labor Standards Act (FLSA) Section 207',
        flaggedPhrases: 'overtime, time and a half, 40 hours, weekly hours'
      },
      benefits: {
        name: 'Benefits Disclosure',
        severity: 'warning',
        description: 'All employee benefits including health insurance, retirement plans, and paid time off must be clearly disclosed.',
        lawReference: 'Employee Retirement Income Security Act (ERISA)',
        flaggedPhrases: 'benefits, health insurance, retirement, PTO, paid time off'
      },
      probation: {
        name: 'Probation Period Limits',
        severity: 'warning',
        description: 'Probationary periods cannot exceed 90 days and must be clearly defined with specific evaluation criteria.',
        lawReference: 'State Employment Law',
        flaggedPhrases: 'probation, probationary period, trial period, evaluation'
      },
      termination: {
        name: 'At-Will Employment Notice',
        severity: 'error',
        description: 'Employment relationship must be clearly defined as at-will with proper notice requirements.',
        lawReference: 'State Labor Code',
        flaggedPhrases: 'at-will, termination, employment relationship, notice period'
      }
    };

    const suggestion = suggestions[suggestionType];
    if (suggestion) {
      setNaturalRuleForm(suggestion);
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
    setIsGenerating(true);
    try {
      let bytesToDownload = null;
      
      // Debug: Log current variables state
      console.log('Download PDF - Current variables:', variables);
      console.log('Download PDF - Template content preview:', template?.content?.substring(0, 200));
      
      // Prefer exporting from the viewer if we have imported bytes
      const importedBytesCandidate = importedPdfBytes || importedPdfBytesRef.current;
      const canUseViewerExport = !!enhancedPdfViewerRef.current && !!importedBytesCandidate;

      if (canUseViewerExport) {
        // Export enhanced PDF with variable updates directly from the viewer
        console.log('Downloading enhanced PDF via viewer export...');
        try {
          bytesToDownload = await enhancedPdfViewerRef.current.exportPDF();
        } catch (exportErr) {
          console.warn('Viewer export threw error - falling back to original imported bytes', exportErr);
          bytesToDownload = importedBytesCandidate;
        }
        const sizeAfterExport = (bytesToDownload?.length ?? bytesToDownload?.byteLength ?? 0);
        if (!bytesToDownload || sizeAfterExport === 0) {
          console.warn('Viewer export returned empty - falling back to original imported bytes');
          bytesToDownload = importedBytesCandidate;
        }
      } else if (template && template.content) {
        // Generate from template with current variables
        console.log('Generating PDF from template with variables...');
        console.log('Variables to apply:', variables);
        
        // Ensure we have the latest template content
        let contentToProcess = templateContent || template.content;
        console.log('Original content preview:', contentToProcess.substring(0, 300));
        
        // MANUAL VARIABLE REPLACEMENT - Ensure variables are applied
        for (const [key, value] of Object.entries(variables)) {
          if (value && value.trim()) {
            const regex = new RegExp(`\\[${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
            contentToProcess = contentToProcess.replace(regex, value);
            console.log(`Replaced [${key}] with "${value}"`);
          }
        }
        
        console.log('Content after variable replacement preview:', contentToProcess.substring(0, 300));
        
        bytesToDownload = await pdfTemplateService.generatePDF(
          contentToProcess,
          {}, // Pass empty variables since we already replaced them manually
          stateConfig.stateBlocks,
          stateConfig.selectedState
        );
      } else {
        alert('No content available to generate PDF. Please import a template or PDF first.');
        setIsGenerating(false);
        return;
      }
      
      let finalBytes = bytesToDownload;
      const finalSize = (finalBytes?.length ?? finalBytes?.byteLength ?? 0);
      if (!finalBytes || finalSize === 0) {
        throw new Error('Generated PDF is empty');
      }

      // Coerce to Uint8Array and validate header; fallback to imported bytes if header missing
      let finalUA = finalBytes instanceof Uint8Array
        ? finalBytes
        : (finalBytes instanceof ArrayBuffer ? new Uint8Array(finalBytes) : new Uint8Array(finalBytes));
      const header = String.fromCharCode(...finalUA.subarray(0, 4));
      if (!header.startsWith('%PDF')) {
        console.warn('Download: Output missing %PDF header, attempting fallback to original imported bytes');
        const importedBytesCandidate2 = importedPdfBytes || importedPdfBytesRef.current;
        if (importedBytesCandidate2) {
          finalUA = importedBytesCandidate2 instanceof Uint8Array ? importedBytesCandidate2 : new Uint8Array(importedBytesCandidate2);
        } else {
          throw new Error('Output is not a valid PDF (no %PDF header)');
        }
      }

      const blob = new Blob([finalUA], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Create a more descriptive filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const candidateName = variables['Candidate Name'] || variables['candidate_name'] || variables['name'] || 'Candidate';
      const cleanName = candidateName.replace(/[^a-zA-Z0-9]/g, '_');
      
      a.href = url;
      a.download = `Offer_Letter_${cleanName}_${timestamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      // Show success message
      alert(`PDF downloaded successfully with all variable updates!\nFile: Offer_Letter_${cleanName}_${timestamp}.pdf`);
      
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(`Failed to download PDF: ${error.message}\n\nPlease check that all variables are filled and try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVariableChange = (varName, value) => {
    console.log(`Variable changed: ${varName} = ${value}`);
    setVariables(prev => {
      const updated = { ...prev, [varName]: value };
      console.log('Updated variables state:', updated);
      return updated;
    });
    
    // Debounce preview refresh for a smoother HR workflow
    if (variableChangeTimerRef.current) {
      clearTimeout(variableChangeTimerRef.current);
    }
    variableChangeTimerRef.current = setTimeout(() => {
      console.log('Refreshing preview with updated variables...');
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
            disabled={isGenerating || (!templateLoaded && !isPdfImported && !isPdfImportedRef.current)}
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
              {/* Direct inline editor with true placeholder editing */}
              {console.log('Rendering DirectInlineEditor with:', {
                importedPdfBytes: !!importedPdfBytes,
                importedPdfBytesLength: importedPdfBytes?.byteLength || 0,
                importedPdfBytesRef: !!importedPdfBytesRef.current,
                importedPdfBytesRefLength: importedPdfBytesRef.current?.byteLength || 0,
                isPdfImported,
                isPdfImportedRef: isPdfImportedRef.current,
                variablesCount: Object.keys(variables || {}).length,
                pdfImportKey
              })}
              {(importedPdfBytes || importedPdfBytesRef.current) ? (
                <DirectInlineEditor
                  key={`direct-editor-${pdfImportKey}`}
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
                    Debug: isPdfImported={isPdfImported.toString()}, isPdfImportedRef={isPdfImportedRef.current?.toString()}, hasBytes={(!!importedPdfBytes).toString()}, hasBytesRef={(!!importedPdfBytesRef.current).toString()}
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
        
        {/* Modern Compliance Analysis Panel */}
        <div className="compliance-analysis-panel">
          <div className="analysis-header">
            <div className="analysis-title-section">
              <div className="analysis-icon">
                <Shield size={20} />
              </div>
              <div className="analysis-title-info">
                <h4 className="analysis-title">Legal Compliance Issues</h4>
                <p className="analysis-subtitle">
                  {sentences.filter(sentence => complianceFlags[sentence.id] && complianceFlags[sentence.id].length > 0).length > 0 
                    ? `${sentences.filter(sentence => complianceFlags[sentence.id] && complianceFlags[sentence.id].length > 0).length} issues found in ${stateConfig.selectedState} compliance review`
                    : `${sentences.length} sentences analyzed - showing only non-compliant content`
                  }
                </p>
              </div>
            </div>
            
            {sentences.length > 0 && (
              <div className="compliance-metrics-badges">
                <div className="metric-badge error">
                  <span className="metric-icon">🚨</span>
                  <span className="metric-count">{Object.values(complianceFlags).flat().filter(f => f.severity === 'error').length}</span>
                  <span className="metric-label">Critical</span>
                </div>
                <div className="metric-badge warning">
                  <span className="metric-icon">⚠️</span>
                  <span className="metric-count">{Object.values(complianceFlags).flat().filter(f => f.severity === 'warning').length}</span>
                  <span className="metric-label">Warnings</span>
                </div>
                <div className="metric-badge info">
                  <span className="metric-icon">🏛️</span>
                  <span className="metric-text">{stateConfig.selectedState}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="analysis-content">
            {sentences.length === 0 && (
              <div className="analysis-empty-state">
                <div className="empty-state-icon">📋</div>
                <h5>No Content to Analyze</h5>
                <p>
                  {isPdfImported ? 
                    'Import a PDF template or add content to begin compliance analysis.' :
                    'Add template content or import a PDF to start analyzing for legal compliance.'
                  }
                </p>
                <div className="empty-state-actions">
                  <button 
                    className="empty-action-btn"
                    onClick={() => document.getElementById('offerLetterInput').click()}
                  >
                    📄 Import PDF
                  </button>
                </div>
              </div>
            )}
            
            <div className="sentences-analysis">
              {sentences
                .filter(sentence => {
                  // Only show sentences that have compliance issues (errors or warnings)
                  const hasFlags = complianceFlags[sentence.id];
                  return hasFlags && hasFlags.length > 0;
                })
                .map((sentence) => {
                  const hasFlags = complianceFlags[sentence.id];
                  const hasErrors = hasFlags && complianceFlags[sentence.id].some(f => f.severity === 'error');
                  const hasWarnings = hasFlags && complianceFlags[sentence.id].some(f => f.severity === 'warning');
                  
                  return (
                    <div key={sentence.id} className="sentence-analysis-card">
                      <div className={`sentence-content ${hasErrors ? 'has-errors' : 'has-warnings'}`}>
                        <div className="sentence-header">
                          <span className="section-badge">§{sentence.section}</span>
                          <div className="sentence-status">
                            {hasErrors ? (
                              <span className="status-badge error">🚨 Critical Issues</span>
                            ) : (
                              <span className="status-badge warning">⚠️ Needs Review</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="sentence-text">
                          {sentence.text}
                        </div>
                      </div>
                      
                      <div className="compliance-flags">
                        {complianceFlags[sentence.id].map((flag, idx) => (
                          <div key={idx} className={`compliance-flag ${flag.severity}`}>
                            <div className="flag-header">
                              <div className="flag-icon">
                                {flag.severity === 'error' ? '🚨' : '⚠️'}
                              </div>
                              <div className="flag-title">
                                <span className="flag-severity">{flag.severity === 'error' ? 'CRITICAL' : 'WARNING'}</span>
                                <span className="flag-type">{flag.type.toUpperCase()}</span>
                              </div>
                            </div>
                            
                            <div className="flag-message">{flag.message}</div>
                            
                            <div className="flag-details">
                              {flag.lawReference && (
                                <div className="flag-detail legal-reference">
                                  <span className="detail-icon">📖</span>
                                  <div className="detail-content">
                                    <strong>Legal Reference:</strong>
                                    <span>{flag.lawReference}</span>
                                  </div>
                                </div>
                              )}
                              
                              {flag.suggestion && (
                                <div className="flag-detail suggestion">
                                  <span className="detail-icon">💡</span>
                                  <div className="detail-content">
                                    <strong>Recommendation:</strong>
                                    <span>{flag.suggestion}</span>
                                  </div>
                                </div>
                              )}
                              
                              {flag.alternativeLanguage && (
                                <div className="flag-detail alternative">
                                  <span className="detail-icon">✏️</span>
                                  <div className="detail-content">
                                    <strong>Suggested Alternative:</strong>
                                    <span className="alternative-text">"{flag.alternativeLanguage}"</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              }
              
              {/* Show message when all content is compliant */}
              {sentences.length > 0 && sentences.filter(sentence => complianceFlags[sentence.id] && complianceFlags[sentence.id].length > 0).length === 0 && (
                <div className="all-compliant-state">
                  <div className="compliant-icon">✅</div>
                  <h5>All Content is Compliant!</h5>
                  <p>Great news! No legal issues were found in the analyzed content.</p>
                  <div className="compliant-summary">
                    <span className="summary-badge">
                      📋 {sentences.length} sentences analyzed
                    </span>
                    <span className="summary-badge">
                      🏛️ {stateConfig.selectedState} compliance verified
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVariablesTab = () => {
    const search = (variableSearch || '').toLowerCase();
    const entries = Object.entries(variables || {})
      .filter(([k]) => !search || k.toLowerCase().includes(search))
      .filter(([k]) => !showFlaggedOnly || (variableMeta[k]?.flaggedOccurrences > 0));

    // Categorize variables for better organization
    const categorizeVariable = (key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('name') || lowerKey.includes('candidate') || lowerKey.includes('employee')) return 'personal';
      if (lowerKey.includes('company') || lowerKey.includes('organization') || lowerKey.includes('employer')) return 'company';
      if (lowerKey.includes('position') || lowerKey.includes('title') || lowerKey.includes('job') || lowerKey.includes('role')) return 'position';
      if (lowerKey.includes('salary') || lowerKey.includes('compensation') || lowerKey.includes('pay') || lowerKey.includes('wage')) return 'compensation';
      if (lowerKey.includes('date') || lowerKey.includes('start') || lowerKey.includes('end') || lowerKey.includes('time')) return 'dates';
      return 'other';
    };

    const categories = {
      personal: { title: '👤 Personal Information', color: '#3b82f6', bgColor: '#eff6ff' },
      company: { title: '🏢 Company Details', color: '#8b5cf6', bgColor: '#f3e8ff' },
      position: { title: '💼 Job Information', color: '#10b981', bgColor: '#ecfdf5' },
      compensation: { title: '💰 Compensation', color: '#f59e0b', bgColor: '#fffbeb' },
      dates: { title: '📅 Important Dates', color: '#ef4444', bgColor: '#fef2f2' },
      other: { title: '📋 Other Details', color: '#6b7280', bgColor: '#f9fafb' }
    };

    const categorizedEntries = entries.reduce((acc, [key, value]) => {
      const category = categorizeVariable(key);
      if (!acc[category]) acc[category] = [];
      acc[category].push([key, value]);
      return acc;
    }, {});

    const completedCount = entries.filter(([_, value]) => value && value.trim()).length;
    const totalCount = entries.length;
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <div className="modern-variables-tab">
        {/* Modern Header with Stats */}
        <div className="variables-header">
          <div className="completion-stats">
            <div className="completion-circle">
              <svg className="progress-ring" width="60" height="60">
                <circle
                  className="progress-ring-bg"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                  fill="transparent"
                  r="26"
                  cx="30"
                  cy="30"
                />
                <circle
                  className="progress-ring-fill"
                  stroke="#10b981"
                  strokeWidth="4"
                  fill="transparent"
                  r="26"
                  cx="30"
                  cy="30"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - completionPercentage / 100)}`}
                />
              </svg>
              <div className="completion-text">
                <span className="percentage">{completionPercentage}%</span>
              </div>
            </div>
            <div className="stats-info">
              <h4>Variable Completion</h4>
              <p>{completedCount} of {totalCount} variables completed</p>
            </div>
          </div>

          {/* Modern Search and Filter */}
          <div className="search-controls">
            <div className="search-input-wrapper">
              <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={variableSearch}
                onChange={(e) => setVariableSearch(e.target.value)}
                placeholder="Search variables..."
                className="modern-search-input"
              />
            </div>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={showFlaggedOnly}
                onChange={(e) => setShowFlaggedOnly(e.target.checked)}
                className="filter-checkbox"
              />
              <span className="filter-text">Show flagged only</span>
            </label>
          </div>
        </div>

        {/* Categorized Variables */}
        <div className="variables-categories">
          {Object.entries(categories).map(([categoryKey, categoryInfo]) => {
            const categoryEntries = categorizedEntries[categoryKey] || [];
            if (categoryEntries.length === 0) return null;

            return (
              <div key={categoryKey} className="variable-category" style={{ '--category-color': categoryInfo.color, '--category-bg': categoryInfo.bgColor }}>
                <div className="category-header">
                  <h5 className="category-title">{categoryInfo.title}</h5>
                  <span className="category-count">{categoryEntries.length} variables</span>
                </div>
                
                <div className="category-variables-grid">
                  {categoryEntries.map(([key, value]) => {
                    const getVariableIcon = (variableKey) => {
                      const lowerKey = variableKey.toLowerCase();
                      if (lowerKey.includes('name') || lowerKey.includes('candidate')) return '👤';
                      if (lowerKey.includes('email')) return '📧';
                      if (lowerKey.includes('phone')) return '📱';
                      if (lowerKey.includes('address')) return '📍';
                      if (lowerKey.includes('company')) return '🏢';
                      if (lowerKey.includes('position') || lowerKey.includes('title') || lowerKey.includes('job')) return '💼';
                      if (lowerKey.includes('salary') || lowerKey.includes('pay')) return '💰';
                      if (lowerKey.includes('date') || lowerKey.includes('start') || lowerKey.includes('end')) return '📅';
                      if (lowerKey.includes('department')) return '🏛️';
                      if (lowerKey.includes('manager') || lowerKey.includes('supervisor')) return '👨‍💼';
                      if (lowerKey.includes('location')) return '🌍';
                      if (lowerKey.includes('experience')) return '⭐';
                      return '📋';
                    };

                    return (
                      <div key={key} className="compact-variable-card">
                        <div className="variable-header">
                          <div className="variable-icon">{getVariableIcon(key)}</div>
                          <div className="variable-info-compact">
                            <span className="variable-name-compact">{key}</span>
                            <div className="variable-badges">
                              <span className="usage-badge">{variableMeta[key]?.occurrences || 0}</span>
                              {variableMeta[key]?.flaggedOccurrences > 0 && (
                                <span className="flag-badge-compact">⚠️</span>
                              )}
                              {value && value.trim() ? (
                                <span className="completed-badge-compact">✓</span>
                              ) : (
                                <span className="pending-badge-compact">○</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleVariableChange(key, e.target.value)}
                          className="compact-variable-input"
                          placeholder={`Enter ${key.toLowerCase()}...`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {entries.length === 0 && (
          <div className="empty-state-modern">
            <div className="empty-icon">📝</div>
            <h3>No variables found</h3>
            <p>Try adjusting your search or import a template to get started.</p>
          </div>
        )}
      </div>
    );
  };

  const renderStateConfigTab = () => {
    const currentStateRules = currentRules[stateConfig.selectedState]?.rules || {};
    const ruleCount = Object.keys(currentStateRules).length;
    const errorRules = Object.values(currentStateRules).filter(rule => rule.severity === 'error').length;
    const warningRules = ruleCount - errorRules;

    return (
      <div className="modern-compliance-tab">
        {/* Compliance Header with Stats */}
        <div className="compliance-header">
          <div className="compliance-stats-card">
            <div className="stats-icon">
              <Shield size={24} />
            </div>
            <div className="stats-content">
              <h3>Legal Compliance</h3>
              <p>Ensure your offer letters meet legal requirements</p>
              <div className="compliance-metrics">
                <div className="metric">
                  <span className="metric-value">{ruleCount}</span>
                  <span className="metric-label">Total Rules</span>
                </div>
                <div className="metric error">
                  <span className="metric-value">{errorRules}</span>
                  <span className="metric-label">Critical</span>
                </div>
                <div className="metric warning">
                  <span className="metric-value">{warningRules}</span>
                  <span className="metric-label">Warnings</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            className="manage-rules-btn"
            onClick={() => setShowRulesManager(!showRulesManager)}
          >
            <BookOpen size={16} />
            <span>{showRulesManager ? 'Hide' : 'Manage'} Rules</span>
          </button>
        </div>

        {/* State Selection */}
        <div className="state-selection-card">
          <div className="state-selector-header">
            <div className="state-icon">🏛️</div>
            <div className="state-info">
              <h4>Jurisdiction Selection</h4>
              <p>Choose the state for compliance verification</p>
            </div>
          </div>
          
          <div className="state-selector-wrapper">
            <select 
              value={stateConfig.selectedState} 
              onChange={(e) => handleStateChange(e.target.value)}
              className="modern-state-select"
            >
              {US_STATES.map(state => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
            
            <div className="state-meta">
              <span className="update-info">
                📅 Last Updated: {currentRules[stateConfig.selectedState]?.lastUpdated || 'Default'}
              </span>
            </div>
          </div>
        </div>

        {/* Rules Manager */}
        {showRulesManager && (
          <div className="rules-manager-card">
            <div className="rules-manager-header">
              <h4>📝 Rules Manager - {stateConfig.selectedState}</h4>
              <p>Add and manage compliance rules for this jurisdiction</p>
            </div>

            <div className="natural-language-rule-editor">
              <div className="rule-input-tabs">
                <button 
                  className={`input-tab ${ruleInputMode === 'natural' ? 'active' : ''}`}
                  onClick={() => setRuleInputMode('natural')}
                >
                  🗣️ Natural Language
                </button>
                <button 
                  className={`input-tab ${ruleInputMode === 'json' ? 'active' : ''}`}
                  onClick={() => setRuleInputMode('json')}
                >
                  📝 JSON Format
                </button>
              </div>

              {ruleInputMode === 'natural' ? (
                <div className="natural-language-input">
                  <label className="rule-editor-label">Describe the compliance rule in plain English:</label>
                  
                  <div className="rule-form-grid">
                    <div className="form-group">
                      <label className="form-label">Rule Name:</label>
                      <input
                        type="text"
                        value={naturalRuleForm.name}
                        onChange={(e) => setNaturalRuleForm({...naturalRuleForm, name: e.target.value})}
                        placeholder="e.g., Minimum Wage Requirement"
                        className="natural-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Severity Level:</label>
                      <select
                        value={naturalRuleForm.severity}
                        onChange={(e) => setNaturalRuleForm({...naturalRuleForm, severity: e.target.value})}
                        className="natural-select"
                      >
                        <option value="error">🚨 Critical (Must Fix)</option>
                        <option value="warning">⚠️ Warning (Should Review)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rule Description:</label>
                    <textarea
                      value={naturalRuleForm.description}
                      onChange={(e) => setNaturalRuleForm({...naturalRuleForm, description: e.target.value})}
                      placeholder="Describe what this rule checks for. For example: 'The salary must be at least $15 per hour to comply with state minimum wage laws.'"
                      className="natural-textarea"
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Legal Reference (Optional):</label>
                    <input
                      type="text"
                      value={naturalRuleForm.lawReference}
                      onChange={(e) => setNaturalRuleForm({...naturalRuleForm, lawReference: e.target.value})}
                      placeholder="e.g., California Labor Code Section 1197"
                      className="natural-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Words/Phrases to Flag:</label>
                    <input
                      type="text"
                      value={naturalRuleForm.flaggedPhrases}
                      onChange={(e) => setNaturalRuleForm({...naturalRuleForm, flaggedPhrases: e.target.value})}
                      placeholder="Enter comma-separated phrases: minimum wage, hourly rate, compensation"
                      className="natural-input"
                    />
                    <div className="input-help">
                      💡 Separate multiple phrases with commas
                    </div>
                  </div>

                  <div className="ai-suggestions">
                    <h6>🤖 AI Suggestions:</h6>
                    <div className="suggestion-chips">
                      <button 
                        className="suggestion-chip"
                        onClick={() => applySuggestion('overtime')}
                      >
                        Overtime Pay Requirements
                      </button>
                      <button 
                        className="suggestion-chip"
                        onClick={() => applySuggestion('benefits')}
                      >
                        Benefits Disclosure
                      </button>
                      <button 
                        className="suggestion-chip"
                        onClick={() => applySuggestion('probation')}
                      >
                        Probation Period Limits
                      </button>
                      <button 
                        className="suggestion-chip"
                        onClick={() => applySuggestion('termination')}
                      >
                        At-Will Employment Notice
                      </button>
                    </div>
                  </div>

                  <div className="json-preview">
                    <label className="form-label">📋 Generated JSON Preview:</label>
                    <pre className="json-preview-code">
                      {generateJSONFromNaturalLanguage()}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="json-input">
                  <label className="rule-editor-label">Add New Compliance Rule (JSON Format):</label>
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
                    className="rule-editor-textarea"
                    rows={8}
                  />
                </div>
              )}
              
              <div className="rule-editor-actions">
                <button 
                  onClick={ruleInputMode === 'natural' ? handleAddNaturalRule : handleAddRule} 
                  className="save-rule-btn"
                  disabled={ruleInputMode === 'natural' ? !naturalRuleForm.name.trim() || !naturalRuleForm.description.trim() : !newRuleData.trim()}
                >
                  <span>💾</span>
                  {ruleInputMode === 'natural' ? 'Create Rule' : 'Save Rule'}
                </button>
                <button 
                  onClick={() => setShowRulesManager(false)} 
                  className="cancel-rule-btn"
                >
                  <span>❌</span>
                  Cancel
                </button>
              </div>
            </div>

            {/* Current Rules Display */}
            <div className="current-rules-section">
              <h5>📋 Active Rules for {stateConfig.selectedState}</h5>
              <div className="rules-grid">
                {Object.entries(currentStateRules).map(([ruleName, rule]) => (
                  <div key={ruleName} className="rule-card">
                    <div className="rule-header">
                      <div className="rule-icon">
                        {rule.severity === 'error' ? '🚨' : '⚠️'}
                      </div>
                      <div className="rule-info">
                        <h6 className="rule-name">{ruleName}</h6>
                        <p className="rule-message">{rule.message}</p>
                      </div>
                      <div className={`severity-badge ${rule.severity}`}>
                        {rule.severity.toUpperCase()}
                      </div>
                    </div>
                    
                    {rule.lawReference && (
                      <div className="rule-reference">
                        📖 {rule.lawReference}
                      </div>
                    )}
                    
                    {rule.flaggedPhrases && rule.flaggedPhrases.length > 0 && (
                      <div className="flagged-phrases">
                        <span className="phrases-label">Flagged Terms:</span>
                        <div className="phrases-list">
                          {rule.flaggedPhrases.map((phrase, idx) => (
                            <span key={idx} className="phrase-tag">"{phrase}"</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {ruleCount === 0 && (
                <div className="no-rules-state">
                  <div className="no-rules-icon">📜</div>
                  <h6>No Custom Rules</h6>
                  <p>Add compliance rules to ensure legal requirements are met</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEditorPanel = () => (
    <div className="editor-panel">
      <div className="panel-header">
        <h3 className="panel-title">Template Editor</h3>
        <button
          className="import-offer-btn"
          onClick={() => document.getElementById('offerLetterInput').click()}
          title="Import Offer Letter PDF"
        >
          <svg className="import-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 15L12 12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="import-text">Import Offer Letter</span>
        </button>
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
    // The DirectInlineEditor will handle variable updates automatically
  

  }}
  onAfterApply={() => {
    // Keep the imported PDF and let DirectInlineEditor handle variable updates
    console.log('NLP replacement applied - keeping imported PDF structure');
    // Variables will automatically update in the direct inline editor
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



