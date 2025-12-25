
import React, { useState, useRef } from 'react';
import { Narrative, Post, CounterOpportunity } from '../types';
import { ShareIcon, DownloadIcon, LinkIcon, MegaphoneIcon, UserPlusIcon, LoadingSpinner, TagIcon, FlameIcon, BrainCircuitIcon, InfoIcon } from './icons/GeneralIcons';
import { ProgressRing } from './ProgressRing';
import { Sparkline } from './Sparkline';
import { BriefingModal } from './BriefingModal';
import { CounterActionPlanModal } from './CounterActionPlanModal';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface NarrativeCardProps {
  narrative: Narrative;
  onAssignToTaskforce: (narrative: Narrative) => Promise<void>;
  onSelectNarrative: (narrative: Narrative) => void;
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

const MiniScoreBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div className="flex flex-col gap-1 w-full min-w-0">
        <div className="flex justify-between text-[10px] text-text-secondary uppercase tracking-wide font-medium">
            <span className="truncate">{label}</span>
            <span>{value}</span>
        </div>
        <div className="h-1.5 w-full bg-background-secondary rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full", color)} style={{ width: `${value * 10}%` }} />
        </div>
    </div>
);

type Tab = 'DMMI Report' | 'DISARM Analysis' | 'Counters' | 'Raw Posts';

