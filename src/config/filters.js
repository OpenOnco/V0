// Filter configurations by category
import { mrdTestData, ecdTestData, trmTestData, tdsTestData, alzBloodTestData } from '../data';

export const filterConfigs = {
  MRD: {
    // Oncologist priority: What cancer? Sample type? Is it covered? Is it FDA approved?
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(mrdTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: [...new Set(mrdTestData.map(t => t.sampleCategory || 'Blood/Plasma'))].sort(),
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT'],
    reimbursements: ['Medicare', 'Commercial'],
    approaches: ['Tumor-informed', 'Tumor-naïve'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
    clinicalSettings: ['Neoadjuvant', 'Post-Surgery', 'Post-Adjuvant', 'Surveillance'],
  },
  ECD: {
    // Oncologist priority: Single cancer or multi? Sample type? What's the target population? Covered?
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit', 'Self-Collection'],
    testScopes: ['Single-cancer (CRC)', 'Multi-cancer (MCED)'],
    sampleCategories: ['Blood/Plasma', 'Stool'],
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT', 'Investigational'],
    reimbursements: ['Medicare', 'Commercial'],
    approaches: ['Blood-based cfDNA screening (plasma)', 'Blood-based cfDNA methylation MCED (plasma)', 'Stool DNA + FIT'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  TRM: {
    // Oncologist priority: What cancer? Sample type? Approach? Covered?
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(trmTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: ['Blood/Plasma'],
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT'],
    approaches: ['Tumor-informed', 'Tumor-naïve', 'Tumor-agnostic'],
    reimbursements: ['Medicare', 'Commercial'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  TDS: {
    // TDS priority: Sample type (tissue vs liquid), cancer types, FDA status, coverage
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(tdsTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: [...new Set(tdsTestData.map(t => t.sampleCategory || 'Unknown'))].sort(),
    approaches: [...new Set(tdsTestData.map(t => t.approach || 'Unknown'))].sort(),
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT'],
    reimbursements: ['Medicare', 'Commercial'],
  },
  'ALZ-BLOOD': {
    // Neurologist priority: What biomarker? Is it covered? What's the accuracy vs PET?
    biomarkers: [...new Set(alzBloodTestData.flatMap(t => t.biomarkers || []))].sort(),
    approaches: [...new Set(alzBloodTestData.map(t => t.approach || 'Unknown'))].sort(),
    fdaStatuses: ['FDA Approved', 'CE-IVD', 'CLIA LDT', 'RUO', 'In development'],
    reimbursements: ['Medicare LCD', 'Coverage varies', 'Not covered'],
    regions: [...new Set(alzBloodTestData.flatMap(t => t.availableRegions || []))].sort(),
  },
};
