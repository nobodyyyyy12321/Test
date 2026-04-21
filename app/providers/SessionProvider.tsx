"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { ShareProvider } from "./ShareProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={true} refetchWhenOffline={false}>
      <ShareProvider>{children}</ShareProvider>
    </SessionProvider>
  );
}
