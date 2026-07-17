import React, { Suspense } from 'react';
import SpreadsheetImportAddressClient from './SpreadsheetImportAddressClient';

export default function ImportAlamatPage() {
  return (
    <div className="w-full">
      <Suspense fallback={<div className="p-4">Loading import form...</div>}>
        <SpreadsheetImportAddressClient />
      </Suspense>
    </div>
  );
}
