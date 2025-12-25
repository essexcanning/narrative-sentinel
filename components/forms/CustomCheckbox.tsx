
import React from 'react';
import { CheckIcon } from '../icons/GeneralIcons';
import clsx from 'clsx';

interface CustomCheckboxProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: () => void;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ id, label, checked, onChange }) => {
    return (
        <label htmlFor={id} className="flex items-center space-x-3 cursor-pointer group select-none">
            <input 
                type="checkbox" 
                id={id} 
                checked={checked} 
                onChange={onChange}
                className="sr-only"
            />
            <div className={clsx(
                "h-5 w-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200",
                checked ? "bg-primary border-primary" : "bg-transparent border-border group-hover:border-primary/50"
            )}>
                {checked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
            </div>
            <span className="text-sm font-medium text-text-primary">{label}</span>
        </label>
    );
};
