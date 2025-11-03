import React from 'react';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
}

export function TextInput({ value, onChange, placeholder, className = '', error = false }: TextInputProps) {
  const inputClasses = `px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 w-full ${
    error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
  } ${className}`;

  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClasses}
    />
  );
}

