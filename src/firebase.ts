import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load Supabase environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verify if Supabase is properly configured with custom credentials
const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-supabase-project.supabase.co' && 
  supabaseAnonKey !== 'your-supabase-anon-key';

export const supabase: SupabaseClient | null = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (supabase) {
  console.log('Supabase engine initialized successfully.');
} else {
  console.warn('Supabase credentials not configured. Running on resilient client-side reactive database fallback.');
}

// Global Operation Types for compatibility
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Database Error [${operationType}] at ${path}:`, error);
  throw error;
}

// --- LIGHTWEIGHT REACTIVE ENGINE ---
// Ensures instant local updates, cross-tab reactive streams, and offline capability.
// If Supabase is configured, this engine automatically pushes changes to the cloud.

interface DBState {
  users: { [uid: string]: any };
  posts: any[];
  comments: { [postId: string]: any[] };
  likes: { [postId: string]: { [userId: string]: boolean } };
  following: { [userId: string]: { [targetId: string]: boolean } };
  followers: { [userId: string]: { [targetId: string]: boolean } };
}

const DEFAULT_STATE: DBState = {
  users: {},
  posts: [],
  comments: {},
  likes: {},
  following: {},
  followers: {}
};

// Load initial state
let dbState: DBState = DEFAULT_STATE;
try {
  const saved = localStorage.getItem('vibesocial_db');
  if (saved) {
    dbState = JSON.parse(saved);
    // Backward compatibility patching
    if (!dbState.users) dbState.users = {};
    if (!dbState.posts) dbState.posts = [];
    if (!dbState.comments) dbState.comments = {};
    if (!dbState.likes) dbState.likes = {};
    if (!dbState.following) dbState.following = {};
    if (!dbState.followers) dbState.followers = {};
  }
} catch (e) {
  console.error('Failed to load local DB state:', e);
}

// Reactive subscriptions
type DBListener = () => void;
const dbListeners = new Set<DBListener>();

function saveAndNotify() {
  try {
    localStorage.setItem('vibesocial_db', JSON.stringify(dbState));
  } catch (e) {
    console.error('Failed to save DB state:', e);
  }
  dbListeners.forEach(listener => {
    try {
      listener();
    } catch (e) {
      console.error('Error in listener callback:', e);
    }
  });
}

// --- AUTHENTICATION MOCK & CLOUD ENGINE ---

class AuthMock {
  private listeners: Set<(user: any) => void> = new Set();
  public currentUser: any = null;

  constructor() {
    // Restore auth state from local storage
    try {
      const savedUser = localStorage.getItem('vibesocial_user');
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
    } catch (e) {
      console.error('Error restoring user:', e);
    }
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.add(callback);
    // Initial call
    callback(this.currentUser);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async signInWithPopup() {
    // Generate a beautiful, creative random mockup user or log in custom user
    const randomId = 'user_' + Math.random().toString(36).substr(2, 9);
    const mockUser = {
      uid: randomId,
      displayName: 'Vibe Explorer',
      email: 'explorer@vibesocial.app',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };
    this.currentUser = mockUser;
    localStorage.setItem('vibesocial_user', JSON.stringify(mockUser));
    this.notifyAuthListeners();
    return { user: mockUser };
  }

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem('vibesocial_user');
    this.notifyAuthListeners();
  }

  private notifyAuthListeners() {
    this.listeners.forEach(callback => callback(this.currentUser));
  }
}

export const auth = new AuthMock();

export const onAuthStateChanged = (authObj: any, callback: (user: any) => void) => {
  return auth.onAuthStateChanged(callback);
};

export const signOut = async (authObj: any) => {
  return auth.signOut();
};

export const signInWithPopup = async (authObj: any, provider: any) => {
  return auth.signInWithPopup();
};

export class GoogleAuthProvider {
  constructor() {}
}

// --- FIRESTORE BRIDGE IMPLEMENTATION ---

export const db = {
  id: 'vibe-db'
};

// Increment class
export class IncrementValue {
  constructor(public amount: number) {}
}

export function increment(amount: number) {
  return new IncrementValue(amount);
}

// Server Timestamp stub
export function serverTimestamp() {
  return new Date();
}

// References
export class CollectionReference {
  constructor(public dbObj: any, public path: string) {}
}

export class DocumentReference {
  constructor(public dbObj: any, public path: string) {}

  get id() {
    const parts = this.path.split('/');
    return parts[parts.length - 1];
  }
}

export class Query {
  constructor(public ref: CollectionReference, public constraints: any[] = []) {}
  get path() {
    return this.ref.path;
  }
}

// Reference builders
export function collection(dbObj: any, path: string, ...segments: string[]): CollectionReference {
  let fullPath = path;
  if (segments.length > 0) {
    fullPath += '/' + segments.join('/');
  }
  return new CollectionReference(dbObj, fullPath);
}

export function doc(dbObj: any, path: string, ...segments: string[]): DocumentReference {
  let fullPath = path;
  if (segments.length > 0) {
    fullPath += '/' + segments.join('/');
  }
  return new DocumentReference(dbObj, fullPath);
}

// Constraints
export function query(ref: CollectionReference, ...constraints: any[]): Query {
  return new Query(ref, constraints);
}

export function where(field: string, op: string, val: any) {
  return { type: 'where', field, op, val };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(limitVal: number) {
  return { type: 'limit', limit: limitVal };
}

export function writeBatch(dbObj: any) {
  return {
    commit: async () => {
      // Stub commit
      return true;
    }
  };
}

// Query Executor
function runQuery(q: Query | CollectionReference) {
  const path = q.path;
  let results: any[] = [];

  if (path === 'posts') {
    results = [...dbState.posts];
  } else if (path === 'users') {
    results = Object.values(dbState.users);
  } else if (path.match(/^posts\/[^/]+\/comments$/)) {
    const postId = path.split('/')[1];
    results = [...(dbState.comments[postId] || [])];
  } else if (path.match(/^users\/[^/]+\/following$/)) {
    const userId = path.split('/')[1];
    const followingMap = dbState.following[userId] || {};
    results = Object.keys(followingMap).map(id => ({ id }));
  } else if (path.match(/^users\/[^/]+\/followers$/)) {
    const userId = path.split('/')[1];
    const followersMap = dbState.followers[userId] || {};
    results = Object.keys(followersMap).map(id => ({ id }));
  }

  // Parse filters
  const constraints = q instanceof Query ? q.constraints : [];
  for (const c of constraints) {
    if (c.type === 'where') {
      const { field, op, val } = c;
      results = results.filter(item => {
        const itemVal = item[field];
        if (op === '==') return itemVal === val;
        if (op === '!=') return itemVal !== val;
        return true;
      });
    } else if (c.type === 'orderBy') {
      const { field, direction } = c;
      results.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        
        let compare = 0;
        if (valA instanceof Date || (typeof valA === 'string' && Date.parse(valA))) {
          compare = new Date(valA).getTime() - new Date(valB).getTime();
        } else if (typeof valA === 'object' && valA?.seconds !== undefined) {
          compare = valA.seconds - valB.seconds;
        } else if (typeof valA === 'string') {
          compare = valA.localeCompare(valB);
        } else {
          compare = (valA || 0) - (valB || 0);
        }
        return direction === 'desc' ? -compare : compare;
      });
    }
  }

  // Apply limit
  for (const c of constraints) {
    if (c.type === 'limit') {
      results = results.slice(0, c.limit);
    }
  }

  return results;
}

// Fetch document
export async function getDoc(docRef: DocumentReference) {
  const path = docRef.path;
  const parts = path.split('/');
  
  let dataVal: any = null;
  let exists = false;

  if (parts[0] === 'users' && parts.length === 2) {
    const userId = parts[1];
    dataVal = dbState.users[userId];
    exists = !!dataVal;
  } else if (parts[0] === 'posts' && parts.length === 2) {
    const postId = parts[1];
    dataVal = dbState.posts.find(p => p.id === postId);
    exists = !!dataVal;
  } else if (parts[0] === 'posts' && parts[2] === 'likes' && parts.length === 4) {
    const postId = parts[1];
    const userId = parts[3];
    exists = !!dbState.likes[postId]?.[userId];
    dataVal = exists ? { liked: true } : null;
  } else if (parts[0] === 'users' && parts[2] === 'following' && parts.length === 4) {
    const userId = parts[1];
    const targetId = parts[3];
    exists = !!dbState.following[userId]?.[targetId];
    dataVal = exists ? { following: true } : null;
  }

  // Fetch from Supabase if configured
  if (supabase) {
    try {
      if (parts[0] === 'users' && parts.length === 2) {
        const { data, error } = await supabase.from('users').select('*').eq('id', parts[1]).maybeSingle();
        if (!error && data) {
          dataVal = {
            ...data,
            followersCount: data.followers_count,
            followingCount: data.following_count,
            profilePic: data.profile_pic,
          };
          exists = true;
          // Sync locally
          dbState.users[parts[1]] = dataVal;
          saveAndNotify();
        }
      }
    } catch (e) {
      console.warn('Supabase getDoc sync fallback:', e);
    }
  }

  return {
    id: docRef.id,
    exists: () => exists,
    data: () => dataVal
  };
}

// Fetch multiple documents
export async function getDocs(q: Query | CollectionReference) {
  const items = runQuery(q);
  const docs = items.map(item => ({
    id: item.id || '',
    exists: () => true,
    data: () => item
  }));

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (callback: (doc: any) => void) => {
      docs.forEach(callback);
    }
  };
}

// Create/set document
export async function setDoc(docRef: DocumentReference, data: any, options?: any) {
  const path = docRef.path;
  const parts = path.split('/');

  // Process potential increments
  const cleanData = { ...data };
  for (const key of Object.keys(cleanData)) {
    if (cleanData[key] instanceof IncrementValue) {
      cleanData[key] = cleanData[key].amount;
    }
  }

  if (parts[0] === 'users' && parts.length === 2) {
    const userId = parts[1];
    dbState.users[userId] = {
      ...dbState.users[userId],
      ...cleanData,
      id: userId,
      createdAt: cleanData.createdAt || dbState.users[userId]?.createdAt || new Date().toISOString()
    };
    
    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('users').upsert({
          id: userId,
          username: cleanData.username,
          email: cleanData.email,
          bio: cleanData.bio,
          profile_pic: cleanData.profilePic,
          followers_count: cleanData.followersCount || 0,
          following_count: cleanData.followingCount || 0,
        });
      } catch (e) {
        console.warn('Supabase users upsert error:', e);
      }
    }
  } else if (parts[0] === 'users' && parts[2] === 'following' && parts.length === 4) {
    const userId = parts[1];
    const targetId = parts[3];
    if (!dbState.following[userId]) dbState.following[userId] = {};
    dbState.following[userId][targetId] = true;

    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('follows').upsert({
          follower_id: userId,
          following_id: targetId,
        });
      } catch (e) {
        console.warn('Supabase follows insert error:', e);
      }
    }
  } else if (parts[0] === 'users' && parts[2] === 'followers' && parts.length === 4) {
    const userId = parts[1];
    const followerId = parts[3];
    if (!dbState.followers[userId]) dbState.followers[userId] = {};
    dbState.followers[userId][followerId] = true;
  } else if (parts[0] === 'posts' && parts[2] === 'likes' && parts.length === 4) {
    const postId = parts[1];
    const userId = parts[3];
    if (!dbState.likes[postId]) dbState.likes[postId] = {};
    dbState.likes[postId][userId] = true;

    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('likes').upsert({
          post_id: postId,
          user_id: userId,
        });
      } catch (e) {
        console.warn('Supabase likes insert error:', e);
      }
    }
  }

  saveAndNotify();
  return true;
}

// Add document to collection
export async function addDoc(collectionRef: CollectionReference, data: any) {
  const path = collectionRef.path;
  const id = 'doc_' + Math.random().toString(36).substr(2, 9);

  const cleanData = { ...data, id };
  for (const key of Object.keys(cleanData)) {
    if (cleanData[key] instanceof IncrementValue) {
      cleanData[key] = cleanData[key].amount;
    }
  }

  if (path === 'posts') {
    dbState.posts.unshift(cleanData);
    
    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('posts').insert({
          id,
          user_id: cleanData.userId,
          author_name: cleanData.authorName,
          author_pic: cleanData.authorPic,
          content: cleanData.content,
          image_url: cleanData.imageUrl,
          likes_count: cleanData.likesCount || 0,
          comments_count: cleanData.commentsCount || 0,
        });
      } catch (e) {
        console.warn('Supabase posts insert error:', e);
      }
    }
  } else if (path.match(/^posts\/[^/]+\/comments$/)) {
    const postId = path.split('/')[1];
    if (!dbState.comments[postId]) dbState.comments[postId] = [];
    dbState.comments[postId].push(cleanData);

    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('comments').insert({
          id,
          post_id: postId,
          user_id: cleanData.userId,
          author_name: cleanData.authorName,
          author_pic: cleanData.authorPic,
          content: cleanData.content,
        });
      } catch (e) {
        console.warn('Supabase comments insert error:', e);
      }
    }
  }

  saveAndNotify();
  return { id };
}

// Update document
export async function updateDoc(docRef: DocumentReference, data: any) {
  const path = docRef.path;
  const parts = path.split('/');

  if (parts[0] === 'users' && parts.length === 2) {
    const userId = parts[1];
    const user = dbState.users[userId] || {};
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val instanceof IncrementValue) {
        user[key] = (user[key] || 0) + val.amount;
      } else {
        user[key] = val;
      }
    }
    dbState.users[userId] = user;

    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('users').update({
          username: user.username,
          email: user.email,
          bio: user.bio,
          profile_pic: user.profilePic,
          followers_count: user.followersCount,
          following_count: user.followingCount,
        }).eq('id', userId);
      } catch (e) {
        console.warn('Supabase users update error:', e);
      }
    }
  } else if (parts[0] === 'posts' && parts.length === 2) {
    const postId = parts[1];
    const postIndex = dbState.posts.findIndex(p => p.id === postId);
    if (postIndex !== -1) {
      const post = dbState.posts[postIndex];
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (val instanceof IncrementValue) {
          post[key] = (post[key] || 0) + val.amount;
        } else {
          post[key] = val;
        }
      }
      dbState.posts[postIndex] = post;

      // Supabase Sync
      if (supabase) {
        try {
          await supabase.from('posts').update({
            content: post.content,
            image_url: post.imageUrl,
            likes_count: post.likesCount,
            comments_count: post.commentsCount,
          }).eq('id', postId);
        } catch (e) {
          console.warn('Supabase posts update error:', e);
        }
      }
    }
  }

  saveAndNotify();
  return true;
}

// Delete document
export async function deleteDoc(docRef: DocumentReference) {
  const path = docRef.path;
  const parts = path.split('/');

  if (parts[0] === 'posts' && parts.length === 2) {
    const postId = parts[1];
    dbState.posts = dbState.posts.filter(p => p.id !== postId);
    delete dbState.comments[postId];
    delete dbState.likes[postId];

    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('posts').delete().eq('id', postId);
      } catch (e) {
        console.warn('Supabase posts delete error:', e);
      }
    }
  } else if (parts[0] === 'users' && parts[2] === 'following' && parts.length === 4) {
    const userId = parts[1];
    const targetId = parts[3];
    if (dbState.following[userId]) {
      delete dbState.following[userId][targetId];
    }

    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
      } catch (e) {
        console.warn('Supabase follows delete error:', e);
      }
    }
  } else if (parts[0] === 'users' && parts[2] === 'followers' && parts.length === 4) {
    const userId = parts[1];
    const followerId = parts[3];
    if (dbState.followers[userId]) {
      delete dbState.followers[userId][followerId];
    }
  } else if (parts[0] === 'posts' && parts[2] === 'likes' && parts.length === 4) {
    const postId = parts[1];
    const userId = parts[3];
    if (dbState.likes[postId]) {
      delete dbState.likes[postId][userId];
    }

    // Supabase Sync
    if (supabase) {
      try {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
      } catch (e) {
        console.warn('Supabase likes delete error:', e);
      }
    }
  }

  saveAndNotify();
  return true;
}

// Real-time observer
export function onSnapshot(
  target: Query | CollectionReference | DocumentReference,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) {
  // Execute immediately
  const deliverUpdate = async () => {
    try {
      if (target instanceof DocumentReference) {
        const snap = await getDoc(target);
        onNext(snap);
      } else {
        const snap = await getDocs(target);
        onNext(snap);
      }
    } catch (e) {
      if (onError) onError(e);
    }
  };

  deliverUpdate();

  // Register for state changes
  const listener = () => {
    deliverUpdate();
  };

  dbListeners.add(listener);

  // Return unsubscribe function
  return () => {
    dbListeners.delete(listener);
  };
}

// Background loader to sync Supabase data on startup
async function syncFromSupabase() {
  if (!supabase) return;
  console.log('Syncing database state from Supabase...');
  try {
    // 1. Fetch Users
    const { data: users, error: usersError } = await supabase.from('users').select('*');
    if (usersError) throw usersError;
    
    // 2. Fetch Posts
    const { data: posts, error: postsError } = await supabase.from('posts').select('*');
    if (postsError) throw postsError;

    // 3. Fetch Comments
    const { data: comments, error: commentsError } = await supabase.from('comments').select('*');
    if (commentsError) throw commentsError;

    // 4. Fetch Likes
    const { data: likes, error: likesError } = await supabase.from('likes').select('*');
    if (likesError) throw likesError;

    // 5. Fetch Follows
    const { data: follows, error: followsError } = await supabase.from('follows').select('*');
    if (followsError) throw followsError;

    // Rebuild local memory structure
    const newUsers: { [uid: string]: any } = {};
    if (users) {
      users.forEach((u: any) => {
        newUsers[u.id] = {
          id: u.id,
          username: u.username,
          email: u.email,
          bio: u.bio,
          profilePic: u.profile_pic,
          followersCount: u.followers_count || 0,
          followingCount: u.following_count || 0,
          createdAt: u.created_at,
        };
      });
    }

    const newPosts: any[] = [];
    if (posts) {
      posts.forEach((p: any) => {
        newPosts.push({
          id: p.id,
          userId: p.user_id,
          authorName: p.author_name,
          authorPic: p.author_pic,
          content: p.content,
          imageUrl: p.image_url,
          likesCount: p.likes_count || 0,
          commentsCount: p.comments_count || 0,
          createdAt: p.created_at,
        });
      });
    }

    const newComments: { [postId: string]: any[] } = {};
    if (comments) {
      comments.forEach((c: any) => {
        if (!newComments[c.post_id]) {
          newComments[c.post_id] = [];
        }
        newComments[c.post_id].push({
          id: c.id,
          postId: c.post_id,
          userId: c.user_id,
          authorName: c.author_name,
          authorPic: c.author_pic,
          content: c.content,
          createdAt: c.created_at,
        });
      });
    }

    const newLikes: { [postId: string]: { [userId: string]: boolean } } = {};
    if (likes) {
      likes.forEach((l: any) => {
        if (!newLikes[l.post_id]) {
          newLikes[l.post_id] = {};
        }
        newLikes[l.post_id][l.user_id] = true;
      });
    }

    const newFollowing: { [userId: string]: { [targetId: string]: boolean } } = {};
    const newFollowers: { [userId: string]: { [targetId: string]: boolean } } = {};
    if (follows) {
      follows.forEach((f: any) => {
        // following map
        if (!newFollowing[f.follower_id]) {
          newFollowing[f.follower_id] = {};
        }
        newFollowing[f.follower_id][f.following_id] = true;

        // followers map
        if (!newFollowers[f.following_id]) {
          newFollowers[f.following_id] = {};
        }
        newFollowers[f.following_id][f.follower_id] = true;
      });
    }

    // Overwrite local DB state since cloud Supabase DB is active and is the single source of truth
    dbState = {
      users: newUsers,
      posts: newPosts,
      comments: newComments,
      likes: newLikes,
      following: newFollowing,
      followers: newFollowers,
    };

    saveAndNotify();
    console.log('Supabase sync complete. Loaded state into reactive engine.');
  } catch (err) {
    console.warn('Failed to sync from Supabase. Using local memory cached fallback:', err);
  }
}

// Trigger cloud synchronization immediately if supabase is configured
if (supabase) {
  syncFromSupabase();
}
