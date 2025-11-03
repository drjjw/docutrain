import React from 'react';
import { WysiwygEditor } from '@/components/UI/WysiwygEditor';
import type { DocumentMessagesCardProps } from './types';

export function DocumentMessagesCard({
  welcomeMessage,
  introMessage,
  onFieldChange
}: DocumentMessagesCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-pink-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Content Messages</h4>
        </div>
      </div>
      <div className="px-6 py-4 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Welcome Message</label>
          <div className="text-xs text-gray-500 mb-2">HTML formatted welcome message. Supports: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;a&gt;</div>
          <WysiwygEditor
            value={welcomeMessage || ''}
            onChange={(val) => onFieldChange('welcome_message', val)}
            placeholder="Enter welcome message with basic HTML formatting..."
            className="w-full"
          />
          {welcomeMessage && (
            <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </div>
              <div className="prose prose-sm max-w-none text-gray-800 wysiwyg-preview" dangerouslySetInnerHTML={{ __html: welcomeMessage }} />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Intro Message</label>
          <div className="text-xs text-gray-500 mb-2">HTML formatted introduction message. Supports: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;a&gt;</div>
          <WysiwygEditor
            value={introMessage || ''}
            onChange={(val) => onFieldChange('intro_message', val)}
            placeholder="Enter intro message with basic HTML formatting..."
            className="w-full"
          />
          {introMessage && (
            <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </div>
              <div className="prose prose-sm max-w-none text-gray-800 wysiwyg-preview" dangerouslySetInnerHTML={{ __html: introMessage }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

