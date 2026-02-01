/**
 * Policy Registry - Known ctDNA/MRD/Liquid Biopsy Policy URLs
 *
 * This registry maps payers to their actual policy documents for
 * ctDNA, MRD, and liquid biopsy coverage. These are the URLs we
 * should crawl for coverage information, not just index pages.
 *
 * Discovery methods:
 * - 'manual': Hand-curated from web research
 * - 'google_search': Found via site search
 * - 'link_crawl': Discovered by following links from index pages
 *
 * Content types:
 * - 'html': Web page with policy text
 * - 'pdf': PDF document
 *
 * Policy types:
 * - 'ctdna': Circulating tumor DNA testing
 * - 'liquid_biopsy': General liquid biopsy policies
 * - 'molecular_oncology': Broader molecular/genomic testing
 * - 'mrd': Minimal/Molecular residual disease
 * - 'tumor_markers': Tumor marker testing (often includes ctDNA)
 */

export const POLICY_REGISTRY = {
  // ============================================================================
  // TIER 1: National Commercial Payers
  // ============================================================================

  aetna: {
    name: 'Aetna',
    tier: 1,
    policies: [
      {
        id: 'aetna-cpb-0352',
        name: 'Tumor Markers (CPB 0352)',
        url: 'https://www.aetna.com/cpb/medical/data/300_399/0352.html',
        contentType: 'html',
        policyType: 'tumor_markers',
        discoveryMethod: 'manual',
        notes: 'Primary ctDNA/liquid biopsy policy. Covers Guardant360, FoundationOne, Signatera.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'aetna-cpb-0715',
        name: 'Pharmacogenetic Testing (CPB 0715)',
        url: 'https://www.aetna.com/cpb/medical/data/700_799/0715.html',
        contentType: 'html',
        policyType: 'molecular_oncology',
        discoveryMethod: 'manual',
        notes: 'EGFR, PIK3CA, ESR1 companion diagnostics via liquid biopsy.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  uhc: {
    name: 'UnitedHealthcare',
    tier: 1,
    policies: [
      {
        id: 'uhc-molecular-oncology',
        name: 'Molecular Oncology Testing for Cancer',
        url: 'https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/molecular-oncology-testing-for-cancer.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'manual',
        notes: 'Commercial policy for multigene molecular profiling including liquid biopsy.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  cigna: {
    name: 'Cigna',
    tier: 1,
    policies: [
      {
        id: 'cigna-0520',
        name: 'Tumor Profiling (Policy 0520)',
        url: 'https://static.cigna.com/assets/chcp/pdf/coveragePolicies/medical/mm_0520_coveragepositioncriteria_tumor_profiling.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'manual',
        notes: 'Primary policy for ctDNA, liquid biopsy, tumor profiling. Covers Signatera, FoundationOne, Guardant360.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'cigna-0052',
        name: 'Genetic Testing (Policy 0052)',
        url: 'https://static.cigna.com/assets/chcp/pdf/coveragePolicies/medical/mm_0052_coveragepositioncriteria_genetic_testing.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'manual',
        notes: 'General genetic testing policy, may reference ctDNA.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  anthem: {
    name: 'Anthem/Elevance Health',
    tier: 1,
    policies: [
      {
        id: 'anthem-gene-14',
        name: 'Circulating Tumor DNA Panel Testing (CG-GENE-14)',
        url: 'https://files.providernews.anthem.com/2003/CG-GENE-14.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'manual',
        notes: 'Primary ctDNA liquid biopsy guideline. Covers when FFPET inadequate or unavailable.',
        lastVerified: '2026-02-01',
      },
      {
        id: 'anthem-gene-13',
        name: 'Molecular Profiling for Solid Tumors (CG-GENE-13)',
        url: 'https://files.providernews.anthem.com/2002/CG-GENE-13.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'Broader molecular profiling guideline including TMB assessment.',
        lastVerified: '2026-02-01',
      },
      {
        id: 'anthem-gene-52',
        name: 'Molecular Profiling Policy (GENE.00052)',
        url: 'https://files.providernews.anthem.com/2354/GENE.00052_Pub-05-25-2023.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'Published May 2023. Covers ctDNA for TMB and checkpoint inhibitor candidacy.',
        lastVerified: '2026-02-01',
      },
      {
        id: 'anthem-lab-00015',
        name: 'Detection of Circulating Tumor Cells (LAB.00015)',
        url: 'https://anthem.com/dam/medpolicies/abc/active/policies/mp_pw_a049885.html',
        contentType: 'html',
        policyType: 'ctdna',
        discoveryMethod: 'manual',
        notes: 'CTC detection policy - generally investigational.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  humana: {
    name: 'Humana',
    tier: 1,
    policies: [
      {
        id: 'humana-liquid-biopsy',
        name: 'Liquid Biopsy',
        url: 'https://assets.humana.com/is/content/humana/Liquid_Biopsypdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'manual',
        notes: 'Covers FoundationOne Liquid CDx, Guardant360 CDx, therascreen PIK3CA.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'humana-cgp-solid-tumors',
        name: 'Comprehensive Genomic Profiling for Solid Tumors',
        url: 'https://assets.humana.com/is/content/humana/Comprehensive_Genomic_Profiling_and_Genetic_Testing_for_Solid_Tumorspdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'CGP and genetic testing for solid tumors. Covers NGS panels, TMB, MSI.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  // ============================================================================
  // TIER 1: Lab Benefit Managers (LBMs)
  // These manage genetic testing for multiple payers
  // ============================================================================

  evicore: {
    name: 'EviCore (Evernorth)',
    tier: 1,
    policies: [
      {
        id: 'evicore-liquid-biopsy-2026',
        name: 'Liquid Biopsy Testing (MOL.TS.194.A)',
        url: 'https://www.evicore.com/sites/default/files/clinical-guidelines/2025-12/MOL.TS_.194.A_Liquid%20Biopsy%20Testing_V1.0.2026_Eff01.01.2026_Pub09.26.2025_Upd12.09.2025.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'manual',
        notes: 'EviCore manages lab benefits for Cigna, Aetna, and others. Primary liquid biopsy guideline.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'evicore-mced-2026',
        name: 'Multi-Cancer Early Detection Screening (MOL.TS.396.A)',
        url: 'https://www.evicore.com/sites/default/files/clinical-guidelines/2025-12/MOL.TS_.396.A_Multi-Cancer%20Early%20Detection%20Screening_V1.0.2026_Eff01.01.2026_Pub09.26.2025_Upd12.08.2025_0.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'manual',
        notes: 'MCED screening (Galleri, etc.) - generally investigational.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  carelon: {
    name: 'Carelon (formerly AIM Specialty Health)',
    tier: 1,
    policies: [
      {
        id: 'carelon-liquid-biopsy-2025',
        name: 'Genetic Liquid Biopsy in Cancer Management (UC0126)',
        url: 'https://guidelines.carelonmedicalbenefitsmanagement.com/wp-content/uploads/2025/11/PDF-Genetic-Liquid-Biopsy-in-the-Management-of-Cancer-and-Cancer-Surveillance-2025-11-15-UC0126.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Carelon (owned by Elevance/Anthem) manages genetic testing benefits. Updated 2025-11-15.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'carelon-somatic-tumor-2025',
        name: 'Somatic Tumor Testing Guidelines',
        url: 'https://guidelines.carelonmedicalbenefitsmanagement.com/wp-content/uploads/2025/08/PDF-Somatic-Tumor-Testing-2025-10-05.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'NGS and molecular profiling for solid tumors. Updated 2025-10-05.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  // ============================================================================
  // TIER 2: Regional BCBS Plans
  // ============================================================================

  bcbsm: {
    name: 'BCBS Michigan',
    tier: 2,
    policies: [
      {
        id: 'bcbsm-ctdna',
        name: 'Circulating Tumor DNA',
        url: 'https://www.bcbsm.com/amslibs/content/dam/public/mpr/mprsearch/pdf/2002479.pdf',
        contentType: 'pdf',
        policyType: 'ctdna',
        discoveryMethod: 'manual',
        notes: 'Primary ctDNA policy for BCBS Michigan.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'bcbsm-genetic-testing-panels',
        name: 'Genetic Testing Including Chromosomal Microarray',
        url: 'https://www.bcbsm.com/amslibs/content/dam/public/mpr/mprsearch/pdf/2003173.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'Covers NGS panels for genetic testing.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'bcbsm-genetic-testing-counseling',
        name: 'Genetic Testing and Counseling',
        url: 'https://www.bcbsm.com/amslibs/content/dam/public/mpr/mprsearch/pdf/2001657.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'General genetic testing guidelines and criteria.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'bcbsm-cancer-susceptibility',
        name: 'Genetic Cancer Susceptibility',
        url: 'https://www.bcbsm.com/amslibs/content/dam/public/mpr/mprsearch/pdf/2032136.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'Hereditary cancer testing. References MolDX LCD L38158.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  highmark: {
    name: 'Highmark BCBS',
    tier: 2,
    policies: [
      {
        id: 'highmark-l123',
        name: 'Liquid Biopsy Testing - Solid Tumors (L-123)',
        url: 'https://secure.highmark.com/ldap/medicalpolicy/wpa-highmark/L-123-006.html',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'manual',
        notes: 'Primary liquid biopsy policy. Updated 12/29/2025.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'highmark-l113',
        name: 'Molecular/Genomic Testing (L-113)',
        url: 'https://secure.highmark.com/ldap/medicalpolicy/wpa-highmark/printerfriendly/L-113-009.html',
        contentType: 'html',
        policyType: 'molecular_oncology',
        discoveryMethod: 'manual',
        notes: 'General molecular testing criteria.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  blueshieldca: {
    name: 'Blue Shield of California',
    tier: 2,
    policies: [
      {
        id: 'bsca-ctdna-liquid-biopsy',
        name: 'Oncology: Circulating Tumor DNA and Cells (Liquid Biopsy)',
        url: 'https://www.blueshieldca.com/content/dam/bsca/en/provider/docs/medical-policies/Oncology-Circulating-Tumor-DNA-Circulating-Tumor-Cells-Liquid-Biopsy.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'manual',
        notes: 'Primary liquid biopsy policy. CA SB 535 removed prior auth for biomarker testing.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'bsca-algorithmic-testing',
        name: 'Oncology: Algorithmic Testing',
        url: 'https://www.blueshieldca.com/content/dam/bsca/en/provider/docs/medical-policies/Oncology-Algorithmic-Testing.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'manual',
        notes: 'Multi-gene panel testing policies.',
        lastVerified: '2026-01-31',
      },
      {
        id: 'bsca-molecular-analysis-tumors',
        name: 'Oncology: Molecular Analysis for Solid Tumors and Hematologic Malignancies',
        url: 'https://www.blueshieldca.com/content/dam/bsca/en/provider/docs/medical-policies/Oncology-Molecular-Analysis-Solid-Tumors-Hematologic-Malignancies.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'Comprehensive molecular analysis including NGS panels. NCCN guideline references.',
        lastVerified: '2026-01-31',
      },
    ],
  },

  bcbst: {
    name: 'BCBS Tennessee',
    tier: 2,
    policies: [
      {
        id: 'bcbst-ctdna-liquid-biopsy',
        name: 'Circulating Tumor DNA (Liquid Biopsy)',
        url: 'https://www.bcbst.com/mpmanual/!ssl!/webhelp/Circulating_Tumor_DNA_Liquid_Biopsy.htm',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Primary ctDNA/liquid biopsy policy. Covers NSCLC, breast, prostate indications.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  bcbsnc: {
    name: 'Blue Cross NC',
    tier: 2,
    policies: [
      {
        id: 'bcbsnc-liquid-biopsy-g2054',
        name: 'Liquid Biopsy (AHS-G2054)',
        url: 'https://www.bluecrossnc.com/providers/policies-guidelines-codes/commercial/laboratory/updates/liquid-biopsy',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Covers NSCLC, breast (PIK3CA), prostate. MCED considered investigational.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  bcbsma: {
    name: 'Blue Cross MA',
    tier: 2,
    policies: [
      {
        id: 'bcbsma-ctdna-797',
        name: 'Circulating Tumor DNA and Circulating Tumor Cells for Cancer',
        url: 'https://www.bluecrossma.org/medical-policies/sites/g/files/csphws2091/files/acquiadam-assets/797Circulating_Tumor_DNA_For_Cancer.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Comprehensive liquid biopsy policy with detailed coverage criteria.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  bcbsks: {
    name: 'BCBS Kansas',
    tier: 2,
    policies: [
      {
        id: 'bcbsks-ctdna-liquid-biopsy',
        name: 'Circulating Tumor DNA and Circulating Tumor Cells for Cancer Management (Liquid Biopsy)',
        url: 'https://www.bcbsks.com/medical-policies/circulating-tumor-dna-and-circulating-tumor-cells-cancer-management-liquid-biopsy',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'BCBS Kansas liquid biopsy medical policy.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  excellus: {
    name: 'Excellus BCBS (NY)',
    tier: 2,
    policies: [
      {
        id: 'excellus-ctdna-liquid-biopsy',
        name: 'Circulating Tumor DNA for Management of Cancer (Liquid Biopsy)',
        url: 'https://www.excellusbcbs.com/documents/20152/127121/Circulating+Tumor+DNA+for+Management+of+Cancer+(Liquid+Biopsy).pdf/',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'New York regional BCBS liquid biopsy policy.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  bcbsri: {
    name: 'BCBS Rhode Island',
    tier: 2,
    policies: [
      {
        id: 'bcbsri-ctdna-2026',
        name: 'Circulating Tumor DNA and Circulating Tumor Cells for Cancer Management (Liquid Biopsy)',
        url: 'https://www.bcbsri.com/providers/sites/providers/files/policies/2026/01/2026%20Circulating%20Tumor%20DNA%20and%20Circulating%20Tumor%20Cells%20for%20Cancer%20Management%20(Liquid%20Biopsy)_0.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: '2026 policy update for Rhode Island.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  floridablue: {
    name: 'Florida Blue',
    tier: 2,
    policies: [
      {
        id: 'floridablue-tumor-markers',
        name: 'Tumor/Genetic Markers (MCG 05-86000-22)',
        url: 'https://mcgs.bcbsfl.com/MCG?mcgId=05-86000-22',
        contentType: 'html',
        policyType: 'tumor_markers',
        discoveryMethod: 'google_search',
        notes: 'Florida Blue medical coverage guideline for tumor markers including ctDNA.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  bcbsmn: {
    name: 'BCBS Minnesota',
    tier: 2,
    policies: [
      {
        id: 'bcbsmn-vi49-liquid-biopsy',
        name: 'Circulating Tumor DNA (Liquid Biopsy) (VI-49)',
        url: 'https://securecms.bluecrossmnonline.com/content/medpolicy/en/minnesota/core/all/policies/Laboratory/VI-49/VI-49-007.html',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Primary liquid biopsy policy. Covers Guardant360, CancerIntercept Detect, NeoLAB.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  bcidaho: {
    name: 'Blue Cross of Idaho',
    tier: 2,
    policies: [
      {
        id: 'bcidaho-mp204141',
        name: 'Circulating Tumor DNA and Cells for Cancer Management (MP 2.04.141)',
        url: 'https://providers.bcidaho.com/medical-management/medical-policies/med/mp_204141.page',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Effective 08/29/2024. Transitioning to Carelon Jan 2026.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  bcbssc: {
    name: 'BlueCross BlueShield South Carolina',
    tier: 2,
    policies: [
      {
        id: 'bcbssc-liquid-biopsy',
        name: 'Liquid Biopsy',
        url: 'https://www.southcarolinablues.com/web/public/brands/medicalpolicy/external/external-policies/liquid-biopsy/',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Covers NSCLC, HR+/HER2- breast (PIK3CA), CRPC (AR-V7, BRCA1/2).',
        lastVerified: '2026-02-01',
      },
    ],
  },

  wellmark: {
    name: 'Wellmark BCBS (Iowa/South Dakota)',
    tier: 2,
    policies: [
      {
        id: 'wellmark-ctdna-liquid-biopsy',
        name: 'Circulating Tumor DNA and Circulating Tumor Cells for Cancer Management (Liquid Biopsies)',
        url: 'https://www.wellmark.com/Provider/MedPoliciesAndAuthorizations/MedicalPolicies/policies/Detection_Quantification.aspx',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Uses eviCore for molecular testing. Separate NSCLC policy (02.04.79).',
        lastVerified: '2026-02-01',
      },
    ],
  },

  regence: {
    name: 'Regence BCBS (OR/WA/UT/ID)',
    tier: 2,
    policies: [
      {
        id: 'regence-policy-46',
        name: 'Circulating Tumor DNA and Circulating Tumor Cells for Management (Liquid Biopsy) of Solid Tumor Cancers (#46)',
        url: 'https://www.regence.com/provider/library/policies-guidelines/medical-policy',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Policy #46. Updated Feb 2023. Search for policy on portal.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  horizonnj: {
    name: 'Horizon BCBS New Jersey',
    tier: 2,
    policies: [
      {
        id: 'horizonnj-evicore-molecular',
        name: 'Molecular and Genomic Testing Program (via eviCore)',
        url: 'https://www.horizonblue.com/providers/products-programs/evicore-health-care/molecular-and-genomic-testing-program',
        contentType: 'html',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'Horizon uses eviCore for molecular/genomic testing authorizations.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  // ============================================================================
  // TIER 1: Federal / Multi-State Programs
  // ============================================================================

  fepblue: {
    name: 'FEP Blue (Federal Employee Program)',
    tier: 1,
    policies: [
      {
        id: 'fep-ctdna-204141',
        name: 'Circulating Tumor DNA and Circulating Tumor Cells (2.04.141)',
        url: 'https://www.fepblue.org/-/media/PDFs/Medical-Policies/2025/January/Medical-Policies/Remove-and-Replace/204141-Circulating-Tumor-DNA-and.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Federal Employee Program policy. Generally considers ctDNA investigational for many indications.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  // ============================================================================
  // TIER 2: Medicaid Managed Care / Other National
  // ============================================================================

  centene: {
    name: 'Centene (Superior, Ambetter, etc.)',
    tier: 2,
    policies: [
      {
        id: 'centene-ctdna-mp239',
        name: 'Oncology Circulating Tumor DNA and Circulating Tumor Cells (CP.MP.239)',
        url: 'https://www.superiorhealthplan.com/content/dam/centene/Superior/policies/clinical-policies/CP.MP.239.pdf',
        contentType: 'pdf',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Centene policy used by Superior, Ambetter, and other Centene affiliates. Covers NSCLC, colorectal, pancreatic.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  molina: {
    name: 'Molina Healthcare',
    tier: 2,
    policies: [
      {
        id: 'molina-genetic-testing-051',
        name: 'Genetic Testing (Policy No. 051)',
        url: 'https://www.molinaclinicalpolicy.com/molinaclinicalpolicy/-/media/Molina/PublicWebsite/PDF/Common/Molina-Clinical-Policy/Genetic-Testing_R.pdf',
        contentType: 'pdf',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'Molina genetic testing policy includes tumor marker genotyping and ctDNA.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  hcsc: {
    name: 'HCSC (IL, MT, NM, OK, TX)',
    tier: 1,
    policies: [
      {
        id: 'hcsc-liquid-biopsy',
        name: 'Circulating Tumor DNA (Liquid Biopsy)',
        url: 'https://medicalpolicy.hcsc.com/home.html?corpEntCd=HCSC',
        contentType: 'html',
        policyType: 'liquid_biopsy',
        discoveryMethod: 'google_search',
        notes: 'Policy portal for all HCSC plans (IL, MT, NM, OK, TX). Search for liquid biopsy.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  bcbsal: {
    name: 'BCBS Alabama',
    tier: 2,
    policies: [
      {
        id: 'bcbsal-policy-portal',
        name: 'Medical Policies Portal',
        url: 'https://al-policies.exploremyplan.com/portal/web/al-policies/home/-/categories/150513503',
        contentType: 'html',
        policyType: 'molecular_oncology',
        discoveryMethod: 'google_search',
        notes: 'Search for liquid biopsy or ctDNA in policy portal.',
        lastVerified: '2026-02-01',
      },
    ],
  },

  // ============================================================================
  // Medicare / CMS
  // ============================================================================

  cms: {
    name: 'Centers for Medicare & Medicaid Services',
    tier: 1,
    policies: [
      {
        id: 'cms-ncd-90-2',
        name: 'Next Generation Sequencing (NCD 90.2)',
        url: 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=372',
        contentType: 'html',
        policyType: 'molecular_oncology',
        discoveryMethod: 'manual',
        notes: 'National Coverage Determination for NGS in cancer. Includes FoundationOne CDx.',
        lastVerified: '2026-01-31',
      },
    ],
  },
};

/**
 * Get all policies as a flat array
 * @returns {Array} All policy entries with payer info
 */
export function getAllPolicies() {
  const policies = [];
  for (const [payerId, payer] of Object.entries(POLICY_REGISTRY)) {
    for (const policy of payer.policies) {
      policies.push({
        ...policy,
        payerId,
        payerName: payer.name,
        payerTier: payer.tier,
      });
    }
  }
  return policies;
}

/**
 * Get policies by type
 * @param {string} policyType - One of: ctdna, liquid_biopsy, molecular_oncology, mrd, tumor_markers
 * @returns {Array} Matching policies
 */
export function getPoliciesByType(policyType) {
  return getAllPolicies().filter(p => p.policyType === policyType);
}

/**
 * Get policies by tier
 * @param {number} tier - 1, 2, or 3
 * @returns {Array} Matching policies
 */
export function getPoliciesByTier(tier) {
  return getAllPolicies().filter(p => p.payerTier === tier);
}

/**
 * Get all PDF policies (for PDF-specific processing)
 * @returns {Array} PDF policies
 */
export function getPdfPolicies() {
  return getAllPolicies().filter(p => p.contentType === 'pdf');
}

/**
 * Get all HTML policies
 * @returns {Array} HTML policies
 */
export function getHtmlPolicies() {
  return getAllPolicies().filter(p => p.contentType === 'html');
}

export default POLICY_REGISTRY;
