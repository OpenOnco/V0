const HowItWorksPage = () => {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">How It Works</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">

        <h2 className="text-2xl font-bold text-gray-900">OpenOnco is Open</h2>
        
        <p>
          The OpenOnco database is assembled from a wide variety of public sources including vendor databases, peer reviewed publications, and clinical trial registries. Sources are cited to the best of our ability along with context and notes on possible contradictory data and its resolution. Information on the database update process can be found below in the Technical Information section.
        </p>

        <p>
          The current version of the OpenOnco database is available for anyone to download in several formats - go to the <strong>Data Download</strong> tab. Go to the <strong>Submissions</strong> tab to tell us about a new test, request changes to test data, and send us bug reports and feature suggestions. You can also see our log of all data changes on the site.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-10">Technical Information</h2>
        
        <p className="mt-4">
          OpenOnco is vibe-coded in React using Opus 4.5. The test database is hardcoded as a JSON structure inside the app. The app (and embedded database) are updated as-needed when new data or tools are added. You can find the build date of the version you are running under the <strong>Data Download</strong> tab. Data for each build is cross-checked by GPT Pro 5.1, Gemini 3, and Opus 4.5. Once the models have beaten each other into submission, the new code is committed to GitHub and deployed on Vercel.
        </p>

      </div>
    </div>
  );
};

// ============================================
// Submissions Page
// ============================================
// 
// VENDOR INVITE FEATURE - Custom URL Links for Vendor Validation
// ============================================
// 
// This feature allows vendors to be invited via custom URL links that pre-fill
// their information and skip email verification. This streamlines the vendor
// validation workflow.
//
// URL Format:
//   https://openonco.org/submissions?invite=vendor&email=EMAIL&name=NAME
//
// Parameters:
//   - invite=vendor    : Tells the system this is a vendor invite (skips email verification)
//   - email=xxx@yyy.com: Pre-fills email AND uses domain to match tests
//   - name=First%20Last: Pre-fills first/last name fields (URL-encoded spaces)
//
// How it works:
//   1. Vendor clicks link → lands on /submissions page
//   2. System auto-detects invite=vendor parameter
//   3. Email is pre-verified (no code needed since you sent the link)
//   4. Name fields pre-filled from the name parameter
//   5. Test dropdown auto-filtered - only shows tests where vendor name matches email domain
//
// Domain Matching Logic:
//   - Extracts domain from email: dan.norton@personalis.com → "personalis"
//   - Matches against vendor names: "Personalis" → matches
//   - Uses fuzzy matching: removes non-alphanumeric chars, case-insensitive
//   - Example: genomictestingcooperative.com → matches "Genomic Testing Cooperative (GTC)"
//
// Example URLs:
//   https://openonco.org/submissions?invite=vendor&email=dan.norton@personalis.com&name=Dan%20Norton
//   https://openonco.org/submissions?invite=vendor&email=jowen@genomictestingcooperative.com&name=Jeffrey%20Owen
//
// Implementation:
//   - URL params parsed in main App component (line ~10737)
//   - vendorInvite prop passed to SubmissionsPage
//   - SubmissionsPage processes invite and sets up form (line ~5004)
//   - getVendorTests() filters test dropdown (line ~5596)
//   - emailMatchesVendor() validates domain matching (line ~5230)
//
// ============================================

export default HowItWorksPage;
