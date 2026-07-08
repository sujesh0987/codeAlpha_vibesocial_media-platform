import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { Home, Compass, User, LogOut, Sparkles, MessageCircle } from 'lucide-react';

interface NavbarProps {
  currentUserProfile: UserProfile | null;
  activeTab: 'feed' | 'explore' | 'profile';
  setActiveTab: (tab: 'feed' | 'explore' | 'profile') => void;
  onViewOwnProfile: () => void;
}

export default function Navbar({ currentUserProfile, activeTab, setActiveTab, onViewOwnProfile }: NavbarProps) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-indigo-100 bg-white/75 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => setActiveTab('feed')}
        >
          <div className="h-10 w-10 vibrant-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-105 transition">
            <span className="font-black text-xl">V</span>
          </div>
          <span className="font-black text-xl tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            VibeSocial
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            id="nav-feed-tab"
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-600'
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Feed</span>
          </button>

          <button
            id="nav-explore-tab"
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'explore'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-600'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Explore</span>
          </button>

          <button
            id="nav-profile-tab"
            onClick={onViewOwnProfile}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-600'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Profile</span>
          </button>
        </nav>

        {/* User Dropdown & Sign Out */}
        {currentUserProfile && (
          <div className="flex items-center gap-3">
            <div 
              onClick={onViewOwnProfile}
              className="flex items-center gap-2 bg-indigo-50/50 hover:bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100/40 cursor-pointer transition"
            >
              <img
                src={currentUserProfile.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                alt={currentUserProfile.username}
                className="h-7 w-7 rounded-full object-cover ring-2 ring-indigo-300"
                referrerPolicy="no-referrer"
              />
              <span className="hidden md:inline text-xs font-bold text-indigo-950">
                @{currentUserProfile.username}
              </span>
            </div>

            <button
              id="nav-logout-btn"
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}

      </div>
    </header>
  );
}
