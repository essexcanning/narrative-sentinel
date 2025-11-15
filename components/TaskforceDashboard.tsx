import React from 'react';
import { TaskforceItem } from '../types';
import { LinkIcon, ShieldExclamationIcon } from './icons/GeneralIcons';

interface TaskforceDashboardProps {
    items: TaskforceItem[];
}

export const TaskforceDashboard: React.FC<TaskforceDashboardProps> = ({ items }) => {
    return (
        <div className="animate-fade-in-up">
            <div className="flex items-center gap-4 mb-6">
                <ShieldExclamationIcon className="h-8 w-8 text-primary"/>
                <h1 className="text-3xl font-bold text-text-primary">Digital Action Taskforce</h1>
            </div>

            {items.length === 0 ? (
                <div className="text-center text-text-secondary bg-background-secondary p-8 rounded-lg border border-border">
                    <h3 className="text-xl font-semibold text-text-primary">Taskforce board is clear.</h3>
                    <p className="mt-2">Assign narratives from the dashboard to create new tasks for the team.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {items.map(item => (
                        <div key={item.id} className="bg-background-card rounded-lg shadow-card flex flex-col">
                            <div className="p-5">
                                <h2 className="text-lg font-semibold text-text-primary mb-3">{item.narrativeTitle}</h2>
                                <div className="bg-background p-3 rounded-lg border border-border text-sm text-text-secondary whitespace-pre-wrap font-mono">
                                    {item.assignmentBrief}
                                </div>
                            </div>
                            <div className="border-t border-border mt-auto p-5">
                                <h3 className="text-sm font-semibold text-text-primary mb-2">Associated Posts ({item.posts.length})</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {item.posts.map((post, index) => (
                                        <div key={index} className="text-xs bg-background p-2 rounded border border-border">
                                            <p className="text-text-secondary truncate">{post.content}</p>
                                            <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-1">
                                                <LinkIcon className="h-3 w-3" /> Source
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