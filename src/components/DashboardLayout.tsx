import { ReactNode } from 'react'
import { Menu, History, Building2, Mail } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const { pathname } = useLocation()

    const NavItem = ({ to, icon: Icon, label }: any) => {
        // Active if exact match or if it's the root and we are at root
        const active = pathname === to || (to !== '/' && pathname.startsWith(to))

        return (
            <Link to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition font-medium
         ${active ? 'bg-panel-100 text-ink-900' : 'text-ink-500 hover:bg-panel-50 hover:text-ink-700'}`}>
                <Icon size={18} /> {label}
            </Link>
        )
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Topbar */}
            <header className="h-14 border-b border-panel-200 bg-white/90 backdrop-blur sticky top-0 z-20">
                <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button className="btn-ghost md:hidden"><Menu size={18} /></button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                                A
                            </div>
                            <span className="font-semibold text-ink-900">Athena Office</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="badge">v1.0</span>
                        <div className="w-8 h-8 rounded-full bg-panel-200 border border-panel-300"></div>
                    </div>
                </div>
            </header>

            {/* Shell */}
            <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-12 gap-6">
                <aside className="col-span-12 md:col-span-3 lg:col-span-2 hidden md:block">
                    <nav className="space-y-1 sticky top-24">
                        <div className="px-3 py-2 text-xs font-semibold text-ink-500 uppercase tracking-wider">
                            Menu
                        </div>
                        <NavItem to="/" icon={Mail} label="Correspondências" />
                        <NavItem to="/empresas" icon={Building2} label="Empresas" />
                        <NavItem to="/historico" icon={History} label="Histórico" />
                    </nav>
                </aside>

                <main className="col-span-12 md:col-span-9 lg:col-span-10 space-y-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
