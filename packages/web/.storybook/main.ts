import { defineMain } from "@storybook/nextjs-vite/node";

export default defineMain({
  framework: "@storybook/nextjs-vite",
  stories: ["../components/**/*.stories.@(ts|tsx)"],
});
