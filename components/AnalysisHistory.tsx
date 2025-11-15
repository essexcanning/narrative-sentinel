import React from 'react';
import { AnalysisHistoryItem, AnalysisInput } from '../types';
import { HistoryIcon, TrashIcon } from './icons/GeneralIcons';

interface AnalysisHistoryProps {
    history: AnalysisHistoryItem[];
    onRun: (inputs: AnalysisInput) => void;
    onClear: () => void;
    isLoading: boolean;
}

export const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ history, onRun, onClear, isLoading }) => {
    if (history.length === 0) {
        return null; // Don't render anything if there's no history
    }

    return (
        <div className="mb-6 min-w-[300px]">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <HistoryIcon className="h-5 w-5 text-text-secondary" />
                    <h3 className="text-sm font-semibold text-text-primary">Recent Analyses</h3>
                </div>
                <button 
                    onClick={onClear} 
                    className="p-1 text-text-secondary hover:text-critical transition-colors rounded-full"
                    title="Clear history"
                    aria-label="Clear analysis history"
                >
                    <TrashIcon className="h-4 w-4" />
                </button>
            </div>
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {history.map(item => {
                     const sourcesText = item.inputs.sources.join(', ').replace('Google News / Search', 'Web').replace('X / Twitter', 'X');
                     return (
                        <li key={item.id}>
                            <button
                                onClick={() => onRun(item.inputs)}
                                disabled={isLoading}
                                className="w-full text-left p-2 rounded-md hover:bg-background-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <div className="flex justify-between items-center">
                                    <p className="text-sm font-medium text-text-primary truncate">{item.inputs.country}</p>
                                    <span className="text-xs text-text-disabled flex-shrink-0 ml-2">
                                        {new Date(item.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-xs text-text-secondary truncate">{sourcesText}</p>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};
