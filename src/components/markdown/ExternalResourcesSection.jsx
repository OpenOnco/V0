import { EXTERNAL_RESOURCES, CATEGORY_STANDARDS } from '../../data';

// External Resource Link Component
const ExternalResourceLink = ({ resource, compact = false }) => {
  const sourceColors = {
    'NCI': 'bg-blue-50 text-blue-700 border-blue-200',
    'FDA': 'bg-purple-50 text-purple-700 border-purple-200',
    'BLOODPAC': 'bg-orange-50 text-orange-700 border-orange-200',
    'FRIENDS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'NCCN': 'bg-violet-50 text-violet-700 border-violet-200',
    'LUNGEVITY': 'bg-pink-50 text-pink-700 border-pink-200',
    'ILSA': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'ASCO': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  const typeIcons = {
    'definition': '📖',
    'standards': '📋',
    'regulatory': '⚖️',
    'research': '🔬',
    'guidelines': '📜',
    'patient-education': '💡',
    'education': '🎓',
    'overview': '📄',
  };

  if (compact) {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sourceColors[resource.source] || 'bg-gray-50 text-gray-700 border-gray-200'} hover:shadow-sm transition-shadow`}
      >
        <span>{typeIcons[resource.type] || '🔗'}</span>
        <span>{resource.title}</span>
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  }

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all bg-white group"
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{typeIcons[resource.type] || '🔗'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 group-hover:text-emerald-600 transition-colors">
              {resource.title}
            </span>
            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{resource.description}</p>
          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${sourceColors[resource.source] || 'bg-gray-100 text-gray-600'}`}>
            {resource.source}
          </span>
        </div>
      </div>
    </a>
  );
};

// External Resources Section Component
const ExternalResourcesSection = ({ category, compact = false }) => {
  const categoryResources = EXTERNAL_RESOURCES[category] || [];
  const generalResources = EXTERNAL_RESOURCES.general || [];
  const standards = CATEGORY_STANDARDS[category];

  // Filter resources for clinician/researcher audience
  const filteredCategoryResources = categoryResources.filter(r =>
    r.audience.includes('clinician') || r.audience.includes('researcher')
  );
  const filteredGeneralResources = generalResources.filter(r =>
    r.audience.includes('clinician')
  );

  // Get primary resources for compact view
  const primaryResources = filteredCategoryResources.filter(r => r.isPrimary);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {primaryResources.slice(0, 3).map(resource => (
          <ExternalResourceLink key={resource.id} resource={resource} compact />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Standards & Resources</h3>
        {standards && (
          <span className="text-xs text-gray-500 italic">{standards.attribution}</span>
        )}
      </div>

      {/* Category-specific resources */}
      {filteredCategoryResources.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Key References</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredCategoryResources.slice(0, 4).map(resource => (
              <ExternalResourceLink key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      )}

      {/* General resources */}
      {filteredGeneralResources.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">General Resources</h4>
          <div className="flex flex-wrap gap-2">
            {filteredGeneralResources.map(resource => (
              <ExternalResourceLink key={resource.id} resource={resource} compact />
            ))}
          </div>
        </div>
      )}

      {/* Standards attribution */}
      {standards && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">Referenced standards:</span>
            <a
              href={standards.primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {standards.primary}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            {standards.secondary && (
              <>
                <span className="text-gray-400">•</span>
                <a
                  href={standards.secondaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {standards.secondary}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { ExternalResourceLink };
export default ExternalResourcesSection;
