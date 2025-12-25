
import React, { useState } from 'react';
import { ShieldCheckIcon, LoadingSpinner, AlertIcon } from './icons/GeneralIcons';
import { signInWithGoogle } from '../services/firebase';
import { User } from '../types';

interface LoginModalProps {
    onLoginSuccess: (user?: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorDetails, setErrorDetails] = useState<string | null>(null);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        setErrorDetails(null);
        try {
            await signInWithGoogle();
            onLoginSuccess();
        } catch (err: any) {
            console.error("Login failed:", err);
            
            const errorMessage = err.message || '';
            const errorCode = err.code || '';

            if (errorCode === 'auth/popup-closed-by-user') {
                setError('Sign-in cancelled by user.');
            } else if (errorCode === 'auth/configuration-not-found') {
                setError('Firebase configuration error.');
                setErrorDetails('Check services/firebase.ts for missing keys.');
            } else if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('unauthorized domain')) {
                setError('Domain Not Authorized');
                setErrorDetails(
                    `This domain is not whitelisted in your Firebase Console.\n\n` +
                    `1. Go to Firebase Console > Authentication > Settings > Authorized Domains.\n` +
                    `2. Add this domain:\n\n${window.location.hostname}`
                );
            } else if (errorCode === 'auth/api-key-not-valid') {
                 setError('Invalid API Key.');
                 setErrorDetails('The API key in services/firebase.ts is incorrect or has been deleted in Firebase Console.');
            } else {
                setError('Authentication Failed');
                setErrorDetails(errorMessage || errorCode || 'Unknown error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGuestLogin = () => {
        const guestUser: User = {
            id: 'guest_dev',
            name: 'Guest Analyst',
            email: 'guest@opennarrative.dev',
            initials: 'GA',
        };
        onLoginSuccess(guestUser);
    };

    return (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-lg flex items-center justify-center z-50 p-4 dark">
            <div className="bg-background-card rounded-2xl shadow-2xl max-w-md w-full p-8 border border-border transform transition-all animate-fade-in-up">
                <div className="text-center">
                    <ShieldCheckIcon className="h-14 w-14 text-primary mx-auto mb-5" />
                    <h2 className="text-3xl font-bold text-text-primary mb-2">OpenNarrative</h2>
                    <p className="text-text-secondary">Defending information integrity.</p>
                </div>
                
                <div className="mt-10 space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center space-x-3 p-3.5 rounded-xl bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 font-semibold transition-all duration-200 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <LoadingSpinner className="h-5 w-5 text-gray-600" />
                        ) : (
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                        )}
                        <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
                    </button>

                    <div className="pt-2 flex flex-col items-center">
                         <p className="text-xs text-text-secondary mb-2">
                            Having trouble connecting in this environment?
                        </p>
                        <button
                            onClick={handleGuestLogin}
                            disabled={isLoading}
                            className="text-xs text-primary hover:text-primary-hover font-medium transition-colors underline decoration-dotted underline-offset-4"
                        >
                            Continue as Guest (Dev Mode)
                        </button>
                    </div>
                    
                    {error && (
                        <div className="p-4 rounded-lg bg-critical/10 border border-critical/20 flex flex-col gap-2 animate-fade-in-up">
                            <div className="flex items-center gap-2 text-critical font-medium">
                                <AlertIcon className="h-5 w-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                            {errorDetails && (
                                <div className="mt-1 text-xs text-text-secondary bg-black/10 p-3 rounded font-mono whitespace-pre-wrap break-all select-all border border-border/50">
                                    {errorDetails}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                 <p className="text-center text-xs text-text-disabled mt-8">
                    By signing in, you agree to the ethical use mandate for defensive operations.
                </p>
            </div>
        </div>
    );
};
