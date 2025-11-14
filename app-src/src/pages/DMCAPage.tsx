/**
 * DMCAPage - DMCA Takedown Policy page
 * Can be accessed directly or linked from other pages
 * Uses PublicHeader (shows sign out if logged in)
 */

import { PublicHeader } from '@/components/Layout/PublicHeader';
import { PublicFooter } from '@/components/Layout/PublicFooter';

export function DMCAPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Public Header */}
      <PublicHeader />

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 lg:p-12">
          {/* Title */}
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              DMCA Takedown Policy
            </h1>
            <p className="text-sm text-gray-500">
              Effective Date: January 15, 2025
            </p>
          </div>

          {/* Introduction */}
          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              DocuTrain Inc. ("we," "us," or "our") respects the intellectual property rights of others and expects 
              our users to do the same. In accordance with the Digital Millennium Copyright Act (DMCA) and other 
              applicable laws, we have adopted the following policy toward copyright infringement.
            </p>

            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                1. Reporting Copyright Infringement
              </h2>
              <p className="mb-3">
                If you believe that content available through our Service infringes your copyright, please send us 
                a notice of claimed infringement ("DMCA Notice") containing the following information:
              </p>
              <ol className="space-y-3 list-decimal pl-6">
                <li>
                  <strong className="text-gray-900">Identification of the copyrighted work:</strong> A description 
                  of the copyrighted work that you claim has been infringed, or if multiple works are covered, a 
                  representative list of such works.
                </li>
                <li>
                  <strong className="text-gray-900">Identification of the infringing material:</strong> Information 
                  reasonably sufficient to permit us to locate the allegedly infringing material, including:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>The URL or location where the material appears on our Service</li>
                    <li>Any document identifiers, titles, or other identifying information</li>
                    <li>Your account information if you have access to identify the specific content</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-gray-900">Your contact information:</strong> Your name, address, telephone 
                  number, and email address.
                </li>
                <li>
                  <strong className="text-gray-900">Statement of good faith:</strong> A statement that you have a 
                  good faith belief that the use of the material in the manner complained of is not authorized by 
                  the copyright owner, its agent, or the law.
                </li>
                <li>
                  <strong className="text-gray-900">Statement of accuracy:</strong> A statement that the information 
                  in your notice is accurate and, under penalty of perjury, that you are the copyright owner or 
                  authorized to act on behalf of the copyright owner.
                </li>
                <li>
                  <strong className="text-gray-900">Physical or electronic signature:</strong> Your physical or 
                  electronic signature (or that of a person authorized to act on your behalf).
                </li>
              </ol>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                2. Where to Send DMCA Notices
              </h2>
              <p className="mb-3">
                Please send your DMCA Notice to our designated Copyright Agent:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
                <p className="font-semibold text-gray-900 mb-2">DocuTrain Inc.</p>
                <p className="text-gray-700">Copyright Agent</p>
                <p className="text-gray-700">
                  Email:{' '}
                  <a href="mailto:copyright@docutrain.io" className="text-blue-600 hover:text-blue-800 underline">
                    copyright@docutrain.io
                  </a>
                </p>
                <p className="text-gray-700 mt-2">
                  Subject Line: "DMCA Takedown Request"
                </p>
              </div>
              <p className="text-sm text-gray-600">
                <strong>Note:</strong> Only DMCA notices should be sent to this email address. For other inquiries, 
                please use{' '}
                <a href="/app/contact" className="text-blue-600 hover:text-blue-800 underline">
                  our contact form
                </a>.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                3. Our Response to DMCA Notices
              </h2>
              <p className="mb-3">
                Upon receipt of a valid DMCA Notice, we will:
              </p>
              <ul className="space-y-2 list-disc pl-6">
                <li>Promptly investigate the claim</li>
                <li>Remove or disable access to the allegedly infringing material if we determine it violates copyright</li>
                <li>Notify the user who uploaded the content of the removal</li>
                <li>Provide the user with a copy of the DMCA Notice</li>
                <li>Inform the user that they may submit a counter-notification if they believe the removal was mistaken</li>
              </ul>
              <p className="mt-3">
                We reserve the right to terminate, in appropriate circumstances, the accounts of users who are 
                repeat infringers of copyright.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                4. Counter-Notification
              </h2>
              <p className="mb-3">
                If you believe that your content was removed or disabled by mistake or misidentification, you may 
                send us a counter-notification ("Counter-Notice") containing:
              </p>
              <ol className="space-y-3 list-decimal pl-6">
                <li>
                  <strong className="text-gray-900">Identification of the removed material:</strong> A description 
                  of the material that was removed and the location where it appeared before removal.
                </li>
                <li>
                  <strong className="text-gray-900">Statement of good faith:</strong> A statement under penalty of 
                  perjury that you have a good faith belief that the material was removed or disabled as a result 
                  of mistake or misidentification.
                </li>
                <li>
                  <strong className="text-gray-900">Your contact information:</strong> Your name, address, telephone 
                  number, and email address.
                </li>
                <li>
                  <strong className="text-gray-900">Consent to jurisdiction:</strong> A statement that you consent 
                  to the jurisdiction of the federal court in your district (or if you are outside the United States, 
                  to the jurisdiction of the federal courts in the district where DocuTrain Inc. is located).
                </li>
                <li>
                  <strong className="text-gray-900">Physical or electronic signature:</strong> Your physical or 
                  electronic signature.
                </li>
              </ol>
              <p className="mt-3">
                If we receive a valid Counter-Notice, we will forward it to the original complainant. The original 
                complainant will have 10 business days to file a court action seeking a court order to restrain you 
                from engaging in infringing activity. If we do not receive such notification, we may restore the 
                removed material.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                5. False Claims
              </h2>
              <p>
                Please be aware that under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents 
                that material or activity is infringing may be subject to liability for damages, including costs 
                and attorneys' fees. Similarly, making a false counter-notification may also result in liability. 
                Please ensure that your claims are accurate and made in good faith.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                6. Contact Information
              </h2>
              <p>
                For questions about this DMCA Takedown Policy or to submit a DMCA Notice or Counter-Notice, please 
                contact our Copyright Agent at{' '}
                <a href="mailto:copyright@docutrain.com" className="text-blue-600 hover:text-blue-800 underline">
                  copyright@docutrain.com
                </a>.
              </p>
            </section>

            {/* Closing */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                This policy is provided for informational purposes only and does not constitute legal advice. 
                If you have questions about copyright law or your rights, please consult with an attorney.
              </p>
            </div>
          </div>
        </div>

      </main>
      
      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
}
