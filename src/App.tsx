import { useEditorStore } from './stores/editorStore'
import { Editor } from './components/Editor/Editor'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Sidebar } from './components/Sidebar/Sidebar'
import './styles/globals.css'

function App() {
  const { isDarkMode, showSidebar } = useEditorStore()

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? 'dark bg-[#1a1a1a] text-[#e5e5e5]' : 'bg-white text-[#1a1a1a]'}`}>
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex overflow-hidden">
          <Editor />
        </main>
      </div>
    </div>
  )
}

export default App
