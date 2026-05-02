"use client";

import { createContext, useContext, useState } from "react";

type ShareCtx = {
  shareText: string | null;
  shareTitle: string | null;
  shareScoreCard: string | null;
  setShareText: (text: string | null) => void;
  setShareTitle: (title: string | null) => void;
  setShareScoreCard: (card: string | null) => void;
};

const ShareContext = createContext<ShareCtx>({
  shareText: null,
  shareTitle: null,
  shareScoreCard: null,
  setShareText: () => {},
  setShareTitle: () => {},
  setShareScoreCard: () => {},
});

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [shareText, setShareText] = useState<string | null>(null);
  const [shareTitle, setShareTitle] = useState<string | null>(null);
  const [shareScoreCard, setShareScoreCard] = useState<string | null>(null);
  return (
    <ShareContext.Provider value={{ shareText, setShareTitle, shareTitle, setShareText, shareScoreCard, setShareScoreCard }}>
      {children}
    </ShareContext.Provider>
  );
}

export function useShare() {
  return useContext(ShareContext);
}