export const NarrativeCard: React.FC<NarrativeCardProps> = ({ narrative, onAssignToTaskforce, onSelectNarrative }) => {
    const [activeTab, setActiveTab] = useState<Tab>('DMMI Report');
    const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
    const [selectedCounter, setSelectedCounter] = useState<CounterOpportunity | null>(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const riskConfig = getRiskConfig(narrative.riskScore, narrative.dmmiReport?.classification);

    const handleAssign = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAssigning(true);
        try {
            await onAssignToTaskforce(narrative);
        } catch (error) {
            console.error("Assignment failed in card:", error);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleCardClick = () => {
        if (narrative.status === 'complete') {
            onSelectNarrative(narrative);
        }
    };

    const handleActionsClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const handleExportPdf = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!cardRef.current) return;
        setIsExporting(true);
        try {
            const element = cardRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                useCORS: true,
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            
            const fileName = `${narrative.title.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-')}-summary.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error("Failed to export PDF from card:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'DMMI Report':
                return narrative.dmmiReport ? (
                     <div className="space-y-3 text-xs w-full">
                        <p className="text-text-secondary break-words whitespace-normal leading-relaxed">{narrative.dmmiReport.rationale}</p>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                            <div className="break-words min-w-0"><span className="font-semibold text-text-secondary">Intent:</span> {narrative.dmmiReport.intent}</div>
                            <div className="break-words min-w-0"><span className="font-semibold text-text-secondary">Veracity:</span> {narrative.dmmiReport.veracity}</div>
                        </div>
                    </div>
                ) : null;
            case 'DISARM Analysis':
                return narrative.disarmAnalysis ? (
                    <div className="space-y-3 text-xs w-full">
                        <div className="grid grid-cols-2 gap-2 w-full">
                            <div className="break-words min-w-0"><span className="font-semibold text-text-secondary">Phase:</span> {narrative.disarmAnalysis.phase}</div>
                            <div className="break-words min-w-0"><span className="font-semibold text-text-secondary">Confidence:</span> {narrative.disarmAnalysis.confidence}</div>
                        </div>
                        <div className="w-full">
                            <p className="font-semibold text-text-secondary mb-1">Observed Tactics:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {narrative.disarmAnalysis.tactics.slice(0, 3).map((tactic, i) => <span key={i} className="bg-background text-text-secondary text-[10px] font-medium px-1.5 py-0.5 rounded border border-border whitespace-normal text-center break-words">{tactic}</span>)}
                                {narrative.disarmAnalysis.tactics.length > 3 && <span className="text-[10px] text-text-disabled">+{narrative.disarmAnalysis.tactics.length - 3} more</span>}
                            </div>
                        </div>
                    </div>
                ) : null;
            case 'Counters':
                return narrative.counterOpportunities ? (
                    <div className="space-y-2 w-full">
                    {narrative.counterOpportunities.slice(0, 2).map((opp, i) => (
                        <button 
                            key={i} 
                            onClick={(e) => { e.stopPropagation(); setSelectedCounter(opp); }}
                            className="w-full text-left text-xs bg-background p-2 rounded border border-border hover:bg-background-hover hover:border-primary/50 transition-all group"
                        >
                            <div className="flex justify-between items-center gap-2 w-full">
                                <p className="font-semibold text-text-primary break-words min-w-0 truncate">{opp.tactic}</p>
                                <BrainCircuitIcon className="h-3 w-3 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0"/>
                            </div>
                            <p className="text-[10px] text-text-secondary mt-0.5 break-words line-clamp-2">{opp.rationale}</p>
                        </button>
                    ))}
                    </div>
                ) : null;
             case 'Raw Posts':
                return narrative.posts && narrative.posts.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 w-full">
                        {narrative.posts.map((post: Post) => (
                            <div key={post.id} className="text-[10px] bg-background p-2 rounded border border-border w-full">
                                <p className="text-text-secondary break-words whitespace-pre-wrap w-full leading-normal">
                                    <span className="font-semibold text-text-primary">{post.author}</span> - {post.content}
                                </p>
                                <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-1 break-all w-fit">
                                    <LinkIcon className="h-2.5 w-2.5 flex-shrink-0" /> Source
                                </a>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-xs text-text-secondary">No raw post data available.</p>;
            default: return null;
        }
    }

    return (
        <>
            {isBriefingModalOpen && <BriefingModal narrative={narrative} onClose={() => setIsBriefingModalOpen(false)} />}
            {selectedCounter && (
                <CounterActionPlanModal 
                    narrative={narrative}
                    counter={selectedCounter}
                    onClose={() => setSelectedCounter(null)}
                />
            )}
            <div 
                ref={cardRef}
                className={clsx(
                    "rounded-xl bg-background-card shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col h-full min-w-0 w-full border border-transparent hover:border-border",
                    narrative.status === 'complete' && 'cursor-pointer',
                    narrative.isTrending && 'ring-2 ring-warning/60'
                )}
                onClick={handleCardClick}
            >
                <div className="p-5 flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={clsx("h-2 w-2 rounded-full flex-shrink-0", riskConfig.dot)}></span>
                                    <span className={clsx("text-xs font-bold uppercase tracking-wider whitespace-nowrap", riskConfig.label)}>
                                        {narrative.dmmiReport?.classification || `Risk Level ${narrative.riskScore}`}
                                    </span>
                                </div>
                                <div className="group relative flex-shrink-0">
                                    <InfoIcon className="h-3.5 w-3.5 text-text-secondary/70 hover:text-text-primary cursor-help transition-colors" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-background-card border border-border rounded shadow-lg text-xs text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                        <p className="font-bold text-text-primary mb-1">Risk Score Calculation:</p>
                                        <ul className="list-disc list-inside space-y-1 opacity-80">
                                            <li><strong>DMMI:</strong> Harm Potential & Veracity</li>
                                            <li><strong>Context:</strong> Virality & Probability</li>
                                            <li><strong>TTPs:</strong> DISARM sophistication</li>
                                        </ul>
                                    </div>
                                </div>
                                {narrative.isTrending && (
                                    <span title="Trending Narrative" className="flex-shrink-0">
                                        <FlameIcon className="h-4 w-4 text-warning" />
                                    </span>
                                )}
                            </div>
                             {narrative.campaign && (
                                <div className="flex items-center gap-1.5 mb-2 text-xs text-text-secondary min-w-0">
                                    <TagIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="font-medium bg-background-hover px-2 py-0.5 rounded text-[10px] truncate max-w-[150px] border border-border/50">{narrative.campaign}</span>
                                </div>
                            )}
                            <h3 className="text-base font-bold text-text-primary break-words leading-snug">{narrative.title}</h3>
                        </div>
                        <div className="flex-shrink-0 pt-1" data-html2canvas-ignore>
                            <ProgressRing status={narrative.status} />
                        </div>
                    </div>
                    
                    <p className="text-xs text-text-secondary mt-3 line-clamp-3 break-words whitespace-normal leading-relaxed">{narrative.summary}</p>
                    
                    {narrative.dmmiReport && (
                        <div className="mt-4 grid grid-cols-3 gap-2 bg-background-secondary/40 p-2 rounded-lg border border-border/40 min-w-0">
                            <MiniScoreBar label="Veracity" value={narrative.dmmiReport.veracityScore} color="bg-blue-500" />
                            <MiniScoreBar label="Harm" value={narrative.dmmiReport.harmScore} color={narrative.dmmiReport.harmScore > 6 ? 'bg-critical' : 'bg-warning'} />
                            <MiniScoreBar label="Prob" value={narrative.dmmiReport.probabilityScore} color={narrative.dmmiReport.probabilityScore > 6 ? 'bg-critical' : 'bg-warning'} />
                        </div>
                    )}

                    {narrative.trendData && (
                        <div className="mt-4 h-10 w-full">
                            <Sparkline data={narrative.trendData.map(d => d.volume)} />
                        </div>
                    )}
                </div>
                
                {narrative.status === 'complete' && (
                    <div className="mt-auto w-full" onClick={handleActionsClick}>
                        <div className="px-5 pt-2 w-full border-t border-border/50">
                            <div className="flex space-x-4 overflow-x-auto scrollbar-hide w-full">
                                {(['DMMI Report', 'DISARM Analysis', 'Counters', 'Raw Posts'] as Tab[]).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }}
                                        className={clsx(
                                            "py-2 px-1 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
                                            activeTab === tab 
                                                ? 'border-primary text-primary' 
                                                : 'border-transparent text-text-secondary hover:text-text-primary'
                                        )}
                                    >
                                        {tab.replace(' Analysis', '').replace('Report', '')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-5 min-h-[140px] w-full bg-background-secondary/10">
                            {renderTabContent()}
                        </div>
                        <div 
                            className="flex justify-between items-center gap-2 px-3 py-2 bg-background-secondary/30 rounded-b-xl border-t border-border w-full"
                            data-html2canvas-ignore
                        >
                            <div className="flex items-center gap-1 flex-wrap">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsBriefingModalOpen(true); }}
                                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors"
                                >
                                    <MegaphoneIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                    Brief
                                </button>
                                 <button 
                                    onClick={handleAssign}
                                    disabled={isAssigning}
                                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAssigning ? <LoadingSpinner className="h-3.5 w-3.5" /> : <UserPlusIcon className="h-3.5 w-3.5" />}
                                    {isAssigning ? 'Assigning...' : 'Assign'}
                                </button>
                            </div>
                            <div className="flex items-center flex-shrink-0">
                                <button onClick={(e) => e.stopPropagation()} className="p-1.5 text-text-secondary hover:text-text-primary transition-colors" title="Share"><ShareIcon className="h-3.5 w-3.5" /></button>
                                <button 
                                    onClick={handleExportPdf}
                                    disabled={isExporting}
                                    className="p-1.5 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-wait" 
                                    title="Export PDF"
                                >
                                    {isExporting ? <LoadingSpinner className="h-3.5 w-3.5" /> : <DownloadIcon className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
