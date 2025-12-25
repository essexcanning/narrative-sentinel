
import React, { useState, useRef } from 'react';
import { Narrative, CounterOpportunity } from '../types';
import { ArrowLeftIcon, LinkIcon, MegaphoneIcon, UserPlusIcon, LoadingSpinner, DownloadIcon, TagIcon, BrainCircuitIcon, ChatIcon, ShieldExclamationIcon, FingerPrintIcon, InfoIcon } from './icons/GeneralIcons';
import { BriefingModal } from './BriefingModal';
import { CounterActionPlanModal } from './CounterActionPlanModal';
import { AnalystCopilot } from './AnalystCopilot';
import { Sparkline } from './Sparkline';
import { DMMIMatrixCube } from './DMMIMatrixCube';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface NarrativeDetailProps {
    narrative: Narrative;
    onBack: () => void;
    onAssignToTaskforce: (narrative: Narrative) => Promise<void>;
    onAssignToCampaign: (narrativeId: string, campaignName: string) => void;
}

type DetailTab = 'overview' | 'risk' | 'disarm' | 'posts' | 'response';

const getRiskConfig = (score: number, classification?: string) => {
    if (classification === 'Disinformation' || classification === 'Malinformation' || score >= 8) {
        return { dot: 'bg-critical', label: 'text-critical', bg: 'bg-critical/10 border-critical/20' };
    }
    if (classification === 'Misinformation' || score >= 5) {
        return { dot: 'bg-warning', label: 'text-warning', bg: 'bg-warning/10 border-warning/20' };
    }
    return { dot: 'bg-success', label: 'text-success', bg: 'bg-success/10 border-success/20' };
};

