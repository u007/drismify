/**
 * Example of using Drismify extensions
 * This example demonstrates how to use the $extends API to add custom functionality to the Drismify client
 */

import { PrismaClient, Drismify } from '../generated/client';

// Create a new Prisma client
const prisma = new PrismaClient();

// Example 1: Add a custom method to a specific model
const prismaWithUserExtension = prisma.$extends({
  name: 'UserExtension',
  model: {
    user: {
      async signUp(email: string, name: string) {
        return this.create({
          data: {
            email,
            name
          }
        });
      },
      
      async findByEmail(email: string) {
        return this.findFirst({
          where: {
            email
          }
        });
      }
    }
  }
});

// Example 2: Add a custom method to all models
const prismaWithAllModelsExtension = prisma.$extends({
  name: 'AllModelsExtension',
  model: {
    $allModels: {
      async exists(where: any) {
        const context = Drismify.getExtensionContext(this);
        const result = await (context as any).findFirst({ where });
        return result !== null;
      }
    }
  }
});

// Example 3: Add a client-level method
const prismaWithClientExtension = prisma.$extends({
  name: 'ClientExtension',
  client: {
    async healthCheck() {
      try {
        await this.$executeRaw('SELECT 1');
        return { status: 'ok' };
      } catch (error) {
        return { status: 'error', error };
      }
    }
  }
});

// Example 4: Modify queries with the query extension
const prismaWithQueryExtension = prisma.$extends({
  name: 'QueryExtension',
  query: {
    user: {
      findMany(args) {
        return {
          ...args,
          orderBy: { createdAt: 'desc' }
        };
      }
    }
  }
});

// Example 5: Add computed fields with the result extension
const prismaWithResultExtension = prisma.$extends({
  name: 'ResultExtension',
  result: {
    user: {
      fullName: {
        needs: { firstName: true, lastName: true },
        compute(user) {
          return `${user.firstName} ${user.lastName}`;
        }
      }
    }
  }
});

// Example 6: Combine multiple extensions
const combinedExtension = Drismify.defineExtension({
  name: 'CombinedExtension',
  model: {
    user: {
      async signUp(email: string, name: string) {
        return this.create({
          data: {
            email,
            name
          }
        });
      }
    },
    $allModels: {
      async exists(where: any) {
        const context = Drismify.getExtensionContext(this);
        const result = await (context as any).findFirst({ where });
        return result !== null;
      }
    }
  },
  client: {
    async healthCheck() {
      try {
        await this.$executeRaw('SELECT 1');
        return { status: 'ok' };
      } catch (error) {
        return { status: 'error', error };
      }
    }
  }
});

const prismaWithCombinedExtensions = prisma.$extends(combinedExtension);

// Example 7: Chain extensions
const chainedExtensions = prisma
  .$extends({
    name: 'Extension1',
    model: {
      user: {
        async signUp(email: string, name: string) {
          return this.create({
            data: {
              email,
              name
            }
          });
        }
      }
    }
  })
  .$extends({
    name: 'Extension2',
    client: {
      async healthCheck() {
        try {
          await this.$executeRaw('SELECT 1');
          return { status: 'ok' };
        } catch (error) {
          return { status: 'error', error };
        }
      }
    }
  });

// Usage examples
async function main() {
  // Connect to the database
  await prisma.connect();
  
  try {
    // Example 1: Use the user extension
    const user = await prismaWithUserExtension.user.signUp('john@example.com', 'John Doe');
    console.log('User created:', user);
    
    const foundUser = await prismaWithUserExtension.user.findByEmail('john@example.com');
    console.log('Found user:', foundUser);
    
    // Example 2: Use the all models extension
    const userExists = await prismaWithAllModelsExtension.user.exists({ email: 'john@example.com' });
    console.log('User exists:', userExists);
    
    // Example 3: Use the client extension
    const healthStatus = await prismaWithClientExtension.healthCheck();
    console.log('Health status:', healthStatus);
    
    // Example 4: Use the query extension
    const users = await prismaWithQueryExtension.user.findMany();
    console.log('Users (ordered by createdAt desc):', users);
    
    // Example 5: Use the result extension
    const userWithFullName = await prismaWithResultExtension.user.findFirst({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true
      }
    });
    console.log('User with full name:', userWithFullName);
    
    // Example 6: Use the combined extensions
    const combinedUser = await prismaWithCombinedExtensions.user.signUp('jane@example.com', 'Jane Doe');
    console.log('Combined user created:', combinedUser);
    
    const combinedHealthStatus = await prismaWithCombinedExtensions.healthCheck();
    console.log('Combined health status:', combinedHealthStatus);
    
    // Example 7: Use the chained extensions
    const chainedUser = await chainedExtensions.user.signUp('bob@example.com', 'Bob Smith');
    console.log('Chained user created:', chainedUser);
    
    const chainedHealthStatus = await chainedExtensions.healthCheck();
    console.log('Chained health status:', chainedHealthStatus);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect from the database
    await prisma.disconnect();
  }
}

// Run the example
main().catch(console.error);
