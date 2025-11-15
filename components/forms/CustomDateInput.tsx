import React from 'react';

interface CustomDateInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const CustomDateInput: React.FC<CustomDateInputProps> = ({ value, onChange }) => {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-background border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary transition-colors"
    />
  );
};