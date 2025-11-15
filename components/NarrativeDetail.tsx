import React, { useState, useRef } from 'react';
import { Narrative, Post } from '../types';
import { ArrowLeftIcon, LinkIcon, MegaphoneIcon, UserPlusIcon, LoadingSpinner, DownloadIcon, TagIcon } from './icons/GeneralIcons';
import { BriefingModal } from './BriefingModal';
import { Sparkline } from './Sparkline';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';


interface NarrativeDetailProps {
    narrative: Narrative;
    onBack: () => void;
    onAssignToTaskforce: (narrative: Narrative) => Promise<void>;
    onAssignToCampaign: (narrativeId: string, campaignName: string) => void;
}

const getRiskConfig = (score: number, classification?: string) => {
    if (classification === 'Disinformation' || classification === 'Malinformation' || score >= 8) {
        return { dot: 'bg-critical', label: 'text-critical', bg: 'bg-critical/10 border-critical/20' };
    }
    if (classification === 'Misinformation' || score >= 5) {
        return { dot: 'bg-warning', label: 'text-warning', bg: 'bg-warning/10 border-warning/20' };
    }
    return { dot: 'bg-success', label: 'text-success', bg: 'bg-success/10 border-success/20' };
};

const DetailCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-background-card rounded-lg border border-border h-full">
        <h3 className="text-lg font-semibold text-text-primary p-4 border-b border-border">{title}</h3>
        <div className="p-4">{children}</div>
    </div>
);

