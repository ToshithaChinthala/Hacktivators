import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-[#f8f9fe] text-slate-800 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gradient-to-br from-[#f8f9fe] via-[#f8f9fe] to-[#f4f3ff]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
