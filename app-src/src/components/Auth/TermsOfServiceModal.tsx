import React from 'react';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

const TERMS_OF_SERVICE = `# DocuTrain Terms of Service

**Effective Date: October 31, 2025**

Welcome to DocuTrain (the "Service"), operated by DocuTrain Inc. ("we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of our website and services, including the upload of PDF documents, AI-powered document analysis, and chat functionalities related to those documents. By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service.

## 1. Description of Service

DocuTrain provides an AI-based platform that allows users to upload PDF documents ("User Content"). Our AI technology processes and analyzes the uploaded documents to enable interactive chat sessions where users can ask questions and receive responses based on the content of those documents. The Service is intended for informational and educational purposes only.

## 2. Eligibility and Account Registration

You must be at least 18 years old or the age of majority in your jurisdiction to use the Service. To access certain features, you may need to create an account. You agree to provide accurate, current, and complete information during registration and to update such information as needed. You are responsible for safeguarding your account credentials and for any activities occurring under your account.

## 3. User Content and Uploads

- **Ownership and License**: You retain ownership of any User Content you upload. By uploading User Content, you grant us a worldwide, non-exclusive, royalty-free license to access, process, analyze, and use the User Content solely for providing the Service, including AI analysis and chat responses. This license ends when you delete your User Content or account, except as necessary for us to comply with legal obligations.

- **Representations**: You represent and warrant that you have all necessary rights to upload User Content and that it does not infringe on any third-party rights, including intellectual property rights. You are solely responsible for the accuracy, legality, and appropriateness of your User Content.

- **Storage and Deletion**: We may store User Content temporarily to facilitate the Service. You can delete your User Content at any time, but residual copies may remain in backups for a reasonable period.

## 4. AI Services and Chat Functionality

Our AI processes your uploaded PDFs to generate responses during chat sessions. These responses are derived from the content of your User Content and our AI models.

- **AI Limitations**: AI technology is not perfect and may produce inaccurate, incomplete, or misleading information. Responses may contain errors, omissions, or hallucinations (fabricated details). We do not guarantee the accuracy, reliability, or suitability of any AI-generated content.

- **No Responsibility for Errors**: DocuTrain is not responsible for any mistakes made by the AI, including but not limited to factual inaccuracies, misinterpretations, or biases in responses. Additionally, we are not responsible for any errors, inaccuracies, or issues in the source material (your uploaded PDFs) that the AI processes or relies upon. You use the AI-generated content at your own risk and should verify all information independently.

- **No Professional Advice**: The Service does not provide legal, financial, medical, or other professional advice. AI responses are not a substitute for professional judgment or expertise.

## 5. Prohibited Uses

You agree not to:

- Upload User Content that is illegal, harmful, defamatory, obscene, or violates any law or third-party rights.

- Use the Service for any unlawful purpose, including but not limited to fraud, harassment, or distribution of malware.

- Attempt to reverse-engineer, hack, or interfere with the Service or AI models.

- Use automated systems (e.g., bots) to interact with the Service without our permission.

- Share or distribute AI-generated content in a way that misrepresents it as human-generated or official advice.

We reserve the right to remove any User Content or suspend access if we believe it violates these Terms.

## 6. Intellectual Property

The Service, including its AI models, software, and design, is owned by DocuTrain or its licensors and protected by intellectual property laws. You may not copy, modify, or distribute any part of the Service without our written consent.

## 7. Disclaimers and Limitations of Liability

- **Disclaimers**: THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.

- **Limitations of Liability**: TO THE MAXIMUM EXTENT PERMITTED BY LAW, DOCUTRAIN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, PROFITS, OR BUSINESS OPPORTUNITIES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS, IF ANY.

- **Indemnification**: You agree to indemnify and hold harmless DocuTrain, its affiliates, officers, and employees from any claims, damages, or expenses arising from your User Content, use of the Service, or violation of these Terms.

## 8. Termination

We may suspend or terminate your access to the Service at any time, with or without cause, including for violations of these Terms. Upon termination, your right to use the Service ends immediately, and we may delete your User Content.

## 9. Governing Law and Dispute Resolution

These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of laws principles. Any disputes arising from these Terms shall be resolved exclusively in the courts located in Toronto, Ontario.

## 10. Changes to Terms

We may update these Terms from time to time. We will notify you of material changes via email or through the Service. Your continued use after changes constitutes acceptance of the updated Terms.

## 11. Contact Us

If you have questions about these Terms, contact us at support@docutrain.com.

By using DocuTrain, you acknowledge that you have read, understood, and agree to these Terms.`;

export function TermsOfServiceModal({ isOpen, onClose, onAccept }: TermsOfServiceModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terms of Service"
      size="lg"
    >
      <div className="space-y-4">
        <div className="max-h-[60vh] overflow-y-auto border rounded-lg p-4 bg-gray-50">
          <div className="prose prose-sm max-w-none">
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {TERMS_OF_SERVICE}
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={onAccept}>
            I Accept
          </Button>
        </div>
      </div>
    </Modal>
  );
}

