import React from 'react';

interface NumberInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  className?: string;
  error?: boolean;
  errorMessage?: string;
}

export function NumberInput({ 
  value, 
  onChange, 
  min, 
  max, 
  className = '', 
  error = false,
  errorMessage 
}: NumberInputProps) {
  const inputClasses = `px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 w-32 ${
    error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
  } ${className}`;

  return (
    <div>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const inputValue = e.target.value === '' ? null : parseInt(e.target.value) || null;
          onChange(inputValue);
        }}
        min={min}
        max={max}
        className={inputClasses}
      />
      {error && errorMessage && (
        <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
      )}
    </div>
  );
}

