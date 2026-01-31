const PrivacyPage = () => {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: January 2025</p>

      <div className="prose prose-lg text-gray-700 space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <p>
            OpenOnco is a non-profit platform that catalogs liquid biopsy and molecular diagnostic tests for cancer.
            We are committed to protecting your privacy and being transparent about the limited data we collect.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data We Collect</h2>

          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Main Website (openonco.org)</h3>
          <p>We collect minimal, anonymized analytics data through PostHog to understand how our site is used:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Page views and navigation patterns</li>
            <li>General device and browser information</li>
            <li>Approximate geographic location (country/region level)</li>
          </ul>
          <p className="mt-4">
            This analytics data is anonymized and cannot be used to identify individual users.
            We do not collect names, email addresses, or any other personally identifiable information
            unless you voluntarily contact us.
          </p>

          <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">MCP Server</h3>
          <p>
            Our MCP (Model Context Protocol) server, which provides programmatic access to our test database,
            does <strong>not</strong> collect any user data. It simply processes queries and returns test information.
            No queries, IP addresses, or usage patterns are logged or stored.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">User Accounts</h2>
          <p>
            OpenOnco does not have user accounts or authentication. You can browse all content without
            creating an account or providing any personal information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cookies</h2>
          <p>
            We use only essential cookies for PostHog analytics. We do not use advertising cookies,
            tracking pixels, or any third-party marketing tools.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Data</h2>
          <p>The anonymized analytics data we collect is used solely to:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Understand which content is most useful to visitors</li>
            <li>Identify technical issues and improve site performance</li>
            <li>Guide decisions about what features and content to develop</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Third-Party Sharing</h2>
          <p>
            We do not sell, trade, or otherwise transfer any information to outside parties.
            Our analytics data is processed by PostHog in accordance with their privacy policy,
            but this data is anonymized and cannot identify individual users.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Retention</h2>
          <p>
            Anonymized analytics data is retained for up to 12 months to identify long-term trends,
            after which it is automatically deleted. Since we don't collect personally identifiable
            information, there is no personal data to delete upon request.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">External Links</h2>
          <p>
            Our site contains links to external resources such as test vendor websites, clinical trial
            registries, and published studies. We are not responsible for the privacy practices of
            these external sites.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. Any changes will be posted on this
            page with an updated revision date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact</h2>
          <p>
            If you have questions about this privacy policy or our data practices, please contact us at{' '}
            <a
              href="mailto:alex@openonco.org"
              className="text-emerald-600 hover:text-emerald-700 underline"
            >
              alex@openonco.org
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;
