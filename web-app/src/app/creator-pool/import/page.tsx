import React, { Suspense } from 'react';
import SpreadsheetImportClient from './SpreadsheetImportClient';

export default function ImportCreatorPoolPage() {
  return (
    <div className="w-full">
      <Suspense fallback={<div className="p-4">Loading import form...</div>}>
        <SpreadsheetImportClient />
      </Suspense>
    </div>
  );
}
