import React from 'react';

interface CustomInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const CustomInput: React.FC<CustomInputProps> = ({ id, label, value, onChange, placeholder }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-2">
        {label}
      </label>
      <input
        type="text"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary transition-colors"
      />
    </div>
  );
};