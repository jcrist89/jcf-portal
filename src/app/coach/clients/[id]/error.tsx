"use client";
import { useEffect } from "react";
import { RouteError } from "@/components/RouteError";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[coach/clients/[id]]", error);
  }, [error]);
  return <RouteError reset={reset} />;
}
