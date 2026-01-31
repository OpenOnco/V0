import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Terms of Service</h1>
        
        <div className="prose prose-slate max-w-none space-y-6">
          <p className="text-slate-600">
            <strong>Effective Date:</strong> January 31, 2026
          </p>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">1. About OpenOnco</h2>
            <p className="text-slate-600">
              OpenOnco is a 501(c)(3) nonprofit platform providing reference information about oncology 
              diagnostic tests. Our services include the OpenOnco website (openonco.org) and the 
              OpenOnco MCP Server (mcp.openonco.org).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">2. Informational Purpose Only</h2>
            <p className="text-slate-600">
              All information provided by OpenOnco is for <strong>educational and informational purposes only</strong>. 
              OpenOnco does not provide medical advice, diagnosis, or treatment recommendations. The information 
              on our platform should not be used as a substitute for professional medical advice from a qualified 
              healthcare provider.
            </p>
            <p className="text-slate-600 mt-4">
              Always consult with your physician or other qualified healthcare provider before making any 
              decisions about diagnostic testing or treatment options.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">3. No Warranty</h2>
            <p className="text-slate-600">
              OpenOnco strives to provide accurate and up-to-date information, but we make no warranties 
              or representations about the completeness, accuracy, reliability, or suitability of the 
              information. Test specifications, pricing, coverage policies, and regulatory status may 
              change. Users should verify current information directly with test vendors and payers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">4. Acceptable Use</h2>
            <p className="text-slate-600">
              You may use OpenOnco services for lawful purposes only. You agree not to:
            </p>
            <ul className="list-disc list-inside text-slate-600 mt-2 space-y-1">
              <li>Use automated systems to overload or disrupt our services</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Misrepresent information obtained from OpenOnco</li>
              <li>Use our services for any illegal or harmful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">5. MCP Server Usage</h2>
            <p className="text-slate-600">
              The OpenOnco MCP Server is provided as a free, public, read-only service. We reserve the 
              right to implement rate limiting or access restrictions to ensure fair usage and service 
              availability for all users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">6. Limitation of Liability</h2>
            <p className="text-slate-600">
              To the fullest extent permitted by law, OpenOnco and its contributors shall not be liable 
              for any direct, indirect, incidental, consequential, or punitive damages arising from your 
              use of our services or reliance on information provided.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">7. Changes to Terms</h2>
            <p className="text-slate-600">
              We may update these Terms of Service from time to time. Continued use of our services 
              after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">8. Contact</h2>
            <p className="text-slate-600">
              For questions about these Terms of Service, contact us at{' '}
              <a href="mailto:alex@openonco.org" className="text-blue-600 hover:underline">
                alex@openonco.org
              </a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
