import React, { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Post } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  UserPlus, 
  UserMinus, 
  Calendar, 
  FileText, 
  Edit3, 
  Save, 
  X, 
  Check, 
  Image,
  Sparkles,
  Flame,
  Clock,
  Heart,
  MessageSquare,
  Upload
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
];

interface ProfileViewProps {
  userId: string; // The ID of the profile we want to view
  currentUserProfile: UserProfile;
  onRefreshCurrentUserProfile: () => void;
  onViewUserProfile: (userId: string) => void;
  onViewPostDetails: (post: Post) => void;
}

export default function ProfileView({ 
  userId, 
  currentUserProfile, 
  onRefreshCurrentUserProfile,
  onViewUserProfile,
  onViewPostDetails
}: ProfileViewProps) {
  const isOwnProfile = userId === currentUserProfile.id;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [editError, setEditError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarInputMethod, setAvatarInputMethod] = useState<'upload' | 'preset' | 'url'>('preset');
  const [avatarFilePreview, setAvatarFilePreview] = useState<string | null>(null);

  // 1. Fetch User Profile Doc
  useEffect(() => {
    setLoading(true);
    const userDocRef = doc(db, 'users', userId);
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
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
        setProfile(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('onSnapshot profile error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // 2. Fetch User's Posts
  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Post[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data({ serverTimestamps: 'estimate' });
        list.push({
          id: doc.id,
          userId: data.userId,
          authorName: data.authorName,
          authorPic: data.authorPic,
          content: data.content,
          imageUrl: data.imageUrl,
          createdAt: data.createdAt,
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0
        });
      });
      setUserPosts(list);
    }, (err) => {
      // In case ordered query fails on compound fields, query simpler first or report error gracefully
      console.warn("Unable to order posts chronologically, falling back to unordered lists", err);
      // Fail gracefully: try to fetch without orderBy in case index isn't ready
      const fallbackQuery = query(postsRef, where('userId', '==', userId));
      getDocs(fallbackQuery).then((snapshot) => {
        const list: Post[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data({ serverTimestamps: 'estimate' });
          list.push({
            id: doc.id,
            userId: data.userId,
            authorName: data.authorName,
            authorPic: data.authorPic,
            content: data.content,
            imageUrl: data.imageUrl,
            createdAt: data.createdAt,
            likesCount: data.likesCount || 0,
            commentsCount: data.commentsCount || 0
          });
        });
        setUserPosts(list);
      });
    });

    return () => unsubscribe();
  }, [userId]);

  // 3. Check if current user is following this profile
  useEffect(() => {
    if (isOwnProfile) return;

    const followDocRef = doc(db, 'users', currentUserProfile.id, 'following', userId);
    const unsubscribe = onSnapshot(followDocRef, (docSnap) => {
       setIsFollowing(docSnap.exists());
    }, (err) => {
       console.error('onSnapshot check follow error:', err);
    });

    return () => unsubscribe();
  }, [userId, currentUserProfile.id, isOwnProfile]);

  // Handle Follow/Unfollow Action
  const handleFollowToggle = async () => {
    if (isOwnProfile) return;

    const followingDocRef = doc(db, 'users', currentUserProfile.id, 'following', userId);
    const followersDocRef = doc(db, 'users', userId, 'followers', currentUserProfile.id);
    
    const currentUserRef = doc(db, 'users', currentUserProfile.id);
    const targetUserRef = doc(db, 'users', userId);

    try {
      if (isFollowing) {
        // Unfollow
        await deleteDoc(followingDocRef);
        await deleteDoc(followersDocRef);

        // Update counts
        await updateDoc(currentUserRef, {
          followingCount: increment(-1)
        });
        await updateDoc(targetUserRef, {
          followersCount: increment(-1)
        });
      } else {
        // Follow
        const payload = {
          followerId: currentUserProfile.id,
          followingId: userId,
          createdAt: serverTimestamp()
        };
        await setDoc(followingDocRef, payload);
        await setDoc(followersDocRef, payload);

        // Update counts
        await updateDoc(currentUserRef, {
          followingCount: increment(1)
        });
        await updateDoc(targetUserRef, {
          followersCount: increment(1)
        });
      }
      onRefreshCurrentUserProfile();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUserProfile.id}/following/${userId}`);
    }
  };

  // Open Edit Dialog
  const handleStartEdit = () => {
    if (!profile) return;
    setEditUsername(profile.username);
    setEditBio(profile.bio || '');
    setEditError('');
    setAvatarFilePreview(null);
    
    const isPreset = PRESET_AVATARS.includes(profile.profilePic || '');
    if (isPreset) {
      setEditAvatar(profile.profilePic || PRESET_AVATARS[0]);
      setCustomAvatarUrl('');
      setAvatarInputMethod('preset');
    } else if (profile.profilePic?.startsWith('data:')) {
      setAvatarFilePreview(profile.profilePic);
      setEditAvatar('');
      setCustomAvatarUrl('');
      setAvatarInputMethod('upload');
    } else {
      setEditAvatar('');
      setCustomAvatarUrl(profile.profilePic || '');
      setAvatarInputMethod('url');
    }
    
    setIsEditing(true);
  };

  // Check if username exists (excluding self)
  const checkUsernameExists = async (name: string): Promise<boolean> => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', name.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      // Filter out self
      let exists = false;
      querySnapshot.forEach((doc) => {
        if (doc.id !== currentUserProfile.id) {
          exists = true;
        }
      });
      return exists;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
      return false;
    }
  };

  // Handle avatar file selection and compression
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditAvatar('');
    setCustomAvatarUrl('');
    setEditError('');

    // Pre-flight size check
    if (file.size > 10 * 1024 * 1024) {
      setEditError('File is too large. Please select an avatar under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Target max 200px for avatars (extremely light weight, perfectly sharp in circular displays)
          const MAX_SIZE = 200;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            
            let quality = 0.75;
            let compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            
            // Safe loop to prevent huge payloads
            let iterations = 0;
            while (compressedBase64.length > 250000 && iterations < 5) {
              iterations++;
              width = Math.round(width * 0.8);
              height = Math.round(height * 0.8);
              canvas.width = width;
              canvas.height = height;
              ctx.clearRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              quality = Math.max(0.3, quality - 0.15);
              compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            }

            setAvatarFilePreview(compressedBase64);
          } else {
            setEditError('Could not process avatar image');
          }
        } catch (err: any) {
          console.error(err);
          setEditError('Error processing avatar: ' + (err.message || err));
        }
      };
      img.onerror = () => {
        setEditError('Invalid image file structure');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setEditError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  // Save Edit Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = editUsername.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setEditError('Username must be at least 3 characters long.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setEditError('Username can only contain lowercase letters, numbers, and underscores.');
      return;
    }

    setSavingProfile(true);
    setEditError('');

    try {
      const exists = await checkUsernameExists(cleanUsername);
      if (exists) {
        setEditError('This username is already taken. Please try another.');
        setSavingProfile(false);
        return;
      }

      const avatar = avatarFilePreview || customAvatarUrl.trim() || editAvatar;
      const userRef = doc(db, 'users', currentUserProfile.id);
      
      await updateDoc(userRef, {
        username: cleanUsername,
        bio: editBio.trim(),
        profilePic: avatar
      });

      // Also update author info on posts? Yes, standard is to update on the profile, and we can keep it simple.
      setIsEditing(false);
      onRefreshCurrentUserProfile();
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || 'Failed to save profile updates.');
    } finally {
      setSavingProfile(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Loading date...';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
        <p className="text-xs text-indigo-500 mt-2 font-bold uppercase tracking-wider">Loading user profile details...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 bg-white border border-indigo-50 rounded-[32px] max-w-lg mx-auto shadow-sm">
        <User className="h-10 w-10 text-indigo-200 mx-auto mb-3" />
        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">User not found</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          The requested user profile does not exist or has been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Profile Info Header Card */}
      <div className="bg-white border border-indigo-50 rounded-[32px] p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2.5 vibrant-gradient" />
        
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-4">
          {/* Profile Picture */}
          <img
            src={profile.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
            alt={profile.username}
            className="h-24 w-24 rounded-full object-cover ring-4 ring-indigo-50 shadow-md"
            referrerPolicy="no-referrer"
          />

          {/* Core Profile Details */}
          <div className="flex-1 text-center sm:text-left space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  @{profile.username}
                </h2>
                <p className="text-[10px] text-slate-400 flex items-center justify-center sm:justify-start gap-1 font-bold uppercase tracking-wider mt-1">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  Joined {formatDate(profile.createdAt)}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center sm:justify-end gap-2">
                {isOwnProfile ? (
                  <button
                    id="edit-profile-btn"
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full transition border-0 cursor-pointer shadow-3xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Profile
                  </button>
                ) : (
                  <button
                    id="follow-toggle-btn"
                    onClick={handleFollowToggle}
                    className={`flex items-center gap-1.5 px-5 py-2 font-bold text-xs rounded-full transition cursor-pointer shadow-sm ${
                      isFollowing
                        ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="h-3.5 w-3.5" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        Follow User
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Profile Bio */}
            <p className="text-xs text-slate-600 leading-relaxed max-w-md font-medium">
              {profile.bio || "No bio specified yet."}
            </p>

            {/* Follow stats */}
            <div className="flex items-center justify-center sm:justify-start gap-6 text-sm text-slate-600 pt-3 border-t border-indigo-50/60">
              <div className="text-center sm:text-left">
                <span className="font-black text-slate-800 text-lg block">{profile.followersCount || 0}</span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Followers</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-black text-slate-800 text-lg block">{profile.followingCount || 0}</span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Following</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-black text-slate-800 text-lg block">{userPosts.length}</span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Posts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal Dialog Overlay */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-[32px] w-full max-w-md p-6 border border-indigo-50 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                  Edit Profile Setup
                </h3>
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="p-1.5 hover:bg-indigo-50 rounded-full text-slate-400 cursor-pointer transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {editError && (
                <div className="bg-rose-50 text-rose-600 text-xs p-3 rounded-2xl border border-rose-100">
                  {editError}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <User className="h-3 w-3 text-indigo-500" /> Alphanumeric Username
                  </label>
                  <input
                    id="edit-username-input"
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full px-4 py-2 border border-indigo-100 bg-indigo-50/10 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400 block mt-1 font-semibold">
                    Only lowercase, numbers, and underscores.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FileText className="h-3 w-3 text-indigo-500" /> Bio details
                  </label>
                  <textarea
                    id="edit-bio-input"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={160}
                    rows={3}
                    className="w-full px-4 py-2 border border-indigo-100 bg-indigo-50/10 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
                  />
                  <span className="text-[9px] text-slate-400 block text-right mt-1 font-bold">
                    {editBio.length}/160 characters
                  </span>
                </div>

                 <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Image className="h-3 w-3 text-indigo-500" /> Select Profile Pic
                  </label>
                  
                  {/* Avatar Tabs */}
                  <div className="flex gap-2 mb-3 border-b border-indigo-50/50 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarInputMethod('preset');
                        setAvatarFilePreview(null);
                        setCustomAvatarUrl('');
                      }}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition cursor-pointer ${
                        avatarInputMethod === 'preset'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-indigo-600 bg-indigo-50/30'
                      }`}
                    >
                      Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarInputMethod('upload');
                        setEditAvatar('');
                        setCustomAvatarUrl('');
                      }}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition cursor-pointer ${
                        avatarInputMethod === 'upload'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-indigo-600 bg-indigo-50/30'
                      }`}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarInputMethod('url');
                        setEditAvatar('');
                        setAvatarFilePreview(null);
                      }}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition cursor-pointer ${
                        avatarInputMethod === 'url'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-indigo-600 bg-indigo-50/30'
                      }`}
                    >
                      Custom URL
                    </button>
                  </div>

                  {avatarInputMethod === 'preset' && (
                    <div className="grid grid-cols-6 gap-2 mb-2">
                      {PRESET_AVATARS.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setEditAvatar(url);
                            setCustomAvatarUrl('');
                            setAvatarFilePreview(null);
                          }}
                          className={`relative aspect-square rounded-full overflow-hidden border-2 cursor-pointer transition ${
                            editAvatar === url && !customAvatarUrl && !avatarFilePreview
                              ? 'border-indigo-500 scale-105 shadow-md ring-2 ring-indigo-200'
                              : 'border-transparent'
                          }`}
                        >
                          <img src={url} alt="Preset avatar preview" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {avatarInputMethod === 'upload' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center w-full">
                        <label 
                          htmlFor="avatar-image-file-upload" 
                          className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-indigo-100 rounded-2xl cursor-pointer bg-indigo-50/5 hover:bg-indigo-50/15 transition duration-150"
                        >
                          <div className="flex flex-col items-center justify-center pt-3 pb-3">
                            <Upload className="h-5 w-5 text-indigo-400 mb-1 animate-bounce" />
                            <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">
                              {avatarFilePreview ? 'Change Selected Avatar' : 'Select local image'}
                            </p>
                          </div>
                          <input 
                            id="avatar-image-file-upload" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleAvatarFileChange}
                          />
                        </label>
                      </div>
                      {avatarFilePreview && (
                        <div className="relative inline-block">
                          <div className="rounded-full overflow-hidden h-16 w-16 border-2 border-indigo-100 shadow-md">
                            <img src={avatarFilePreview} alt="Avatar preview" className="w-full h-full object-cover" />
                          </div>
                          <button 
                            type="button"
                            onClick={() => setAvatarFilePreview(null)} 
                            className="absolute -top-1 -right-1 bg-rose-500 text-white p-0.5 rounded-full hover:bg-rose-600 transition shadow-xs cursor-pointer"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {avatarInputMethod === 'url' && (
                    <input
                      id="edit-custom-avatar-url"
                      type="url"
                      value={customAvatarUrl}
                      onChange={(e) => {
                        setCustomAvatarUrl(e.target.value);
                        setEditAvatar('');
                        setAvatarFilePreview(null);
                      }}
                      placeholder="Or paste an image URL..."
                      className="w-full px-4 py-2 border border-indigo-100 bg-indigo-50/10 rounded-2xl text-[11px] focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                  )}
                </div>

                <div className="flex gap-2 justify-end border-t border-indigo-50 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full cursor-pointer transition border-0"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-profile-btn"
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-lg shadow-indigo-100 cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User's Created Posts section */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest pb-1 border-b border-indigo-100">
          User's Activity Posts
        </h3>

        {userPosts.length === 0 ? (
          <div className="text-center py-16 bg-white border border-indigo-50 rounded-[32px] shadow-xs">
            <Flame className="h-10 w-10 text-indigo-200 mx-auto mb-3" />
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">No posts shared yet</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">All posts written by this user will display here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userPosts.map((post) => (
              <div 
                key={post.id} 
                className="bg-white border border-indigo-50 rounded-[32px] p-6 shadow-sm hover:border-indigo-100 hover:shadow-md transition duration-200 cursor-pointer"
                onClick={() => onViewPostDetails(post)}
              >
                <div className="flex items-center gap-1.5 mb-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{formatDate(post.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-3 leading-relaxed">{post.content}</p>
                {post.imageUrl && (
                  <div className="mt-3 rounded-2xl overflow-hidden max-h-40 bg-slate-50 flex items-center justify-center border border-indigo-50/50">
                    <img src={post.imageUrl} alt="post content preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex gap-4 mt-4 pt-3 border-t border-indigo-50/60 text-[11px] text-slate-500 font-semibold">
                  <span className="flex items-center gap-1 text-pink-600 font-bold"><Heart className="h-3.5 w-3.5 text-pink-500 fill-pink-500" /> {post.likesCount}</span>
                  <span className="flex items-center gap-1 text-indigo-600 font-bold"><MessageSquare className="h-3.5 w-3.5 text-indigo-500" /> {post.commentsCount} comments</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
