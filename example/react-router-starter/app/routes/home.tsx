import { Editor, EditorToolbar } from "@avarlabs/editor";
import "@avarlabs/editor/styles/editor.css";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "@avarlabs/editor · React Router" }];
}

export default function Home() {
  return (
    <main className="container mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-2xl font-bold">@avarlabs/editor · React Router</h1>
      <Editor toolbar={EditorToolbar} />
    </main>
  );
}
