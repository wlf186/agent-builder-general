'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KnowledgeBasesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main page - KB is now integrated in sidebar
    router.replace('/#knowledge');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <p className="text-gray-500">Redirecting to Agent Builder...</p>
    </div>
  );
}
