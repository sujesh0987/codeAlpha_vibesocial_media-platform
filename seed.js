import admin from 'firebase-admin';
import fs from 'fs';

console.log('🚀 Starting Database Seed Script...\n');

// 1. Check for Service Account credentials
const serviceAccountPath = './firebase-service-account.json';
const appletConfigPath = './firebase-applet-config.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Error: ${serviceAccountPath} not found!`);
  console.log('\n================================================================');
  console.log('💡 HOW TO SEED YOUR FIREBASE DATABASE:');
  console.log('1. Go to your Firebase Console: https://console.firebase.google.com/');
  console.log('2. Click on the gear icon (Project Settings) > "Service accounts".');
  console.log('3. Select "Node.js" and click "Generate new private key".');
  console.log(`4. Save the downloaded JSON file as "${serviceAccountPath}" in the root of this project.`);
  console.log('5. Run "node seed.js" again.');
  console.log('================================================================\n');
  process.exit(1);
}

// Read configs
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const appletConfig = JSON.parse(fs.readFileSync(appletConfigPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: appletConfig.projectId
});

// Use the custom database ID if specified in your project setup
const db = admin.firestore(appletConfig.firestoreDatabaseId || '(default)');

// Realistic dummy users
const DUMMY_USERS = [
  {
    id: 'seed_user_john_doe',
    username: 'john_doe',
    email: 'john_doe@example.com',
    bio: 'Coffee lover ☕ | Landscape Photographer 📸 | Seeking the perfect shot',
    profilePic: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'seed_user_sarah_writes',
    username: 'sarah_writes',
    email: 'sarah_writes@example.com',
    bio: 'Always writing something | Novelist & Coffee enthusiast 📚☕ | Words are my superpower',
    profilePic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'seed_user_mike_codes',
    username: 'mike_codes',
    email: 'mike_codes@example.com',
    bio: 'Full-stack software engineer | Building cool apps with React & Node 💻🚀',
    profilePic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'seed_user_priya_art',
    username: 'priya_art',
    email: 'priya_art@example.com',
    bio: 'Digital illustrator & fine artist 🎨 | Pastel colors and cute stickers represent my vibe',
    profilePic: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'seed_user_alex_travel',
    username: 'alex_travel',
    email: 'alex_travel@example.com',
    bio: 'Wanderlust 🌍 | Traveling the world one city at a time | Foodie & adventure seeker',
    profilePic: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'seed_user_emily_fit',
    username: 'emily_fit',
    email: 'emily_fit@example.com',
    bio: 'Yoga teacher & certified wellness coach 🧘‍♀️🍃 | Healthy mind, healthy body',
    profilePic: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'seed_user_chef_david',
    username: 'chef_david',
    email: 'chef_david@example.com',
    bio: 'Culinary arts graduate 🍳 | Cooking is love made visible | Recipe creator',
    profilePic: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'seed_user_lisa_tech',
    username: 'lisa_tech',
    email: 'lisa_tech@example.com',
    bio: 'UI/UX Product Designer | Obsessed with good design, spacing, and clean code ✨',
    profilePic: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
  }
];

