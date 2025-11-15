export type Theme = 'light' | 'dark';
export type Page = 'dashboard' | 'taskforce';

export interface SearchSource {
  uri: string;
  title: string;
}

export interface AnalysisInput {
  country: string;
  timeFrame: {
    start: string;
    end: string;
  };
  sources: string[];
}

export interface Post {
  id: string;
  source: 'Web Article' | 'Social Media Post' | 'News Report' | 'Twitter';
  author: string; // publication or user
  content: string; // summary of content
  timestamp: string; // estimated date
  imageUrl?: string;
  videoUrl?: string;
  link: string;
}

export interface DMMIReport {
  classification: 'Disinformation' | 'Misinformation' | 'Malinformation' | 'Information';
  intent: 'Harmful' | 'Benign' | 'Uncertain';
  veracity: 'False' | 'Misleading' | 'True' | 'Unverified';
  successProbability: number; // 0-100
  rationale: string;
}

export interface DisarmAnalysis {
  phase: string;
  tactics: string[];
  techniques: string[];
  confidence: 'Low' | 'Medium' | 'High';
}

export interface CounterOpportunity {
    tactic: string;
    rationale: string;
}

export interface Narrative {
  id: string;
  title: string;
  summary: string;
  postIds: string[];
  riskScore: number;
  status: 'pending' | 'complete' | 'error';
  dmmiReport?: DMMIReport;
  disarmAnalysis?: DisarmAnalysis;
  counterOpportunities?: CounterOpportunity[];
  trendData?: { date: string; volume: number }[];
  posts?: Post[]; // Added to hold the raw posts for the new tab
}

export interface TaskforceItem {
    id: string;
    narrativeTitle: string;
    assignmentBrief: string;
    posts: {
        content: string;
        link: string;
    }[];
}

export interface AnalysisStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'done' | 'error';
}
