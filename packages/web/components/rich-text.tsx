import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { BLOCKS } from "@contentful/rich-text-types";
import type { Document } from "@contentful/rich-text-types";
import type { ReactNode } from "react";

// The page's own <h1> is rendered outside this component, so every heading
// an editor writes into the CMS body — whatever level they picked — must
// render no higher than h2, or it either duplicates the page's h1 or skips
// a level under it.
const asH2 = (_node: unknown, children: ReactNode) => <h2>{children}</h2>;

const options = {
  renderNode: {
    [BLOCKS.HEADING_1]: asH2,
    [BLOCKS.HEADING_2]: asH2,
    [BLOCKS.HEADING_3]: asH2,
    [BLOCKS.HEADING_4]: asH2,
    [BLOCKS.HEADING_5]: asH2,
    [BLOCKS.HEADING_6]: asH2,
  },
};

export function RichText({ document }: { document: Document }) {
  return (
    <div className="ledger-prose prose mt-8 prose-headings:font-display prose-headings:tracking-wide prose-a:no-underline prose-a:underline-offset-4 hover:prose-a:underline">
      {documentToReactComponents(document, options)}
    </div>
  );
}
