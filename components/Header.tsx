import React, { useState, useEffect } from 'react';
import { Theme } from '../types';
import { SunIcon, MoonIcon, MenuIcon, XIcon, ChevronLeftIcon } from './icons/GeneralIcons';
import clsx from 'clsx';

interface HeaderProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export const Header: React.FC<HeaderProps> = ({ isSidebarOpen, setIsSidebarOpen, theme, setTheme }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60); // Update every minute
        return () => clearInterval(timer);
    }, []);

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    return (
        <header className="flex-shrink-0 bg-background-secondary border-b border-border h-16 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2">
                 <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                    className="p-2 rounded-md text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors"
                    aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                    {isSidebarOpen ? <ChevronLeftIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
                </button>
                <h1 className="text-xl font-bold text-text-primary tracking-tight">
                    Narrative Sentinel
                </h1>
                <span className="hidden sm:inline-block bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                    Hackathon Build
                </span>
            </div>
            <div className="flex items-center gap-4">
                 <span className="text-sm text-text-secondary hidden md:inline">
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button 
                    onClick={toggleTheme}
                    className="p-2 rounded-full text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors"
                    aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
                </button>
                <div className="w-8 h-8 rounded-full bg-background-hover border border-border flex items-center justify-center text-sm font-semibold text-text-secondary">
                    A
                </div>
            </div>
        </header>
    );
};