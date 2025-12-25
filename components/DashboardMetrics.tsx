
import React from 'react';
import { Narrative } from '../types';
import { ShieldExclamationIcon, FlameIcon, ChartBarIcon, TagIcon } from './icons/GeneralIcons';
import clsx from 'clsx';

interface DashboardMetricsProps {
    narratives: Narrative[];
}

const MetricCard: React.FC<{ 
    title: string; 
    value: string | number; 
    icon: React.ElementType; 
    trend?: string;
    trendType?: 'up' | 'down' | 'neutral';
    color: 'primary' | 'critical' | 'warning' | 'success';
}> = ({ title, value, icon: Icon, trend, trendType, color }) => {
    const colorStyles = {
        primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
        critical: { bg: 'bg-critical/10', text: 'text-critical', border: 'border-critical/20' },
        warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
        success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
    };

    return (
        <div className="bg-background-card rounded-xl border border-border p-4 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className={clsx("p-3 rounded-lg flex-shrink-0", colorStyles[color].bg, colorStyles[color].text)}>
                <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-secondary truncate">{title}</p>
                <div className="flex items-end gap-2 mt-1">
                    <h3 className="text-2xl font-bold text-text-primary leading-none">{value}</h3>
                    {trend && (
                        <span className={clsx("text-xs font-medium mb-0.5", 
                            trendType === 'down' ? 'text-success' : trendType === 'up' ? 'text-critical' : 'text-text-secondary'
                        )}>
                            {trend}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ narratives }) => {
    const totalNarratives = narratives.length;
    const criticalThreats = narratives.filter(n => n.riskScore >= 8).length;
    const avgRisk = totalNarratives > 0 
        ? (narratives.reduce((acc, n) => acc + n.riskScore, 0) / totalNarratives).toFixed(1) 
        : '0.0';
    
    // Count distinct campaigns or just default to 0 if not set
    const activeCampaigns = new Set(narratives.filter(n => n.campaign).map(n => n.campaign)).size;
    const sourcesMonitored = totalNarratives > 0 ? "24/7" : "Idle"; 

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard 
                title="Active Narratives" 
                value={totalNarratives} 
                icon={ChartBarIcon} 
                color="primary" 
                trend={totalNarratives > 0 ? "+12% this week" : undefined}
                trendType="up"
            />
            <MetricCard 
                title="Critical Threats" 
                value={criticalThreats} 
                icon={ShieldExclamationIcon} 
                color="critical" 
                trend={criticalThreats > 0 ? "Action Required" : "Stable"}
                trendType={criticalThreats > 0 ? 'up' : 'neutral'}
            />
            <MetricCard 
                title="Avg Risk Score" 
                value={avgRisk} 
                icon={FlameIcon} 
                color="warning" 
                trend={Number(avgRisk) > 5 ? "Elevated" : "Low"}
                trendType={Number(avgRisk) > 5 ? 'up' : 'down'}
            />
            <MetricCard 
                title="Active Campaigns" 
                value={activeCampaigns || sourcesMonitored} 
                icon={TagIcon} 
                color="success" 
                trend="Monitoring"
                trendType="neutral"
            />
        </div>
    );
};
