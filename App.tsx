import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { WelcomeModal } from './components/WelcomeModal';
import { AnalysisInput, Narrative, Post, SearchSource, Theme, Page, TaskforceItem } from './types';
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
  
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    setToasts(currentToasts => [...currentToasts, { ...toast, id: generateId() }]);
  }, []);

  const handleAnalysis = useCallback(async (inputs: AnalysisInput) => {
    setIsLoading(true);
    setAnalysisPhase('fetching');
    setCurrentPage('dashboard');
    setNarratives([]);
    setSources([]);
    addToast({ type: 'info', message: 'Starting analysis... Fetching real-time data.' });

    try {
      const dataPromises: Promise<{ posts: Post[], sources: SearchSource[] }>[] = [];

      if (inputs.sources.includes('Google News / Search')) {
        dataPromises.push(fetchRealtimePosts(inputs));
      }
      if (inputs.sources.includes('X / Twitter')) {
        dataPromises.push(fetchTwitterPosts(inputs));
      }

      const results = await Promise.allSettled(dataPromises);
      
      let combinedPosts: Post[] = [];
      let combinedSources: SearchSource[] = [];
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          combinedPosts.push(...result.value.posts);
          combinedSources.push(...result.value.sources);
        } else {
          console.error(`Failed to fetch from a source:`, result.reason);
          addToast({ type: 'error', message: 'Failed to fetch data from a source.' });
        }
      });
      
      const uniqueSources = Array.from(new Map(combinedSources.map(s => [s.uri, s])).values());
      setSources(uniqueSources);

      if (combinedPosts.length === 0) {
        addToast({ type: 'warning', message: 'No relevant posts found for the given criteria.' });
        setNarratives([]);
      } else {
        setAnalysisPhase('clustering');
        addToast({ type: 'info', message: `Found ${combinedPosts.length} posts. Clustering narratives...` });
        const initialNarratives = await detectAndClusterNarratives(combinedPosts, `narratives about ${inputs.topic} in ${inputs.country}`);
        
        if (!initialNarratives || initialNarratives.length === 0) {
          addToast({ type: 'warning', message: 'Could not detect distinct narratives.' });
          setNarratives([]);
        } else {
          const narrativesWithPosts = initialNarratives.map(n => ({ 
            ...n, 
            status: 'pending' as const, 
            posts: combinedPosts.filter(p => n.postIds.includes(p.id)) 
          }));
          setNarratives(narrativesWithPosts);
          
          setAnalysisPhase('enriching');
          addToast({ type: 'info', message: `Detected ${initialNarratives.length} narratives. Starting deep analysis...` });

          const enrichmentPromises = narrativesWithPosts.map(narrative => {
             return enrichNarrative(narrative, narrative.posts)
              .then(enriched => {
                setNarratives(prev => prev.map(n => n.id === enriched.id ? { ...enriched, posts: narrative.posts, status: 'complete' } : n));
                return enriched;
              })
              .catch(err => {
                console.error(`Failed to enrich narrative ${narrative.id}:`, err);
                setNarratives(prev => prev.map(n => n.id === narrative.id ? { ...n, status: 'error' } : n));
                addToast({type: 'error', message: `Analysis failed for narrative: "${narrative.title.substring(0, 20)}..."`})
                return null;
              });
          });
          
          await Promise.all(enrichmentPromises);
          addToast({ type: 'success', message: 'Analysis complete.' });
        }
      }

    } catch (err) {
      console.error('Analysis failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      addToast({ type: 'error', message: `Analysis failed: ${errorMessage}` });
    } finally {
      setIsLoading(false);
      setAnalysisPhase(null);
    }
  }, [addToast]);

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
                onAssignToTaskforce={handleAssignToTaskforce}
              />
            ) : (
              <TaskforceDashboard items={taskforceItems} />
            )}
          </main>
          <footer className="flex-shrink-0 border-t border-border px-4 md:px-6 py-2 text-center text-xs text-text-secondary">
            Built with Gemini &bull; Open Source &bull; MIT License &bull; London Hackathon 2025
          </footer>
        </div>
      </div>
    </>
  );
};

export default App;