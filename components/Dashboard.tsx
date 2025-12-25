
import React, { useState, useEffect, useRef } from 'react';
import { Narrative, SearchSource, AnalysisStep } from '../types';
import { NarrativeCard } from './NarrativeCard';
import { SourcesUsed } from './SourcesUsed';
import { SortAscendingIcon, SortDescendingIcon, SparklesIcon, SearchIcon, FilterIcon, DownloadIcon } from './icons/GeneralIcons';
import { AnalysisInProgress } from './AnalysisInProgress';
import { MultiLineChart } from './MultiLineChart';
import { DashboardMetrics } from './DashboardMetrics';
import { NarrativeCardSkeleton } from './NarrativeCardSkeleton';
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
type RiskFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

export const Dashboard: React.FC<DashboardProps> = ({ narratives, sources, isLoading, analysisPhase, analysisSteps, onAssignToTaskforce, onSelectNarrative }) => {
    const [sortKey, setSortKey] = useState<SortKey>('riskScore');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
    
    // Helper to calculate filtered list based on current state
    const calculateFiltered = (currentNarratives: Narrative[]) => {
        return currentNarratives.filter(n => {
            // Text Search
            const matchesSearch = 
                n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                n.summary.toLowerCase().includes(searchQuery.toLowerCase());
            
            // Risk Filter
            let matchesRisk = true;
            if (riskFilter === 'critical') matchesRisk = n.riskScore >= 8;
            else if (riskFilter === 'high') matchesRisk = n.riskScore >= 5 && n.riskScore < 8;
            else if (riskFilter === 'medium') matchesRisk = n.riskScore >= 3 && n.riskScore < 5;
            else if (riskFilter === 'low') matchesRisk = n.riskScore < 3;

            return matchesSearch && matchesRisk;
        }).sort((a, b) => {
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
    };

    const [filteredNarratives, setFilteredNarratives] = useState<Narrative[]>(() => calculateFiltered(narratives));
    const [isFiltering, setIsFiltering] = useState(false);
    const prevNarrativesRef = useRef(narratives);

    // Effect to handle filtering with debounce for user inputs, immediate for data updates
    useEffect(() => {
        const narrativesChanged = prevNarrativesRef.current !== narratives;
        
        if (narrativesChanged) {
            // Data update (e.g. analysis finished): Update immediately, no skeleton
            setFilteredNarratives(calculateFiltered(narratives));
            prevNarrativesRef.current = narratives;
        } else {
            // User interaction (filter/sort): Show skeleton + debounce
            setIsFiltering(true);
            const timer = setTimeout(() => {
                setFilteredNarratives(calculateFiltered(narratives));
                setIsFiltering(false);
            }, 350); // 350ms delay for "processing" feel
            return () => clearTimeout(timer);
        }
    }, [narratives, searchQuery, riskFilter, sortKey, sortDirection]);


    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc');
        }
    };

    const handleExportCSV = () => {
        const headers = ['ID', 'Title', 'Summary', 'Risk Score', 'Classification', 'Veracity Score', 'Harm Score', 'Prob Score', 'Status', 'Post Count'];
        const rows = filteredNarratives.map(n => [
            n.id,
            `"${n.title.replace(/"/g, '""')}"`,
            `"${n.summary.replace(/"/g, '""')}"`,
            n.riskScore,
            n.dmmiReport?.classification || 'N/A',
            n.dmmiReport?.veracityScore || 0,
            n.dmmiReport?.harmScore || 0,
            n.dmmiReport?.probabilityScore || 0,
            n.status,
            n.posts?.length || 0
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'open_narrative_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
            <div className="space-y-6 animate-fade-in-up pb-10">
                <DashboardMetrics narratives={narratives} />
                
                <SourcesUsed sources={sources} />
                
                {filteredNarratives.length > 0 && (
                    <MultiLineChart narratives={filteredNarratives} />
                )}

                {/* Toolbar Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background-card p-4 rounded-xl border border-border shadow-sm sticky top-0 z-10 backdrop-blur-md bg-opacity-90 transition-all duration-300">
                    <div className="flex flex-1 items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none md:w-64">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                            <input 
                                type="text"
                                placeholder="Search narratives..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background-secondary border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none transition-all"
                            />
                        </div>
                        
                        <div className="relative group">
                            <div className="flex items-center gap-2 px-3 py-2 bg-background-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-colors">
                                <FilterIcon className="h-4 w-4" />
                                <select 
                                    value={riskFilter}
                                    onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                                    className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer font-medium text-text-primary appearance-none pr-6"
                                >
                                    <option value="all">All Risks</option>
                                    <option value="critical">Critical Only (8+)</option>
                                    <option value="high">High Risk (5-7)</option>
                                    <option value="medium">Medium Risk (3-5)</option>
                                    <option value="low">Low Risk (&lt;3)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                         <div className="flex items-center bg-background-secondary rounded-lg border border-border p-1">
                            <button
                                onClick={() => handleSort('riskScore')}
                                className={clsx('flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all', sortKey === 'riskScore' ? 'bg-background shadow-sm text-primary' : 'text-text-secondary hover:text-text-primary')}
                            >
                                <span>Risk</span>
                                {sortKey === 'riskScore' && <SortIcon className="h-3.5 w-3.5" />}
                            </button>
                            <button
                                onClick={() => handleSort('title')}
                                className={clsx('flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all', sortKey === 'title' ? 'bg-background shadow-sm text-primary' : 'text-text-secondary hover:text-text-primary')}
                            >
                                <span>Title</span>
                                {sortKey === 'title' && <SortIcon className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                        <button 
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-3 py-2 bg-background-secondary hover:bg-background-hover border border-border rounded-lg text-sm font-medium text-text-primary transition-colors"
                        >
                            <DownloadIcon className="h-4 w-4" />
                            <span>Export CSV</span>
                        </button>
                    </div>
                </div>

                {/* Narrative Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {isFiltering ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <NarrativeCardSkeleton key={`skeleton-${i}`} />
                        ))
                    ) : (
                        <>
                            {filteredNarratives.map(narrative => (
                                <NarrativeCard 
                                    key={narrative.id} 
                                    narrative={narrative} 
                                    onAssignToTaskforce={onAssignToTaskforce}
                                    onSelectNarrative={onSelectNarrative}
                                />
                            ))}
                            {filteredNarratives.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center p-12 text-center opacity-60">
                                    <SearchIcon className="h-12 w-12 text-text-disabled mb-3" />
                                    <h3 className="text-lg font-medium text-text-secondary">No matching narratives found</h3>
                                    <p className="text-sm text-text-disabled">Try adjusting your filters or search query.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full">
            {renderContent()}
        </div>
    );
};
