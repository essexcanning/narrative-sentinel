import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { WelcomeModal } from './components/WelcomeModal';
import { AnalysisInput, Narrative, Post, SearchSource, Theme, Page, TaskforceItem, AnalysisStep } from './types';
import { fetchRealtimePosts, detectAndClusterNarratives, enrichNarrative, generateTaskforceBrief } from './services/geminiService';
import { fetchTwitterPosts } from './services/twitterService';
import { Header } from './components/Header';
import { Toast, ToastData } from './components/Toast';
import { generateId } from './utils/generateId';
import { TaskforceDashboard } from './components/TaskforceDashboard';

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
  
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    setToasts(currentToasts => [...currentToasts, { ...toast, id: generateId() }]);
  }, []);

  const handleAnalysis = useCallback(async (inputs: AnalysisInput) => {
    setIsLoading(true);
    setCurrentPage('dashboard');
    setNarratives([]);
    setSources([]);
    
    const initialSteps: AnalysisStep[] = [];
    if (inputs.sources.includes('Google News / Search')) {
      initialSteps.push({ id: 'google', label: `Performing Google News/Search scan for ${inputs.country}...`, status: 'pending' });
    }
    if (inputs.sources.includes('X / Twitter')) {
      initialSteps.push({ id: 'twitter', label: 'Scanning X/Twitter...', status: 'pending' });
    }
    initialSteps.push({ id: 'clustering', label: 'Clustering narratives...', status: 'pending' });
    setAnalysisSteps(initialSteps);

    const updateStepStatus = (id: string, status: AnalysisStep['status'], label?: string) => {
        setAnalysisSteps(prevSteps => prevSteps.map(step => step.id === id ? { ...step, status, label: label || step.label } : step));
    };

    try {
      let combinedPosts: Post[] = [];
      let combinedSources: SearchSource[] = [];
      
      setAnalysisPhase('fetching');

      if (inputs.sources.includes('Google News / Search')) {
        updateStepStatus('google', 'in-progress');
        try {
          const result = await fetchRealtimePosts(inputs);
          combinedPosts.push(...result.posts);
          combinedSources.push(...result.sources);
          updateStepStatus('google', 'done', `Google News/Search scan complete.`);
        } catch (e) {
            updateStepStatus('google', 'error', `Google News/Search scan failed.`);
            throw e;
        }
      }
      
      if (inputs.sources.includes('X / Twitter')) {
         updateStepStatus('twitter', 'in-progress');
         try {
            const result = await fetchTwitterPosts(inputs);
            combinedPosts.push(...result.posts);
            combinedSources.push(...result.sources);
            updateStepStatus('twitter', 'done', 'X/Twitter scan complete.');
         } catch (e) {
            updateStepStatus('twitter', 'error', 'X/Twitter scan failed.');
            throw e;
         }
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
  }, [addToast, analysisPhase]);

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
  
  const handleWelcomeAcknowledge = () => {
    setShowWelcome(false);
  };

  const removeToast = (id: string) => {
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
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
        <Sidebar onAnalyze={handleAnalysis} isLoading={isLoading} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} currentPage={currentPage} setCurrentPage={setCurrentPage} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} theme={theme} setTheme={setTheme} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-background">
            {currentPage === 'dashboard' ? (
              <Dashboard 
                narratives={narratives} 
                sources={sources} 
                isLoading={isLoading} 
                analysisPhase={analysisPhase}
                analysisSteps={analysisSteps}
                onAssignToTaskforce={handleAssignToTaskforce}
              />
            ) : (
              <TaskforceDashboard items={taskforceItems} />
            )}
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