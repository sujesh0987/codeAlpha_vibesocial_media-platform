import React, { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged, doc, getDoc } from './firebase';
import { UserProfile, Post } from './types';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Feed from './components/Feed';
import Explore from './components/Explore';
import ProfileView from './components/ProfileView';
import PostDetail from './components/PostDetail';
import { Sparkles, MessageSquare, Heart, Compass, LogOut } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'explore' | 'profile'>('feed');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null); // For viewing others' profiles
  const [selectedPost, setSelectedPost] = useState<Post | null>(null); // For post detail view

  // 1. Subscribe to Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserProfile(currentUser.uid);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch or refresh the current user's profile from Firestore
  const fetchUserProfile = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile({
          id: docSnap.id,
          username: data.username,
          email: data.email,
          bio: data.bio || '',
          profilePic: data.profilePic || '',
          createdAt: data.createdAt,
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0
        });
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error("Error retrieving user profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshProfile = () => {
    if (user) {
      fetchUserProfile(user.uid);
    }
  };

  // Switch tab and view another user's profile
  const handleViewUserProfile = (uid: string) => {
    setSelectedUserId(uid);
    setActiveTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // View own profile
  const handleViewOwnProfile = () => {
    if (user) {
      setSelectedUserId(user.uid);
      setActiveTab('profile');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Trigger single post detail view modal
  const handleViewPostDetails = (post: Post) => {
    setSelectedPost(post);
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF2FF] flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [0.95, 1.05, 0.95] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="h-16 w-16 vibrant-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200"
        >
          <Sparkles className="h-8 w-8" />
        </motion.div>
        <p className="text-sm font-extrabold text-slate-800 tracking-tight mt-4">Connecting to VibeSocial...</p>
        <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Powering security authentications & database structures</p>
      </div>
    );
  }

  // Not logged in or has no finished profile document
  if (!user || !userProfile) {
    return (
      <Login 
        onProfileCreated={() => {
          if (auth.currentUser) {
            setLoading(true);
            fetchUserProfile(auth.currentUser.uid);
          }
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF2FF] text-slate-800 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <Navbar 
        currentUserProfile={userProfile}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'profile') {
            setSelectedUserId(null); // Clear selected user profile when navigating away
          }
        }}
        onViewOwnProfile={handleViewOwnProfile}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 md:py-8">
        
        <div className="space-y-6">
          {activeTab === 'feed' && (
            <Feed 
              currentUserProfile={userProfile}
              onViewUserProfile={handleViewUserProfile}
              onViewPostDetails={handleViewPostDetails}
            />
          )}

          {activeTab === 'explore' && (
            <Explore 
              currentUserProfile={userProfile}
              onRefreshCurrentUserProfile={handleRefreshProfile}
              onViewUserProfile={handleViewUserProfile}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView 
              userId={selectedUserId || userProfile.id}
              currentUserProfile={userProfile}
              onRefreshCurrentUserProfile={handleRefreshProfile}
              onViewUserProfile={handleViewUserProfile}
              onViewPostDetails={handleViewPostDetails}
            />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-indigo-100 bg-white/70 backdrop-blur-md text-center text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-12">
        <div className="max-w-2xl mx-auto px-4 space-y-1">
          <p>© 2026 VibeSocial Inc.</p>
          <p className="normal-case tracking-normal font-semibold text-slate-400">
            Powered by Firebase Auth & Google Cloud Firestore
          </p>
        </div>
      </footer>

      {/* Single Post Detail Modal */}
      {selectedPost && (
        <PostDetail 
          post={selectedPost}
          currentUserId={userProfile.id}
          currentUsername={userProfile.username}
          currentUserPic={userProfile.profilePic || ''}
          onClose={() => setSelectedPost(null)}
          onViewUserProfile={handleViewUserProfile}
        />
      )}

    </div>
  );
}
