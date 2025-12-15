// Re-export all config files for convenient importing
export { DOMAINS, getDomain, getSiteConfig } from './siteConfig';
export {
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGES_BY_GRID,
  getStagesByDomain,
  lifecycleColorClasses,
  PRODUCT_TYPES,
  getProductTypeConfig,
  createCategoryMeta,
  getTestListByCategory,
} from './categories';
export { filterConfigs } from './filters';
export { comparisonParams } from './comparison';