export const NarrativeDetail: React.FC<NarrativeDetailProps> = ({ narrative, onBack, onAssignToTaskforce, onAssignToCampaign }) => {
    const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
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
            // Temporarily remove scrollbars during capture for cleaner output
            const originalStyle = element.style.overflow;
            element.style.overflow = 'visible';

            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#f9fafb',
                useCORS: true,
                logging: false,
            });

            element.style.overflow = originalStyle;

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
            // In a real app, you might show a toast notification here
        } finally {
            setIsExporting(false);
        }
    };


    return (
        <>
        {isBriefingModalOpen && <BriefingModal narrative={narrative} onClose={() => setIsBriefingModalOpen(false)} />}
        <div ref={exportRef} className="bg-background">
            <div className="animate-fade-in-up space-y-6 p-1">
                {/* Header */}
                <div>
                    <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary mb-4 transition-colors">
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to Dashboard
                    </button>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-text-primary leading-tight">{narrative.title}</h1>
                            {narrative.campaign && (
                                <div className="flex items-center gap-2 mt-2 text-text-secondary">
                                    <TagIcon className="h-5 w-5" />
                                    <span className="text-sm font-semibold bg-background-hover px-3 py-1 rounded-full">{narrative.campaign}</span>
                                </div>
                            )}
                        </div>
                        <div className={clsx("flex items-center gap-2 flex-shrink-0 py-1 px-3 rounded-full text-sm font-semibold border", riskConfig.bg, riskConfig.label)}>
                            <span className={clsx("h-2 w-2 rounded-full", riskConfig.dot)}></span>
                            <span>{narrative.dmmiReport?.classification || `Risk Level ${narrative.riskScore}`}</span>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <DetailCard title="Narrative Summary">
                            <p className="text-text-secondary leading-relaxed">{narrative.summary}</p>
                        </DetailCard>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                            {narrative.dmmiReport && (
                                <DetailCard title="DMMI Report">
                                    <div className="space-y-3 text-sm">
                                        <p className="text-text-secondary">{narrative.dmmiReport.rationale}</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-border">
                                            <div><span className="font-semibold text-text-secondary">Intent:</span> {narrative.dmmiReport.intent}</div>
                                            <div><span className="font-semibold text-text-secondary">Veracity:</span> {narrative.dmmiReport.veracity}</div>
                                            <div className="col-span-2"><span className="font-semibold text-text-secondary">Success Probability:</span> {narrative.dmmiReport.successProbability}%</div>
                                        </div>
                                    </div>
                                </DetailCard>
                            )}
                            {narrative.disarmAnalysis && (
                                <DetailCard title="DISARM Analysis">
                                    <div className="space-y-4 text-sm">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            <div><span className="font-semibold text-text-secondary">Phase:</span> {narrative.disarmAnalysis.phase}</div>
                                            <div><span className="font-semibold text-text-secondary">Confidence:</span> {narrative.disarmAnalysis.confidence}</div>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-text-secondary mb-2">Tactics:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {narrative.disarmAnalysis.tactics.map((t, i) => <span key={i} className="bg-background text-text-secondary text-xs font-medium px-2 py-1 rounded-full border border-border">{t}</span>)}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-text-secondary mb-2">Techniques:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {narrative.disarmAnalysis.techniques.map((t, i) => <span key={i} className="bg-background text-text-secondary text-xs font-medium px-2 py-1 rounded-full border border-border">{t}</span>)}
                                            </div>
                                        </div>
                                    </div>
                                </DetailCard>
                            )}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {narrative.trendData && (
                            <DetailCard title="Trend Analysis (14d)">
                                <div className="h-20 text-text-secondary">
                                    <Sparkline data={narrative.trendData.map(d => d.volume)} />
                                </div>
                            </DetailCard>
                        )}
                        {narrative.counterOpportunities && (
                            <DetailCard title="Counter-Opportunities">
                                <div className="space-y-3">
                                    {narrative.counterOpportunities.map((opp, i) => (
                                        <div key={i} className="text-sm bg-background p-3 rounded-lg border border-border">
                                            <p className="font-semibold text-text-primary">{opp.tactic}</p>
                                            <p className="text-xs text-text-secondary mt-1">{opp.rationale}</p>
                                        </div>
                                    ))}
                                </div>
                            </DetailCard>
                        )}
                        <DetailCard title="Actions">
                            <div className="space-y-3">
                                 <button 
                                    onClick={handleAssignCampaign}
                                    className="w-full flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-md bg-background-hover text-text-primary hover:bg-background-hover/80 transition-colors"
                                >
                                    <TagIcon className="h-4 w-4" />
                                    Assign to Campaign
                                </button>
                                <button 
                                    onClick={() => setIsBriefingModalOpen(true)}
                                    className="w-full flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-md bg-background-hover text-text-primary hover:bg-background-hover/80 transition-colors"
                                >
                                    <MegaphoneIcon className="h-4 w-4" />
                                    Brief Alliance
                                </button>
                                <button 
                                    onClick={handleAssign}
                                    disabled={isAssigning}
                                    className="w-full flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-md bg-background-hover text-text-primary hover:bg-background-hover/80 transition-colors disabled:opacity-50"
                                >
                                    {isAssigning ? <LoadingSpinner className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
                                    {isAssigning ? 'Assigning...' : 'Assign to Taskforce'}
                                </button>
                                <button 
                                    onClick={handleExportPdf}
                                    disabled={isExporting}
                                    className="w-full flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-md bg-background-hover text-text-primary hover:bg-background-hover/80 transition-colors disabled:opacity-50"
                                >
                                    {isExporting ? <LoadingSpinner className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
                                    {isExporting ? 'Exporting...' : 'Export as PDF'}
                                </button>
                            </div>
                        </DetailCard>
                    </div>
                </div>
                
                {narrative.posts && narrative.posts.length > 0 && (
                    <DetailCard title={`Associated Posts (${narrative.posts.length})`}>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {narrative.posts.map((post: Post) => (
                                <div key={post.id} className="text-sm bg-background p-3 rounded-lg border border-border">
                                    <p className="font-semibold text-text-primary">{post.author}</p>
                                    <p className="text-text-secondary mt-1">{post.content}</p>
                                    <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-2 text-xs font-medium">
                                        <LinkIcon className="h-3 w-3" /> View Source
                                    </a>
                                </div>
                            ))}
                        </div>
                    </DetailCard>
                )}
            </div>
        </div>
        </>
    );
};