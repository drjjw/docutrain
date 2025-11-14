import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string | React.ReactNode;
  description?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
  description
}: ToggleProps) {
  const sizeClasses = {
    sm: {
      container: 'h-5 w-9',
      circle: 'h-4 w-4',
      translate: 'translate-x-4'
    },
    md: {
      container: 'h-6 w-11',
      circle: 'h-5 w-5',
      translate: 'translate-x-5'
    },
    lg: {
      container: 'h-7 w-14',
      circle: 'h-6 w-6',
      translate: 'translate-x-7'
    }
  };

  const classes = sizeClasses[size];

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const toggleContent = (
    <div
      className={`
        relative inline-flex ${classes.container} shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}
        ${checked && !disabled ? 'hover:bg-blue-700' : ''}
      `}
      onClick={handleClick}
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <span
        className={`
          pointer-events-none inline-block ${classes.circle} transform rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out
          ${checked ? classes.translate : 'translate-x-0'}
        `}
      />
    </div>
  );

  if (label || description) {
    return (
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          {toggleContent}
        </div>
        <div className="flex-1 min-w-0">
          {label && (
            <label
              className={`block font-medium cursor-pointer ${disabled ? 'text-gray-400' : 'text-gray-900'}`}
              onClick={handleClick}
            >
              {label}
            </label>
          )}
          {description && (
            <p className={`text-sm mt-1 ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
              {description}
            </p>
          )}
        </div>
      </div>
    );
  }

  return toggleContent;
}
