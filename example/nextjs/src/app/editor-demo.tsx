"use client";

import { Editor, EditorToolbar } from "@avarlabs/editor";
import "@avarlabs/editor/styles/editor.css";

export function EditorDemo() {
  return <Editor toolbar={EditorToolbar} />;
}
