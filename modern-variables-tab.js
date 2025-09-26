// Modern Variables Tab Component - Replace the renderVariablesTab function in EmailEditor.js with this content

const renderVariablesTab = () => {
  const search = (variableSearch || '').toLowerCase();
  const entries = Object.entries(variables || {})
    .filter(([k]) => !search || k.toLowerCase().includes(search))
    .filter(([k]) => !showFlaggedOnly || (variableMeta[k]?.flaggedOccurrences > 0));

  // Group variables by category
  const groupedVariables = {
    personal: entries.filter(([key]) =>
      key.toLowerCase().includes('candidate') ||
      key.toLowerCase().includes('name') ||
      key.toLowerCase().includes('address') ||
      key.toLowerCase().includes('email') ||
      key.toLowerCase().includes('phone')
    ),
    company: entries.filter(([key]) =>
      key.toLowerCase().includes('company') ||
      key.toLowerCase().includes('employer') ||
      key.toLowerCase().includes('organization')
    ),
    job: entries.filter(([key]) =>
      key.toLowerCase().includes('job') ||
      key.toLowerCase().includes('position') ||
      key.toLowerCase().includes('title') ||
      key.toLowerCase().includes('salary') ||
      key.toLowerCase().includes('department')
    ),
    legal: entries.filter(([key]) =>
      key.toLowerCase().includes('date') ||
      key.toLowerCase().includes('start') ||
      key.toLowerCase().includes('end') ||
      key.toLowerCase().includes('term') ||
      key.toLowerCase().includes('agreement')
    ),
    other: entries.filter(([key]) =>
      !key.toLowerCase().includes('candidate') &&
      !key.toLowerCase().includes('name') &&
      !key.toLowerCase().includes('address') &&
      !key.toLowerCase().includes('email') &&
      !key.toLowerCase().includes('phone') &&
      !key.toLowerCase().includes('company') &&
      !key.toLowerCase().includes('employer') &&
      !key.toLowerCase().includes('organization') &&
      !key.toLowerCase().includes('job') &&
      !key.toLowerCase().includes('position') &&
      !key.toLowerCase().includes('title') &&
      !key.toLowerCase().includes('salary') &&
      !key.toLowerCase().includes('department') &&
      !key.toLowerCase().includes('date') &&
      !key.toLowerCase().includes('start') &&
      !key.toLowerCase().includes('end') &&
      !key.toLowerCase().includes('term') &&
      !key.toLowerCase().includes('agreement')
    )
  };

  const categoryIcons = {
    personal: '👤',
    company: '🏢',
    job: '💼',
    legal: '⚖️',
    other: '📄'
  };

  const categoryNames = {
    personal: 'Personal Information',
    company: 'Company Details',
    job: 'Job Information',
    legal: 'Legal & Dates',
    other: 'Other Details'
  };

  const categoryColors = {
    personal: '#3b82f6',
    company: '#10b981',
    job: '#f59e0b',
    legal: '#8b5cf6',
    other: '#6b7280'
  };

  const completedVariables = entries.filter(([_, value]) => value && value.trim() !== '').length;
  const totalVariables = entries.length;
  const completionPercentage = totalVariables > 0 ? Math.round((completedVariables / totalVariables) * 100) : 0;

  return (
    <div className="modern-variables-tab">
      {/* Header Stats */}
      <div className="variables-header">
        <div className="header-content">
          <div className="header-title">
            <h3>Document Variables</h3>
            <p>Customize your offer letter with dynamic content</p>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <div className="stat-number">{totalVariables}</div>
              <div className="stat-label">Total Variables</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{completedVariables}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="completion-ring">
              <div className="ring-background"></div>
              <div
                className="ring-progress"
                style={{
                  background: `conic-gradient(${completionPercentage >= 70 ? '#10b981' : completionPercentage >= 50 ? '#f59e0b' : '#ef4444'} ${completionPercentage * 3.6}deg, #e5e7eb 0deg)`
                }}
              ></div>
              <div className="ring-center">
                <div className="completion-percentage">{completionPercentage}%</div>
                <div className="completion-label">Done</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="variables-controls">
          <div className="search-container">
            <div className="search-icon">🔍</div>
            <input
              type="text"
              value={variableSearch}
              onChange={(e) => setVariableSearch(e.target.value)}
              placeholder="Search variables..."
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={showFlaggedOnly}
                onChange={(e) => setShowFlaggedOnly(e.target.checked)}
              />
              <span className="checkmark"></span>
              Show flagged only
            </label>
            <button
              className="clear-all-btn"
              onClick={() => {
                const cleared = {};
                Object.keys(variables).forEach(key => cleared[key] = '');
                setVariables(cleared);
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Variables Content */}
      <div className="variables-content">
        {Object.entries(groupedVariables).map(([category, vars]) => {
          if (vars.length === 0) return null;

          return (
            <div key={category} className="variable-category">
              <div className="category-header">
                <div className="category-info">
                  <span className="category-icon">{categoryIcons[category]}</span>
                  <h4 className="category-title">{categoryNames[category]}</h4>
                  <span className="category-count">{vars.length}</span>
                </div>
                <div
                  className="category-accent"
                  style={{ backgroundColor: categoryColors[category] }}
                ></div>
              </div>

              <div className="variables-grid">
                {vars.map(([key, value]) => {
                  const meta = variableMeta[key] || {};
                  const isFlagged = meta.flaggedOccurrences > 0;
                  const isCompleted = value && value.trim() !== '';

                  return (
                    <div key={key} className={`variable-card ${isFlagged ? 'flagged' : ''} ${isCompleted ? 'completed' : ''}`}>
                      <div className="variable-header">
                        <div className="variable-label">
                          <span className="variable-key">{key}</span>
                          {isFlagged && <span className="flag-indicator">⚠️</span>}
                        </div>
                        <div className="variable-meta">
                          {meta.occurrences > 0 && (
                            <span className="usage-count">
                              {meta.occurrences} use{meta.occurrences !== 1 ? 's' : ''}
                            </span>
                          )}
                          {isFlagged && (
                            <span className="flagged-count">
                              {meta.flaggedOccurrences} issue{meta.flaggedOccurrences !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="variable-input-container">
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleVariableChange(key, e.target.value)}
                          placeholder={`Enter ${key.toLowerCase()}...`}
                          className="variable-input"
                        />
                        <div className="input-actions">
                          {value && (
                            <button
                              className="clear-btn"
                              onClick={() => handleVariableChange(key, '')}
                              title="Clear value"
                            >
                              ✕
                            </button>
                          )}
                          {isCompleted && (
                            <div className="completion-check">✓</div>
                          )}
                        </div>
                      </div>

                      {isFlagged && (
                        <div className="variable-warning">
                          <span className="warning-icon">⚠️</span>
                          <span className="warning-text">Appears in compliance issues</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {entries.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h4>No variables found</h4>
            <p>
              {search ? 'Try adjusting your search or filters' : 'Import a PDF or add template content to detect variables'}
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .modern-variables-tab {
          padding: 24px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .variables-header {
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .header-title h3 {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px 0;
        }

        .header-title p {
          color: #6b7280;
          margin: 0;
          font-size: 14px;
        }

        .header-stats {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          line-height: 1;
        }

        .stat-label {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
          font-weight: 500;
        }

        .completion-ring {
          position: relative;
          width: 60px;
          height: 60px;
        }

        .ring-background, .ring-progress {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .ring-background {
          background: #e5e7eb;
        }

        .ring-progress {
          clip-path: inset(0 0 0 50%);
          transform: rotate(90deg);
        }

        .ring-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .completion-percentage {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          line-height: 1;
        }

        .completion-label {
          font-size: 10px;
          color: #6b7280;
          margin-top: 1px;
        }

        .variables-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .search-container {
          position: relative;
          flex: 1;
          max-width: 320px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 16px;
          color: #6b7280;
        }

        .search-input {
          width: 100%;
          padding: 12px 12px 12px 40px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          background: #ffffff;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .filter-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #374151;
          cursor: pointer;
          position: relative;
        }

        .filter-checkbox input[type="checkbox"] {
          position: absolute;
          opacity: 0;
          cursor: pointer;
        }

        .checkmark {
          width: 18px;
          height: 18px;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          position: relative;
          transition: all 0.2s ease;
        }

        .filter-checkbox input:checked ~ .checkmark {
          background: #3b82f6;
          border-color: #3b82f6;
        }

        .filter-checkbox input:checked ~ .checkmark::after {
          content: '';
          position: absolute;
          left: 5px;
          top: 2px;
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        .clear-all-btn {
          padding: 8px 16px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .clear-all-btn:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        .variables-content {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .variable-category {
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
        }

        .category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
        }

        .category-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .category-icon {
          font-size: 20px;
        }

        .category-title {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .category-count {
          background: #e5e7eb;
          color: #6b7280;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .category-accent {
          width: 4px;
          height: 24px;
          border-radius: 2px;
        }

        .variables-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 16px;
          padding: 20px;
        }

        .variable-card {
          background: #ffffff;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          transition: all 0.2s ease;
          position: relative;
        }

        .variable-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
          transform: translateY(-1px);
        }

        .variable-card.completed {
          border-color: #10b981;
          background: #f0fdf4;
        }

        .variable-card.flagged {
          border-color: #f59e0b;
          background: #fffbeb;
        }

        .variable-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .variable-label {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .variable-key {
          font-weight: 600;
          color: #111827;
          font-size: 14px;
        }

        .flag-indicator {
          font-size: 14px;
        }

        .variable-meta {
          display: flex;
          gap: 8px;
          font-size: 12px;
        }

        .usage-count {
          background: #e0e7ff;
          color: #3730a3;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }

        .flagged-count {
          background: #fef3c7;
          color: #92400e;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }

        .variable-input-container {
          position: relative;
          margin-bottom: 8px;
        }

        .variable-input {
          width: 100%;
          padding: 12px 40px 12px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: #ffffff;
          transition: all 0.2s ease;
        }

        .variable-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .input-actions {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .clear-btn {
          width: 20px;
          height: 20px;
          border: none;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .clear-btn:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        .completion-check {
          width: 20px;
          height: 20px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }

        .variable-warning {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #92400e;
          background: #fef3c7;
          padding: 6px 8px;
          border-radius: 4px;
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: #6b7280;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state h4 {
          font-size: 18px;
          color: #374151;
          margin: 0 0 8px 0;
        }

        .empty-state p {
          margin: 0;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .variables-grid {
            grid-template-columns: 1fr;
          }

          .header-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .variables-controls {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .filter-controls {
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
};
