import React, { useState } from 'react';
import { Plus, FileText, Pen, Download, Settings, Users, BarChart3, Shield, Clock, Search, LogOut } from 'lucide-react';
import TemplateModal from './TemplateModal';

const HomeScreen = ({ onTemplateSelect, onPDFGenerate, onLogout }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [templates, setTemplates] = useState([
    {
      id: 1,
      title: 'Offer Letter Template',
      description: 'Standard employment offer letter with customizable clauses',
      category: 'hiring',
      lastModified: '2025-01-20',
      usage: 45,
      compliance: 'verified',
      preview: 'Dear [Candidate Name], We are pleased to offer you the position of [Job Title]...',
      content: `Dear [Candidate Name],

We are pleased to offer you the position of [Job Title] at [Company Name]. This offer is contingent upon your acceptance of the following terms and conditions:

Position: [Job Title]
Department: [Department]
Start Date: [Start Date]
Salary: $[Amount] per [Period]
Benefits: [List of Benefits]

This offer is valid for [Number] days from the date of this letter. Please sign and return a copy of this letter to indicate your acceptance.

We look forward to welcoming you to our team.

Sincerely,
[Hiring Manager Name]
[Company Name]`
    },
    {
      id: 2,
      title: 'Welcome Email',
      description: 'New employee welcome and onboarding email',
      category: 'onboarding',
      lastModified: '2025-01-18',
      usage: 32,
      compliance: 'verified',
      preview: 'Welcome to [Company Name]! We are excited to have you join our team...',
      content: `Welcome to [Company Name]!

We are excited to have you join our team as [Job Title]. Your first day will be [Start Date] at [Time].

Please bring the following documents:
- Government-issued ID
- Social Security Card
- Direct Deposit Form
- Emergency Contact Information

If you have any questions, please don't hesitate to reach out.

Best regards,
[HR Team]`
    }
  ]);

  const categories = [
    { id: 'all', name: 'All Templates', count: templates.length },
    { id: 'hiring', name: 'Hiring', count: templates.filter(t => t.category === 'hiring').length },
    { id: 'onboarding', name: 'Onboarding', count: templates.filter(t => t.category === 'onboarding').length },
    { id: 'performance', name: 'Performance', count: 0 },
    { id: 'termination', name: 'Termination', count: 0 }
  ];

  const handleAddTemplate = (templateData) => {
    const newTemplate = {
      id: Date.now(),
      ...templateData,
      category: templateData.category || 'other',
      lastModified: new Date().toISOString().split('T')[0],
      usage: 0,
      compliance: 'pending',
      content: templateData.content || 'Your email content will appear here...'
    };
    setTemplates([...templates, newTemplate]);
    setShowAddModal(false);
  };

  const handleTemplateClick = (template) => {
    onTemplateSelect(template);
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getComplianceColor = (compliance) => {
    switch (compliance) {
      case 'verified': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'review': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getComplianceText = (compliance) => {
    switch (compliance) {
      case 'verified': return 'Compliant';
      case 'pending': return 'Review Pending';
      case 'review': return 'Needs Review';
      default: return 'Not Checked';
    }
  };

  return (
    <div className="home-screen">
      {/* Professional Header */}
      <div className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-section">
              <div className="logo">HR Portal</div>
              <div className="header-subtitle">Document Management System</div>
            </div>
          </div>
          <div className="header-right">
            <button 
              className="logout-btn"
              onClick={onLogout}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
            <div className="user-info">
              <div className="user-details">
                <span className="user-name">HR Administrator</span>
                <span className="user-role">Document Manager</span>
              </div>
              <div className="user-avatar">
                <Users size={18} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="dashboard-stats">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <FileText size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{templates.length}</div>
                <div className="stat-label">Active Templates</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <BarChart3 size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{templates.reduce((sum, t) => sum + t.usage, 0)}</div>
                <div className="stat-label">Documents Generated</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Shield size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{templates.filter(t => t.compliance === 'verified').length}</div>
                <div className="stat-label">Compliance Verified</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">98%</div>
                <div className="stat-label">System Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-section">
            <h1 className="page-title">Document Templates</h1>
            <p className="page-description">
              Manage and create professional HR documents with built-in compliance checking
            </p>
          </div>
          <div className="page-actions">
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} />
              New Template
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="filters-section">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="category-filters">
            {categories.map(category => (
              <button
                key={category.id}
                className={`filter-btn ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
                <span className="filter-count">{category.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="templates-section">
          <div className="template-grid">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="template-card"
              >
                <div className="template-header">
                  <div className="template-icon">
                    <FileText size={20} />
                  </div>
                  <div className="template-meta">
                    <div 
                      className="compliance-badge"
                      style={{ 
                        backgroundColor: getComplianceColor(template.compliance) + '20',
                        color: getComplianceColor(template.compliance)
                      }}
                    >
                      <Shield size={12} />
                      {getComplianceText(template.compliance)}
                    </div>
                  </div>
                </div>
                
                <div className="template-content">
                  <h3 className="template-title">{template.title}</h3>
                  <p className="template-description">{template.description}</p>
                </div>

                <div className="template-stats">
                  <div className="stat-item">
                    <span className="stat-label">Used</span>
                    <span className="stat-value">{template.usage}x</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Modified</span>
                    <span className="stat-value">{template.lastModified}</span>
                  </div>
                </div>

                <div className="template-actions">
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => onTemplateSelect(template)}
                  >
                    <Pen size={14} />
                    Edit Template
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => onPDFGenerate && onPDFGenerate(template)}
                  >
                    <Download size={14} />
                    Generate
                  </button>
                </div>
              </div>
            ))}

            {/* Add Template Card */}
            <div
              className="template-card add-template-card"
              onClick={() => setShowAddModal(true)}
            >
              <div className="add-template-content">
                <div className="add-template-icon">
                  <Plus size={32} />
                </div>
                <h3 className="add-template-title">Create New Template</h3>
                <p className="add-template-description">
                  Build a custom document template for your organization
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <TemplateModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddTemplate}
        />
      )}

      <style jsx>{`
        .home-screen {
          min-height: 100vh;
          background-color: #f8fafc;
        }

        /* Professional Header */
        .header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 16px 0;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
        }

        .logo-section {
          display: flex;
          flex-direction: column;
        }

        .logo {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 2px;
        }

        .header-subtitle {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .logout-btn {
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .logout-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .user-details {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .user-name {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }

        .user-role {
          font-size: 12px;
          color: #64748b;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          background: #3b82f6;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        /* Dashboard Stats */
        .dashboard-stats {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 20px 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          background: #3b82f6;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .stat-content {
          flex: 1;
        }

        .stat-number {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1;
        }

        .stat-label {
          font-size: 14px;
          color: #64748b;
          margin-top: 4px;
        }

        /* Main Content */
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 32px 0 24px 0;
        }

        .page-title {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .page-description {
          font-size: 16px;
          color: #64748b;
          margin: 0;
        }

        /* Filters */
        .filters-section {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 32px;
          padding: 20px;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .search-bar {
          position: relative;
          flex: 1;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .search-input {
          width: 100%;
          padding: 12px 12px 12px 44px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          background: #f8fafc;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          background: white;
        }

        .category-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-btn:hover {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .filter-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .filter-count {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .filter-btn.active .filter-count {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Template Grid */
        .template-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }

        .template-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 24px;
          transition: all 0.2s ease;
          cursor: pointer;
          overflow: hidden;
          word-wrap: break-word;
          display: flex;
          flex-direction: column;
          height: fit-content;
        }

        .template-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transform: translateY(-1px);
        }

        .template-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-shrink: 0;
        }

        .template-icon {
          width: 40px;
          height: 40px;
          background: #f1f5f9;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b82f6;
          flex-shrink: 0;
        }

        .compliance-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .template-content {
          margin-bottom: 20px;
          flex-grow: 1;
          overflow: hidden;
        }

        .template-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          word-wrap: break-word;
        }

        .template-description {
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          word-wrap: break-word;
          hyphens: auto;
        }

        .template-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          padding: 12px 0;
          border-top: 1px solid #f1f5f9;
          border-bottom: 1px solid #f1f5f9;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-item .stat-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }

        .stat-item .stat-value {
          font-size: 14px;
          color: #1e293b;
          font-weight: 600;
        }

        .template-actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 10px 16px;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          justify-content: center;
        }

        .btn-sm {
          padding: 8px 12px;
          font-size: 13px;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        /* Add Template Card */
        .add-template-card {
          border: 2px dashed #cbd5e1;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 280px;
        }

        .add-template-card:hover {
          border-color: #3b82f6;
          background: #f0f9ff;
        }

        .add-template-content {
          text-align: center;
        }

        .add-template-icon {
          width: 64px;
          height: 64px;
          background: #e2e8f0;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px auto;
          color: #64748b;
        }

        .add-template-card:hover .add-template-icon {
          background: #3b82f6;
          color: white;
        }

        .add-template-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .add-template-description {
          font-size: 14px;
          color: #64748b;
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 16px;
          }

          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .filters-section {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }

          .template-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default HomeScreen;