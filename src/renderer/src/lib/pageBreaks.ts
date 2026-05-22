import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/**
 * PageBreaks — a TipTap extension that paginates content like Google Docs.
 *
 * Strategy:
 *   1. After every doc update (or content resize), measure each top-level
 *      block's natural Y position in the contenteditable.
 *   2. Walk blocks in order, tracking which page each one lands on.
 *   3. When a block would straddle the page boundary, attach a node-level
 *      Decoration with `margin-top: Npx` that pushes the block down to the
 *      next page's content area. Layout reflows and the block lands aligned.
 *   4. Report the final page count via `onPageCount` so React can render the
 *      same number of visible page rectangles in an overlay.
 *
 * The math uses CSS pixels (1in = 96 px) and assumes US Letter @ 0.5" margins.
 *
 * Render structure expected by this plugin:
 *
 *   .notes-pages-wrapper        // position: relative, fixed width
 *     .notes-pages-overlay      // pointer-events: none, z-index: 0
 *       .notes-page-rect × N    // absolutely positioned at i × STRIDE
 *     .notes-editor-content     // contenteditable, z-index: 1, transparent
 *
 * The plugin doesn't render the overlay; React does. They stay in sync
 * because the plugin's pageCount reflects the same measurements that drive
 * the decorations.
 */

// US Letter @ 96 CSS px/in
export const PAGE_LAYOUT = {
  /** Total page height (11 in). */
  height: 11 * 96, // 1056
  /** Top + bottom page margin combined area shrunk to one side (0.5 in). */
  margin: 0.5 * 96, // 48
  /** Usable content area per page (height − 2×margin = 10 in). */
  contentHeight: 10 * 96, // 960
  /** Visible gap between pages in the editor. */
  gap: 32,
  /** From one page-top to the next page-top. */
  get stride() {
    return this.height + this.gap;
  },
};

export interface PageBreaksOptions {
  /** Called whenever the page count changes. Should be stable (useCallback). */
  onPageCount?: (n: number) => void;
}

const pluginKey = new PluginKey<DecorationSet>("pageBreaks");

export const PageBreaks = Extension.create<PageBreaksOptions>({
  name: "pageBreaks",
  addOptions() {
    return { onPageCount: undefined };
  },
  addProseMirrorPlugins() {
    return [createPageBreaksPlugin(this.options)];
  },
});

function createPageBreaksPlugin(opts: PageBreaksOptions) {
  let rafId: number | null = null;
  let lastSnapshot = "";

  return new Plugin({
    key: pluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        const meta = tr.getMeta(pluginKey);
        if (meta) return meta as DecorationSet;
        // Doc may have changed under us — remap to keep decorations aligned.
        return old.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return pluginKey.getState(state);
      },
    },
    view(view) {
      function schedule() {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          recompute();
        });
      }

      function recompute() {
        if (!view.dom.isConnected || view.dom.offsetParent === null) return;

        const { decos, pageCount } = computePageBreaks(view);
        const snapshot = serializeDecos(decos) + "|" + pageCount;
        if (snapshot === lastSnapshot) return;
        lastSnapshot = snapshot;

        view.dispatch(view.state.tr.setMeta(pluginKey, decos));
        opts.onPageCount?.(pageCount);
      }

      // ResizeObserver covers content size changes that aren't doc edits
      // (font loading, container resize, etc.).
      const ro = new ResizeObserver(() => schedule());
      ro.observe(view.dom);

      // Initial measurement
      schedule();

      return {
        update(view, prevState) {
          if (!prevState.doc.eq(view.state.doc)) schedule();
        },
        destroy() {
          if (rafId !== null) cancelAnimationFrame(rafId);
          ro.disconnect();
        },
      };
    },
  });
}

