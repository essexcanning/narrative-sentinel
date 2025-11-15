import React from 'react';
import { AnalysisStep } from '../types';
import { LoadingSpinner, CheckIcon, BrainCircuitIcon, CircleIcon, AlertIcon } from './icons/GeneralIcons';
import clsx from 'clsx';

interface AnalysisInProgressProps {
    steps: AnalysisStep[];
}

const getStepIcon = (status: AnalysisStep['status']) => {
    switch(status) {
        case 'pending':
            return <CircleIcon className="h-6 w-6 text-text-disabled" />;
        case 'in-progress':
            return <LoadingSpinner className="h-6 w-6 text-primary" />;
        case 'done':
            return <CheckIcon className="h-6 w-6 text-success" />;
        case 'error':
            return <AlertIcon className="h-6 w-6 text-critical" />;
        default:
            return null;
    }
}

export const AnalysisInProgress: React.FC<AnalysisInProgressProps> = ({ steps }) => {
    return (
        <div className="flex items-center justify-center h-full text-center animate-fade-in-up">
            <div className="max-w-xl w-full">
                <BrainCircuitIcon className="mx-auto h-16 w-16 text-primary animate-pulse" />
                <h2 className="mt-6 text-3xl font-bold text-text-primary">Analyzing Information Environment...</h2>
                <p className="mt-2 text-text-secondary">The AI is performing initial scans and clustering. This may take a moment.</p>
                <div className="mt-8 text-left bg-background-secondary p-6 rounded-lg border border-border">
                    <ul className="space-y-4">
                        {steps.map(step => (
                            <li key={step.id} className="flex items-center gap-4 transition-opacity duration-300">
                                <div className="flex-shrink-0">
                                    {getStepIcon(step.status)}
                                </div>
                                <span className={clsx("font-medium", {
                                    'text-text-secondary': step.status === 'pending',
                                    'text-text-primary': step.status === 'in-progress',
                                    'text-success': step.status === 'done',
                                    'text-critical': step.status === 'error',
                                })}>
                                    {step.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};