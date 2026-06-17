import React from 'react';
import SpreadsheetImportClient from './SpreadsheetImportClient';

export default function ImportCreatorPage({ params }: { params: { id: string } }) {
  const campaignId = parseInt(params.id, 10);
  
  return (
    <div className="w-full">
      <SpreadsheetImportClient campaignId={campaignId} />
    </div>
  );
}
