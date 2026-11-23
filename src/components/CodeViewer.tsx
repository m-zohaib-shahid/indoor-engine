import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  FileCode,
  FolderGit2,
  Search,
  ExternalLink,
  Layers,
  FileText
} from 'lucide-react';
import JSZip from 'jszip';
import { FLUTTER_CODE_FILES, DartSourceFile } from '../data/flutterCode';

interface CodeViewerProps {
  selectedFile?: string;
  onSelectFile?: (file: string) => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  selectedFile: externalSelectedFile,
  onSelectFile
}) => {
  const [internalSelectedFile, setInternalSelectedFile] = useState<string>(
    externalSelectedFile || FLUTTER_CODE_FILES[0].path
  );
  const [copiedFile, setCopiedFile] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const currentFilePath = externalSelectedFile || internalSelectedFile;
  const currentFile =
    FLUTTER_CODE_FILES.find((f) => f.path === currentFilePath) || FLUTTER_CODE_FILES[0];

  const handleSelect = (path: string) => {
    setInternalSelectedFile(path);
    if (onSelectFile) onSelectFile(path);
  };

  const handleCopyCurrent = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.code);
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyAllFiles = async () => {
    try {
      const combinedMarkdown = FLUTTER_CODE_FILES.map(
        (f) => `### File: \`${f.path}\`\n\n\`\`\`${f.path.endsWith('.yaml') ? 'yaml' : 'dart'}\n${f.code}\n\`\`\`\n`
      ).join('\n---\n\n');

      await navigator.clipboard.writeText(combinedMarkdown);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch (err) {
      console.error('Failed to copy all', err);
    }
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Add each file according to its exact path
      FLUTTER_CODE_FILES.forEach((f) => {
        zip.file(f.path, f.code);
      });

      // Add README.md with setup guide
      const readmeContent = `# Enterprise Multi-User Indoor Tracking & Navigation Engine (Flutter)
Production-ready Flutter Indoor Positioning System fusing BLE RSSI Trilateration, 1D Kalman Filtering, Pedestrian Dead Reckoning (PDR), Kindona Building Graph Pathfinding, Supabase Auth, and Dynamic User-to-User Target Navigation.

## Key Upgrades
- **Supabase Authentication & Profiles**: Complete sign-up, sign-in, session streaming, and profile synchronization.
- **Active Building Peers Directory**: Real-time multi-user presence and coordinates tracking on the floor plan.
- **Dynamic User-to-User A* Routing**: Connects current user coordinates to a moving peer with real-time recalculation as either user walks.
- **ZainCheema RF Math**: Log-Distance Path Loss, 1D Kalman filter noise suppression, and linearized matrix trilateration.
- **Inertial Sensors PDR**: Tri-axial accelerometer norm peak detection with Weinberg dynamic step length estimation ($L = K \sqrt[4]{a_{\max} - a_{\min}}$).

## Installation & Setup
1. Run \`flutter pub get\`
2. Configure your Supabase URL & anon key in \`lib/main.dart\`
3. Run \`flutter run\` on physical devices for sensor & BLE access
`;
      zip.file('README.md', readmeContent);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'indoor_positioning_engine_flutter.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate zip', err);
    } finally {
      setIsZipping(false);
    }
  };

  const filteredFiles = FLUTTER_CODE_FILES.filter((f) => {
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    if (searchQuery.trim() === '') return true;
    return (
      f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const lines = currentFile.code.split('\n');

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 max-w-7xl mx-auto">
      {/* Left Sidebar: File Tree & Action Bar */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Project Header Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Flutter Project Tree</h3>
              <p className="text-[11px] text-slate-400">7 files • Zero placeholders</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Production-grade Dart code fusing ZainCheema math logic with Kindona floor plan architecture.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleCopyAllFiles}
              className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl text-xs font-semibold transition-all shadow-lg ${
                copiedAll
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
              }`}
            >
              {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedAll ? 'All 7 Files Copied to Clipboard!' : 'Copy All 7 Files (Master Output)'}
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              {isZipping ? 'Generating .zip...' : 'Download Project .zip'}
            </button>
          </div>
        </div>

        {/* File Filter & Search */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl">
          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
            {['all', 'service', 'model', 'screen', 'config'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2 py-1 rounded capitalize whitespace-nowrap transition ${
                  filterCategory === cat
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* File List */}
          <div className="mt-2 space-y-1">
            {filteredFiles.map((file) => {
              const isSelected = file.path === currentFile.path;
              return (
                <button
                  key={file.path}
                  onClick={() => handleSelect(file.path)}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <FileCode
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isSelected ? 'text-cyan-400' : 'text-slate-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono font-medium truncate">{file.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{file.path}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Code Viewer with Line Numbers */}
      <div className="flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
        {/* Code Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-950/80 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 font-mono text-sm font-semibold text-white">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>{currentFile.path}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{currentFile.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
              {lines.length} lines • {(new TextEncoder().encode(currentFile.code).length / 1024).toFixed(1)} KB
            </span>

            <button
              onClick={handleCopyCurrent}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                copiedFile
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {copiedFile ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              {copiedFile ? 'Copied File!' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Code Content View */}
        <div className="relative overflow-x-auto max-h-[720px] bg-[#060A12] text-xs font-mono leading-relaxed p-4 select-text">
          <table className="border-collapse w-full">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40">
                  <td className="text-slate-600 text-right pr-4 select-none w-10 align-top text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="text-slate-300 pl-2 whitespace-pre break-all">
                    {/* Basic syntax coloring */}
                    {formatSyntax(line)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Simple syntax color helper for Dart & YAML
function formatSyntax(line: string) {
  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return <span className="text-slate-500 italic">{line}</span>;
  }
  if (line.trim().startsWith('import ') || line.trim().startsWith('library ')) {
    return <span className="text-purple-400 font-medium">{line}</span>;
  }
  if (line.includes('class ') || line.includes('enum ')) {
    return <span className="text-cyan-300 font-bold">{line}</span>;
  }
  if (line.includes('void ') || line.includes('Future<') || line.includes('Stream<') || line.includes('double ') || line.includes('int ')) {
    return <span className="text-emerald-300">{line}</span>;
  }
  if (line.includes('return ') || line.includes('final ') || line.includes('const ')) {
    return <span className="text-sky-300">{line}</span>;
  }
  return line;
}
