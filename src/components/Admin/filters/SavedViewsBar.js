import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import ConfirmDialog from '../ConfirmDialog';
import { logAudit } from '../../../utils/audit';
import { serializeTree, deserializeTree, countConditions } from './filterModel';

// Postgres unique-violation — the partial index on (scope, lower(name)).
const UNIQUE_VIOLATION = '23505';

// How many views fit in the highlight bar before the rest live behind search.
export const MAX_PINNED = 5;

// The saved-views highlight bar that sits above the Filters panel.
//
// Pinned views are one click away as chips; everything else is reachable through
// the search box. `scope` keeps the Contacts and Communications lists separate,
// since the two screens offer slightly different fields.
export default function SavedViewsBar({ scope, tree, onLoad, isKnownField }) {
  const [views, setViews] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [loadedSnapshot, setLoadedSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [dialog, setDialog] = useState(null); // 'save_as' | 'rename' | 'delete'
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const menuRef = useRef(null);
  const searchRef = useRef(null);

  const activeView = views.find((v) => v.id === activeId) || null;
  const hasConditions = countConditions(tree) > 0;

  const pinnedViews = useMemo(
    () =>
      views
        .filter((v) => v.pinned)
        .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0) || a.name.localeCompare(b.name))
        .slice(0, MAX_PINNED),
    [views]
  );
  const pinnedCount = views.filter((v) => v.pinned).length;

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    return views
      .filter((v) => !term || v.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [views, search]);

  // Compare against what was loaded so the admin can see they have unsaved edits.
  const currentSnapshot = useMemo(() => JSON.stringify(serializeTree(tree).root), [tree]);
  const dirty = Boolean(activeView) && loadedSnapshot !== null && currentSnapshot !== loadedSnapshot;

  const loadViews = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('contact_filter_views')
      .select('id, name, filter_tree, pinned, pin_order')
      .eq('scope', scope)
      .is('deleted_at', null)
      .order('name');
    if (err) {
      setError(err.message);
      return;
    }
    setViews(data || []);
  }, [scope]);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onDown = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, searchOpen]);

  const applyView = (view) => {
    setError(null);
    const revived = deserializeTree(view.filter_tree, isKnownField);
    setActiveId(view.id);
    setLoadedSnapshot(JSON.stringify(serializeTree(revived).root));
    onLoad(revived);
    setSearchOpen(false);
    setSearch('');
  };

  // Clicking the active chip again deselects it, leaving the filters in place —
  // which is also how you'd start a new view from an existing one.
  const toggleView = (view) => {
    if (view.id === activeId) {
      setActiveId('');
      setLoadedSnapshot(null);
    } else {
      applyView(view);
    }
  };

  const handleSave = async () => {
    if (!activeView) return;
    setError(null);
    const { error: err } = await supabase
      .from('contact_filter_views')
      // serializeTree stamps the shape version inside the JSON itself.
      .update({ filter_tree: serializeTree(tree) })
      .eq('id', activeView.id);
    if (err) {
      setError(err.message);
      return;
    }
    await logAudit({
      action: 'filter_view.updated',
      entityType: 'filter_view',
      entityId: activeView.id,
      entityLabel: activeView.name,
      // Record both sides so the log shows what the view used to select.
      changes: { filter_tree: { from: loadedSnapshot, to: currentSnapshot } },
      metadata: { scope },
    });
    setLoadedSnapshot(currentSnapshot);
    await loadViews();
  };

  const handleSaveAs = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: err } = await supabase
      .from('contact_filter_views')
      .insert({
        name,
        scope,
        filter_tree: serializeTree(tree),
        created_by: user?.id ?? null,
        // A new view pins itself while there's room, so it lands somewhere
        // visible rather than only inside search.
        pinned: pinnedCount < MAX_PINNED,
        pin_order: pinnedCount < MAX_PINNED ? pinnedCount : null,
      })
      .select('id, name, filter_tree, pinned, pin_order')
      .single();
    if (err) {
      setError(
        err.code === UNIQUE_VIOLATION
          ? 'A saved view with that name already exists.'
          : err.message
      );
      return;
    }
    await logAudit({
      action: 'filter_view.created',
      entityType: 'filter_view',
      entityId: data.id,
      entityLabel: name,
      changes: { name, filter_tree: currentSnapshot },
      metadata: { scope },
    });
    setDialog(null);
    setNameDraft('');
    setActiveId(data.id);
    setLoadedSnapshot(currentSnapshot);
    await loadViews();
  };

  const handleRename = async () => {
    const name = nameDraft.trim();
    if (!name || !activeView) return;
    setError(null);
    const { error: err } = await supabase
      .from('contact_filter_views')
      .update({ name })
      .eq('id', activeView.id);
    if (err) {
      setError(
        err.code === UNIQUE_VIOLATION
          ? 'A saved view with that name already exists.'
          : err.message
      );
      return;
    }
    await logAudit({
      action: 'filter_view.renamed',
      entityType: 'filter_view',
      entityId: activeView.id,
      entityLabel: name,
      changes: { name: { from: activeView.name, to: name } },
      metadata: { scope },
    });
    setDialog(null);
    setNameDraft('');
    await loadViews();
  };

  const handleTogglePin = async (view) => {
    setError(null);
    if (!view.pinned && pinnedCount >= MAX_PINNED) {
      setError(`You can pin up to ${MAX_PINNED} views. Unpin one first.`);
      return;
    }
    const { error: err } = await supabase
      .from('contact_filter_views')
      .update({
        pinned: !view.pinned,
        pin_order: !view.pinned ? pinnedCount : null,
      })
      .eq('id', view.id);
    if (err) {
      setError(err.message);
      return;
    }
    await loadViews();
  };

  // Soft delete, matching the convention everywhere else in the admin.
  const handleDelete = async () => {
    if (!activeView) return;
    setError(null);
    const { error: err } = await supabase
      .from('contact_filter_views')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', activeView.id);
    if (err) {
      setError(err.message);
      return;
    }
    await logAudit({
      action: 'filter_view.deleted',
      entityType: 'filter_view',
      entityId: activeView.id,
      entityLabel: activeView.name,
      // Snapshot on delete, matching contact.deleted — enough to rebuild it.
      changes: { name: activeView.name, filter_tree: JSON.stringify(activeView.filter_tree) },
      metadata: { scope },
    });
    setDialog(null);
    setActiveId('');
    setLoadedSnapshot(null);
    await loadViews();
  };

  // One Save button: it overwrites the loaded view, or asks for a name when
  // there isn't one. Nothing to save when a loaded view is untouched.
  const canSave = activeView ? dirty : hasConditions;
  const handleSaveClick = () => {
    setError(null);
    if (activeView) {
      handleSave();
    } else {
      setNameDraft('');
      setDialog('save_as');
    }
  };

  const chipCls = (isActive) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-night-600 dark:bg-night-700 dark:text-gray-300 dark:hover:bg-night-600'
    }`;

  return (
    <div className="bg-white dark:bg-night-800 rounded-lg shadow px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 mr-1">
          Saved views
        </span>

        {pinnedViews.map((v) => (
          <button key={v.id} type="button" onClick={() => toggleView(v)} className={chipCls(v.id === activeId)}>
            {v.name}
            {v.id === activeId && dirty && (
              <span className="text-amber-600 dark:text-amber-400" title="Unsaved changes">
                •
              </span>
            )}
          </button>
        ))}

        {views.length === 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            None yet — build a filter below and click Save.
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Search covers everything, pinned or not, so nothing is unreachable. */}
          <div className="relative" ref={searchRef}>
            <input
              type="text"
              value={search}
              placeholder="Search views…"
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              className="w-40 sm:w-52 rounded-lg border border-gray-400 dark:border-night-600 py-1.5 px-3 text-sm bg-white dark:bg-night-700 text-gray-900 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-0"
            />
            {searchOpen && (
              <div className="absolute right-0 z-30 mt-1 w-72 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 py-1 shadow-xl">
                {searchResults.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-night-700"
                  >
                    <button
                      type="button"
                      onClick={() => applyView(v)}
                      className={`flex-1 truncate text-left ${
                        v.id === activeId
                          ? 'font-medium text-primary-700 dark:text-primary-300'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePin(v)}
                      title={v.pinned ? 'Unpin from bar' : 'Pin to bar'}
                      aria-label={v.pinned ? `Unpin ${v.name}` : `Pin ${v.name}`}
                      className={`rounded p-1 ${
                        v.pinned
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400'
                      }`}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 2a1 1 0 000 2v5.382l-1.447 2.894A1 1 0 006.447 14H9v4a1 1 0 102 0v-4h2.553a1 1 0 00.894-1.724L13 9.382V4a1 1 0 100-2H7z" />
                      </svg>
                    </button>
                  </div>
                ))}
                {searchResults.length === 0 && (
                  <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {views.length === 0 ? 'No saved views yet.' : 'No views match that search.'}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!canSave}
            onClick={handleSaveClick}
            title={activeView ? `Save changes to "${activeView.name}"` : 'Save these filters as a view'}
            className="inline-flex items-center rounded-md border border-gray-300 dark:border-night-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-700 hover:bg-gray-50 dark:hover:bg-night-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>

          {/* Rename, pin and delete act on whichever view is currently loaded. */}
          {activeView && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={`More actions for ${activeView.name}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-night-700 dark:hover:text-gray-200"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 py-1 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      handleTogglePin(activeView);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-night-700"
                  >
                    {activeView.pinned ? 'Unpin from bar' : 'Pin to bar'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setNameDraft(activeView.name);
                      setError(null);
                      setDialog('rename');
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-night-700"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setDialog('delete');
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-night-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {dirty && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Unsaved changes to “{activeView.name}”.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {(dialog === 'save_as' || dialog === 'rename') && (
        <div className="mt-3 rounded-lg border border-gray-200 dark:border-night-600 bg-gray-50 dark:bg-night-700/40 p-3">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {dialog === 'save_as' ? 'Name this view' : 'Rename view'}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (dialog === 'save_as' ? handleSaveAs : handleRename)();
                if (e.key === 'Escape') setDialog(null);
              }}
              placeholder="e.g. 2025 golfers with no email"
              className="block flex-1 min-w-[12rem] rounded-lg border border-gray-400 dark:border-night-600 py-2 px-3 text-sm bg-white dark:bg-night-700 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              onClick={dialog === 'save_as' ? handleSaveAs : handleRename}
              disabled={!nameDraft.trim()}
              className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40"
            >
              {dialog === 'save_as' ? 'Save' : 'Rename'}
            </button>
            <button
              type="button"
              onClick={() => setDialog(null)}
              className="inline-flex items-center rounded-md border border-gray-300 dark:border-night-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={handleDelete}
        title="Delete saved view"
        message={`Delete the saved view "${activeView?.name || ''}"? The filters currently on screen are not affected.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
