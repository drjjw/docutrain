/**
 * TermsPage - Standalone Terms of Service page
 * Can be accessed directly or linked from other pages
 * Uses PublicHeader (shows sign out if logged in)
 */

import { PublicHeader } from '@/components/Layout/PublicHeader';
import { PublicFooter } from '@/components/Layout/PublicFooter';

export function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-sm text-gray-500">
              Effective Date: October 31, 2025
            </p>
          </div>

          {/* Introduction */}
          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              Welcome to DocuTrain (the "Service"), operated by DocuTrain Inc. ("we," "us," or "our"). 
              These Terms of Service ("Terms") govern your access to and use of our website and services, 
              including the upload of PDF documents, AI-powered document analysis, and chat functionalities 
              related to those documents. By accessing or using the Service, you agree to be bound by these 
              Terms. If you do not agree, you may not use the Service.
            </p>

            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                1. Description of Service
              </h2>
              <p>
                DocuTrain provides an AI-based platform that allows users to upload PDF documents ("User Content"). 
                Our AI technology processes and analyzes the uploaded documents to enable interactive chat sessions 
                where users can ask questions and receive responses based on the content of those documents. The 
                Service is intended for informational and educational purposes only.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                2. Eligibility and Account Registration
              </h2>
              <p>
                You must be at least 18 years old or the age of majority in your jurisdiction to use the Service. 
                To access certain features, you may need to create an account. You agree to provide accurate, current, 
                and complete information during registration and to update such information as needed. You are 
                responsible for safeguarding your account credentials and for any activities occurring under your account.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                3. User Content and Uploads
              </h2>
              <ul className="space-y-3 list-none pl-0">
                <li>
                  <strong className="text-gray-900">Ownership and License:</strong> You retain ownership of any 
                  User Content you upload. By uploading User Content, you grant us a worldwide, non-exclusive, 
                  royalty-free license to access, process, analyze, and use the User Content solely for providing 
                  the Service, including AI analysis and chat responses. This license ends when you delete your 
                  User Content or account, except as necessary for us to comply with legal obligations.
                </li>
                <li>
                  <strong className="text-gray-900">Representations:</strong> You represent and warrant that you 
                  have all necessary rights to upload User Content and that it does not infringe on any third-party 
                  rights, including intellectual property rights. You are solely responsible for the accuracy, legality, 
                  and appropriateness of your User Content.
                </li>
                <li>
                  <strong className="text-gray-900">Storage and Deletion:</strong> We may store User Content 
                  temporarily to facilitate the Service. You can delete your User Content at any time, but residual 
                  copies may remain in backups for a reasonable period.
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                4. AI Services and Chat Functionality
              </h2>
              <p className="mb-3">
                Our AI processes your uploaded PDFs to generate responses during chat sessions. These responses 
                are derived from the content of your User Content and our AI models.
              </p>
              <ul className="space-y-3 list-none pl-0">
                <li>
                  <strong className="text-gray-900">AI Limitations:</strong> AI technology is not perfect and may 
                  produce inaccurate, incomplete, or misleading information. Responses may contain errors, omissions, 
                  or hallucinations (fabricated details). We do not guarantee the accuracy, reliability, or suitability 
                  of any AI-generated content.
                </li>
                <li>
                  <strong className="text-gray-900">No Responsibility for Errors:</strong> DocuTrain is not responsible 
                  for any mistakes made by the AI, including but not limited to factual inaccuracies, misinterpretations, 
                  or biases in responses. Additionally, we are not responsible for any errors, inaccuracies, or issues 
                  in the source material (your uploaded PDFs) that the AI processes or relies upon. You use the 
                  AI-generated content at your own risk and should verify all information independently.
                </li>
                <li>
                  <strong className="text-gray-900">No Professional Advice:</strong> The Service does not provide 
                  legal, financial, medical, or other professional advice. AI responses are not a substitute for 
                  professional judgment or expertise.
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                5. Prohibited Uses
              </h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="space-y-2 list-disc pl-6">
                <li>Upload User Content that is illegal, harmful, defamatory, obscene, or violates any law or third-party rights.</li>
                <li>Use the Service for any unlawful purpose, including but not limited to fraud, harassment, or distribution of malware.</li>
                <li>Attempt to reverse-engineer, hack, or interfere with the Service or AI models.</li>
                <li>Use automated systems (e.g., bots) to interact with the Service without our permission.</li>
                <li>Share or distribute AI-generated content in a way that misrepresents it as human-generated or official advice.</li>
              </ul>
              <p className="mt-3">
                We reserve the right to remove any User Content or suspend access if we believe it violates these Terms.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                6. Intellectual Property
              </h2>
              <p>
                The Service, including its AI models, software, and design, is owned by DocuTrain or its licensors 
                and protected by intellectual property laws. You may not copy, modify, or distribute any part of 
                the Service without our written consent.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                7. Disclaimers and Limitations of Liability
              </h2>
              <ul className="space-y-3 list-none pl-0">
                <li>
                  <strong className="text-gray-900">Disclaimers:</strong> THE SERVICE IS PROVIDED "AS IS" AND 
                  "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO 
                  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT 
                  WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
                </li>
                <li>
                  <strong className="text-gray-900">Limitations of Liability:</strong> TO THE MAXIMUM EXTENT 
                  PERMITTED BY LAW, DOCUTRAIN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, 
                  OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, 
                  PROFITS, OR BUSINESS OPPORTUNITIES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN 
                  THE PAST 12 MONTHS, IF ANY.
                </li>
                <li>
                  <strong className="text-gray-900">Indemnification:</strong> You agree to indemnify and hold harmless 
                  DocuTrain, its affiliates, officers, and employees from any claims, damages, or expenses arising from 
                  your User Content, use of the Service, or violation of these Terms.
                </li>
              </ul>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                8. Termination
              </h2>
              <p>
                We may suspend or terminate your access to the Service at any time, with or without cause, including 
                for violations of these Terms. Upon termination, your right to use the Service ends immediately, and 
                we may delete your User Content.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                9. Governing Law and Dispute Resolution
              </h2>
              <p>
                These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada 
                applicable therein, without regard to conflict of laws principles. Any disputes arising from these 
                Terms shall be resolved exclusively in the courts located in Toronto, Ontario.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                10. Changes to Terms
              </h2>
              <p>
                We may update these Terms from time to time. We will notify you of material changes via email or 
                through the Service. Your continued use after changes constitutes acceptance of the updated Terms.
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8">
                11. Contact Us
              </h2>
              <p>
                If you have questions about these Terms, contact us at{' '}
                <a href="mailto:support@docutrain.com" className="text-blue-600 hover:text-blue-800 underline">
                  support@docutrain.com
                </a>.
              </p>
            </section>

            {/* Closing */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                By using DocuTrain, you acknowledge that you have read, understood, and agree to these Terms.
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

