import React, { useState } from 'react';
import { Compass, ArrowRight, Lock, Mail, User, Building } from 'lucide-react';

interface CleanAuthScreenProps {
  onLoginSuccess: (user: { name: string; role: string; email: string }) => void;
}

export const CleanAuthScreen: React.FC<CleanAuthScreenProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('sarah.jenkins@enterprise.io');
  const [password, setPassword] = useState('password123');
  const [fullName, setFullName] = useState('Sarah Jenkins');
  const [department, setDepartment] = useState('Architecture');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess({
        name: isSignUp ? fullName : 'Sarah Jenkins',
        role: isSignUp ? department : 'Lead Architect',
        email,
      });
    }, 400);
  };

  return (
    <div className="min-h-screen w-full bg-[#070B14] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Soft Ambient Light Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

      {/* Minimalist Glassmorphic Card */}
      <div className="w-full max-w-md bg-[#0F172A]/85 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20 mb-3">
            <div className="w-full h-full bg-[#0F172A] rounded-[14px] flex items-center justify-center">
              <Compass className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Indoor Nav Engine</h1>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp ? 'Create your profile to join building floor plan' : 'Sign in to access live indoor navigation'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex p-1 rounded-xl bg-slate-900/80 border border-slate-800 mb-6 text-xs">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${
              !isSignUp ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${
              isSignUp ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isSignUp && (
            <>
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-[#090D18] border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Department / Role</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Architecture / Engineering"
                    className="w-full bg-[#090D18] border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@enterprise.io"
                className="w-full bg-[#090D18] border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#090D18] border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Join Building Floor Plan' : 'Sign In to Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
