import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../Layout/ThemeToggle';

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('adminSidebarCollapsed') === '1'
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('adminSidebarCollapsed', next ? '1' : '0');
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: '📊' },
    { name: 'Tournaments', href: '/admin/tournaments', icon: '🏆' },
    { name: 'Events', href: '/admin/events', icon: '📅' },
    { name: 'Registrations', href: '/admin/registrations', icon: '✍️' },
    { name: 'Financials', href: '/admin/financials', icon: '💰' },
    { name: 'Vendors', href: '/admin/vendors', icon: '🏪' },
    { name: 'Contacts', href: '/admin/contacts', icon: '👥' },
    { name: 'Communications', href: '/admin/communications', icon: '📧' },
    { name: 'Rules', href: '/admin/rules', icon: '📋' },
    { name: 'Teams', href: '/admin/teams', icon: '👫' },
    { name: 'Team Builder', href: '/admin/team-builder', icon: '🧩' },
    { name: 'Tee Times', href: '/admin/tee-times', icon: '🕐' },
    { name: 'Leaderboard', href: '/admin/leaderboard', icon: '⛳' },
    { name: 'Awards', href: '/admin/awards', icon: '🏅' },
  ];

  // Secondary "housekeeping" tools — shown as small icons in the footer, not in the
  // main nav alongside the primary content pages.
  const secondaryTools = [
    { name: 'Recycle Bin', href: '/admin/recycle-bin', icon: '🗑️' },
    { name: 'Audit Log', href: '/admin/audit', icon: '🧾' },
  ];

  const isActive = (path) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-100 dark:bg-night-900 flex">
      {/* Left Sidebar (fixed full height; only the main area scrolls) */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className={`flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
          <div className="flex flex-col flex-grow bg-white dark:bg-night-800 border-r border-gray-200 dark:border-night-700 pt-5 pb-4 overflow-y-auto">
            {/* Logo + collapse toggle */}
            <div className={`flex items-center flex-shrink-0 px-3 ${collapsed ? 'flex-col gap-3' : 'justify-between'}`}>
              {!collapsed && (
                <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400 truncate">Kathryn Classic</h1>
              )}
              <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
                <ThemeToggle />
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-700 hover:text-gray-600 dark:hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'} />
                  </svg>
                </button>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="mt-8 flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  title={collapsed ? item.name : undefined}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${collapsed ? 'justify-center' : ''} ${
                    isActive(item.href)
                      ? 'bg-primary-100 dark:bg-night-700 text-primary-900 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`text-lg ${collapsed ? '' : 'mr-3'}`}>{item.icon}</span>
                  {!collapsed && item.name}
                </Link>
              ))}
            </nav>

            {/* User Section */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-night-700 p-4">
              {collapsed ? (
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleSignOut}
                    title="Sign out"
                    aria-label="Sign out"
                    className="flex items-center justify-center rounded-md p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-night-700 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                  {secondaryTools.map((tool) => (
                    <Link
                      key={tool.name}
                      to={tool.href}
                      title={tool.name}
                      aria-label={tool.name}
                      className={`flex items-center justify-center rounded-md p-2 text-base ${
                        isActive(tool.href)
                          ? 'bg-primary-100 dark:bg-night-700'
                          : 'opacity-70 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-night-700'
                      }`}
                    >
                      <span aria-hidden="true">{tool.icon}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="w-full group block">
                  <div className="flex items-center">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <Link
                      to="/admin/change-password"
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 block"
                    >
                      Change Password
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 block text-left w-full"
                    >
                      Sign out
                    </button>
                  </div>
                  {/* Secondary tools — below Sign out */}
                  <div className="mt-3 flex items-center gap-1">
                    {secondaryTools.map((tool) => (
                      <Link
                        key={tool.name}
                        to={tool.href}
                        title={tool.name}
                        aria-label={tool.name}
                        className={`flex items-center justify-center rounded-md p-1.5 text-base ${
                          isActive(tool.href)
                            ? 'bg-primary-100 dark:bg-night-700'
                            : 'opacity-60 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-night-700'
                        }`}
                      >
                        <span aria-hidden="true">{tool.icon}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-white dark:bg-night-800 border-b border-gray-200 dark:border-night-700 px-4 py-3">
        <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400">Kathryn Classic</h1>
        <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-700 hover:text-gray-500"
        >
          <span className="sr-only">Open menu</span>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-night-800">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none"
              >
                <span className="sr-only">Close sidebar</span>
                <span className="text-white text-2xl">✕</span>
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">Kathryn Classic</h1>
              </div>
              <nav className="mt-8 px-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                      isActive(item.href)
                        ? 'bg-primary-100 dark:bg-night-700 text-primary-900 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="mr-3 text-xl">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-night-700 p-4">
              <div className="flex-shrink-0 w-full">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate mb-3">
                  {user?.email}
                </p>
                <Link
                  to="/admin/change-password"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 block mb-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Change Password
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 block text-left w-full"
                >
                  Sign out
                </button>
                {/* Secondary tools — below Sign out */}
                <div className="mt-3 flex items-center gap-4">
                  {secondaryTools.map((tool) => (
                    <Link
                      key={tool.name}
                      to={tool.href}
                      className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span aria-hidden="true">{tool.icon}</span>
                      {tool.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="admin-content flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-night-900 pt-16 md:pt-0">
          <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