export const NarrativeDetail: React.FC<NarrativeDetailProps> = ({ narrative, onBack, onAssignToTaskforce, onAssignToCampaign }) => {
    const [activeTab, setActiveTab] = useState<DetailTab>('overview');
    const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
    const [selectedCounter, setSelectedCounter] = useState<CounterOpportunity | null>(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showCopilot, setShowCopilot] = useState(false);
    const riskConfig = getRiskConfig(narrative.riskScore, narrative.dmmiReport?.classification);
    const exportRef = useRef<HTMLDivElement>(null);

    const handleAssign = async () => {
        setIsAssigning(true);
        try {
            await onAssignToTaskforce(narrative);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleAssignCampaign = () => {
        const campaignName = window.prompt("Enter a name for the campaign:", narrative.campaign || "");
        if (campaignName && campaignName.trim() !== "") {
            onAssignToCampaign(narrative.id, campaignName.trim());
        }
    };

    const handleExportPdf = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            const element = exportRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#f9fafb',
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
            const fileName = `${narrative.title.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-')}-report.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error("Failed to export PDF:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const TabButton: React.FC<{ id: DetailTab; label: string }> = ({ id, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={clsx(
                "pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            )}
        >
            {label}
        </button>
    );

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
        {showCopilot && (
            <AnalystCopilot 
                narrative={narrative} 
                onClose={() => setShowCopilot(false)} 
            />
        )}

        {/* Floating Copilot Button */}
        {!showCopilot && (
            <button 
                onClick={() => setShowCopilot(true)}
                className="fixed bottom-8 right-8 z-30 bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-2xl transition-all hover:scale-105 flex items-center gap-2 group"
            >
                <BrainCircuitIcon className="h-6 w-6" />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap font-semibold">
                    Analyst Copilot
                </span>
            </button>
        )}

        <div ref={exportRef} className="w-full max-w-5xl mx-auto pb-20">
            <div className="animate-fade-in-up space-y-6">
                
                {/* Header Section */}
                <div className="space-y-4 bg-background pt-2">
                    <button onClick={onBack} className="group flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                        <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Back to Dashboard
                    </button>
                    
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className={clsx("flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide shadow-sm", riskConfig.bg, riskConfig.label)}>
                                        <span className={clsx("h-2 w-2 rounded-full", riskConfig.dot)}></span>
                                        {narrative.dmmiReport?.classification || `Risk Level ${narrative.riskScore}`}
                                    </div>
                                    <div className="group relative flex-shrink-0">
                                        <InfoIcon className="h-4 w-4 text-text-secondary/70 hover:text-text-primary cursor-help transition-colors" />
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-background-card border border-border rounded shadow-lg text-xs text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                            <p className="font-bold text-text-primary mb-1">Risk Score Calculation:</p>
                                            <ul className="list-disc list-inside space-y-1 opacity-80">
                                                <li><strong>DMMI:</strong> Harm Potential & Veracity</li>
                                                <li><strong>Context:</strong> Virality & Probability</li>
                                                <li><strong>TTPs:</strong> DISARM sophistication</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {narrative.campaign && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background-secondary border border-border text-xs font-medium text-text-secondary">
                                            <TagIcon className="h-3.5 w-3.5" />
                                            {narrative.campaign}
                                        </div>
                                    )}
                                </div>
                                <h1 className="text-3xl md:text-4xl font-bold text-text-primary leading-tight break-words">{narrative.title}</h1>
                            </div>
                            
                            {/* Action Bar */}
                            <div className="flex items-center gap-2 self-start sm:self-center">
                                <button onClick={handleExportPdf} disabled={isExporting} className="p-2 text-text-secondary hover:bg-background-hover rounded-lg border border-transparent hover:border-border transition-all" title="Export PDF">
                                    {isExporting ? <LoadingSpinner className="h-5 w-5" /> : <DownloadIcon className="h-5 w-5" />}
                                </button>
                                <button onClick={() => setIsBriefingModalOpen(true)} className="p-2 text-text-secondary hover:bg-background-hover rounded-lg border border-transparent hover:border-border transition-all" title="Alliance Brief">
                                    <MegaphoneIcon className="h-5 w-5" />
                                </button>
                                <button onClick={handleAssign} disabled={isAssigning} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50">
                                    {isAssigning ? <LoadingSpinner className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
                                    <span className="hidden sm:inline">Assign Taskforce</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="border-b border-border flex gap-6 overflow-x-auto scrollbar-hide">
                        <TabButton id="overview" label="Overview" />
                        <TabButton id="risk" label="Risk Analysis" />
                        <TabButton id="disarm" label="DISARM TTPs" />
                        <TabButton id="posts" label={`Source Data (${narrative.posts?.length || 0})`} />
                        <TabButton id="response" label="Response Options" />
                    </div>
                </div>

                {/* Tab Content */}
                <div className="min-h-[400px]">
                    
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-background-card rounded-xl border border-border p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-text-primary mb-4">Narrative Summary</h3>
                                <p className="text-base text-text-secondary leading-relaxed whitespace-pre-wrap break-words">
                                    {narrative.summary}
                                </p>
                            </div>

                            {narrative.attribution && (
                                <div className="bg-background-card rounded-xl border border-border p-6 shadow-sm">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <FingerPrintIcon className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-text-primary">Attribution Intelligence</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Suspected Origin</p>
                                                <p className="text-base font-medium text-text-primary">{narrative.attribution.suspectedOrigin}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Network Dynamics</p>
                                                <p className="text-base text-text-primary">{narrative.attribution.networkDynamics}</p>
                                            </div>
                                             <div>
                                                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Confidence Score</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-background-secondary rounded-full overflow-hidden max-w-[100px]">
                                                        <div className={clsx("h-full rounded-full", narrative.attribution.confidenceScore > 7 ? 'bg-success' : narrative.attribution.confidenceScore > 4 ? 'bg-warning' : 'bg-critical')} style={{ width: `${narrative.attribution.confidenceScore * 10}%` }}></div>
                                                    </div>
                                                    <span className="text-sm font-bold text-text-primary">{narrative.attribution.confidenceScore}/10</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Key Amplifiers</p>
                                            <div className="flex flex-wrap gap-2">
                                                {narrative.attribution.keyAmplifiers.map((amp, i) => (
                                                    <span key={i} className="inline-flex items-center px-3 py-1 rounded-md bg-background-secondary text-sm text-text-primary border border-border">
                                                        {amp}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {narrative.trendData && (
                                <div className="bg-background-card rounded-xl border border-border p-6 shadow-sm">
                                    <h3 className="text-lg font-semibold text-text-primary mb-4">Trend Velocity (14 Days)</h3>
                                    <div className="h-48 w-full">
                                        <Sparkline data={narrative.trendData.map(d => d.volume)} height={150} />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-background-secondary/30 rounded-xl p-5 border border-border">
                                    <span className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Detected Phase</span>
                                    <span className="text-xl font-bold text-text-primary">{narrative.disarmAnalysis?.phase || "Unknown"}</span>
                                </div>
                                <div className="bg-background-secondary/30 rounded-xl p-5 border border-border">
                                    <span className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Confidence</span>
                                    <span className="text-xl font-bold text-text-primary">{narrative.disarmAnalysis?.confidence || "N/A"}</span>
                                </div>
                                <div className="bg-background-secondary/30 rounded-xl p-5 border border-border">
                                    <span className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Veracity Score</span>
                                    <span className="text-xl font-bold text-text-primary">{narrative.dmmiReport?.veracityScore || 0}/10</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RISK TAB */}
                    {activeTab === 'risk' && narrative.dmmiReport && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-background-card rounded-xl border border-border p-6 shadow-sm">
                                <div className="flex flex-col md:flex-row gap-8 items-center">
                                    <div className="w-full md:w-1/2 max-w-sm mx-auto">
                                        <DMMIMatrixCube 
                                            veracity={narrative.dmmiReport.veracityScore || 0}
                                            harm={narrative.dmmiReport.harmScore || 0}
                                            probability={narrative.dmmiReport.probabilityScore || 0}
                                            riskScore={narrative.dmmiReport.matrixRiskScore || narrative.riskScore}
                                            classification={narrative.dmmiReport.classification}
                                        />
                                    </div>
                                    <div className="w-full md:w-1/2 space-y-4">
                                        <h3 className="text-xl font-bold text-text-primary">DMMI Matrix Assessment</h3>
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-lg bg-background-secondary/20 border border-border">
                                                <span className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Analyst Rationale</span>
                                                <p className="text-sm text-text-primary leading-relaxed">
                                                    {narrative.dmmiReport.rationale}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-xs text-text-secondary mb-1">Intent</span>
                                                    <span className="font-semibold text-text-primary">{narrative.dmmiReport.intent}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-text-secondary mb-1">Veracity</span>
                                                    <span className="font-semibold text-text-primary">{narrative.dmmiReport.veracity}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DISARM TAB */}
                    {activeTab === 'disarm' && narrative.disarmAnalysis && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-background-card rounded-xl border border-border p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-text-primary mb-6">Adversary Tactics, Techniques & Procedures</h3>
                                
                                <div className="space-y-8">
                                    <div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="h-px flex-grow bg-border"></div>
                                            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Tactics (High Level)</span>
                                            <div className="h-px flex-grow bg-border"></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {narrative.disarmAnalysis.tactics.map((t, i) => (
                                                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                                                    <ShieldExclamationIcon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                                                    <span className="text-sm font-medium text-text-primary break-words">{t}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="h-px flex-grow bg-border"></div>
                                            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Techniques (Specific)</span>
                                            <div className="h-px flex-grow bg-border"></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {narrative.disarmAnalysis.techniques.map((t, i) => (
                                                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                                                    <span className="text-sm text-text-secondary break-words">{t}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* POSTS TAB */}
                    {activeTab === 'posts' && (
                        <div className="space-y-4 animate-fade-in-up">
                            <div className="grid grid-cols-1 gap-4">
                                {narrative.posts?.map((post) => (
                                    <div key={post.id} className="bg-background-card p-5 rounded-xl border border-border hover:border-primary/30 transition-colors shadow-sm">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-background-secondary flex items-center justify-center font-bold text-xs text-text-primary border border-border">
                                                    {post.author.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-text-primary text-sm">{post.author}</p>
                                                    <p className="text-xs text-text-disabled">{post.source} • {post.timestamp}</p>
                                                </div>
                                            </div>
                                            <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                                                <LinkIcon className="h-3 w-3" /> View Source
                                            </a>
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words border-l-2 border-border pl-4">
                                            {post.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* RESPONSE TAB */}
                    {activeTab === 'response' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">Strategic Counter-Opportunities</h3>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Select a counter-tactic below to generate a detailed action plan using the AI Copilot.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {narrative.counterOpportunities?.map((opp, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => setSelectedCounter(opp)}
                                        className="text-left bg-background-card p-5 rounded-xl border border-border hover:border-primary hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-text-primary group-hover:text-primary transition-colors">{opp.tactic}</h4>
                                            <BrainCircuitIcon className="h-5 w-5 text-text-disabled group-hover:text-primary" />
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed">
                                            {opp.rationale}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
        </>
    );
};
