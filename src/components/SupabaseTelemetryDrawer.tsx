import React, { useState } from 'react';
import { X, Radio, Wifi, Send, Users, ShieldCheck, ChevronRight } from 'lucide-react';
import { TelemetryPacket } from '../types/simulator';

interface SupabaseTelemetryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  packets: TelemetryPacket[];
  onOpenCode?: (file: string) => void;
}

export const SupabaseTelemetryDrawer: React.FC<SupabaseTelemetryDrawerProps> = ({
  isOpen,
  onClose,
  packets,
  onOpenCode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-left">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Supabase Realtime Stream</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[11px] text-slate-400">
              Channel: <code className="text-emerald-400 font-mono">indoor_floor_1</code>
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Network Health Stats */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-800 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-slate-500 uppercase">STATUS</div>
          <div className="text-emerald-400 font-bold font-mono mt-0.5">CONNECTED</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-slate-500 uppercase">THROTTLE</div>
          <div className="text-cyan-400 font-bold font-mono mt-0.5">3.0 Hz (330ms)</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-slate-500 uppercase">LATENCY</div>
          <div className="text-purple-400 font-bold font-mono mt-0.5">18 ms</div>
        </div>
      </div>

      {/* Code Link banner */}
      <div className="px-4 py-2.5 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400">Implemented in Dart:</span>
        <button
          onClick={() => {
            onClose();
            if (onOpenCode) onOpenCode('lib/services/supabase_sync_service.dart');
          }}
          className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
        >
          supabase_sync_service.dart <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Telemetry Packet Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        <div className="text-[11px] font-sans text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Live Broadcast Payloads</span>
          <span className="text-slate-500">{packets.length} packets logged</span>
        </div>

        {packets.slice(0, 25).map((pkt) => (
          <div
            key={pkt.id}
            className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="text-cyan-400 font-semibold">{pkt.userId}</span>
              <span className="text-slate-500">{pkt.timestamp}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300 text-[11px]">
              <div>
                <span className="text-slate-500">coord: </span>
                <span className="text-white">({pkt.x}m, {pkt.y}m)</span>
              </div>
              <div>
                <span className="text-slate-500">heading: </span>
                <span className="text-cyan-300">{pkt.heading}°</span>
              </div>
              <div>
                <span className="text-slate-500">floor: </span>
                <span>Level {pkt.floor}</span>
              </div>
              <div>
                <span className="text-slate-500">accuracy: </span>
                <span className="text-emerald-400">±{pkt.accuracy}m</span>
              </div>
            </div>
          </div>
        ))}

        {packets.length === 0 && (
          <div className="text-center py-12 text-slate-500 font-sans text-xs">
            Awaiting location telemetry events...
          </div>
        )}
      </div>
    </div>
  );
};
