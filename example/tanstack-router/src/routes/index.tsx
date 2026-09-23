import { Editor, EditorToolbar } from '@avarlabs/editor'
import '@avarlabs/editor/styles/editor.css'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main>
      <h1>@avarlabs/editor · TanStack Router</h1>
      <Editor toolbar={EditorToolbar} />
    </main>
  )
}
