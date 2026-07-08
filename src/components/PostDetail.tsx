import React, { useState, useEffect } from 'react';
import { 
  db, 
  handleFirestoreError, 
  OperationType,
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  increment,
  getDocs,
  serverTimestamp
} from '../firebase';
import { Post, Comment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Heart, 
  MessageSquare, 
  Send, 
  Clock, 
  Trash2, 
  Users, 
  Sparkles, 
  Flame 
} from 'lucide-react';

interface PostDetailProps {
  post: Post;
  currentUserId: string;
  currentUserPic: string;
  currentUsername: string;
  onClose: () => void;
  onViewUserProfile: (userId: string) => void;
}

export default function PostDetail({ 
  post, 
  currentUserId, 
  currentUserPic, 
  currentUsername, 
  onClose,
  onViewUserProfile
}: PostDetailProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [likesUsers, setLikesUsers] = useState<string[]>([]); // Usernames of people who liked
  const [isLiked, setIsLiked] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'likes'>('comments');

  // 1. Fetch comments for this post
  useEffect(() => {
    const commentsRef = collection(db, 'posts', post.id, 'comments');
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
      setComments(list);
    }, (err) => {
      console.error('onSnapshot comments error:', err);
    });

    return () => unsubscribe();
  }, [post.id]);

  // 2. Fetch people who liked this post
  useEffect(() => {
    const likesRef = collection(db, 'posts', post.id, 'likes');
    
    const unsubscribe = onSnapshot(likesRef, (snapshot) => {
      const usernames: string[] = [];
      let currentUserHasLiked = false;
      
      snapshot.forEach((doc) => {
        if (doc.id === currentUserId) {
          currentUserHasLiked = true;
        }
        usernames.push(doc.id); // Storing the liking User's UID. Let's resolve to names or just keep it as UID.
      });

      setIsLiked(currentUserHasLiked);
      
      // Resolve UIDs to usernames in real time
      resolveLikingUsernames(usernames);
    }, (err) => {
      console.error('onSnapshot likes error:', err);
    });

    return () => unsubscribe();
  }, [post.id, currentUserId]);

  const resolveLikingUsernames = async (uids: string[]) => {
    if (uids.length === 0) {
      setLikesUsers([]);
      return;
    }
    try {
      const resolvedList: string[] = [];
      for (const uid of uids) {
        const userDoc = await getDocs(query(collection(db, 'users')));
        userDoc.forEach((u) => {
          if (u.id === uid) {
            resolvedList.push(u.data().username);
          }
        });
      }
      setLikesUsers(resolvedList);
    } catch (err) {
      console.warn("Unable to resolve usernames for likes", err);
    }
  };

  // Submit comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);

    try {
      const commentPayload = {
        postId: post.id,
        userId: currentUserId,
        authorName: currentUsername,
        authorPic: currentUserPic,
        content: newComment.trim(),
        createdAt: serverTimestamp()
      };

      const commentsRef = collection(db, 'posts', post.id, 'comments');
      await addDoc(commentsRef, commentPayload);

      // Increment commentsCount
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });

      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posts/${post.id}/comments`);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete your comment?')) return;

    try {
      const commentRef = doc(db, 'posts', post.id, 'comments', commentId);
      await deleteDoc(commentRef);

      // Decrement commentsCount
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(-1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}/comments/${commentId}`);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-[32px] w-full max-w-2xl max-h-[90vh] flex flex-col border border-indigo-50 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-100 bg-indigo-50/10">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
            Detailed Post View
          </h3>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-indigo-100 rounded-full text-slate-400 cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Layout */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Post Author Details */}
          <div className="flex items-center gap-3">
            <img
              src={post.authorPic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
              alt={post.authorName}
              onClick={() => {
                onViewUserProfile(post.userId);
                onClose();
              }}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-100 cursor-pointer shadow-3xs"
              referrerPolicy="no-referrer"
            />
            <div>
              <h4 
                onClick={() => {
                  onViewUserProfile(post.userId);
                  onClose();
                }}
                className="text-xs font-bold text-slate-800 hover:text-indigo-600 cursor-pointer"
              >
                @{post.authorName}
              </h4>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 font-bold mt-0.5 uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                {formatDate(post.createdAt)}
              </p>
            </div>
          </div>

          {/* Post Content */}
          <div className="space-y-4">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
              {post.content}
            </p>

            {post.imageUrl && (
              <div className="rounded-2xl overflow-hidden border border-indigo-50 max-h-96 bg-slate-50 flex items-center justify-center">
                <img
                  src={post.imageUrl}
                  alt="Post attachment"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>

          {/* Tabs for Engagement Details */}
          <div className="border-t border-indigo-50/60 pt-4 space-y-4">
            <div className="flex border-b border-indigo-50/60 pb-1 gap-4">
              <button
                id="post-detail-comments-tab"
                onClick={() => setActiveTab('comments')}
                className={`pb-2 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'comments'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-slate-400 hover:text-indigo-600'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comments ({comments.length})
              </button>
              
              <button
                id="post-detail-likes-tab"
                onClick={() => setActiveTab('likes')}
                className={`pb-2 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'likes'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-slate-400 hover:text-indigo-600'
                }`}
              >
                <Heart className="h-3.5 w-3.5" />
                Likes ({post.likesCount})
              </button>
            </div>

            {/* Comments Tab Panel */}
            {activeTab === 'comments' ? (
              <div className="space-y-4">
                {/* List Comments */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6 font-medium">No comments on this post yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3 items-start bg-indigo-50/20 p-3.5 rounded-2xl border border-indigo-50/50 shadow-3xs">
                        <img
                          src={comment.authorPic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                          alt={comment.authorName}
                          className="h-8 w-8 rounded-full object-cover ring-1 ring-indigo-50"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h5 
                              onClick={() => {
                                onViewUserProfile(comment.userId);
                                onClose();
                              }}
                              className="text-xs font-bold text-slate-700 hover:text-indigo-600 cursor-pointer"
                            >
                              @{comment.authorName}
                            </h5>
                            <span className="text-[9px] text-slate-400 font-semibold">{formatDate(comment.createdAt)}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap leading-relaxed font-medium">
                            {comment.content}
                          </p>
                        </div>

                        {comment.userId === currentUserId && (
                          <button
                            id={`delete-detail-comment-${comment.id}`}
                            onClick={() => handleDeleteComment(comment.id)}
                            title="Delete comment"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-full hover:bg-rose-50 cursor-pointer transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Submit New Comment Form */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    id="new-comment-input"
                    type="text"
                    required
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Express your thoughts..."
                    className="flex-1 px-4 py-2.5 border border-indigo-100 bg-indigo-50/10 rounded-full text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none placeholder-slate-400"
                  />
                  <button
                    id="submit-comment-btn"
                    type="submit"
                    disabled={submittingComment || !newComment.trim()}
                    className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-full cursor-pointer disabled:opacity-50 shadow-md shadow-indigo-100 transition"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            ) : (
              /* Likes Tab Panel - Shows exactly who liked */
              <div className="space-y-2">
                {likesUsers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6 font-medium">No likes on this post yet.</p>
                ) : (
                  <div className="bg-indigo-50/20 p-4 rounded-2xl border border-indigo-50/50 max-h-60 overflow-y-auto">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest mb-3">
                      <Users className="h-4 w-4 text-indigo-400" /> Liking Community
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {likesUsers.map((username, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-indigo-50 shadow-3xs">
                          <Heart className="h-3.5 w-3.5 text-pink-500 fill-pink-500" />
                          <span className="text-xs font-bold text-slate-700">@{username}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
}
