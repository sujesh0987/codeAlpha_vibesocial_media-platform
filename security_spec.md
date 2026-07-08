# Firestore Security Specification

This document details the security constraints, rules, and threat models for the application.

## 1. Data Invariants
- **User Ownership**: A user profile can only be modified by the matching authenticated user.
- **Post Authenticity**: A post's `userId` must always match the creator's authenticated UID.
- **Immutable Timestamps**: `createdAt` timestamps cannot be updated once created.
- **Base64 Payload Support**: `imageUrl` and `profilePic` must support up to 1,000,000 characters to allow client-side optimized base64 image uploading.
- **Graceful Nullability**: If `imageUrl` or `profilePic` is null or omitted, security rules must not crash or deny the operation.

## 2. Threat Vector Checklist ("Dirty Dozen" Payloads)

### T1: Email Spoofing Attack
- **Payload**: Registering profile with an arbitrary email or administrative email.
- **Expectation**: Prevented by verifying `request.auth.uid` matches the document ID, and validating `email` matches.

### T2: Identity Spoofing (Post Creation)
- **Payload**: Creating a post with `userId` of another user.
- **Expectation**: Prevented by checking `incoming().userId == request.auth.uid`.

### T3: Large String Resource Poisoning
- **Payload**: Injecting a 2MB string into `content` or `bio`.
- **Expectation**: Prevented by string size constraints: `content.size() <= 1000`, `bio.size() <= 300`.

### T4: Base64 Image Upload Blocks (Current Issue)
- **Payload**: Uploading a standard 200KB base64 JPEG to `imageUrl` or `profilePic`.
- **Expectation**: Should be ALLOWED, but is currently BLOCKED by the old 1,000-character limits. New limits must allow up to 1,000,000 characters.

### T5: Temporal Tampering
- **Payload**: Submitting `createdAt` as a manual timestamp in the past or future.
- **Expectation**: Rejected by checking `createdAt == request.time`.

### T6: Rating/Count Hijacking
- **Payload**: Modifying `likesCount` or `commentsCount` of a post arbitrarily.
- **Expectation**: Prevented by restricting updates to incrementing/decrementing only.

### T7: Blind Read Leakage
- **Payload**: Attempting to read users' private fields.
- **Expectation**: Prevented by secure match scopes.

### T8: Follow Self-Assignment
- **Payload**: Adding a follower connection representing another user.
- **Expectation**: Prevented by requiring `followerId == request.auth.uid` in `following` subcollection.

### T9: Comment Post-Mapping Hijack
- **Payload**: Submitting a comment with a mismatched `postId`.
- **Expectation**: Prevented by validating `incoming().postId == postId`.

### T10: Orphaned Likes
- **Payload**: Submitting a like on a non-existent post.
- **Expectation**: Prevented by placing likes as sub-resources of the specific post document.

### T11: Ghost Fields (Shadow Updates)
- **Payload**: Appending `isVerified: true` or other unauthorized fields to profile or post updates.
- **Expectation**: Blocked by `.affectedKeys().hasOnly(...)` during updates.

### T12: Post Creator Impersonation (Post Edit)
- **Payload**: Editing someone else's post content.
- **Expectation**: Prevented by checking `existing().userId == request.auth.uid` before permitting updates.
