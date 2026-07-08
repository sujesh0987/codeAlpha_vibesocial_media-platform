# Social Media Web App

A mini social media application styled beautifully using Tailwind CSS and powered in real-time by Firebase Authentication and Cloud Firestore database.

## Core Features
1. **User Profiles**: Google Authentication Sign-In, profile customization (pick colorful avatars or input custom image URLs, custom usernames, and bios), and followers/following metrics.
2. **Dynamic Feed**: Share text posts with optional image URLs. Supports toggleable tabs for filtering between "All Posts" or "Following Only" (filtering to followed creators + your own posts).
3. **Likes System**: Multi-user interactive post likes with instant toggle, and a detailed list displaying which users liked each post.
4. **Comments Section**: Inline comment expansions directly on feed cards, supporting real-time updates and comment removals.
5. **Follow/Unfollow Systems**: Follow other creators directly from a dedicated **Explore** community tab or their specific profile page. Counts are synchronized atomically.

---

## Firestore Database Schemas

- **Users Collection** (`/users/{userId}`)
  - `username`: `string`
  - `email`: `string`
  - `bio`: `string` (optional)
  - `profilePic`: `string` (optional image URL)
  - `createdAt`: `timestamp`
  - `followingCount`: `number`
  - `followersCount`: `number`

- **Posts Collection** (`/posts/{postId}`)
  - `userId`: `string` (author UID)
  - `authorName`: `string` (author username)
  - `authorPic`: `string`
  - `content`: `string`
  - `imageUrl`: `string` (optional)
  - `createdAt`: `timestamp`
  - `likesCount`: `number`
  - `commentsCount`: `number`

- **Comments Subcollection** (`/posts/{postId}/comments/{commentId}`)
  - `postId`: `string`
  - `userId`: `string`
  - `authorName`: `string`
  - `authorPic`: `string`
  - `content`: `string`
  - `createdAt`: `timestamp`

- **Likes Subcollection** (`/posts/{postId}/likes/{userId}`)
  - `postId`: `string`
  - `userId`: `string`
  - `createdAt`: `timestamp`

- **Following Subcollection** (`/users/{userId}/following/{followingId}`)
  - `followerId`: `string`
  - `followingId`: `string`
  - `createdAt`: `timestamp`

- **Followers Subcollection** (`/users/{userId}/followers/{followerId}`)
  - `followerId`: `string`
  - `followingId`: `string`
  - `createdAt`: `timestamp`

---

## Local Development Setup

To run this application locally, follow these steps:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Firebase**:
   Ensure you place your Web Firebase Config inside `firebase-applet-config.json` in the root:
   ```json
   {
     "projectId": "your-project-id",
     "appId": "your-app-id",
     "apiKey": "your-api-key",
     "authDomain": "your-auth-domain",
     "firestoreDatabaseId": "your-database-id-or-empty-default",
     "storageBucket": "your-storage-bucket"
   }
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Compile / Build Production Bundle**:
   ```bash
   npm run build
   ```
