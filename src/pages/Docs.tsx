import ReactMarkdown from 'react-markdown';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import docsRaw from '../../DOCUMENTATION.md?raw';

export default function Docs() {
  return (
    <div className="min-h-screen p-4 md:p-8 relative z-10 selection:bg-[#00ff9d] selection:text-black">
      <div className="max-w-4xl mx-auto glass-panel rounded-none border border-[#00ff9d]/50 shadow-[0_0_30px_rgba(0,255,157,0.2)] flex flex-col h-[85vh]">
        <div className="border-b border-[#00ff9d]/30 bg-[#00ff9d]/10 p-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#00ff9d] font-bold text-sm tracking-widest">
            <BookOpen className="w-4 h-4" />
            SYS.DOCUMENTATION // REVISION 2
          </div>
          <Link to="/" className="text-[#00ff9d] hover:text-[#ff0080] transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="p-8 flex-1 overflow-y-auto text-[#00ff9d] font-mono text-sm leading-relaxed prose prose-invert prose-green max-w-none 
          prose-h1:text-[#00ff9d] prose-h1:uppercase prose-h1:tracking-widest prose-h1:border-b prose-h1:border-[#00ff9d]/30 prose-h1:pb-2
          prose-h2:text-[#00ff9d] prose-h2:uppercase prose-h2:tracking-widest prose-h2:mt-8
          prose-h3:text-[#00ff9d]/80 prose-h3:uppercase
          prose-strong:text-[#00ff9d] prose-a:text-[#ff0080] prose-code:text-[#ff0080] prose-code:bg-[#ff0080]/10 prose-code:px-1 prose-code:py-0.5
          prose-ul:list-square prose-li:marker:text-[#00ff9d]">
          <ReactMarkdown>{docsRaw}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
