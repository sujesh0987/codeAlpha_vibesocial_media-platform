export interface UserProfile {
  id: string; // Document ID (UID)
  username: string;
  email: string;
  bio?: string;
  profilePic?: string;
  createdAt: any; // Firestore Timestamp
  followingCount?: number;
  followersCount?: number;
}

export interface Post {
  id: string; // Document ID
  userId: string;
  authorName: string;
  authorPic?: string;
  content: string;
  imageUrl?: string;
  createdAt: any; // Firestore Timestamp
  likesCount: number;
  commentsCount: number;
}

export interface Comment {
  id: string; // Document ID
  postId: string;
  userId: string;
  authorName: string;
  authorPic?: string;
  content: string;
  createdAt: any; // Firestore Timestamp
}

export interface Like {
  postId: string;
  userId: string;
  createdAt: any; // Firestore Timestamp
}

export interface Follow {
  followerId: string;
  followingId: string;
  createdAt: any; // Firestore Timestamp;
}
