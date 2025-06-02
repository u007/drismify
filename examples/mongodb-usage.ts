/**
 * MongoDB Usage Example with Drismify
 * 
 * This example demonstrates how to use Drismify with MongoDB,
 * including basic operations, transactions, and MongoDB-specific features.
 */

import { DrismifyClient } from '../src/client/base-client';
import { MongoDBAdapter } from '../src/adapters/mongodb-adapter';

// Example MongoDB schema (schema.prisma)
/*
generator client {
  provider = "drismify"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model User {
  id       String   @id @default(auto()) @map("_id") @db.ObjectId
  email    String   @unique
  name     String?
  posts    Post[]
  profile  Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String   @db.ObjectId
  tags      String[]
  metadata  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Profile {
  id     String @id @default(auto()) @map("_id") @db.ObjectId
  bio    String
  user   User   @relation(fields: [userId], references: [id])
  userId String @unique @db.ObjectId
}
*/

async function mongoDBExample() {
  // Import MongoDB configuration
  const { getMongoDBConfig, getMongoDBConnectionOptions } = await import('../src/config/mongodb.config');
  const mongoConfig = getMongoDBConfig('example');
  const connectionOptions = getMongoDBConnectionOptions(mongoConfig);

  // Create MongoDB adapter
  const adapter = new MongoDBAdapter(connectionOptions);

  // Create Drismify client with MongoDB adapter
  const client = new DrismifyClient({
    adapter: 'mongodb',
    datasources: {
      db: {
        url: mongoConfig.url,
        database: mongoConfig.database
      }
    }
  });

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    // Get MongoDB-specific collections
    const usersCollection = adapter.getCollection('User');
    const postsCollection = adapter.getCollection('Post');
    const profilesCollection = adapter.getCollection('Profile');

    // Example 1: Basic CRUD Operations
    console.log('\n=== Basic CRUD Operations ===');

    // Create a user
    const newUser = await usersCollection.insertOne({
      email: 'john@example.com',
      name: 'John Doe',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('Created user:', newUser.insertedId);

    // Find the user
    const user = await usersCollection.findOne({ 
      email: 'john@example.com' 
    });
    console.log('Found user:', user);

    // Update the user
    const updateResult = await usersCollection.updateOne(
      { email: 'john@example.com' },
      { 
        $set: { 
          name: 'John Smith',
          updatedAt: new Date()
        }
      }
    );
    console.log('Updated user:', updateResult.modifiedCount);

    // Example 2: Working with Arrays and JSON
    console.log('\n=== Arrays and JSON Operations ===');

    if (user) {
      // Create a post with tags and metadata
      const newPost = await postsCollection.insertOne({
        title: 'Getting Started with MongoDB',
        content: 'MongoDB is a great NoSQL database...',
        published: true,
        authorId: user._id,
        tags: ['mongodb', 'nosql', 'database'],
        metadata: {
          category: 'tutorial',
          difficulty: 'beginner',
          estimatedReadTime: 5
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Created post:', newPost.insertedId);

      // Query posts by tags
      const tutorialPosts = await postsCollection.find({
        tags: { $in: ['tutorial', 'mongodb'] }
      }).toArray();
      console.log('Tutorial posts:', tutorialPosts.length);

      // Query by JSON metadata
      const beginnerPosts = await postsCollection.find({
        'metadata.difficulty': 'beginner'
      }).toArray();
      console.log('Beginner posts:', beginnerPosts.length);
    }

    // Example 3: Aggregation Pipeline
    console.log('\n=== Aggregation Pipeline ===');

    const userStats = await usersCollection.aggregate([
      {
        $lookup: {
          from: 'Post',
          localField: '_id',
          foreignField: 'authorId',
          as: 'posts'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          postCount: { $size: '$posts' },
          publishedPosts: {
            $size: {
              $filter: {
                input: '$posts',
                cond: { $eq: ['$$this.published', true] }
              }
            }
          }
        }
      }
    ]).toArray();
    console.log('User stats:', userStats);

    // Example 4: Transactions
    console.log('\n=== Transactions ===');

    const result = await adapter.transaction(async (session) => {
      // In a real implementation, you would use the session for operations
      // For now, this demonstrates the transaction structure
      console.log('Executing transaction...');
      return 'Transaction completed successfully';
    });
    console.log('Transaction result:', result);

    // Example 5: Text Search (if text index exists)
    console.log('\n=== Text Search ===');

    try {
      // Create text index (you might need to do this manually in MongoDB)
      await postsCollection.createIndex({ 
        title: 'text', 
        content: 'text' 
      });

      // Perform text search
      const searchResults = await postsCollection.find({
        $text: { $search: 'mongodb database' }
      }).toArray();
      console.log('Search results:', searchResults.length);
    } catch (error) {
      console.log('Text search not available (index may not exist)');
    }

    // Example 6: Geospatial Queries (if you have location data)
    console.log('\n=== Geospatial Example ===');

    // This would work if you had location data in your schema
    // const nearbyUsers = await usersCollection.find({
    //   location: {
    //     $near: {
    //       $geometry: { type: 'Point', coordinates: [-73.9857, 40.7484] },
    //       $maxDistance: 1000
    //     }
    //   }
    // }).toArray();

    console.log('MongoDB example completed successfully!');

  } catch (error) {
    console.error('Error in MongoDB example:', error);
  } finally {
    // Disconnect from MongoDB
    await client.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the example
if (require.main === module) {
  mongoDBExample().catch(console.error);
}

export { mongoDBExample };
