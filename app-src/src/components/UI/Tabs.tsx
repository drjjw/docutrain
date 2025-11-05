import React, { useState, createContext, useContext } from 'react';

interface TabsContextValue {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  children: React.ReactNode;
  defaultIndex?: number;
  className?: string;
}

export function Tabs({ children, defaultIndex = 0, className = '' }: TabsProps) {
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);

  return (
    <TabsContext.Provider value={{ selectedIndex, setSelectedIndex }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabList({ children, className = '' }: TabListProps) {
  return (
    <div
      className={`flex border-b border-gray-200 mb-6 ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

interface TabProps {
  children: React.ReactNode;
  index: number;
  className?: string;
}

export function Tab({ children, index, className = '' }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tab must be used within a Tabs component');
  }

  const { selectedIndex, setSelectedIndex } = context;
  const isSelected = selectedIndex === index;

  const handleClick = () => {
    setSelectedIndex(index);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedIndex(index);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      // Find next tab - would need to know total count, but for simplicity just focus next
      const tabs = (e.currentTarget.parentElement?.querySelectorAll('[role="tab"]') || []) as HTMLElement[];
      const currentIndex = Array.from(tabs).indexOf(e.currentTarget as HTMLElement);
      const nextIndex = (currentIndex + 1) % tabs.length;
      tabs[nextIndex]?.focus();
      setSelectedIndex(nextIndex);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const tabs = (e.currentTarget.parentElement?.querySelectorAll('[role="tab"]') || []) as HTMLElement[];
      const currentIndex = Array.from(tabs).indexOf(e.currentTarget as HTMLElement);
      const nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      tabs[nextIndex]?.focus();
      setSelectedIndex(nextIndex);
    }
  };

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      aria-controls={`panel-${index}`}
      id={`tab-${index}`}
      tabIndex={isSelected ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        px-6 py-3 text-sm font-medium transition-colors border-b-2 focus:outline-none
        ${isSelected
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

interface TabPanelsProps {
  children: React.ReactNode;
  className?: string;
}

export function TabPanels({ children, className = '' }: TabPanelsProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabPanels must be used within a Tabs component');
  }

  const { selectedIndex } = context;

  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => {
        if (index === selectedIndex) {
          return (
            <div
              id={`panel-${index}`}
              role="tabpanel"
              aria-labelledby={`tab-${index}`}
              className="outline-none"
            >
              {child}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

interface TabPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ children, className = '' }: TabPanelProps) {
  return <div className={className}>{children}</div>;
}

