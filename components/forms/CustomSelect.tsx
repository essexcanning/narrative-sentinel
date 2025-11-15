import React from 'react';
import { ChevronDownIcon } from '../icons/GeneralIcons';

interface CustomSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ id, label, value, onChange, options }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-2">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-background border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary transition-colors"
        >
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-secondary">
            <ChevronDownIcon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};