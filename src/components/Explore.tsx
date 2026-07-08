import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc, increment, limit, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { Users, UserCheck, UserPlus, Sparkles, MessageCircle, Heart } from 'lucide-react';

interface ExploreProps {
  currentUserProfile: UserProfile;
  onRefreshCurrentUserProfile: () => void;
  onViewUserProfile: (userId: string) => void;
}

export default function Explore({ currentUserProfile, onRefreshCurrentUserProfile, onViewUserProfile }: ExploreProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<{ [userId: string]: boolean }>({});

  // 1. Fetch all users
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          username: data.username,
          email: data.email,
          bio: data.bio || '',
          profilePic: data.profilePic || '',
          createdAt: data.createdAt,
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0
        });
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error('onSnapshot users error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Track who the current user is following
  useEffect(() => {
    const followingRef = collection(db, 'users', currentUserProfile.id, 'following');
    
    const unsubscribe = onSnapshot(followingRef, (snapshot) => {
      const map: { [userId: string]: boolean } = {};
      snapshot.forEach((doc) => {
        map[doc.id] = true;
      });
      setFollowingIds(map);
    }, (err) => {
      console.error('onSnapshot following error:', err);
    });

    return () => unsubscribe();
  }, [currentUserProfile.id]);

  // Follow/Unfollow Action
  const handleFollowToggle = async (userId: string) => {
    const isCurrentlyFollowing = followingIds[userId];
    const followingDocRef = doc(db, 'users', currentUserProfile.id, 'following', userId);
    const followersDocRef = doc(db, 'users', userId, 'followers', currentUserProfile.id);
    
    const currentUserRef = doc(db, 'users', currentUserProfile.id);
    const targetUserRef = doc(db, 'users', userId);

    try {
      if (isCurrentlyFollowing) {
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

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
        <p className="text-xs text-indigo-500 mt-2 font-bold uppercase tracking-wider">Discovering community members...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-indigo-100 pb-4">
        <div className="p-2.5 vibrant-gradient text-white rounded-[16px] shadow-lg shadow-indigo-200">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Explore Accounts</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Discover new creators and expand your social vibe network.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map((user) => {
          const isMe = user.id === currentUserProfile.id;
          const isFollowing = followingIds[user.id];

          return (
            <motion.div
              key={user.id}
              whileHover={{ y: -1 }}
              className="bg-white border border-indigo-50 rounded-[32px] p-5 shadow-sm flex items-start gap-4 transition duration-200 hover:shadow-md"
            >
              {/* Profile Avatar */}
              <img
                src={user.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                alt={user.username}
                onClick={() => onViewUserProfile(user.id)}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-indigo-100 cursor-pointer hover:opacity-90 transition shadow-2xs"
                referrerPolicy="no-referrer"
              />

              {/* User Bio and Stats */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <h3 
                    onClick={() => onViewUserProfile(user.id)}
                    className="text-xs font-bold text-slate-800 hover:text-indigo-600 cursor-pointer truncate"
                  >
                    @{user.username}
                  </h3>
                  
                  {isMe ? (
                    <span className="text-[9px] bg-indigo-50 text-indigo-600 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      You
                    </span>
                  ) : (
                    <button
                      id={`explore-follow-${user.id}`}
                      onClick={() => handleFollowToggle(user.id)}
                      className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full transition cursor-pointer ${
                        isFollowing
                          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="h-3 w-3" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3 w-3" />
                          Follow
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-2 min-h-[32px] leading-relaxed">
                  {user.bio || "No bio specified yet."}
                </p>

                {/* Followers and Following count stats */}
                <div className="flex items-center gap-4 text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider">
                  <span>{user.followersCount || 0} followers</span>
                  <span>{user.followingCount || 0} following</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