function computePageBreaks(view: EditorView): {
  decos: DecorationSet;
  pageCount: number;
} {
  const doc = view.state.doc;
  const out: Decoration[] = [];

  // Existing spacer-widget heights from the previous pass — used to subtract
  // out the current visual shift when computing natural positions.
  const existingDecos =
    (pluginKey.getState(view.state) ?? DecorationSet.empty).find();
  const existingMargins = new Map<number, number>();
  for (const d of existingDecos) {
    const spec = (d as unknown as { spec?: { pageBreakHeight?: number } }).spec;
    if (spec?.pageBreakHeight !== undefined) {
      existingMargins.set(d.from, spec.pageBreakHeight);
    }
  }

  // Shift accumulated from PRIOR blocks' existing margins. Used to recover
  // each block's natural offsetTop.
  let cumulativeExistingShift = 0;
  // New margins decided this pass. Affects effectiveTop for subsequent blocks.
  let addedMargin = 0;
  let currentPage = 1;
  let blockIndex = 0;

  doc.forEach((_node, offset) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) {
      blockIndex++;
      return;
    }

    const measuredTop = dom.offsetTop;
    const naturalHeight = dom.offsetHeight; // height doesn't depend on margin
    const thisExistingMargin = existingMargins.get(offset) ?? 0;

    // True natural position: strip out the shift from prior blocks' existing
    // margins AND this block's own existing margin-top.
    const naturalTop = measuredTop - cumulativeExistingShift - thisExistingMargin;

    // Where this block lands after this pass's new pushes.
    const effectiveTop = naturalTop + addedMargin;
    const effectiveBottom = effectiveTop + naturalHeight;

    // Move forward to the page this block's top actually lands on. Never
    // backward — once we've moved on from a page, we don't reconsider it.
    const pageOfTop = Math.max(1, Math.floor(effectiveTop / PAGE_LAYOUT.stride) + 1);
    if (pageOfTop > currentPage) currentPage = pageOfTop;

    const currentPageContentBottom =
      (currentPage - 1) * PAGE_LAYOUT.stride +
      PAGE_LAYOUT.margin +
      PAGE_LAYOUT.contentHeight;

    if (effectiveBottom > currentPageContentBottom && blockIndex > 0) {
      currentPage += 1;
      const nextPageContentTop =
        (currentPage - 1) * PAGE_LAYOUT.stride + PAGE_LAYOUT.margin;
      const requiredMargin = nextPageContentTop - effectiveTop;

      if (requiredMargin > 0) {
        // Widget spacer (a real div with fixed height) instead of margin-top.
        // Avoids margin-collapse with the previous block's margin-bottom —
        // a margin-top decoration's *effective* shift is N − prev.marginBottom,
        // not N, which breaks the natural-position math by a few px per page
        // and compounds into visible drift around page 4+.
        const heightPx = requiredMargin;
        out.push(
          Decoration.widget(
            offset,
            () => {
              const spacer = document.createElement("div");
              spacer.className = "pb-page-spacer";
              spacer.style.height = `${heightPx}px`;
              spacer.setAttribute("aria-hidden", "true");
              spacer.setAttribute("contenteditable", "false");
              return spacer;
            },
            {
              side: -1,
              key: `pb-spacer-${offset}-${heightPx}`,
              ignoreSelection: true,
              pageBreakHeight: heightPx,
            },
          ),
        );
        addedMargin += requiredMargin;
      }
    }

    cumulativeExistingShift += thisExistingMargin;
    blockIndex++;
  });

  return {
    decos: DecorationSet.create(doc, out),
    pageCount: currentPage,
  };
}

/**
 * Stable string for change detection — avoids redundant dispatches when
 * ResizeObserver fires for the same layout we already computed.
 */
function serializeDecos(set: DecorationSet): string {
  const items = set.find();
  return items
    .map(
      (d) =>
        `${d.from}-${d.to}-${((d as unknown) as { type: { attrs?: { style?: string } } }).type.attrs?.style ?? ""}`,
    )
    .join(";");
}
