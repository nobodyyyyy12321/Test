"use client";

import { createContext, useContext, useState } from "react";

type ShareCtx = {
  shareText: string | null;
  setShareText: (text: string | null) => void;
};

const ShareContext = createContext<ShareCtx>({ shareText: null, setShareText: () => {} });

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [shareText, setShareText] = useState<string | null>(null);
  return (
    <ShareContext.Provider value={{ shareText, setShareText }}>
      {children}
    </ShareContext.Provider>
  );
}

export function useShare() {
  return useContext(ShareContext);
}
