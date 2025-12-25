
import React from 'react';

interface PlanRendererProps {
    text: string;
}

export const PlanRenderer: React.FC<PlanRendererProps> = ({ text }) => {
    const elements: React.ReactNode[] = [];
    if (!text) return null;

    const lines = text.split('\n');
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const endList = () => {
        if (inList) {
            elements.push(
                <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 pl-4 mb-3">
                    {listItems}
                </ul>
            );
            listItems = [];
            inList = false;
        }
    };

    // Helper to parse inline bolding like **text** within a string
    const parseInlineStyles = (str: string) => {
        const parts = str.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return <strong key={i} className="text-text-primary font-semibold">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return; // Skip empty lines to handle spacing via margins

        // Check for headers or bolded keys at start of line
        if (trimmedLine.startsWith('**')) {
             // Case 1: "**Header**" (Standalone Header)
             if (trimmedLine.endsWith('**') && trimmedLine.length > 4 && !trimmedLine.includes(':', 2)) {
                 endList();
                 elements.push(
                    <h4 key={`h-${index}`} className="text-sm font-bold text-text-primary mt-4 mb-2 first:mt-0">
                        {trimmedLine.replace(/\*\*/g, '')}
                    </h4>
                 );
             } 
             // Case 2: "**Label:** Value" (Inline Label)
             else {
                 const closingIndex = trimmedLine.indexOf('**', 2);
                 // Ensure we have a closing **, and likely a colon following it or very close
                 if (closingIndex !== -1) {
                     endList();
                     const labelSection = trimmedLine.substring(0, closingIndex + 2); // includes **
                     const contentSection = trimmedLine.substring(closingIndex + 2);
                     
                     elements.push(
                        <div key={`p-${index}`} className="mb-2 text-sm text-text-secondary leading-relaxed">
                            {parseInlineStyles(labelSection)}
                            {parseInlineStyles(contentSection)}
                        </div>
                     );
                 } else {
                     // Fallback if structure is weird
                     endList();
                     elements.push(<p key={`p-${index}`} className="mb-2 text-sm text-text-secondary leading-relaxed">{parseInlineStyles(trimmedLine)}</p>);
                 }
             }
        } 
        // List Items
        else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || /^\d+\.\s/.test(trimmedLine)) {
            if (!inList) {
                inList = true;
            }
            const content = /^\d+\.\s/.test(trimmedLine) 
                ? trimmedLine.replace(/^\d+\.\s/, '') 
                : trimmedLine.substring(2);
                
            listItems.push(<li key={`li-${index}`} className="text-sm text-text-secondary leading-relaxed">{parseInlineStyles(content)}</li>);
        } 
        // Regular Paragraphs
        else {
            endList();
            elements.push(<p key={`p-${index}`} className="mb-3 text-sm text-text-secondary leading-relaxed">{parseInlineStyles(trimmedLine)}</p>);
        }
    });

    endList();

    return <div className="space-y-1">{elements}</div>;
};
