import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}

export function SelectInput({ 
  value, 
  onChange, 
  options, 
  className = '', 
  placeholder = 'None',
  allowEmpty = true 
}: SelectInputProps) {
  const inputClasses = `px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full ${className}`;

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || (allowEmpty ? '' : options[0]?.value || ''))}
      className={inputClasses}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

