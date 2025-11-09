import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { PublicFooter } from '@/components/Layout/PublicFooter';

interface DashboardProps {
  children: React.ReactNode;
}

export function Dashboard({ children }: DashboardProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <DashboardHeader />
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

