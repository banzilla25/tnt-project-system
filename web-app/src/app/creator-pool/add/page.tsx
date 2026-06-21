import React, { Suspense } from 'react';
import AddCreatorClient from './AddCreatorClient';

export default function AddCreatorPage() {
  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <Suspense fallback={<div>Loading form...</div>}>
        <AddCreatorClient />
      </Suspense>
    </div>
  );
}
