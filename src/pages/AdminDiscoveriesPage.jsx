import { useState, useEffect, useMemo } from 'react';

// Source display config
const SOURCE_CONFIG = {
  pubmed: { label: 'PubMed', color: 'bg-blue-100 text-blue-800' },
  fda: { label: 'FDA', color: 'bg-purple-100 text-purple-800' },
  cms: { label: 'CMS', color: 'bg-green-100 text-green-800' },
  vendor: { label: 'Vendor', color: 'bg-orange-100 text-orange-800' },
  preprints: { label: 'Preprints', color: 'bg-yellow-100 text-yellow-800' },
};

// Relevance display config
const RELEVANCE_CONFIG = {
  high: { label: 'High', color: 'bg-emerald-100 text-emerald-800' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-800' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
};

const Badge = ({ children, className }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);

const AdminDiscoveriesPage = () => {
  const [discoveries, setDiscoveries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Auth state - stored in localStorage
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('openonco-admin-key') || '');
  const [keyInput, setKeyInput] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Filters
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('discoveredAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Save admin key to localStorage
  const handleSaveKey = () => {
    if (keyInput.trim()) {
      localStorage.setItem('openonco-admin-key', keyInput.trim());
      setAdminKey(keyInput.trim());
      setKeyInput('');
    }
  };

  // Clear admin key
  const handleClearKey = () => {
    localStorage.removeItem('openonco-admin-key');
    setAdminKey('');
    setIsAuthorized(false);
    setDiscoveries([]);
    setStats(null);
  };

  // Fetch discoveries
  const fetchDiscoveries = async () => {
    if (!adminKey) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ key: adminKey, limit: '1000' });
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/admin/discoveries?${params}`);
      const result = await response.json();

      if (!result.success) {
        if (response.status === 401 || response.status === 403) {
          setIsAuthorized(false);
          throw new Error('Invalid admin key');
        }
        throw new Error(result.error || 'Failed to fetch discoveries');
      }

      setIsAuthorized(true);
      setDiscoveries(result.data);
      setStats(result.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) {
      fetchDiscoveries();
    }
  }, [sourceFilter, statusFilter, adminKey]);

  // Filter and sort discoveries
  const filteredDiscoveries = useMemo(() => {
    let filtered = [...discoveries];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title?.toLowerCase().includes(query) ||
          d.summary?.toLowerCase().includes(query) ||
          d.url?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle nested relevance
      if (sortField === 'relevance') {
        aVal = a.data?.relevance || 'low';
        bVal = b.data?.relevance || 'low';
        const order = { high: 3, medium: 2, low: 1 };
        aVal = order[aVal] || 0;
        bVal = order[bVal] || 0;
      }

      // Handle dates
      if (sortField === 'discoveredAt' || sortField === 'reviewedAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return filtered;
  }, [discoveries, searchQuery, sortField, sortOrder]);

  // Mark as reviewed
  const handleMarkReviewed = async (id, e) => {
    e?.stopPropagation();
    try {
      const response = await fetch(`/api/admin/discoveries?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markReviewed', id }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // Update local state
      setDiscoveries((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: 'reviewed', reviewedAt: new Date().toISOString() } : d
        )
      );
    } catch (err) {
      alert('Failed to mark as reviewed: ' + err.message);
    }
  };

  // Mark as pending
  const handleMarkPending = async (id, e) => {
    e?.stopPropagation();
    try {
      const response = await fetch(`/api/admin/discoveries?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markPending', id }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      setDiscoveries((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'pending', reviewedAt: null } : d))
      );
    } catch (err) {
      alert('Failed to mark as pending: ' + err.message);
    }
  };

  // Toggle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Toggle row expansion
  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Truncate text helper
  const truncate = (text, length = 60) => {
    if (!text) return '—';
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Discoveries Admin</h1>
              <p className="text-sm text-gray-500 mt-1">Review and manage discovered content</p>
            </div>
            {isAuthorized && (
              <button
                onClick={fetchDiscoveries}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Refresh
              </button>
            )}
          </div>

          {/* Auth Form */}
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Admin Key</label>
                {adminKey ? (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 font-mono">
                      {'•'.repeat(Math.min(adminKey.length, 20))}
                    </span>
                    <button
                      onClick={handleClearKey}
                      className="px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                    {isAuthorized && (
                      <span className="text-xs text-emerald-600 font-medium">✓ Authorized</span>
                    )}
                    {!isAuthorized && adminKey && !loading && (
                      <span className="text-xs text-red-600 font-medium">✗ Invalid key</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                      placeholder="Enter admin key..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSaveKey}
                      disabled={!keyInput.trim()}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && isAuthorized && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                <div className="text-2xl font-bold text-emerald-600">{stats.reviewed}</div>
                <div className="text-xs text-gray-500">Reviewed</div>
              </div>
              {Object.entries(stats.bySource || {}).map(([source, count]) => (
                <div key={source} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="text-2xl font-bold text-gray-700">{count}</div>
                  <div className="text-xs text-gray-500">{SOURCE_CONFIG[source]?.label || source}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content - only show if we have a key */}
      {adminKey && (
        <>
          {/* Filters */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Search discoveries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Source filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Source:</span>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Sources</option>
                    {Object.entries(SOURCE_CONFIG).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto" />
                <p className="text-gray-500 mt-4">Loading discoveries...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
                <p className="text-red-600">{error}</p>
                <button
                  onClick={fetchDiscoveries}
                  className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm"
                >
                  Retry
                </button>
              </div>
            ) : !isAuthorized ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Enter a valid admin key to view discoveries.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          onClick={() => handleSort('source')}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          Source {sortField === 'source' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th
                          onClick={() => handleSort('relevance')}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          Relevance {sortField === 'relevance' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Summary
                        </th>
                        <th
                          onClick={() => handleSort('discoveredAt')}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          Discovered {sortField === 'discoveredAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredDiscoveries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                            No discoveries found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredDiscoveries.map((discovery) => {
                          const sourceConfig = SOURCE_CONFIG[discovery.source] || {
                            label: discovery.source,
                            color: 'bg-gray-100 text-gray-800',
                          };
                          const relevance = discovery.data?.relevance || 'low';
                          const relevanceConfig = RELEVANCE_CONFIG[relevance] || RELEVANCE_CONFIG.low;
                          const isExpanded = expandedId === discovery.id;

                          return (
                            <>
                              <tr
                                key={discovery.id}
                                onClick={() => toggleExpand(discovery.id)}
                                className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
                              >
                                <td className="px-4 py-3">
                                  <Badge className={sourceConfig.color}>{sourceConfig.label}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    className={
                                      discovery.status === 'reviewed'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }
                                  >
                                    {discovery.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={relevanceConfig.color}>{relevanceConfig.label}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="max-w-xs text-sm font-medium text-gray-900">
                                    {truncate(discovery.title, 50)}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="max-w-sm text-xs text-gray-500">
                                    {truncate(discovery.summary, 80)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                  {new Date(discovery.discoveredAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    {discovery.url && (
                                      <a
                                        href={discovery.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                                      >
                                        Open
                                      </a>
                                    )}
                                    {discovery.status === 'pending' ? (
                                      <button
                                        onClick={(e) => handleMarkReviewed(discovery.id, e)}
                                        className="px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                                      >
                                        Mark Reviewed
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => handleMarkPending(discovery.id, e)}
                                        className="px-2 py-1 text-xs font-medium text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded"
                                      >
                                        Mark Pending
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {/* Expanded Row */}
                              {isExpanded && (
                                <tr key={`${discovery.id}-expanded`} className="bg-gray-50">
                                  <td colSpan={7} className="px-6 py-4">
                                    <div className="space-y-4">
                                      {/* Full Title */}
                                      <div>
                                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">Full Title</div>
                                        <p className="text-sm text-gray-900">{discovery.title}</p>
                                      </div>

                                      {/* Full Summary */}
                                      <div>
                                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">Summary</div>
                                        <p className="text-sm text-gray-700">{discovery.summary || 'No summary available'}</p>
                                      </div>

                                      {/* URL */}
                                      {discovery.url && (
                                        <div>
                                          <div className="text-xs font-medium text-gray-500 uppercase mb-1">URL</div>
                                          <a
                                            href={discovery.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline break-all"
                                          >
                                            {discovery.url}
                                          </a>
                                        </div>
                                      )}

                                      {/* Dates */}
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-xs font-medium text-gray-500 uppercase mb-1">Discovered</div>
                                          <p className="text-sm text-gray-700">
                                            {new Date(discovery.discoveredAt).toLocaleString()}
                                          </p>
                                        </div>
                                        {discovery.reviewedAt && (
                                          <div>
                                            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Reviewed</div>
                                            <p className="text-sm text-gray-700">
                                              {new Date(discovery.reviewedAt).toLocaleString()}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {/* Metadata */}
                                      {discovery.data && Object.keys(discovery.data).length > 0 && (
                                        <div>
                                          <div className="text-xs font-medium text-gray-500 uppercase mb-1">Metadata</div>
                                          <div className="bg-white rounded-lg p-3 border border-gray-200 overflow-x-auto">
                                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                                              {JSON.stringify(discovery.data, null, 2)}
                                            </pre>
                                          </div>
                                        </div>
                                      )}

                                      {/* ID */}
                                      <div className="pt-2 border-t border-gray-200">
                                        <span className="text-xs text-gray-400">ID: {discovery.id}</span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
                  Showing {filteredDiscoveries.length} discoveries
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* No key entered state */}
      {!adminKey && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Admin Access Required</h2>
            <p className="text-gray-500">Enter your admin key above to view and manage discoveries.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDiscoveriesPage;
