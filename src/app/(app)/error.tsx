"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <ErrorState
        title="This page hit an error"
        message="Something went wrong while loading this view."
        onRetry={reset}
      />
    </div>
  );
}
