import React from 'react';
import { Toggle } from '@/components/UI/Toggle';
import type { DocumentUIConfigCardProps } from './types';

export function DocumentUIConfigCard({
  showDocumentSelector,
  showKeywords,
  showDownloads,
  showReferences,
  showRecentQuestions,
  showCountryFlags,
  showQuizzes,
  quizzesGenerated = false,
  documentSlug,
  onFieldChange,
  isTextUpload = false,
  isSuperAdmin = false,
  referencesDisabled = false,
  referencesDisabledReason = null,
  savingField = null,
  savedField = null
}: DocumentUIConfigCardProps) {

  const FieldIndicator = ({ fieldName }: { fieldName: string }) => {
    if (savingField === fieldName) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 ml-2">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Saving...</span>
        </span>
      );
    }
    if (savedField === fieldName) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 ml-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Saved!</span>
        </span>
      );
    }
    return null;
  };

  const ToggleWithIndicator = ({ 
    fieldName, 
    label, 
    ...toggleProps 
  }: { 
    fieldName: string; 
    label: string; 
    [key: string]: any;
  }) => {
    return (
      <Toggle
        {...toggleProps}
        label={
          <span className="inline-flex items-center">
            {label}
            <FieldIndicator fieldName={fieldName} />
          </span>
        }
      />
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">UI Configuration</h4>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        <ToggleWithIndicator
          fieldName="show_document_selector"
          checked={showDocumentSelector || false}
          onChange={(checked) => onFieldChange('show_document_selector', checked)}
          label="Document Selector"
          description="Show a document selection interface in the chat interface"
          size="md"
        />
        <ToggleWithIndicator
          fieldName="show_keywords"
          checked={showKeywords !== false}
          onChange={(checked) => onFieldChange('show_keywords', checked)}
          label="Show Keywords Cloud"
          description="Display the keywords cloud in the chat interface"
          size="md"
        />
        <ToggleWithIndicator
          fieldName="show_downloads"
          checked={showDownloads !== false}
          onChange={(checked) => onFieldChange('show_downloads', checked)}
          label="Show Downloads Section"
          description="Display the downloads section in the chat interface"
          size="md"
        />
        {isSuperAdmin && (
          <ToggleWithIndicator
            fieldName="show_quizzes"
            checked={showQuizzes === true}
            onChange={(checked) => onFieldChange('show_quizzes', checked)}
            label="Show Quiz Button"
            description={quizzesGenerated 
              ? "Display the quiz button next to keywords in the chat interface"
              : "Generate questions in the Quiz tab first to enable this option"}
            size="md"
            disabled={!quizzesGenerated}
          />
        )}
        {isSuperAdmin && showQuizzes && !quizzesGenerated && (
          <div className="ml-6 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800">
                Quizzes will not appear until you generate questions in the Quiz tab.
              </p>
            </div>
          </div>
        )}
        <ToggleWithIndicator
          fieldName="show_references"
          checked={showReferences !== false}
          onChange={(checked) => onFieldChange('show_references', checked)}
          label="Show References"
          description={
            isTextUpload 
              ? "References are disabled for text uploads since there are no page numbers in the source material"
              : referencesDisabled && referencesDisabledReason
              ? referencesDisabledReason
              : "Display references section at the end of chat messages"
          }
          size="md"
          disabled={isTextUpload || referencesDisabled}
        />
        <ToggleWithIndicator
          fieldName="show_recent_questions"
          checked={showRecentQuestions === true}
          onChange={(checked) => onFieldChange('show_recent_questions', checked)}
          label="Show Recent Questions"
          description="Display a gallery of recent questions asked about this document. Note: The gallery will only appear if there are at least 2 recent questions available."
          size="md"
        />
        {showRecentQuestions && (
          <div className="ml-6 pl-4 border-l-2 border-gray-200">
            <ToggleWithIndicator
              fieldName="show_country_flags"
              checked={showCountryFlags === true}
              onChange={(checked) => onFieldChange('show_country_flags', checked)}
              label="Show Country Flags"
              description="Display country flags next to recent questions based on the user's IP address location"
              size="md"
            />
          </div>
        )}
        {(isTextUpload || (referencesDisabled && referencesDisabledReason)) && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800">
                {isTextUpload ? (
                  <>
                    <strong>Note:</strong> This document was uploaded as text. References require page numbers, which are only available for PDF uploads.
                  </>
                ) : (
                  <>
                    <strong>Note:</strong> {referencesDisabledReason}
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