// Realistic posts with distributed authors and staggered timestamps over the last 7 days
const DUMMY_POSTS = [
  {
    authorId: 'seed_user_john_doe',
    content: 'Just had the most incredible single-origin espresso at my local roastery! ☕ The notes of blueberry and dark chocolate were mind-blowing. What is your go-to coffee order in the morning?',
    imageUrl: 'https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=600&auto=format&fit=crop&q=80',
    daysAgo: 6.8
  },
  {
    authorId: 'seed_user_sarah_writes',
    content: 'Staring at a blank page is both the most terrifying and exciting part of being a writer. Chapter 1 of my new mystery novel is officially underway! 📝✨ #writingcommunity #amwriting #novelist',
    imageUrl: null,
    daysAgo: 6.2
  },
  {
    authorId: 'seed_user_mike_codes',
    content: 'Just pushed a major refactor of our database client queries. Everything is now running 40% faster with optimized indexing! Feels incredibly satisfying to clean up legacy technical debt. 💻⚡ #programming #webdev',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    daysAgo: 5.5
  },
  {
    authorId: 'seed_user_priya_art',
    content: 'Finished my latest digital painting today. Inspired by twilight hours, cyber neon lights, and rainy evenings. 🌆✨ Hope you all enjoy the aesthetic!',
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&auto=format&fit=crop&q=80',
    daysAgo: 4.9
  },
  {
    authorId: 'seed_user_alex_travel',
    content: 'Woke up at 5:00 AM to see this breathtaking sunrise in Kyoto, Japan. The serenity of the temples in the morning mist is absolutely indescribable. 🇯🇵🏔️ Definitely worth the early start.',
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80',
    daysAgo: 4.4
  },
  {
    authorId: 'seed_user_emily_fit',
    content: 'Friendly reminder to take 5 deep, mindful breaths right now. Inhale calm, hold it, and exhale all of your daily tension. 🧘‍♀️ Let is make this a beautiful, centered, and peaceful week.',
    imageUrl: null,
    daysAgo: 3.9
  },
  {
    authorId: 'seed_user_chef_david',
    content: 'Sunday morning pancakes in the making! 🥞 My secret ingredient is a pinch of cinnamon, a splash of vanilla, and fresh orange zest in the batter. What is everyone else cooking up today?',
    imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&auto=format&fit=crop&q=80',
    daysAgo: 3.5
  },
  {
    authorId: 'seed_user_lisa_tech',
    content: 'Good design is invisible. Great design is a silent, elegant guide that shapes user choices effortlessly. Pay extra attention to your typography, margins, and letter spacing today, folks! 😉 #design #uiux',
    imageUrl: null,
    daysAgo: 3.1
  },
  {
    authorId: 'seed_user_john_doe',
    content: 'Chasing golden hour shadows in the state park this evening. 📸 The way the sunlight filters through the old pines is magic. Nature never ceases to inspire me.',
    imageUrl: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=600&auto=format&fit=crop&q=80',
    daysAgo: 2.7
  },
  {
    authorId: 'seed_user_sarah_writes',
    content: 'Book recommendation of the week: "The Shadow of the Wind" by Carlos Ruiz Zafón. Gorgeous prose, atmosphere, and mystery. Highly recommend to any bibliophile! 📚 Let me know if you read it.',
    imageUrl: null,
    daysAgo: 2.2
  },
  {
    authorId: 'seed_user_mike_codes',
    content: 'Why do programmers wear glasses? Because they cannot C#! 🤓 Classic joke to bring some smiles to your Tuesday workflow.',
    imageUrl: null,
    daysAgo: 1.9
  },
  {
    authorId: 'seed_user_priya_art',
    content: 'Quick sketch during my tea break today. ☕✏️ Trying to practice active anatomy lines and gesture drawing. Consistency is key!',
    imageUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80',
    daysAgo: 1.5
  },
  {
    authorId: 'seed_user_alex_travel',
    content: 'Street food in Bangkok is on another level entirely. This Pad Thai cost me less than $2 and is easily one of the most delicious things I have ever tasted in my life. 🍜🌶️ What is your favorite cuisine?',
    imageUrl: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&auto=format&fit=crop&q=80',
    daysAgo: 1.2
  },
  {
    authorId: 'seed_user_emily_fit',
    content: 'Post-workout green smoothie recipe: Banana, almond butter, baby spinach, chia seeds, oat milk, and a scoop of vanilla protein. 🥬🍌 Healthy, refreshing, and energizing!',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
    daysAgo: 0.9
  },
  {
    authorId: 'seed_user_chef_david',
    content: 'Perfecting the wild sourdough crust. Look at that gorgeous oven spring and ear! 🥖 Took months of failed attempts but the patience has finally paid off.',
    imageUrl: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&auto=format&fit=crop&q=80',
    daysAgo: 0.5
  },
  {
    authorId: 'seed_user_lisa_tech',
    content: 'Currently redesigning our feed experience. The goals: Less solid borders, more generous negative space, lighter font weights, and butter-smooth layout animations. Minimalist but warm. 🎨',
    imageUrl: null,
    daysAgo: 0.3
  },
  {
    authorId: 'seed_user_john_doe',
    content: 'Rainy days are perfect for macro lens photography indoors. Capturing tiny water droplets on house plants is incredibly peaceful. 🌿💧 Take time to appreciate the little details.',
    imageUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&auto=format&fit=crop&q=80',
    daysAgo: 0.1
  }
];

async function seedDatabase() {
  const usersMap = {};
  const now = Date.now();

  // 1. Write Users documents
  console.log('👤 Seeding User Profiles...');
  for (const dummyUser of DUMMY_USERS) {
    const userDocRef = db.collection('users').doc(dummyUser.id);
    const createdTime = new Date(now - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const userProfile = {
      id: dummyUser.id,
      username: dummyUser.username,
      email: dummyUser.email,
      bio: dummyUser.bio,
      profilePic: dummyUser.profilePic,
      createdAt: admin.firestore.Timestamp.fromDate(createdTime),
      followingCount: 0,
      followersCount: 0
    };

    try {
      await userDocRef.set(userProfile);
      console.log(`   ✅ Seeded profile: @${dummyUser.username}`);
      usersMap[dummyUser.id] = dummyUser;
    } catch (err) {
      console.error(`   ❌ Failed to write profile for @${dummyUser.username}:`, err.message);
    }
  }

  // 2. Write Posts with staggered timestamps
  console.log('\n📝 Seeding Social Posts...');
  for (const dummyPost of DUMMY_POSTS) {
    const author = usersMap[dummyPost.authorId];
    if (!author) continue;

    const postTime = new Date(now - dummyPost.daysAgo * 24 * 60 * 60 * 1000);

    const postPayload = {
      userId: author.id,
      authorName: author.username,
      authorPic: author.profilePic,
      content: dummyPost.content,
      imageUrl: dummyPost.imageUrl,
      createdAt: admin.firestore.Timestamp.fromDate(postTime),
      likesCount: 0,
      commentsCount: 0
    };

    try {
      const docRef = await db.collection('posts').add(postPayload);
      console.log(`   ✅ Published post for @${author.username} (${dummyPost.daysAgo.toFixed(1)} days ago)`);
    } catch (err) {
      console.error(`   ❌ Failed to write post for @${author.username}:`, err.message);
    }
  }

  console.log('\n🎉 Seed process successfully completed! Your database has been filled with realistic mock data.');
  process.exit(0);
}

seedDatabase().catch((error) => {
  console.error('Fatal database seeding error:', error);
  process.exit(1);
});
