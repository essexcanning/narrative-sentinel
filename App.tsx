
import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { WelcomeModal } from './components/WelcomeModal';
import { AnalysisInput, Narrative, Post, SearchSource, Theme, Page, TaskforceItem, AnalysisStep, User, AnalysisHistoryItem } from './types';
import { fetchRealtimePosts, detectAndClusterNarratives, enrichNarrative, generateTaskforceBrief } from './services/geminiService';
import { Header } from './components/Header';
import { Toast, ToastData } from './components/Toast';
import { generateId } from './utils/generateId';
import { TaskforceDashboard } from './components/TaskforceDashboard';
import { LoginModal } from './components/LoginModal';
import { NarrativeDetail } from './components/NarrativeDetail';
import { auth, onAuthStateChanged, signOut, mapFirebaseUser } from './services/firebase';

const App: React.FC = () => {
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisPhase, setAnalysisPhase] = useState<'fetching' | 'clustering' | 'enriching' | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  const [theme, setTheme] = useState<Theme>('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [taskforceItems, setTaskforceItems] = useState<TaskforceItem[]>([]);
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedNarrative, setSelectedNarrative] = useState<Narrative | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);
  
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
            setCurrentUser(mapFirebaseUser(firebaseUser));
        } else {
            setCurrentUser(null);
        }
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (currentUser) {
        try {
            const storedHistory = localStorage.getItem(`openNarrativeHistory_${currentUser.id}`);
            if (storedHistory) {
                setAnalysisHistory(JSON.parse(storedHistory));
            } else {
                setAnalysisHistory([]);
            }
        } catch (error) {
            console.error("Failed to load analysis history from localStorage", error);
        }
    }
  }, [currentUser]);


  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    setToasts(currentToasts => [...currentToasts, { ...toast, id: generateId() }]);
  }, []);

  const handleAnalysis = useCallback(async (inputs: AnalysisInput) => {
    if (!currentUser) return;

    // Add to history right away, move to top if it's a re-run
    const newHistoryItem: AnalysisHistoryItem = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        inputs,
    };
    setAnalysisHistory(prev => {
        const filtered = prev.filter(item => JSON.stringify(item.inputs) !== JSON.stringify(inputs));
        const updated = [newHistoryItem, ...filtered].slice(0, 20); // Keep last 20
        try {
            localStorage.setItem(`openNarrativeHistory_${currentUser.id}`, JSON.stringify(updated));
        } catch (error) {
            console.error("Failed to save analysis history to localStorage", error);
        }
        return updated;
    });

    setIsLoading(true);
    setSelectedNarrative(null); // Clear detail view on new analysis
    setCurrentPage('dashboard');
    setNarratives([]);
    setSources([]);
    
    // Unified search: All sources are now handled via Gemini Search Grounding
    const initialSteps: AnalysisStep[] = [];
    initialSteps.push({ id: 'search-grounding', label: `Scanning platforms for ${inputs.country}...`, status: 'pending' });
    initialSteps.push({ id: 'clustering', label: 'Clustering narratives...', status: 'pending' });
    setAnalysisSteps(initialSteps);

    const updateStepStatus = (id: string, status: AnalysisStep['status'], label?: string) => {
        setAnalysisSteps(prevSteps => prevSteps.map(step => step.id === id ? { ...step, status, label: label || step.label } : step));
    };

    try {
      let combinedPosts: Post[] = [];
      let combinedSources: SearchSource[] = [];
      
      setAnalysisPhase('fetching');

      // Execute unified search
      updateStepStatus('search-grounding', 'in-progress');
      try {
        const result = await fetchRealtimePosts(inputs);
        combinedPosts.push(...result.posts);
        combinedSources.push(...result.sources);
        updateStepStatus('search-grounding', 'done', `Multi-platform scan complete.`);
      } catch (e) {
        updateStepStatus('search-grounding', 'error', `Platform scan failed.`);
        throw e;
      }
      
      const uniqueSources = Array.from(new Map(combinedSources.map(s => [s.uri, s])).values());
      setSources(uniqueSources);

      if (combinedPosts.length === 0) {
        addToast({ type: 'warning', message: 'No significant posts found for the given criteria.' });
        setNarratives([]);
        setIsLoading(false);
        setAnalysisPhase(null);
        return;
      }
      
      setAnalysisPhase('clustering');
      updateStepStatus('clustering', 'in-progress');
      const initialNarratives = await detectAndClusterNarratives(combinedPosts, `trending narratives in ${inputs.country}`);
      
      if (!initialNarratives || initialNarratives.length === 0) {
        updateStepStatus('clustering', 'done', 'Clustering complete. No distinct narratives found.');
        addToast({ type: 'warning', message: 'Could not detect distinct narratives.' });
        setNarratives([]);
      } else {
        updateStepStatus('clustering', 'done', `Clustering complete. Found ${initialNarratives.length} narratives.`);
        const narrativesWithPosts = initialNarratives.map(n => ({ 
          ...n, 
          status: 'pending' as const, 
          posts: combinedPosts.filter(p => n.postIds.includes(p.id)) 
        }));
        setNarratives(narrativesWithPosts);
        
        setIsLoading(false); // Stop main loading, show pending cards
        setAnalysisPhase('enriching');
        addToast({ type: 'info', message: `Detected ${initialNarratives.length} narratives. Starting deep analysis...` });

        // Sequentially enrich narratives
        for (const narrative of narrativesWithPosts) {
            try {
                const enriched = await enrichNarrative(narrative, narrative.posts);
                setNarratives(prev => prev.map(n => n.id === enriched.id ? { ...enriched, status: 'complete' } : n));
            } catch (err) {
                console.error(`Failed to enrich narrative ${narrative.id}:`, err);
                setNarratives(prev => prev.map(n => n.id === narrative.id ? { ...n, status: 'error' } : n));
                addToast({type: 'error', message: `Analysis failed for narrative: "${narrative.title.substring(0, 20)}..."`})
            }
        }
        addToast({ type: 'success', message: 'Analysis complete.' });
      }

    } catch (err) {
      console.error('Analysis failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      addToast({ type: 'error', message: `Analysis failed: ${errorMessage}` });
    } finally {
      if (analysisPhase !== 'enriching') {
          setIsLoading(false);
          setAnalysisPhase(null);
      } else {
          setAnalysisPhase(null); // Enrichment is done.
      }
    }
  }, [addToast, analysisPhase, currentUser]);

  const handleAssignToTaskforce = useCallback(async (narrative: Narrative) => {
    addToast({ type: 'info', message: `Assigning "${narrative.title.substring(0, 20)}..." to taskforce.` });
    try {
        const assignmentBrief = await generateTaskforceBrief(narrative);
        const newItem: TaskforceItem = {
            id: generateId(),
            narrativeTitle: narrative.title,
            assignmentBrief,
            posts: narrative.posts?.map(p => ({ content: p.content, link: p.link })) || []
        };
        setTaskforceItems(prev => [newItem, ...prev]);
        addToast({ type: 'success', message: 'Successfully assigned to taskforce.' });
    } catch (err) {
        console.error("Failed to assign to taskforce:", err);
        addToast({ type: 'error', message: 'Failed to generate assignment brief.' });
    }
  }, [addToast]);
  
  const handleAssignToCampaign = useCallback((narrativeId: string, campaignName: string) => {
    const updatedNarratives = narratives.map(n => 
        n.id === narrativeId ? { ...n, campaign: campaignName } : n
    );
    setNarratives(updatedNarratives);

    if (selectedNarrative && selectedNarrative.id === narrativeId) {
        setSelectedNarrative(prev => prev ? { ...prev, campaign: campaignName } : null);
    }
    addToast({ type: 'success', message: `Tagged narrative as part of "${campaignName}" campaign.` });
  }, [narratives, selectedNarrative, addToast]);

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    // Reset app state for a clean slate
    setNarratives([]);
    setSources([]);
    setTaskforceItems([]);
    setAnalysisSteps([]);
    setCurrentPage('dashboard');
    setShowWelcome(true);
    setSelectedNarrative(null);
    setAnalysisHistory([]);
  };

  const handleWelcomeAcknowledge = () => {
    setShowWelcome(false);
  };

  const removeToast = (id: string) => {
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
  };
  
  const handleSelectNarrative = (narrative: Narrative) => {
    setSelectedNarrative(narrative);
  };

  const handleBackToDashboard = () => {
    setSelectedNarrative(null);
  };
  
  const handleClearHistory = () => {
      if (!currentUser) return;
      setAnalysisHistory([]);
      try {
          localStorage.removeItem(`openNarrativeHistory_${currentUser.id}`);
          addToast({ type: 'info', message: 'Analysis history cleared.' });
      } catch (e) {
          console.error('Failed to clear history:', e);
          addToast({ type: 'error', message: 'Could not clear history.' });
      }
  };

  if (authLoading) {
      return (
          <div className="flex h-screen items-center justify-center bg-background">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
      );
  }

  if (!currentUser) {
    return <LoginModal onLoginSuccess={(user) => { if (user) setCurrentUser(user); }} />;
  }
  
  const renderPage = () => {
    if (selectedNarrative) {
        return <NarrativeDetail 
                    narrative={selectedNarrative}
                    onBack={handleBackToDashboard}
                    onAssignToTaskforce={handleAssignToTaskforce}
                    onAssignToCampaign={handleAssignToCampaign}
                />;
    }
    switch (currentPage) {
        case 'dashboard':
            return <Dashboard 
                        narratives={narratives} 
                        sources={sources} 
                        isLoading={isLoading} 
                        analysisPhase={analysisPhase}
                        analysisSteps={analysisSteps}
                        onAssignToTaskforce={handleAssignToTaskforce}
                        onSelectNarrative={handleSelectNarrative}
                    />;
        case 'taskforce':
            return <TaskforceDashboard items={taskforceItems} />;
        default:
            return null;
    }
  };


  return (
    <>
      <div className={`fixed inset-x-0 top-0 z-50 p-4 flex flex-col items-end space-y-2 pointer-events-none`}>
        {toasts.map(toast => (
          <Toast key={toast.id} data={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
      {showWelcome && <WelcomeModal onAcknowledge={handleWelcomeAcknowledge} />}
      <div className={`flex h-screen bg-background text-text-primary font-sans transition-all duration-300 ${showWelcome ? 'blur-md' : ''}`}>
        <Sidebar 
            onAnalyze={handleAnalysis} 
            isLoading={isLoading} 
            isOpen={isSidebarOpen} 
            setIsOpen={setIsSidebarOpen} 
            currentPage={currentPage} 
            setCurrentPage={setCurrentPage}
            analysisHistory={analysisHistory}
            onRunHistory={handleAnalysis}
            onClearHistory={handleClearHistory}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} theme={theme} setTheme={setTheme} currentUser={currentUser} onLogout={handleLogout} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-background">
            {renderPage()}
          </main>
          <footer className="flex-shrink-0 border-t border-border px-4 md:px-6 py-2 text-center text-xs text-text-secondary">
            Fueled by some magic from Gemini &bull; Open Source &bull; MIT License
          </footer>
        </div>
      </div>
    </>
  );
};

export default App;
