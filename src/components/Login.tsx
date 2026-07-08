import React, { useState } from 'react';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType,
  signInWithPopup, 
  GoogleAuthProvider,
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from '../firebase';
import { motion } from 'motion/react';
import { LogIn, Sparkles, User, FileText, Camera, ArrowRight, Loader2, Upload, X, Image } from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
];

interface LoginProps {
  onProfileCreated: () => void;
}

export default function Login({ onProfileCreated }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [error, setError] = useState('');
  
  // Profile Setup State
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [tempUser, setTempUser] = useState<any>(null);
  const [avatarInputMethod, setAvatarInputMethod] = useState<'upload' | 'preset' | 'url'>('preset');
  const [avatarFilePreview, setAvatarFilePreview] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user profile already exists
      const userDocRef = doc(db, 'users', user.uid);
      let userDoc;
      try {
        userDoc = await getDoc(userDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (userDoc && userDoc.exists()) {
        // Profile exists, we are done
        onProfileCreated();
      } else {
        // Needs setup
        setTempUser(user);
        // Default username from display name (alphanumeric only, lowercase)
        const suggestedUsername = (user.displayName || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        setUsername(suggestedUsername);
        setNeedsProfileSetup(true);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const checkUsernameExists = async (name: string): Promise<boolean> => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', name.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
      return false;
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedAvatar('');
    setCustomAvatarUrl('');
    setError('');

    // Pre-flight size check
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Please select an avatar under 10MB.');
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
            setError('Could not process avatar image');
          }
        } catch (err: any) {
          console.error(err);
          setError('Error processing avatar: ' + (err.message || err));
        }
      };
      img.onerror = () => {
        setError('Invalid image file structure');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;
    
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setError('Username can only contain lowercase letters, numbers, and underscores.');
      return;
    }

    setLoading(true);
    setError('');
    setCheckingUsername(true);

    try {
      // Check for username uniqueness
      const exists = await checkUsernameExists(cleanUsername);
      setCheckingUsername(false);
      if (exists) {
        setError('This username is already taken. Please try another one.');
        setLoading(false);
        return;
      }

      const avatar = avatarFilePreview || customAvatarUrl.trim() || selectedAvatar;
      const userProfile = {
        id: tempUser.uid,
        username: cleanUsername,
        email: tempUser.email || '',
        bio: bio.trim(),
        profilePic: avatar,
        createdAt: serverTimestamp(),
        followingCount: 0,
        followersCount: 0
      };

      const userDocRef = doc(db, 'users', tempUser.uid);
      try {
        await setDoc(userDocRef, userProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${tempUser.uid}`);
      }

      onProfileCreated();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while saving your profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EEF2FF] px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-[32px] shadow-2xl border border-indigo-50">
        
        {!needsProfileSetup ? (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mx-auto h-16 w-16 vibrant-gradient flex items-center justify-center rounded-[20px] text-white shadow-lg shadow-indigo-100"
            >
              <Sparkles className="h-8 w-8" />
            </motion.div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-black font-sans tracking-tight text-slate-800">
                Welcome to VibeSocial
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto font-medium leading-relaxed">
                A gorgeous, real-time social space to share moments, express your thoughts, and build connections.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3.5 rounded-2xl text-left">
                {error}
              </div>
            )}

            <button
              id="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-indigo-100 rounded-full shadow-sm bg-white hover:bg-indigo-50/50 text-xs font-bold uppercase tracking-wider text-slate-700 transition duration-150 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.5-1.14 2.77-2.4 3.61v3h3.86c2.26-2.08 3.57-5.14 3.57-8.67z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.86-3c-1.08.72-2.45 1.16-4.1 1.16-3.15 0-5.81-2.13-6.76-5.01H1.28v3.1A12 12 0 0 0 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.24 14.24c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3v-3.1H1.28A11.943 11.943 0 0 0 0 12c0 1.92.45 3.79 1.28 5.48l3.96-3.1c-.28-.24-.5-.54-.7-.88z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.96 11.96 0 0 0 1.28 6.5l3.96 3.1c.95-2.88 3.61-5.01 6.76-5.01z"
                  />
                </svg>
              )}
              Sign in with Google
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-black tracking-tight text-slate-800">
                Complete your Profile
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Customize your social experience before diving in.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3.5 rounded-2xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-indigo-500" /> Unique Username
                </label>
                <input
                  id="setup-username-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="e.g. johndoe"
                  className="w-full px-4 py-2.5 border border-indigo-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/20"
                />
                <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
                  Only lowercase letters, numbers, and underscores. Min 3 characters.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-indigo-500" /> Bio / About You
                </label>
                <textarea
                  id="setup-bio-input"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  maxLength={160}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-indigo-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/20 resize-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block text-right font-bold">
                  {bio.length}/160 characters
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5 text-indigo-500" /> Profile Picture
                </label>
                
                {/* Avatar Tabs */}
                <div className="flex gap-2 mb-3 border-b border-indigo-100/50 pb-2">
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
                        : 'text-slate-400 hover:text-indigo-600 bg-indigo-50/20'
                    }`}
                  >
                    Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarInputMethod('upload');
                      setSelectedAvatar('');
                      setCustomAvatarUrl('');
                    }}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition cursor-pointer ${
                      avatarInputMethod === 'upload'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-indigo-600 bg-indigo-50/20'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarInputMethod('url');
                      setSelectedAvatar('');
                      setAvatarFilePreview(null);
                    }}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition cursor-pointer ${
                      avatarInputMethod === 'url'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-indigo-600 bg-indigo-50/20'
                    }`}
                  >
                    Custom URL
                  </button>
                </div>

                {avatarInputMethod === 'preset' && (
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedAvatar(url);
                          setCustomAvatarUrl('');
                          setAvatarFilePreview(null);
                        }}
                        className={`relative aspect-square rounded-full overflow-hidden border-2 cursor-pointer transition-all ${
                          selectedAvatar === url && !customAvatarUrl && !avatarFilePreview
                            ? 'border-indigo-500 scale-105 shadow-md ring-2 ring-indigo-200'
                            : 'border-transparent hover:scale-105'
                        }`}
                      >
                        <img src={url} alt={`Avatar Preset ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                )}

                {avatarInputMethod === 'upload' && (
                  <div className="space-y-3 mb-3">
                    <div className="flex items-center justify-center w-full">
                      <label 
                        htmlFor="setup-avatar-file-upload" 
                        className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-indigo-100 rounded-2xl cursor-pointer bg-indigo-50/5 hover:bg-indigo-50/15 transition duration-150"
                      >
                        <div className="flex flex-col items-center justify-center pt-3 pb-3">
                          <Upload className="h-5 w-5 text-indigo-400 mb-1 animate-bounce" />
                          <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">
                            {avatarFilePreview ? 'Change Selected Avatar' : 'Select local image'}
                          </p>
                        </div>
                        <input 
                          id="setup-avatar-file-upload" 
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
                    id="setup-custom-avatar-input"
                    type="url"
                    value={customAvatarUrl}
                    onChange={(e) => {
                      setCustomAvatarUrl(e.target.value);
                      setSelectedAvatar('');
                      setAvatarFilePreview(null);
                    }}
                    placeholder="Or paste a custom image URL..."
                    className="w-full px-4 py-2 border border-indigo-100 rounded-2xl text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/20"
                  />
                )}
              </div>

              <button
                id="setup-save-btn"
                type="submit"
                disabled={loading || checkingUsername}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-lg shadow-indigo-100 transition duration-150 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {checkingUsername ? 'Checking Username...' : 'Creating Profile...'}
                  </>
                ) : (
                  <>
                    Launch My Profile <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
