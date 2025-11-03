import React from 'react';

interface CheckboxInputProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function CheckboxInput({ checked, onChange, className = '' }: CheckboxInputProps) {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        checked={checked || false}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${className}`}
      />
    </div>
  );
}

