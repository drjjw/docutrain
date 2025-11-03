/**
 * PublicFooter - Footer for public pages (Terms, Contact, etc.)
 * Matches the style of the home page footer
 */

export function PublicFooter() {
  return (
    <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 pb-8 border-b border-white/10 mb-8">
          {/* Brand Section */}
          <div className="flex-1 max-w-md">
            <div className="flex flex-col gap-2">
              <span className="font-bold text-xl font-['Space_Grotesk',sans-serif]">
                DocuTrain
              </span>
              <p className="text-white/70 text-sm leading-relaxed">
                Document-focused AI assistant for training, compliance, and knowledge management. Keep your AI context focused on your documents—not the entire internet.
              </p>
            </div>
          </div>
          
          {/* Links Section */}
          <div className="flex flex-wrap gap-8">
            <a href="/app/chat" className="text-white/70 hover:text-white font-medium text-sm transition-colors">
              Chat
            </a>
            <a href="/app/dashboard" className="text-white/70 hover:text-white font-medium text-sm transition-colors">
              Dashboard
            </a>
            <a href="/app/documents" className="text-white/70 hover:text-white font-medium text-sm transition-colors">
              Documents
            </a>
            <a href="/app/profile" className="text-white/70 hover:text-white font-medium text-sm transition-colors">
              Profile
            </a>
            <a href="/app/contact" className="text-white/70 hover:text-white font-medium text-sm transition-colors">
              Contact
            </a>
          </div>
        </div>
        
        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-white/50 text-sm">
            © 2025 DocuTrain. Powered by RAG Technology.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1.5 bg-white/10 rounded text-xs font-semibold">
              Gemini
            </span>
            <span className="px-3 py-1.5 bg-white/10 rounded text-xs font-semibold">
              Grok
            </span>
            <span className="px-3 py-1.5 bg-white/10 rounded text-xs font-semibold">
              OpenAI
            </span>
            <span className="px-3 py-1.5 bg-white/10 rounded text-xs font-semibold">
              Supabase
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
