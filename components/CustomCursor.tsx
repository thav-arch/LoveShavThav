"use client";

import { useEffect } from "react";
import { onCursorLabel } from "@/lib/cursor";

/**
 * Cursor, as in the reference: the native system cursor, switched by what is
 * under it — grab over the 3D world, pointer over a card, grabbing while
 * dragging. The "glassy" reaction is not a cursor graphic but the liquid wake
 * the cursor leaves in the WebGL frame (components/shaders/flow.ts).
 */
export function CustomCursor() {
  useEffect(() => {
    const root = document.documentElement;
    const off = onCursorLabel((label) => {
      if (label === "DRAG") root.dataset.sceneCursor = "grabbing";
      else if (label) root.dataset.sceneCursor = "pointer";
      else delete root.dataset.sceneCursor;
    });
    return () => {
      off();
      delete root.dataset.sceneCursor;
    };
  }, []);
  return null;
}
