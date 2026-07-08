import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  getDoc,
  setDoc,
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  increment,
  writeBatch,
  getDocs,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Post, Comment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageSquare, 
  Trash2, 
  Image, 
  Send, 
  Clock, 
  AlertCircle, 
  ThumbsUp, 
  Flame, 
  X,
  Edit2,
  Check,
  Upload,
  Sparkles,
  Users,
  UserPlus,
  UserCheck
} from 'lucide-react';
import { DUMMY_USERS } from '../seedData';

interface FeedProps {
  currentUserProfile: UserProfile;
  onViewUserProfile: (userId: string) => void;
  onViewPostDetails: (post: Post) => void;
}

export default function Feed({ currentUserProfile, onViewUserProfile, onViewPostDetails }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<'all' | 'following'>('all');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  
  // Post Creation State
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [posting, setPosting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const seedingRef = useRef(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageInputMethod, setImageInputMethod] = useState<'upload' | 'url'>('upload');
  const [postAuthorId, setPostAuthorId] = useState<string>('me');

  // Handle Seeding of Database via Frontend
  const handleInAppSeed = async () => {
    if (seedingRef.current) return;
    seedingRef.current = true;
    setSeeding(true);
    setError('');
    try {
      const { DUMMY_USERS: seedUsers, DUMMY_POSTS: seedPosts } = await import('../seedData');
      const now = Date.now();

      // 1. Create all 8 mock users in the database
      for (const user of seedUsers) {
        const userDocRef = doc(db, 'users', user.id);
        const createdTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
        await setDoc(userDocRef, {
          username: user.username,
          email: user.email,
          bio: user.bio,
          profilePic: user.profilePic,
          createdAt: createdTime,
          followersCount: user.followersCount,
          followingCount: user.followingCount
        });
      }

      // 2. Create all 17 mock posts in the database
      for (const post of seedPosts) {
        const author = seedUsers.find(u => u.id === post.authorId);
        if (!author) continue;

        const postTime = new Date(now - post.daysAgo * 24 * 60 * 60 * 1000);
        await addDoc(collection(db, 'posts'), {
          userId: author.id,
          authorName: author.username,
          authorPic: author.profilePic,
          content: post.content,
          imageUrl: post.imageUrl,
          createdAt: postTime,
          likesCount: 0,
          commentsCount: 0
        });
      }
    } catch (err: any) {
      console.error(err);
      setError('Seed failed: ' + (err.message || err));
      seedingRef.current = false;
    } finally {
      setSeeding(false);
    }
  };

  // Editing Post State
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Active User Likes (Tracked client-side per post)
  const [likedPostIds, setLikedPostIds] = useState<{ [postId: string]: boolean }>({});

  // Inline Comment states per post
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<{ [postId: string]: Comment[] }>({});
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [submittingComment, setSubmittingComment] = useState<{ [postId: string]: boolean }>({});

  // 1. Fetch Posts via onSnapshot
  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsList: Post[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data({ serverTimestamps: 'estimate' });
        postsList.push({
          id: doc.id,
          userId: data.userId,
          authorName: data.authorName,
          authorPic: data.authorPic,
          content: data.content,
          imageUrl: data.imageUrl,
          createdAt: data.createdAt,
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0,
        });
      });
      setPosts(postsList);
      setLoading(false);
    }, (err) => {
      console.error('onSnapshot posts error:', err);
      setError('Failed to load posts: ' + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-seed database with 8 realistic profiles & 17 social posts under the hood when empty
  useEffect(() => {
    if (!loading && posts.length === 0 && !seedingRef.current) {
      handleInAppSeed();
    }
  }, [loading, posts.length]);

  // 2. Fetch Following IDs to filter "Following" feed
  useEffect(() => {
    const followingRef = collection(db, 'users', currentUserProfile.id, 'following');
    const unsubscribe = onSnapshot(followingRef, (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach((doc) => {
        ids.push(doc.id);
      });
      setFollowingIds(ids);
    }, (err) => {
      console.error('onSnapshot following error:', err);
    });

    return () => unsubscribe();
  }, [currentUserProfile.id]);

  // Suggested Users state
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [suggestedUsersLoading, setSuggestedUsersLoading] = useState(true);

  // Fetch suggested users (limit 15, excluding current user)
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        if (doc.id !== currentUserProfile.id) {
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
        }
      });
      setSuggestedUsers(list);
      setSuggestedUsersLoading(false);
    }, (err) => {
      console.error('Error fetching suggested users:', err);
      setSuggestedUsersLoading(false);
    });
    return () => unsubscribe();
  }, [currentUserProfile.id]);

  // Follow/Unfollow Action from Feed
  const handleFollowToggle = async (userId: string) => {
    const isCurrentlyFollowing = followingIds.includes(userId);
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
    } catch (err: any) {
      console.error('Follow toggle error in feed:', err);
    }
  };

  // 3. Keep track of what posts the active user liked
  useEffect(() => {
    if (posts.length === 0) return;

    // Check likes for each post
    const unsubscribes = posts.map((post) => {
      const likeRef = doc(db, 'posts', post.id, 'likes', currentUserProfile.id);
      return onSnapshot(likeRef, (docSnap) => {
        setLikedPostIds((prev) => ({
          ...prev,
          [post.id]: docSnap.exists()
        }));
      });
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [posts, currentUserProfile.id]);

  // 4. Fetch comments inline when a post is expanded
  useEffect(() => {
    if (!expandedCommentsPostId) return;

    const commentsRef = collection(db, 'posts', expandedCommentsPostId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Comment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data({ serverTimestamps: 'estimate' });
        list.push({
          id: doc.id,
          postId: data.postId,
          userId: data.userId,
          authorName: data.authorName,
          authorPic: data.authorPic,
          content: data.content,
          createdAt: data.createdAt,
        });
      });
      setCommentsMap((prev) => ({
        ...prev,
        [expandedCommentsPostId]: list
      }));
    }, (err) => {
      console.error('onSnapshot comments error:', err);
    });

    return () => unsubscribe();
  }, [expandedCommentsPostId]);

  // Handle local image selection and client-side optimization/resizing
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUrl('');
    setError('');

    // Quick file size sanity check (pre-flight)
    if (file.size > 15 * 1024 * 1024) {
      setError('File is too large. Please select an image under 15MB.');
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

          // Target max resolution 600px for post images (extremely sharp, fits comfortably on mobile and desktop)
          const MAX_SIZE = 600;
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
            
            let quality = 0.7;
            let compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            
            // Loop to ensure size is under 800,000 characters to safely fit within Firestore's 1MiB document limit
            let iterations = 0;
            while (compressedBase64.length > 800000 && iterations < 5) {
              iterations++;
              width = Math.round(width * 0.8);
              height = Math.round(height * 0.8);
              canvas.width = width;
              canvas.height = height;
              ctx.clearRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              quality = Math.max(0.3, quality - 0.1);
              compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            }

            setImagePreview(compressedBase64);
          } else {
            setError('Could not process selected image');
          }
        } catch (err: any) {
          console.error(err);
          setError('Error processing image: ' + (err.message || err));
        }
      };
      img.onerror = () => {
        setError('Invalid image file structure');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  // Handle Post Creation
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setPosting(true);
    setError('');

    try {
      const finalImageUrl = imagePreview || imageUrl.trim() || null;
      
      const postPayload = {
        userId: currentUserProfile.id,
        authorName: currentUserProfile.username,
        authorPic: currentUserProfile.profilePic || '',
        content: content.trim(),
        imageUrl: finalImageUrl,
        createdAt: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0
      };

      const postsRef = collection(db, 'posts');
      await addDoc(postsRef, postPayload);

      setContent('');
      setImageUrl('');
      setImagePreview(null);
      setShowImageInput(false);
      setPostAuthorId('me'); // Reset identity after posting
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  // Generate a random demo post instantly from a random follower/person
  const handleGenerateRandomPost = async () => {
    setPosting(true);
    setError('');
    try {
      // Select a random user
      const randomUser = DUMMY_USERS[Math.floor(Math.random() * DUMMY_USERS.length)];
      
      // Load raw dummy posts or custom extra templates to keep it dynamic
      const customTemplates = [
        {
          content: "Just spent an hour watching the rain stream down the window while coding. 💻🌧️ There's a unique comfort in writing clean functions with a hot mug of matcha tea next to you.",
          imageUrl: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=600&auto=format&fit=crop&q=80"
        },
        {
          content: "Life is too short to drink bad coffee or write bad code. ☕✨ Happy Friday everyone! Let's build something beautiful today.",
          imageUrl: null
        },
        {
          content: "Getting lost in the woods is the best way to find yourself. 🌲🥾 Today's hike offered some spectacular views. Take a step outside and breathe that fresh air!",
          imageUrl: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=600&auto=format&fit=crop&q=80"
        },
        {
          content: "Minimalist workspace setup check! Clean desk, dual monitors, soft warm lighting, and a mechanical keyboard. ⌨️💡 Productivity is a flow state.",
          imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80"
        },
        {
          content: "Reading 'Atomic Habits' again. 📚 'You do not rise to the level of your goals. You fall to the level of your systems.' Such a powerful framing for self-improvement.",
          imageUrl: null
        }
      ];

      const { DUMMY_POSTS } = await import('../seedData');
      const allPosts = [...DUMMY_POSTS, ...customTemplates];
      const randomPostTemplate = allPosts[Math.floor(Math.random() * allPosts.length)];
      
      // Ensure the random user's profile exists
      const userDocRef = doc(db, 'users', randomUser.id);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          username: randomUser.username,
          email: randomUser.email,
          bio: randomUser.bio,
          profilePic: randomUser.profilePic,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          followersCount: randomUser.followersCount,
          followingCount: randomUser.followingCount
        });
      }

      // Add the post
      const postsRef = collection(db, 'posts');
      await addDoc(postsRef, {
        userId: randomUser.id,
        authorName: randomUser.username,
        authorPic: randomUser.profilePic,
        content: randomPostTemplate.content,
        imageUrl: randomPostTemplate.imageUrl || null,
        createdAt: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0
      });

    } catch (err: any) {
      console.error(err);
      setError('Failed to generate random post: ' + (err.message || err));
    } finally {
      setPosting(false);
    }
  };

  // Handle Edit Post Toggle/Save
  const handleEditPost = async (postId: string, currentText: string) => {
    setEditingPostId(postId);
    setEditingContent(currentText);
  };

  const handleSaveEditedPost = async (postId: string) => {
    if (!editingContent.trim()) return;
    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        content: editingContent.trim()
      });
      setEditingPostId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  // Handle Post Deletion
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      const postRef = doc(db, 'posts', postId);
      await deleteDoc(postRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  // Handle Post Like/Unlike Toggle (Atomic transaction helper)
  const handleLikeToggle = async (postId: string) => {
    const isLiked = likedPostIds[postId];
    const likeDocRef = doc(db, 'posts', postId, 'likes', currentUserProfile.id);
    const postRef = doc(db, 'posts', postId);

    try {
      if (isLiked) {
        // Unlike post
        await deleteDoc(likeDocRef);
        await updateDoc(postRef, {
          likesCount: increment(-1)
        });
      } else {
        // Like post
        await setDoc(likeDocRef, {
          postId,
          userId: currentUserProfile.id,
          createdAt: serverTimestamp()
        });
        await updateDoc(postRef, {
          likesCount: increment(1)
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posts/${postId}/likes/${currentUserProfile.id}`);
    }
  };

  // Handle Adding Comment inline
  const handleAddComment = async (postId: string) => {
    const commentText = commentInputs[postId] || '';
    if (!commentText.trim()) return;

    setSubmittingComment(prev => ({ ...prev, [postId]: true }));

    try {
      const commentPayload = {
        postId,
        userId: currentUserProfile.id,
        authorName: currentUserProfile.username,
        authorPic: currentUserProfile.profilePic || '',
        content: commentText.trim(),
        createdAt: serverTimestamp()
      };

      const commentsRef = collection(db, 'posts', postId, 'comments');
      await addDoc(commentsRef, commentPayload);

      // Increment comments count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });

      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posts/${postId}/comments`);
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Handle Comment Deletion
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm('Delete comment?')) return;

    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      await deleteDoc(commentRef);

      // Decrement comments count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentsCount: increment(-1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
    }
  };

  // Filter Posts
  const filteredPosts = posts.filter((post) => {
    if (feedType === 'all') return true;
    // Show followed users + own posts
    return followingIds.includes(post.userId) || post.userId === currentUserProfile.id;
  });

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      
      {/* Create Post Card */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-[32px] border border-indigo-50 shadow-sm space-y-5"
      >
        <div className="flex gap-4">
          <img
            src={currentUserProfile.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
            alt="Profile avatar"
            className="h-12 w-12 rounded-full object-cover ring-2 ring-indigo-100 shrink-0 transition-all duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1">
            <textarea
              id="new-post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What is happening? Share a beautiful vibe..."
              rows={3}
              maxLength={1000}
              className="w-full resize-none border-0 focus:ring-0 p-1 text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Optional Image Input Slider */}
        <AnimatePresence>
          {showImageInput && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-indigo-50/60 pt-4 space-y-4"
            >
              {/* Tab Selector */}
              <div className="flex gap-2 border-b border-indigo-50/50 pb-2">
                <button
                  type="button"
                  onClick={() => setImageInputMethod('upload')}
                  className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition cursor-pointer ${
                    imageInputMethod === 'upload'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-indigo-600 bg-indigo-50/30'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMethod('url')}
                  className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition cursor-pointer ${
                    imageInputMethod === 'url'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-indigo-600 bg-indigo-50/30'
                  }`}
                >
                  Image URL
                </button>
              </div>

              {imageInputMethod === 'upload' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-full">
                    <label 
                      htmlFor="post-image-file-upload" 
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-indigo-100 rounded-[24px] cursor-pointer bg-indigo-50/5 hover:bg-indigo-50/20 transition duration-150"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-6 w-6 text-indigo-400 mb-2 animate-bounce" />
                        <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">
                          {imagePreview ? 'Change Selected Image' : 'Select local image file'}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">
                          PNG, JPG, GIF up to 10MB (will be auto-optimized)
                        </p>
                      </div>
                      <input 
                        id="post-image-file-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageFileChange}
                      />
                    </label>
                  </div>
                  {imagePreview && (
                    <div className="relative inline-block mt-1">
                      <div className="rounded-2xl overflow-hidden h-28 w-44 border border-indigo-100 shadow-inner">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setImagePreview(null)} 
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white p-1 rounded-full hover:bg-rose-600 transition shadow-md cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-indigo-400 shrink-0" />
                    <input
                      id="new-post-image-url"
                      type="url"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setImagePreview(null); // Clear upload preview if URL is manually edited
                      }}
                      placeholder="Paste image URL (e.g. unsplash link)..."
                      className="flex-1 px-4 py-2 border border-indigo-100 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/10"
                    />
                    {imageUrl && (
                      <button 
                        type="button"
                        onClick={() => setImageUrl('')} 
                        className="p-1.5 hover:bg-indigo-50 rounded-full text-indigo-400 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {imageUrl && (
                    <div className="mt-3 rounded-2xl overflow-hidden h-28 w-44 border border-indigo-100 shadow-inner">
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>



        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-2xl flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-indigo-50/60 pt-4">
          <button
            id="toggle-image-input"
            type="button"
            onClick={() => setShowImageInput(!showImageInput)}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full transition cursor-pointer ${
              showImageInput 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'text-slate-500 hover:bg-indigo-50/50 hover:text-indigo-600'
            }`}
          >
            <Image className="h-4 w-4" />
            <span>Add Photo/Image</span>
          </button>

          <button
            id="publish-post-btn"
            onClick={handleCreatePost}
            disabled={posting || !content.trim()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-full transition shadow-lg shadow-indigo-100 hover:shadow-indigo-200 disabled:opacity-50 cursor-pointer"
          >
            {posting ? 'Posting...' : 'Share Post'}
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Suggested Vibe Creators */}
      <div className="bg-white border border-indigo-50 rounded-[32px] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Suggested Creators</h3>
          </div>
          {suggestedUsers.length === 0 && !seeding && (
            <button
              onClick={handleInAppSeed}
              className="flex items-center gap-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-extrabold px-3 py-1 rounded-full transition cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>Load Seed Profiles</span>
            </button>
          )}
        </div>

        {seeding ? (
          <div className="text-center py-4 flex flex-col items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent"></div>
            <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Generating beautiful profiles & feeds...</p>
          </div>
        ) : suggestedUsers.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-indigo-100 rounded-2xl bg-indigo-50/5">
            <p className="text-xs text-slate-400 font-medium">No other profiles in the database yet.</p>
            <button
              onClick={handleInAppSeed}
              className="mt-3 inline-flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-full shadow-md shadow-indigo-100 cursor-pointer transition"
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span>Populate All 8 Profiles & 17 Posts</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent">
            {suggestedUsers.map((user) => {
              const isFollowing = followingIds.includes(user.id);
              return (
                <div 
                  key={user.id} 
                  className="flex flex-col items-center p-3 border border-indigo-50 rounded-2xl hover:border-indigo-100 bg-indigo-50/5 hover:bg-indigo-50/10 transition-all text-center min-w-[125px] flex-shrink-0"
                >
                  <div 
                    onClick={() => onViewUserProfile(user.id)}
                    className="cursor-pointer hover:opacity-90 transition relative"
                  >
                    <img
                      src={user.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                      alt={user.username}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-50"
                      referrerPolicy="no-referrer"
                    />
                    {isFollowing && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 text-white p-0.5 rounded-full ring-2 ring-white">
                        <UserCheck className="h-2 w-2" />
                      </span>
                    )}
                  </div>
                  <h4 
                    onClick={() => onViewUserProfile(user.id)}
                    className="text-[11px] font-bold text-slate-800 mt-2 truncate max-w-[110px] cursor-pointer hover:text-indigo-600"
                  >
                    @{user.username}
                  </h4>
                  <p className="text-[9px] text-slate-400 font-medium truncate max-w-[110px] mb-2.5">
                    {user.bio || 'Vibe explorer'}
                  </p>
                  <button
                    onClick={() => handleFollowToggle(user.id)}
                    className={`w-full py-1.5 rounded-xl text-[9px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      isFollowing
                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="h-2.5 w-2.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-2.5 w-2.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feed Filters */}
      <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
        <div className="flex gap-2">
          <button
            id="feed-type-all-btn"
            onClick={() => setFeedType('all')}
            className={`px-4 py-2 text-xs font-bold rounded-full transition cursor-pointer ${
              feedType === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-500 border border-indigo-50 hover:bg-indigo-50/50'
            }`}
          >
            All Posts
          </button>
          <button
            id="feed-type-following-btn"
            onClick={() => setFeedType('following')}
            className={`px-4 py-2 text-xs font-bold rounded-full transition cursor-pointer ${
              feedType === 'following'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-500 border border-indigo-50 hover:bg-indigo-50/50'
            }`}
          >
            Following ({followingIds.length})
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
            {filteredPosts.length} post{filteredPosts.length !== 1 && 's'}
          </span>
        </div>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-xs text-indigo-500 mt-2 font-bold uppercase tracking-wider">Loading social feed...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center bg-white border border-indigo-50 rounded-[32px] py-16 px-6 shadow-sm">
          <Flame className="h-12 w-12 text-indigo-200 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">No posts to display</h3>
          <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
            {feedType === 'following' 
              ? "You aren't following anyone yet or they haven't posted. Try exploring users to follow some vibe accounts!"
              : "Be the first one to post a beautiful thought!"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPosts.map((post) => {
            const isLiked = likedPostIds[post.id];
            const isOwnPost = post.userId === currentUserProfile.id;
            const isEditing = editingPostId === post.id;

            return (
              <motion.article
                key={post.id}
                layout
                className="bg-white border border-indigo-50 rounded-[32px] p-6 shadow-sm space-y-4 hover:shadow-md transition duration-200"
              >
                {/* Post Header */}
                <div className="flex items-start justify-between">
                  <div 
                    onClick={() => onViewUserProfile(post.userId)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <img
                      src={post.authorPic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                      alt={post.authorName}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-100 group-hover:ring-indigo-300 transition"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition">
                        @{post.authorName}
                      </h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDate(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Delete/Edit) */}
                  {isOwnPost && (
                    <div className="flex items-center gap-1.5">
                      {!isEditing ? (
                        <>
                          <button
                            id={`edit-post-${post.id}`}
                            onClick={() => handleEditPost(post.id, post.content)}
                            title="Edit Post"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            id={`delete-post-${post.id}`}
                            onClick={() => handleDeletePost(post.id)}
                            title="Delete Post"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSaveEditedPost(post.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-full transition cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingPostId(null)}
                            className="p-1.5 text-slate-400 hover:bg-indigo-50 rounded-full transition cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-4">
                  {isEditing ? (
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={2}
                      className="w-full text-xs border border-indigo-100 bg-indigo-50/10 rounded-2xl p-3 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                  ) : (
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  )}

                  {post.imageUrl && (
                    <div className="rounded-2xl overflow-hidden border border-indigo-50/80 max-h-80 bg-slate-50 flex items-center justify-center">
                      <img
                        src={post.imageUrl}
                        alt="Post media"
                        className="w-full h-full object-cover hover:scale-[1.01] transition duration-200"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>

                {/* Engagement counts */}
                <div className="flex items-center gap-4 pt-3 text-xs text-slate-500 border-t border-indigo-50/60">
                  <button
                    id={`like-btn-${post.id}`}
                    onClick={() => handleLikeToggle(post.id)}
                    className={`flex items-center gap-1 cursor-pointer transition ${
                      isLiked ? 'text-pink-600 font-extrabold scale-105' : 'hover:text-pink-500'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                    <span>{post.likesCount}</span>
                  </button>

                  <button
                    id={`comments-toggle-${post.id}`}
                    onClick={() => {
                      if (expandedCommentsPostId === post.id) {
                        setExpandedCommentsPostId(null);
                      } else {
                        setExpandedCommentsPostId(post.id);
                      }
                    }}
                    className={`flex items-center gap-1 cursor-pointer transition hover:text-indigo-600 ${
                      expandedCommentsPostId === post.id ? 'text-indigo-600 font-bold' : ''
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>{post.commentsCount} comments</span>
                  </button>

                  <button
                    id={`post-details-btn-${post.id}`}
                    onClick={() => onViewPostDetails(post)}
                    className="ml-auto text-[10px] text-slate-400 hover:text-indigo-600 font-bold uppercase tracking-wider"
                  >
                    More Details
                  </button>
                </div>

                {/* Expanded Inline Comments Section */}
                {expandedCommentsPostId === post.id && (
                  <div className="border-t border-indigo-50/60 pt-4 space-y-4 bg-indigo-50/25 -mx-6 -mb-6 p-6 rounded-b-[32px]">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                      Comments Section
                    </span>

                    {/* Comment List */}
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                      {(!commentsMap[post.id] || commentsMap[post.id].length === 0) ? (
                        <p className="text-[11px] text-slate-400 italic">No comments yet. Write the first one!</p>
                      ) : (
                        commentsMap[post.id].map((comment) => (
                          <div key={comment.id} className="flex gap-2.5 items-start bg-white p-3 rounded-2xl border border-indigo-50 shadow-2xs">
                            <img
                              src={comment.authorPic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                              alt={comment.authorName}
                              className="h-7 w-7 rounded-full object-cover ring-1 ring-indigo-50"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span 
                                  onClick={() => onViewUserProfile(comment.userId)}
                                  className="text-[11px] font-bold text-slate-700 hover:text-indigo-600 cursor-pointer"
                                >
                                  @{comment.authorName}
                                </span>
                                <span className="text-[9px] text-slate-400 font-semibold">{formatDate(comment.createdAt)}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-normal mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                            </div>
                            
                            {comment.userId === currentUserProfile.id && (
                              <button
                                id={`delete-comment-${comment.id}`}
                                onClick={() => handleDeleteComment(post.id, comment.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-full transition cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Comment Input Form */}
                    <div className="flex items-center gap-2 border border-indigo-100 rounded-full bg-white px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-400 shadow-3xs">
                      <input
                        id={`comment-input-${post.id}`}
                        type="text"
                        placeholder="Add your comment..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        className="flex-1 border-0 focus:ring-0 px-2 py-0.5 text-xs text-slate-700 focus:outline-none placeholder-slate-400"
                      />
                      <button
                        id={`comment-submit-btn-${post.id}`}
                        onClick={() => handleAddComment(post.id)}
                        disabled={submittingComment[post.id] || !(commentInputs[post.id] || '').trim()}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full transition disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>

                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      )}

    </div>
  );
}
