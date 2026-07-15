import type { Preview } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { Big_Shoulders, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { sb } from "storybook/test";

import "../app/globals.css";

sb.mock(import("../lib/api.ts"), { spy: true });
sb.mock(import("../lib/auth-client.ts"), { spy: true });

const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
});

const body = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-code",
});

const fontClassNames = [display.variable, body.variable, mono.variable];

const preview: Preview = {
  decorators: [
    (Story) => {
      useEffect(() => {
        document.documentElement.classList.add(...fontClassNames);
        return () => {
          document.documentElement.classList.remove(...fontClassNames);
        };
      }, []);

      return <Story />;
    },
  ],
};

export default preview;
