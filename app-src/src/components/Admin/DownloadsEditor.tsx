import React, { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import type { DownloadLink } from '@/types/admin';

interface DownloadsEditorProps {
  downloads: DownloadLink[];
  onSave: (downloads: DownloadLink[]) => void;
  onCancel: () => void;
}

export function DownloadsEditor({ downloads, onSave, onCancel }: DownloadsEditorProps) {
  const [editedDownloads, setEditedDownloads] = useState<DownloadLink[]>(downloads);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setEditedDownloads(downloads);
  }, [downloads]);

  const handleAdd = () => {
    setEditedDownloads([...editedDownloads, { url: '', title: '' }]);
  };

  const handleRemove = (index: number) => {
    setEditedDownloads(editedDownloads.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: 'url' | 'title', value: string) => {
    const updated = [...editedDownloads];
    updated[index] = { ...updated[index], [field]: value };
    setEditedDownloads(updated);
  };

  const validate = (): boolean => {
    const newErrors: string[] = [];
    
    editedDownloads.forEach((download, index) => {
      if (!download.url.trim()) {
        newErrors.push(`Download ${index + 1}: URL is required`);
      }
      if (!download.title.trim()) {
        newErrors.push(`Download ${index + 1}: Title is required`);
      }
      // Basic URL validation
      if (download.url.trim() && !download.url.match(/^https?:\/\/.+/)) {
        newErrors.push(`Download ${index + 1}: URL must start with http:// or https://`);
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      // Filter out empty downloads
      const validDownloads = editedDownloads.filter(d => d.url.trim() && d.title.trim());
      onSave(validDownloads);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white shadow-xl w-full h-full md:rounded-lg md:max-w-2xl md:w-full md:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Edit Downloads</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add or modify download links for this document
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4 min-h-0">
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-sm font-medium text-red-800 mb-1">Please fix the following errors:</h3>
              <ul className="list-disc list-inside text-sm text-red-700">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {editedDownloads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No downloads yet. Click "Add Download" to create one.
              </div>
            ) : (
              editedDownloads.map((download, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Download {index + 1}</h3>
                    <button
                      onClick={() => handleRemove(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={download.title}
                        onChange={(e) => handleChange(index, 'title', e.target.value)}
                        placeholder="e.g., Download PDF"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL
                      </label>
                      <input
                        type="url"
                        value={download.url}
                        onChange={(e) => handleChange(index, 'url', e.target.value)}
                        placeholder="https://example.com/file.pdf"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={handleAdd}
            className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            + Add Download
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 md:flex-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 md:flex-none"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

