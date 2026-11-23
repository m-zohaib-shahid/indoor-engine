import React from 'react';
import { X, BookOpen, Cpu, Radio, Network, ArrowRight } from 'lucide-react';

interface MathExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToCode?: (file: string) => void;
}

export const MathExplainerModal: React.FC<MathExplainerModalProps> = ({
  isOpen,
  onClose,
  onJumpToCode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Mathematical Architecture & Theory</h2>
              <p className="text-xs text-slate-400">
                Synthesis of ZainCheema BLE Math + Kindona Graph Pathfinding
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

        {/* Content body */}
        <div className="overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
          {/* Card 1: Log-Distance Path Loss Model */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-400" />
                1. Log-Distance Path Loss Model (RSSI to Distance)
              </h3>
              <span className="text-[11px] font-mono text-cyan-400">ZainCheema Engine</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Models electromagnetic signal attenuation across indoor air and walls:
            </p>
            <div className="p-3 rounded-lg bg-slate-900 font-mono text-cyan-300 text-center text-sm border border-slate-800/80 my-2">
              d = 10 ^ ((TxPower - RSSI) / (10 * n))
            </div>
            <div className="text-xs text-slate-400 space-y-1 mt-2">
              <div><strong className="text-slate-200">TxPower (A):</strong> Measured RSSI at 1 meter calibration distance (typically -59 to -65 dBm).</div>
              <div><strong className="text-slate-200">n (Path Loss Exponent):</strong> Environmental obstacle factor: 2.0 (free space), 2.2 (line-of-sight hallway), 2.8 - 3.5 (dense walls/cubicles).</div>
            </div>
          </div>

          {/* Card 2: 1D Kalman Filter */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                2. 1D Kalman Filter (Multipath Noise Suppression)
              </h3>
              <span className="text-[11px] font-mono text-emerald-400">ZainCheema Engine</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Eliminates high-frequency multipath fading spikes from incoming raw RSSI readings without adding lag:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-emerald-300">
                <div className="text-slate-400 text-[10px] uppercase mb-1">Prediction Phase</div>
                <div>P_pred = P + Q</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-emerald-300">
                <div className="text-slate-400 text-[10px] uppercase mb-1">Kalman Gain & Update</div>
                <div>K = P_pred / (P_pred + R)</div>
                <div>x = x + K * (measurement - x)</div>
                <div>P = (1 - K) * P_pred</div>
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Tunables: <code className="text-slate-200 font-mono">Q = 0.012</code> (process noise covariance), <code className="text-slate-200 font-mono">R = 2.0</code> (measurement sensor noise).
            </div>
          </div>

          {/* Card 3: Non-Linear Least-Squares Trilateration */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Network className="w-4 h-4 text-amber-400" />
                3. Linearized Matrix Trilateration
              </h3>
              <span className="text-[11px] font-mono text-amber-400">2D Matrix Solver</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Subtracting the equation of Beacon 1 from Beacons 2 and 3 linearizes the circle intersection system into Ax = b:
            </p>
            <div className="p-3 rounded-lg bg-slate-900 font-mono text-amber-300 text-xs border border-slate-800/80 overflow-x-auto">
              [ 2(x₂ - x₁)   2(y₂ - y₁) ] [ x ]   [ r₁² - r₂² + x₂² - x₁² + y₂² - y₁² ]
              <br />
              [ 2(x₃ - x₁)   2(y₃ - y₁) ] [ y ] = [ r₁² - r₃² + x₃² - x₁² + y₃² - y₁² ]
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Solved instantaneously in O(1) time using Cramer's rule / 2x2 determinant inversion. In degenerate collinear cases, the engine seamlessly falls back to inverse-distance weighted centroids.
            </p>
          </div>

          {/* Card 4: PDR Step Detection & Weinberg Model */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-pink-400" />
                4. Pedestrian Dead Reckoning (PDR) & Weinberg Model
              </h3>
              <span className="text-[11px] font-mono text-pink-400">Inertial Sensors</span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Euclidean magnitude <code className="text-slate-200 font-mono">||a|| = √(ax² + ay² + az²)</code> is smoothed with an EMA low-pass filter. Steps are detected via peak/valley amplitude thresholding with a 280ms refractory lockout. Step length is estimated dynamically using Weinberg's model:
            </p>
            <div className="p-3 rounded-lg bg-slate-900 font-mono text-pink-300 text-center text-xs border border-slate-800/80 my-2">
              StepLength = K * (a_max - a_min)^(1/4)
            </div>
            <p className="text-xs text-slate-400">
              Displacement is integrated using magnetometer heading: <code className="text-slate-200 font-mono">dx = L * sin(θ), dy = -L * cos(θ)</code>.
            </p>
          </div>

          {/* Card 5: Kindona Building Graph & A* */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                5. Kindona Building Graph & A* Shortest Path
              </h3>
              <span className="text-[11px] font-mono text-cyan-400">it-at-m/Kindona</span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Represents rooms, doors, and corridors as weighted topological graph nodes. Computes shortest path via A*:
            </p>
            <div className="p-3 rounded-lg bg-slate-900 font-mono text-cyan-300 text-center text-xs border border-slate-800/80 my-2">
              f(n) = g(n) + h(n)  where  h(n) = ||position(n) - position(target)||
            </div>
            <p className="text-xs text-slate-400">
              Turns are calculated by computing the relative angle between consecutive vector segments: if <code className="text-slate-200 font-mono">Δθ &gt; 40°</code> trigger "Turn right", if <code className="text-slate-200 font-mono">Δθ &lt; -40°</code> trigger "Turn left", else "Continue straight".
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            All algorithms are fully implemented in the Dart files.
          </span>
          <button
            onClick={() => {
              onClose();
              if (onJumpToCode) onJumpToCode('lib/services/location_fusion_service.dart');
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
          >
            Inspect Fusion Service Code <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
