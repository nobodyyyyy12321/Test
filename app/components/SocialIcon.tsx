type Platform = "facebook" | "instagram" | "threads" | "x" | "website";

export function SocialIcon({ platform, size = 18 }: { platform: Platform; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
  } as const;

  switch (platform) {
    case "facebook":
      return (
        <svg {...common} aria-hidden>
          <path
            fill="#1877F2"
            d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06z"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common} aria-hidden>
          <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFD600" />
              <stop offset="25%" stopColor="#FF7A00" />
              <stop offset="50%" stopColor="#FF0069" />
              <stop offset="75%" stopColor="#D300C5" />
              <stop offset="100%" stopColor="#7638FA" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="url(#ig-grad)" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="url(#ig-grad)" strokeWidth="1.8" />
          <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad)" />
        </svg>
      );
    case "threads":
      return (
        <svg {...common} aria-hidden>
          <path
            fill="#ffffff"
            d="M17.62 11.13c-.09-.04-.18-.08-.27-.12-.16-2.94-1.77-4.62-4.46-4.64h-.04c-1.61 0-2.95.69-3.78 1.94l1.48 1.02c.62-.94 1.59-1.14 2.3-1.14h.03c.89.01 1.56.27 1.99.77.32.37.53.88.64 1.52-.81-.14-1.69-.18-2.62-.13-2.63.15-4.32 1.69-4.21 3.83.06 1.09.6 2.02 1.53 2.63.78.52 1.79.77 2.84.71 1.39-.08 2.48-.61 3.24-1.59.58-.74.94-1.7 1.1-2.91.65.39 1.13.91 1.4 1.53.45 1.06.48 2.81-.94 4.23-1.25 1.24-2.74 1.78-4.99 1.79-2.49-.02-4.38-.82-5.6-2.38-1.15-1.46-1.74-3.57-1.77-6.27.03-2.7.62-4.81 1.77-6.27 1.23-1.56 3.11-2.36 5.6-2.38 2.51.02 4.42.83 5.69 2.39.62.77 1.09 1.74 1.39 2.86l1.85-.49c-.37-1.39-.96-2.6-1.76-3.59-1.62-2-4-3.02-7.16-3.04h-.02c-3.16.02-5.51 1.05-7.09 3.05C2.41 4.91 1.69 7.4 1.66 10.4v.04c.03 3 .75 5.49 2.16 7.31 1.58 2 3.93 3.02 7.09 3.05h.02c2.81-.02 4.79-.75 6.43-2.39 2.13-2.13 2.07-4.81 1.36-6.46-.5-1.18-1.45-2.14-2.74-2.81zm-4.65 4.07c-1.16.06-2.36-.46-2.42-1.55-.04-.81.59-1.71 2.49-1.82.22-.01.43-.02.65-.02.69 0 1.33.07 1.92.2-.22 2.74-1.51 3.13-2.64 3.19z"
          />
        </svg>
      );
    case "x":
      return (
        <svg {...common} aria-hidden>
          <path
            fill="currentColor"
            d="M18.244 2H21l-6.52 7.45L22.5 22h-6.81l-4.74-6.2L5.5 22H2.74l6.99-7.99L1.5 2h6.93l4.28 5.66L18.244 2zm-1.19 18h1.7L7.04 4H5.27l11.78 16z"
          />
        </svg>
      );
    case "website":
      return (
        <svg {...common} fill="none" stroke="#5fa870" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      );
  }
}
