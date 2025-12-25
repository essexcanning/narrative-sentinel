
import React, { useState } from 'react';
import { AnalysisInput, Page, AnalysisHistoryItem } from '../types';
import { COUNTRIES } from '../constants';
import { FilterIcon, LoadingSpinner, CheckIcon, ChevronLeftIcon, DashboardIcon, ShieldExclamationIcon } from './icons/GeneralIcons';
import { CustomSelect } from './forms/CustomSelect';
import { CustomInput } from './forms/CustomInput';
import { CustomDateInput } from './forms/CustomDateInput';
import { CustomCheckbox } from './forms/CustomCheckbox';
import { AnalysisHistory } from './AnalysisHistory';
import clsx from 'clsx';

interface SidebarProps {
  onAnalyze: (inputs: AnalysisInput) => void;
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  analysisHistory: AnalysisHistoryItem[];
  onRunHistory: (inputs: AnalysisInput) => void;
  onClearHistory: () => void;
}

const NavButton: React.FC<{ icon: React.ElementType; label: string; isActive: boolean; onClick: () => void; }> = ({ icon: Icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={clsx(
            "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
            isActive
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:bg-background-hover hover:text-text-primary"
        )}
    >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
    </button>
);


export const Sidebar: React.FC<SidebarProps> = ({ 
    onAnalyze, 
    isLoading, 
    isOpen, 
    setIsOpen, 
    currentPage, 
    setCurrentPage,
    analysisHistory,
    onRunHistory,
    onClearHistory 
}) => {
  const [country, setCountry] = useState('Moldova');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [sources, setSources] = useState({
    googleNews: true,
    twitter: false,
    reddit: false,
    telegram: false,
    tiktok: false
  });

  const handleSourceChange = (name: keyof typeof sources) => {
    setSources(prev => ({ ...prev, [name]: !prev[name] }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedSources = Object.entries(sources)
      .filter(([, checked]) => checked)
      .map(([name]): string | null => {
        if (name === 'googleNews') return 'Google News / Search';
        if (name === 'twitter') return 'X / Twitter';
        if (name === 'reddit') return 'Reddit';
        if (name === 'telegram') return 'Telegram';
        if (name === 'tiktok') return 'TikTok';
        return null;
      })
      .filter((name): name is string => name !== null);
    
    if (selectedSources.length === 0) {
      alert("Please select at least one data source.");
      return;
    }

    onAnalyze({
      country,
      timeFrame: { start: startDate, end: endDate },
      sources: selectedSources,
    });
  };

  return (
    <aside className={clsx(
      "bg-background-secondary border-r border-border flex flex-col h-full transition-all duration-300 ease-in-out",
      isOpen ? "w-full md:w-80 lg:w-96 p-6" : "w-0 p-0 overflow-hidden"
    )}>
       <div className="flex items-center justify-between mb-6 min-w-[300px]">
         <h2 className="text-xl font-semibold text-text-primary">OpenNarrative</h2>
         <button onClick={() => setIsOpen(false)} className="md:hidden p-1 text-text-secondary hover:text-text-primary">
            <ChevronLeftIcon className="h-6 w-6" />
        </button>
      </div>

      <nav className="space-y-2 mb-6 min-w-[300px]">
        <NavButton icon={DashboardIcon} label="Dashboard" isActive={currentPage === 'dashboard'} onClick={() => setCurrentPage('dashboard')} />
        <NavButton icon={ShieldExclamationIcon} label="Taskforce" isActive={currentPage === 'taskforce'} onClick={() => setCurrentPage('taskforce')} />
      </nav>

      <AnalysisHistory 
        history={analysisHistory}
        onRun={onRunHistory}
        onClear={onClearHistory}
        isLoading={isLoading}
      />

      <div className="flex items-center justify-between mb-4 pt-6 border-t border-border min-w-[300px]">
        <div className="flex items-center">
            <FilterIcon className="h-6 w-6 text-text-secondary mr-3" />
            <h2 className="text-xl font-semibold text-text-primary">Analysis Parameters</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-grow flex flex-col min-w-[300px]">
        <div className="space-y-6 flex-grow">
          <CustomSelect
            id="country"
            label="Country"
            value={country}
            onChange={setCountry}
            options={COUNTRIES.map(c => ({ value: c, label: c }))}
          />
          <div>
             <label className="block text-sm font-medium text-text-secondary mb-2">Time Frame</label>
            <div className="space-y-2">
                <CustomDateInput value={startDate} onChange={setStartDate} />
                <CustomDateInput value={endDate} onChange={setEndDate} />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center">
              Data Sources
            </label>
            <div className="space-y-3 bg-background p-3 rounded-lg border border-border">
              <CustomCheckbox id="googleNews" label="Google News / Search" checked={sources.googleNews} onChange={() => handleSourceChange('googleNews')} />
              <CustomCheckbox id="reddit" label="Reddit" checked={sources.reddit} onChange={() => handleSourceChange('reddit')} />
              <CustomCheckbox id="telegram" label="Telegram (Public Channels)" checked={sources.telegram} onChange={() => handleSourceChange('telegram')} />
              <CustomCheckbox id="tiktok" label="TikTok" checked={sources.tiktok} onChange={() => handleSourceChange('tiktok')} />
              <div className="pt-2 mt-2 border-t border-border/50">
                  <CustomCheckbox id="twitter" label="X / Twitter" checked={sources.twitter} onChange={() => handleSourceChange('twitter')} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-secondary focus:ring-primary disabled:bg-background-disabled disabled:text-text-disabled disabled:cursor-not-allowed transition-all"
            >
                {isLoading ? (
                    <>
                        <LoadingSpinner className="h-5 w-5 mr-2" />
                        Analyzing...
                    </>
                ) : 'Discover Narratives'}
            </button>
        </div>
      </form>
    </aside>
  );
};
