// Example usage of the generated client

import * as path from 'path';
import * as fs from 'fs';
import { ClientGenerator } from '../generator/client-generator';

async function generateClient() {
  console.log('Generating client from schema...');
  
  const schemaPath = path.resolve('test-schema.prisma');
  const outputDir = path.resolve('./generated/client');
  
  // Create the output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const generator = new ClientGenerator({
    outputDir,
    generateTypes: true,
    generateJs: true,
    generatePackageJson: true,
    generateReadme: true
  });
  
  await generator.generateFromSchemaFile(schemaPath);
  console.log(`Client generated successfully at ${outputDir}`);
  
  return outputDir;
}

async function useClient() {
  console.log('Using the generated client...');
  
  // Import the generated client
  // Note: In a real application, you would import from the generated directory
  // This is just a demonstration of how it would be used
  const { PrismaClient } = require('../../generated/client');
  
  // Create a client instance
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:./dev.db'
      }
    },
    debug: true,
    log: ['query']
  });
  
  try {
    // Connect to the database
    await prisma.connect();
    console.log('Connected to the database');
    
    // Create a user
    const user = await prisma.user.create({
      name: 'John Doe',
      email: 'john@example.com',
      role: 'USER'
    });
    console.log('Created user:', user);
    
    // Create a post
    const post = await prisma.post.create({
      title: 'Hello World',
      content: 'This is my first post',
      published: true,
      authorId: user.id,
      status: 'PUBLISHED'
    });
    console.log('Created post:', post);
    
    // Find all users
    const users = await prisma.user.findMany({
      include: {
        posts: true
      }
    });
    console.log('All users:', users);
    
    // Find a user by ID
    const foundUser = await prisma.user.findUnique({
      where: {
        id: user.id
      },
      include: {
        posts: true
      }
    });
    console.log('Found user:', foundUser);
    
    // Update a post
    const updatedPost = await prisma.post.update({
      where: {
        id: post.id
      },
      data: {
        title: 'Updated Title'
      }
    });
    console.log('Updated post:', updatedPost);
    
    // Delete a post
    const deletedPost = await prisma.post.delete({
      where: {
        id: post.id
      }
    });
    console.log('Deleted post:', deletedPost);
    
    // Delete a user
    const deletedUser = await prisma.user.delete({
      where: {
        id: user.id
      }
    });
    console.log('Deleted user:', deletedUser);
    
    // Disconnect from the database
    await prisma.disconnect();
    console.log('Disconnected from the database');
  } catch (error) {
    console.error('Error:', error);
    
    // Ensure we disconnect even if there's an error
    await prisma.disconnect();
  }
}

// Run the example
async function main() {
  try {
    // Generate the client
    await generateClient();
    
    // Use the client
    // Note: This would fail unless you've set up the database with the correct schema
    // This is just a demonstration of how it would be used
    console.log('\nTo use the client, you would:');
    console.log('1. Import the PrismaClient from the generated directory');
    console.log('2. Create a client instance with your database connection options');
    console.log('3. Connect to the database');
    console.log('4. Use the client to interact with your data');
    console.log('5. Disconnect from the database when done');
    
    // Uncomment to actually use the client (requires database setup)
    // await useClient();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { generateClient, useClient };
