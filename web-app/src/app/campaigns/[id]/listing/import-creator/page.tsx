import React, { Suspense } from 'react';
import SpreadsheetImportCreatorClient from './SpreadsheetImportCreatorClient';

export default function ImportCreatorPage() {
  return (
    <div className="w-full">
      <Suspense fallback={<div className="p-4 flex items-center justify-center text-slate-500">Loading import form...</div>}>
        <SpreadsheetImportCreatorClient />
      </Suspense>
    </div>
  );
}
