import React, { useState } from 'react';
import { Narrative, SearchSource, AnalysisStep } from '../types';
import { NarrativeCard } from './NarrativeCard';
import { SourcesUsed } from './SourcesUsed';
import { SortAscendingIcon, SortDescendingIcon, SparklesIcon } from './icons/GeneralIcons';
import { AnalysisInProgress } from './AnalysisInProgress';
import clsx from 'clsx';

interface DashboardProps {
  narratives: Narrative[];
  sources: SearchSource[];
  isLoading: boolean;
  analysisPhase: 'fetching' | 'clustering' | 'enriching' | null;
  analysisSteps: AnalysisStep[];
  onAssignToTaskforce: (narrative: Narrative) => Promise<void>;
  onSelectNarrative: (narrative: Narrative) => void;
}

type SortKey = 'riskScore' | 'title';
type SortDirection = 'asc' | 'desc';

export const Dashboard: React.FC<DashboardProps> = ({ narratives, sources, isLoading, analysisPhase, analysisSteps, onAssignToTaskforce, onSelectNarrative }) => {
    const [sortKey, setSortKey] = useState<SortKey>('riskScore');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const sortedNarratives = [...narratives].sort((a, b) => {
        let aValue: string | number, bValue: string | number;
        if (sortKey === 'riskScore') {
            aValue = a.riskScore || 0;
            bValue = b.riskScore || 0;
        } else {
            aValue = a.title || '';
            bValue = b.title || '';
        }
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc');
        }
    };

    const SortIcon = sortDirection === 'asc' ? SortAscendingIcon : SortDescendingIcon;
    const hasResults = narratives.length > 0 || sources.length > 0;
    const isInitialLoading = isLoading && (analysisPhase === 'fetching' || analysisPhase === 'clustering');


    const renderContent = () => {
        if (isInitialLoading) {
            return <AnalysisInProgress steps={analysisSteps} />;
        }

        if (!hasResults) {
            return (
                 <div className="flex items-center justify-center h-full text-center">
                    <div className="max-w-md">
                        <SparklesIcon className="mx-auto h-12 w-12 text-primary" />
                        <h2 className="mt-4 text-2xl font-semibold text-text-primary">Monitor the Information Environment</h2>
                        <p className="mt-2 text-text-secondary">Select a country and topic in the sidebar to begin your analysis and uncover emerging narratives in real-time.</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6 animate-fade-in-up">
                <SourcesUsed sources={sources} />
                {narratives.length > 0 ? (
                    <>
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-text-primary">{narratives.length} Narratives Detected</h3>
                            <div className="flex items-center space-x-4 text-sm">
                                <span className="text-text-secondary hidden sm:inline">Sort by:</span>
                                <button
                                    onClick={() => handleSort('riskScore')}
                                    className={clsx('flex items-center space-x-1 p-1 rounded font-medium', sortKey === 'riskScore' ? 'text-primary' : 'text-text-secondary hover:text-text-primary')}
                                >
                                    <span>Risk</span>
                                    {sortKey === 'riskScore' && <SortIcon className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={() => handleSort('title')}
                                    className={clsx('flex items-center space-x-1 p-1 rounded font-medium', sortKey === 'title' ? 'text-primary' : 'text-text-secondary hover:text-text-primary')}
                                >
                                    <span>Title</span>
                                    {sortKey === 'title' && <SortIcon className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            {sortedNarratives.map(narrative => (
                                <NarrativeCard 
                                  key={narrative.id} 
                                  narrative={narrative} 
                                  onAssignToTaskforce={onAssignToTaskforce}
                                  onSelectNarrative={onSelectNarrative}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="text-center text-text-secondary bg-background-secondary p-8 rounded-lg border border-border">
                        <h3 className="text-xl font-semibold text-text-primary">Analysis Complete</h3>
                        <p className="mt-2">No distinct narratives were detected. Try broadening your topic or time frame.</p>
                    </div>
                )}
            </div>
        );
    };
    
    return (
       <div className="h-full">
            {renderContent()}
       </div>
    );
};