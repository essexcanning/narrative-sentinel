
import React from 'react';
import { TaskforceItem } from '../types';
import { LinkIcon, ShieldExclamationIcon } from './icons/GeneralIcons';
import { PlanRenderer } from './PlanRenderer';

interface TaskforceDashboardProps {
    items: TaskforceItem[];
}

export const TaskforceDashboard: React.FC<TaskforceDashboardProps> = ({ items }) => {
    return (
        <div className="animate-fade-in-up w-full">
            <div className="flex items-center gap-4 mb-6">
                <ShieldExclamationIcon className="h-8 w-8 text-primary flex-shrink-0"/>
                <h1 className="text-3xl font-bold text-text-primary truncate">Digital Action Taskforce</h1>
            </div>

            {items.length === 0 ? (
                <div className="text-center text-text-secondary bg-background-secondary p-8 rounded-lg border border-border">
                    <h3 className="text-xl font-semibold text-text-primary">Taskforce board is clear.</h3>
                    <p className="mt-2">Assign narratives from the dashboard to create new tasks for the team.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {items.map(item => (
                        <div key={item.id} className="bg-background-card rounded-lg shadow-card flex flex-col h-full min-w-0 border border-transparent hover:border-border transition-colors">
                            <div className="p-5 flex-grow min-w-0">
                                <h2 className="text-lg font-semibold text-text-primary mb-3 break-words whitespace-normal leading-tight">{item.narrativeTitle}</h2>
                                <div className="bg-background-secondary/30 p-4 rounded-lg border border-border/50">
                                    <PlanRenderer text={item.assignmentBrief} />
                                </div>
                            </div>
                            <div className="border-t border-border p-5 min-w-0 bg-background/50 rounded-b-lg">
                                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Associated Posts ({item.posts.length})</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 w-full custom-scrollbar">
                                    {item.posts.map((post, index) => (
                                        <div key={index} className="text-xs bg-background p-2.5 rounded border border-border w-full hover:border-primary/30 transition-colors">
                                            <p className="text-text-secondary break-words whitespace-normal w-full line-clamp-3 mb-1">{post.content}</p>
                                            <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 break-all w-full font-medium">
                                                <LinkIcon className="h-3 w-3 flex-shrink-0" /> Source
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
