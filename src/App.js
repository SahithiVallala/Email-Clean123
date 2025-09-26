import React, { useState } from 'react';
import Login from './components/Login';
import HomeScreen from './components/HomeScreen';
import EmailEditor from './components/EmailEditor';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleLogin = (credentials) => {
    // In a real app, you would validate credentials against a backend
    console.log('User logged in with:', credentials);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentView('home');
    setSelectedTemplate(null);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setCurrentView('editor');
  };

  const handlePDFGenerate = (template) => {
    setSelectedTemplate(template);
    setCurrentView('editor');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedTemplate(null);
  };

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      {currentView === 'home' && (
        <HomeScreen
          onTemplateSelect={handleTemplateSelect}
          onPDFGenerate={handlePDFGenerate}
          onLogout={handleLogout}
        />
      )}
      {currentView === 'editor' && selectedTemplate && (
        <EmailEditor
          template={selectedTemplate}
          onBack={handleBackToHome}
        />
      )}
    </div>
  );
}

export default App;
