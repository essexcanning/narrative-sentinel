import React, { useState } from 'react';
import { Narrative, Post } from '../types';
import { ShareIcon, DownloadIcon, LinkIcon, MegaphoneIcon, UserPlusIcon, LoadingSpinner } from './icons/GeneralIcons';
import { ProgressRing } from './ProgressRing';
import { Sparkline } from './Sparkline';
import { BriefingModal } from './BriefingModal';
import clsx from 'clsx';

interface NarrativeCardProps {
  narrative: Narrative;
  onAssignToTaskforce: (narrative: Narrative) => Promise<void>;
}

const getRiskConfig = (score: number, classification?: string) => {
    if (classification === 'Disinformation' || classification === 'Malinformation' || score >= 8) {
        return {
            dot: 'bg-critical',
            label: 'text-critical',
            bg: 'bg-critical/5 dark:bg-critical/10',
            text: 'text-critical'
        };
    }
    if (classification === 'Misinformation' || score >= 5) {
        return {
            dot: 'bg-warning',
            label: 'text-warning',
            bg: 'bg-warning/5 dark:bg-warning/10',
            text: 'text-warning'
        };
    }
    return {
        dot: 'bg-success',
        label: 'text-success',
        bg: 'bg-success/5 dark:bg-success/10',
        text: 'text-success'
    };
};

type Tab = 'DMMI Report' | 'DISARM Analysis' | 'Counters' | 'Raw Posts';

export const NarrativeCard: React.FC<NarrativeCardProps> = ({ narrative, onAssignToTaskforce }) => {
    const [activeTab, setActiveTab] = useState<Tab>('DMMI Report');
    const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const riskConfig = getRiskConfig(narrative.riskScore, narrative.dmmiReport?.classification);

    const handleAssign = async () => {
        setIsAssigning(true);
        try {
            await onAssignToTaskforce(narrative);
        } catch (error) {
            console.error("Assignment failed in card:", error);
        } finally {
            setIsAssigning(false);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'DMMI Report':
                return narrative.dmmiReport ? (
                     <div className="space-y-3 text-sm">
                        <p>{narrative.dmmiReport.rationale}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-border">
                            <div><span className="font-semibold text-text-secondary">Intent:</span> {narrative.dmmiReport.intent}</div>
                            <div><span className="font-semibold text-text-secondary">Veracity:</span> {narrative.dmmiReport.veracity}</div>
                            <div className="col-span-2"><span className="font-semibold text-text-secondary">Success Probability:</span> {narrative.dmmiReport.successProbability}%</div>
                        </div>
                    </div>
                ) : null;
            case 'DISARM Analysis':
                return narrative.disarmAnalysis ? (
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div><span className="font-semibold text-text-secondary">Phase:</span> {narrative.disarmAnalysis.phase}</div>
                            <div><span className="font-semibold text-text-secondary">Confidence:</span> {narrative.disarmAnalysis.confidence}</div>
                        </div>
                        <div className="pt-2">
                            <p className="font-semibold text-text-secondary mb-1">Observed Tactics:</p>
                            <div className="flex flex-wrap gap-2">
                                {narrative.disarmAnalysis.tactics.map((tactic, i) => <span key={i} className="bg-background text-text-secondary text-xs font-medium px-2 py-1 rounded-full border border-border">{tactic}</span>)}
                            </div>
                        </div>
                        <div className="pt-2">
                            <p className="font-semibold text-text-secondary mb-1">Observed Techniques:</p>
                            <div className="flex flex-wrap gap-2">
                                {narrative.disarmAnalysis.techniques.map((technique, i) => <span key={i} className="bg-background text-text-secondary text-xs font-medium px-2 py-1 rounded-full border border-border">{technique}</span>)}
                            </div>
                        </div>
                    </div>
                ) : null;
            case 'Counters':
                return narrative.counterOpportunities ? (
                    <div className="space-y-3">
                    {narrative.counterOpportunities.map((opp, i) => (
                        <div key={i} className="text-sm bg-background p-3 rounded-lg border border-border">
                            <p className="font-semibold text-text-primary">{opp.tactic}</p>
                            <p className="text-xs text-text-secondary mt-1">{opp.rationale}</p>
                        </div>
                    ))}
                    </div>
                ) : null;
             case 'Raw Posts':
                return narrative.posts && narrative.posts.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {narrative.posts.map((post: Post) => (
                            <div key={post.id} className="text-xs bg-background p-2 rounded border border-border">
                                <p className="text-text-secondary truncate"><span className="font-semibold text-text-primary">{post.author}</span> - {post.content}</p>
                                <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-1">
                                    <LinkIcon className="h-3 w-3" /> Source
                                </a>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-sm text-text-secondary">No raw post data available.</p>;
            default: return null;
        }
    }

    return (
        <>
            {isBriefingModalOpen && <BriefingModal narrative={narrative} onClose={() => setIsBriefingModalOpen(false)} />}
            <div className="rounded-lg bg-background-card shadow-card hover:shadow-card-hover transition-shadow flex flex-col">
                <div className="p-5">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={clsx("h-2 w-2 rounded-full", riskConfig.dot)}></span>
                                <span className={clsx("text-xs font-semibold uppercase tracking-wider", riskConfig.label)}>
                                    {narrative.dmmiReport?.classification || `Risk Level ${narrative.riskScore}`}
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold text-text-primary">{narrative.title}</h3>
                        </div>
                        <ProgressRing status={narrative.status} />
                    </div>
                    <p className="text-sm text-text-secondary mt-2 h-10">{narrative.summary.substring(0, 120)}{narrative.summary.length > 120 ? '...' : ''}</p>
                    {narrative.trendData && (
                        <div className="mt-4 h-12">
                            <Sparkline data={narrative.trendData.map(d => d.volume)} />
                        </div>
                    )}
                </div>
                
                {narrative.status === 'complete' && (
                    <div className="mt-auto">
                        <div className="px-5 pt-2">
                            <div className="border-b border-border flex space-x-4">
                                {(['DMMI Report', 'DISARM Analysis', 'Counters', 'Raw Posts'] as Tab[]).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={clsx(
                                            "py-2 px-1 text-sm font-medium border-b-2 transition-colors",
                                            activeTab === tab 
                                                ? 'border-primary text-primary' 
                                                : 'border-transparent text-text-secondary hover:text-text-primary'
                                        )}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-5 min-h-[150px]">
                            {renderTabContent()}
                        </div>
                        <div className="flex justify-between items-center gap-2 px-3 py-2 bg-background/50 rounded-b-lg">
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => setIsBriefingModalOpen(true)}
                                    className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors"
                                >
                                    <MegaphoneIcon className="h-4 w-4" />
                                    Brief Alliance
                                </button>
                                 <button 
                                    onClick={handleAssign}
                                    disabled={isAssigning}
                                    className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAssigning ? <LoadingSpinner className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
                                    {isAssigning ? 'Assigning...' : 'Assign to Taskforce'}
                                </button>
                            </div>
                            <div className="flex items-center">
                                <button className="p-2 text-text-secondary hover:text-text-primary transition-colors" title="Share"><ShareIcon className="h-4 w-4" /></button>
                                <button className="p-2 text-text-secondary hover:text-text-primary transition-colors" title="Export PDF"><DownloadIcon className="h-4 w-4" /></button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};