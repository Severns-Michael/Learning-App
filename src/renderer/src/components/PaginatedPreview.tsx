import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders markdown as discrete printable pages (Google-Docs style):
 *
 * 1. Render the markdown into a hidden off-screen container that matches the
 *    on-page content width (so wrapping is identical).
 * 2. Walk its top-level children. Accumulate offsetTop+offsetHeight per page.
 *    When the next element would overflow the page content height, start a new
 *    page. Single elements taller than a page are placed alone (overflow
 *    accepted — rare for normal study notes).
 * 3. Take outerHTML of each child and inject the per-page HTML into visible
 *    page rectangles via dangerouslySetInnerHTML. (Safe: the HTML originated
 *    from react-markdown which sanitizes by default.)
 *
 * The same .paginated-page DOM is what `window.print()` paginates: print CSS
 * forces page-break-after: always on each .paginated-page, so what you see is
 * exactly what prints.
 *
 * Margin-collapse caveat: each new page may have ~one line less content than
 * computed because the first child's margin-top no longer collapses with a
 * sibling's margin-bottom. We compensate with a small reserve in
 * PAGE_CONTENT_HEIGHT.
 */

// US Letter at 96 CSS px/in. Content area = 11in − 2×0.5in margin = 10in.
// Reserve ~0.15in for accumulated margin-collapse drift across page breaks.
const PAGE_CONTENT_HEIGHT_PX = (10 - 0.15) * 96;
const PAGE_CONTENT_WIDTH_PX = 7.5 * 96;

export function PaginatedPreview({
  markdown,
  onPageCount,
}: {
  markdown: string;
  /** Called whenever the page count changes. Parent should memoize with useCallback. */
  onPageCount?: (n: number) => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([""]);

  // Latest onPageCount in a ref so it doesn't drive the effect's deps.
  const onPageCountRef = useRef(onPageCount);
  onPageCountRef.current = onPageCount;

  useEffect(() => {
    const container = measureRef.current;
    if (!container) return;

    function paginate() {
      if (!container) return;
      const children = Array.from(container.children) as HTMLElement[];
      if (children.length === 0) {
        setPages([""]);
        onPageCountRef.current?.(1);
        return;
      }

      const grouped: string[][] = [[]];
      let pageStartTop = children[0].offsetTop;

      for (const child of children) {
        const top = child.offsetTop;
        const bottom = top + child.offsetHeight;
        const relativeBottom = bottom - pageStartTop;

        // Start a new page if this child would overflow AND we already have
        // something on the current page (avoids empty pages for huge children).
        if (
          relativeBottom > PAGE_CONTENT_HEIGHT_PX &&
          grouped[grouped.length - 1].length > 0
        ) {
          grouped.push([]);
          pageStartTop = top;
        }

        grouped[grouped.length - 1].push(child.outerHTML);
      }

      const result = grouped.map((p) => p.join(""));
      setPages(result);
      onPageCountRef.current?.(result.length);
    }

    paginate();
    const obs = new ResizeObserver(paginate);
    obs.observe(container);
    return () => obs.disconnect();
  }, [markdown]);

  return (
    <>
      {/* Hidden off-screen container with identical typography and content
          width — used purely for measuring. */}
      <div
        aria-hidden
        ref={measureRef}
        className="notes-view"
        style={{
          position: "absolute",
          left: "-99999px",
          top: 0,
          width: `${PAGE_CONTENT_WIDTH_PX}px`,
          visibility: "hidden",
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdown || "_(no notes yet)_"}
        </ReactMarkdown>
      </div>

      {/* Visible paginated pages */}
      <div className="paginated-pages">
        {pages.map((html, i) => (
          <div key={i} className="paginated-page">
            <div
              className="notes-view paginated-page-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <div className="page-footer no-print">
              Page {i + 1} of {pages.length}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
