import React from 'react';

interface TextareaInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function TextareaInput({ value, onChange, placeholder, rows = 3, className = '' }: TextareaInputProps) {
  const inputClasses = `px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full ${className}`;

  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={inputClasses}
    />
  );
}

