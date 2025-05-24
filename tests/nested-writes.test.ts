import { PrismaClient, type User, type Post, type Profile, type Category, type CategoriesOnPosts } from '@generated/nested-writes-client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const schemaPath = path.join(__dirname, 'fixtures', 'nested-writes-schema.prisma');
const dbPath = path.join(__dirname, 'fixtures', 'dev.db'); // Matches the path in the schema

describe('Prisma Client Nested Writes', () => {
  let prisma: PrismaClient;

  beforeAll(async () => { // Make beforeAll async
    // Ensure the database is clean and schema is applied before any tests run.
    // This is a simplified approach for a test environment.
    // In a real project, you might use a more sophisticated migration tool or test database setup.
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    
    try {
      // We've already manually created the client, so we don't need to generate it here
      console.log('Using pre-generated client for tests');
      
      // Check if the main client file exists
      const expectedClientPath = path.resolve(__dirname, '..', 'generated', 'nested-writes-client', 'index.ts');
      if (!fs.existsSync(expectedClientPath)) {
        console.error(`Client file not found at: ${expectedClientPath}`);
        throw new Error(`Client file not found: ${expectedClientPath}`);
      }
      console.log(`Found client file at: ${expectedClientPath}`);
      
      // Create an empty SQLite database file for testing
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // Create an empty file if it doesn't exist
      if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, '');
      }
      
      console.log(`Created test database at: ${dbPath}`);
    } catch (e) {
      console.error('Failed to setup test environment:', e);
      throw e; // Fail fast if setup fails
    }
  });

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`, // Ensure client uses the correct DB path for tests
        },
      },
    });
    // No connect method for Prisma Client v5+; connection is managed automatically.
    // Clean data between tests - this is crucial.
    // For SQLite, deleting and re-pushing schema per test suite (beforeAll) is one way.
    // For per-test cleaning, one might delete all data from tables.
    // Since beforeAll handles schema, this might be less about schema and more about data.
    // However, for simplicity and given the schema push in beforeAll, we'll rely on that for a clean state.
    // If tests within this describe block need more granular data cleaning, add it here.
    // For now, we assume each test starts with an empty DB due to beforeAll.
    // A common pattern:
    // await prisma.categoriesOnPosts.deleteMany({});
    // await prisma.post.deleteMany({});
    // await prisma.category.deleteMany({});
    // await prisma.profile.deleteMany({});
    // await prisma.user.deleteMany({});
    // The order matters due to foreign key constraints.
    // For this setup, `db push --force-reset` in `beforeAll` handles this.
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  // --- I. `create` Operations ---
  describe('`create` Operations', () => {
    describe('To-One Relations', () => {
      it('User with Profile (FK on Profile)', async () => {
        const userWithProfile = await prisma.user.create({
          data: {
            email: 'u1@a.c',
            profile: {
              create: { bio: 'Bio for U1' },
            },
          },
          include: { profile: true },
        });
        expect(userWithProfile.email).toBe('u1@a.c');
        expect(userWithProfile.profile).toBeDefined();
        expect(userWithProfile.profile?.bio).toBe('Bio for U1');
        
        const profileData = userWithProfile.profile;
        if (!profileData) throw new Error("Profile not created for userWithProfile");
        const profile = await prisma.profile.findUnique({ where: { id: profileData.id } });
        expect(profile?.userId).toBe(userWithProfile.id);
      });

      it('Post with new Author (FK on Post)', async () => {
        const postWithNewAuthor = await prisma.post.create({
          data: {
            title: 'P1',
            author: {
              create: { email: 'u2@a.c', name: 'U2' },
            },
          },
          include: { author: true },
        });
        expect(postWithNewAuthor.title).toBe('P1');
        expect(postWithNewAuthor.author).toBeDefined();
        expect(postWithNewAuthor.author?.email).toBe('u2@a.c');
        const authorData = postWithNewAuthor.author;
        if (!authorData) throw new Error("Author not created for postWithNewAuthor");
        expect(postWithNewAuthor.authorId).toBe(authorData.id);
      });

      it('Post with existing Author via authorId (baseline)', async () => {
        const user = await prisma.user.create({ data: { email: 'existing-u-for-p2@a.c' } });
        const post = await prisma.post.create({
          data: { title: 'P2', authorId: user.id },
        });
        expect(post.title).toBe('P2');
        expect(post.authorId).toBe(user.id);
      });

      it('Post with existing Author via connect (FK on Post)', async () => {
        const user = await prisma.user.create({ data: { email: 'existing-u-for-p3@a.c' } });
        const postWithConnectedAuthor = await prisma.post.create({
          data: {
            title: 'P3',
            author: {
              connect: { id: user.id },
            },
          },
        });
        expect(postWithConnectedAuthor.title).toBe('P3');
        expect(postWithConnectedAuthor.authorId).toBe(user.id);
      });
    });

    describe('To-Many Relations (User.posts - FK on Post)', () => {
      it('User with multiple new Posts', async () => {
        const userWithPosts = await prisma.user.create({
          data: {
            email: 'u3@a.c',
            posts: {
              create: [
                { title: 'P5' },
                { title: 'P6', published: true },
              ],
            },
          },
          include: { posts: true },
        });
        expect(userWithPosts.email).toBe('u3@a.c');
        expect(userWithPosts.posts).toHaveLength(2);
        expect(userWithPosts.posts.map(p => p.title)).toEqual(expect.arrayContaining(['P5', 'P6']));
        for (const p of userWithPosts.posts) {
          expect(p.authorId).toBe(userWithPosts.id);
        }
      });

      it('User with single new Post', async () => {
        const userWithSinglePost = await prisma.user.create({
          data: {
            email: 'u4@a.c',
            posts: {
              create: { title: 'P7' },
            },
          },
          include: { posts: true },
        });
        expect(userWithSinglePost.posts).toHaveLength(1);
        expect(userWithSinglePost.posts[0].title).toBe('P7');
        expect(userWithSinglePost.posts[0].authorId).toBe(userWithSinglePost.id);
      });
      
      it('User connecting existing Posts', async () => {
        const p8 = await prisma.post.create({ data: { title: 'P8 Unconnected' } });
        const p9 = await prisma.post.create({ data: { title: 'P9 Unconnected' } });

        const u6 = await prisma.user.create({
          data: {
            email: 'u6@a.c',
            posts: {
              connect: [{ id: p8.id }, { id: p9.id }],
            },
          },
        });

        const updatedP8 = await prisma.post.findUnique({ where: { id: p8.id } });
        const updatedP9 = await prisma.post.findUnique({ where: { id: p9.id } });
        expect(updatedP8?.authorId).toBe(u6.id);
        expect(updatedP9?.authorId).toBe(u6.id);
      });
    });

    describe('Many-to-Many Relations (Post.categories - explicit join table)', () => {
      it('Post connecting to existing Category and creating a new Category via join table', async () => {
        const c1 = await prisma.category.create({ data: { name: 'C1 Existing' } });
        
        const post = await prisma.post.create({
          data: {
            title: 'P10',
            categories: {
              create: [
                { category: { connect: { id: c1.id } } }, // Connects P10 to C1
                { category: { create: { name: 'NewCat from P10' } } }, // Creates NewCat and connects P10 to it
              ],
            },
          },
          include: { categories: { include: { category: true } } },
        });

        expect(post.title).toBe('P10');
        expect(post.categories).toHaveLength(2);

        const createdCategory = await prisma.category.findUnique({ where: { name: 'NewCat from P10' } });
        expect(createdCategory).toBeDefined();

        const joinRecords = await prisma.categoriesOnPosts.findMany({ where: { postId: post.id } });
        expect(joinRecords).toHaveLength(2);
        if (!createdCategory) throw new Error("Category was not created as expected");
        expect(joinRecords.map(j => j.categoryId)).toEqual(expect.arrayContaining([c1.id, createdCategory.id]));

        // Verify through included categories
        const categoryNames = post.categories.map(cop => cop.category.name);
        expect(categoryNames).toEqual(expect.arrayContaining(['C1 Existing', 'NewCat from P10']));
      });
    });
  });
  
  // --- II. `update` Operations ---
  describe('`update` Operations', () => {
    describe('To-One Relations', () => {
      it('User: create Profile on update', async () => {
        const u1 = await prisma.user.create({ data: { email: 'u1-update@a.c' } });
        const updatedU1 = await prisma.user.update({
          where: { id: u1.id },
          data: { profile: { create: { bio: 'Profile for U1 (update)' } } },
          include: { profile: true },
        });
        expect(updatedU1.profile).toBeDefined();
        expect(updatedU1.profile?.bio).toBe('Profile for U1 (update)');
        expect(updatedU1.profile?.userId).toBe(u1.id);
      });

      it('User: disconnect Profile (Profile deleted due to required relation)', async () => {
        const u2 = await prisma.user.create({
          data: { email: 'u2-disconnect@a.c', profile: { create: { bio: 'Profile for U2' } } },
          include: { profile: true },
        });
        const u2Profile = u2.profile;
        if (!u2Profile) throw new Error("Profile not created for u2");
        const profileId = u2Profile.id;

        // Since Profile.userId is required, disconnect should delete the Profile.
        // If it were optional, userId would become null.
        await prisma.user.update({
          where: { id: u2.id },
          data: { profile: { disconnect: true } }, 
        });
        
        const disconnectedUser = await prisma.user.findUnique({ where: { id: u2.id }, include: { profile: true } });
        expect(disconnectedUser?.profile).toBeNull();

        const deletedProfile = await prisma.profile.findUnique({ where: { id: profileId } });
        expect(deletedProfile).toBeNull(); // Verify profile is deleted
      });
      
      it('Post: connect, re-connect, disconnect, create Author', async () => {
        let p1 = await prisma.post.create({ data: { title: 'P1 Update Author' } });
        const u1_for_p1 = await prisma.user.create({ data: { email: 'u1-for-p1@a.c' } });
        const u2_for_p1 = await prisma.user.create({ data: { email: 'u2-for-p1@a.c' } });

        // Connect U1
        p1 = await prisma.post.update({ where: { id: p1.id }, data: { author: { connect: { id: u1_for_p1.id } } } });
        expect(p1.authorId).toBe(u1_for_p1.id);

        // Connect U2 (re-connect)
        p1 = await prisma.post.update({ where: { id: p1.id }, data: { author: { connect: { id: u2_for_p1.id } } } });
        expect(p1.authorId).toBe(u2_for_p1.id);
        
        // Disconnect author
        p1 = await prisma.post.update({ where: { id: p1.id }, data: { author: { disconnect: true } } });
        expect(p1.authorId).toBeNull();

        // Create new author
        const updatedP1WithNewAuthor = await prisma.post.update({
          where: { id: p1.id },
          data: { author: { create: { email: 'newauthor-p1@a.c' } } },
          include: { author: true },
        });
        expect(updatedP1WithNewAuthor.author).toBeDefined();
        expect(updatedP1WithNewAuthor.author?.email).toBe('newauthor-p1@a.c');
        expect(p1.authorId).not.toBe(updatedP1WithNewAuthor.authorId); // Ensure it's a new ID
      });
    });

    describe('To-Many Relations (User.posts - FK on Post)', () => {
      let u1_tm: User; // User for to-many tests
      let p1_tm_un: Post;
      let p2_tm_un: Post; // Unassociated posts
      let p3_tm_assoc: Post; // Associated post

      beforeEach(async () => {
        // Clean up from previous specific tests if any
        await prisma.categoriesOnPosts.deleteMany({});
        await prisma.post.deleteMany({});
        await prisma.category.deleteMany({});
        await prisma.profile.deleteMany({});
        await prisma.user.deleteMany({});

        u1_tm = await prisma.user.create({ data: { email: 'u1-tomany@a.c' } });
        p1_tm_un = await prisma.post.create({ data: { title: 'P1 Unassoc' } });
        p2_tm_un = await prisma.post.create({ data: { title: 'P2 Unassoc' } });
        p3_tm_assoc = await prisma.post.create({ data: { title: 'P3 Assoc', authorId: u1_tm.id } });
      });

      it('User: create new Post via update', async () => {
        await prisma.user.update({
          where: { id: u1_tm.id },
          data: { posts: { create: [{ title: 'New Post for U1 via update' }] } },
        });
        const postsForU1 = await prisma.post.findMany({ where: { authorId: u1_tm.id } });
        expect(postsForU1.map(p => p.title)).toEqual(expect.arrayContaining(['P3 Assoc', 'New Post for U1 via update']));
      });

      it('User: connect existing Posts via update', async () => {
        await prisma.user.update({
          where: { id: u1_tm.id },
          data: { posts: { connect: [{ id: p1_tm_un.id }, { id: p2_tm_un.id }] } },
        });
        const p1Updated = await prisma.post.findUnique({ where: { id: p1_tm_un.id } });
        const p2Updated = await prisma.post.findUnique({ where: { id: p2_tm_un.id } });
        expect(p1Updated?.authorId).toBe(u1_tm.id);
        expect(p2Updated?.authorId).toBe(u1_tm.id);
      });

      it('User: disconnect a Post via update', async () => {
        await prisma.user.update({
          where: { id: u1_tm.id },
          data: { posts: { disconnect: [{ id: p3_tm_assoc.id }] } },
        });
        const p3Updated = await prisma.post.findUnique({ where: { id: p3_tm_assoc.id } });
        expect(p3Updated?.authorId).toBeNull();
      });

      it('User: delete a Post via update', async () => {
        await prisma.user.update({
          where: { id: u1_tm.id },
          data: { posts: { delete: [{ id: p3_tm_assoc.id }] } },
        });
        const p3Deleted = await prisma.post.findUnique({ where: { id: p3_tm_assoc.id } });
        expect(p3Deleted).toBeNull();
      });
      
      it('User: updateMany Posts via update', async () => {
        // Create another post for u1_tm to test updateMany
        await prisma.post.create({ data: { title: 'P4 for U1 updateMany', authorId: u1_tm.id, published: false } });
        await prisma.post.create({ data: { title: 'P5 for U1 updateMany', authorId: u1_tm.id, published: false } });
        
        await prisma.user.update({
          where: { id: u1_tm.id },
          data: {
            posts: {
              updateMany: {
                where: { published: false, authorId: u1_tm.id }, // Important to scope where to this user's posts
                data: { published: true },
              },
            },
          },
        });
        const updatedPosts = await prisma.post.findMany({ where: { authorId: u1_tm.id, title: { contains: 'updateMany' } } });
        for (const p of updatedPosts) {
          expect(p.published).toBe(true);
        }
      });

      it('User: deleteMany Posts via update', async () => {
         await prisma.post.create({ data: { title: 'P_DM_1 New for U1', authorId: u1_tm.id } });
         await prisma.post.create({ data: { title: 'P_DM_2 New for U1', authorId: u1_tm.id } });

        await prisma.user.update({
          where: { id: u1_tm.id },
          data: {
            posts: {
              deleteMany: {
                where: { title: { contains: 'New for U1' }, authorId: u1_tm.id }, // Scope to this user
              },
            },
          },
        });
        const deletedPosts = await prisma.post.findMany({ where: { authorId: u1_tm.id, title: { contains: 'New for U1' } } });
        expect(deletedPosts).toHaveLength(0);
      });
    });
    
    describe('Many-to-Many Relations (Post.categories - explicit join table)', () => {
      let p1_m2m: Post;
      let c1_m2m: Category;
      let c2_m2m: Category;

      beforeEach(async () => {
        // Clean up from previous specific tests if any
        await prisma.categoriesOnPosts.deleteMany({});
        await prisma.post.deleteMany({});
        await prisma.category.deleteMany({});
        await prisma.profile.deleteMany({});
        await prisma.user.deleteMany({});

        p1_m2m = await prisma.post.create({ data: { title: 'P1 M2M' } });
        c1_m2m = await prisma.category.create({ data: { name: 'C1 M2M' } });
        c2_m2m = await prisma.category.create({ data: { name: 'C2 M2M' } });
      });

      it('Post: create join records via categories.create', async () => {
        await prisma.post.update({
          where: { id: p1_m2m.id },
          data: {
            categories: {
              create: [
                { category: { connect: { id: c1_m2m.id } } },
                { category: { connect: { id: c2_m2m.id } } },
              ],
            },
          },
        });
        const joinRecords = await prisma.categoriesOnPosts.findMany({ where: { postId: p1_m2m.id } });
        expect(joinRecords).toHaveLength(2);
        expect(joinRecords.map(j => j.categoryId)).toEqual(expect.arrayContaining([c1_m2m.id, c2_m2m.id]));
      });

      it('Post: deleteMany join records via categories.deleteMany', async () => {
        // First, create some join records
        await prisma.categoriesOnPosts.create({ data: { postId: p1_m2m.id, categoryId: c1_m2m.id } });
        await prisma.categoriesOnPosts.create({ data: { postId: p1_m2m.id, categoryId: c2_m2m.id } });
        
        await prisma.post.update({
          where: { id: p1_m2m.id },
          data: {
            categories: {
              deleteMany: { where: { categoryId: c1_m2m.id } }, // Note: This is a where on CategoriesOnPosts
            },
          },
        });
        const remainingJoins = await prisma.categoriesOnPosts.findMany({ where: { postId: p1_m2m.id } });
        expect(remainingJoins).toHaveLength(1);
        expect(remainingJoins[0].categoryId).toBe(c2_m2m.id);
      });
      
      it('Post: updateMany join records via categories.updateMany', async () => {
        const oldDate = new Date(Date.now() - 100000);
        await prisma.categoriesOnPosts.create({ data: { postId: p1_m2m.id, categoryId: c1_m2m.id, assignedAt: oldDate } });
        await prisma.categoriesOnPosts.create({ data: { postId: p1_m2m.id, categoryId: c2_m2m.id, assignedAt: oldDate } });
        
        const newDate = new Date();
        await prisma.post.update({
          where: { id: p1_m2m.id },
          data: {
            categories: {
              updateMany: {
                where: { categoryId: c2_m2m.id }, // This is a where on CategoriesOnPosts
                data: { assignedAt: newDate },
              },
            },
          },
        });
        const c1Join = await prisma.categoriesOnPosts.findUnique({ where: { postId_categoryId: { postId: p1_m2m.id, categoryId: c1_m2m.id } } });
        const c2Join = await prisma.categoriesOnPosts.findUnique({ where: { postId_categoryId: { postId: p1_m2m.id, categoryId: c2_m2m.id } } });
        
        // Dates can be tricky due to precision. Check if close enough or just that it changed.
        expect(c1Join?.assignedAt.toISOString()).toBe(oldDate.toISOString());
        // For c2Join, check if it's updated (not oldDate). Allow for minor ms differences.
        expect(c2Join?.assignedAt.getTime()).toBeGreaterThanOrEqual(newDate.getTime() - 1000); // Check it's very recent
        expect(c2Join?.assignedAt.getTime()).toBeLessThanOrEqual(newDate.getTime() + 1000); // Check it's very recent
      });
    });
  });
});

// Helper function to get a clean Prisma client instance for tests if needed outside beforeEach
// async function getPrismaTestInstance(): Promise<PrismaClient> {
//   const client = new PrismaClient({
//     datasources: {
//       db: {
//         url: `file:${dbPath}`,
//       },
//     },
//   });
//   return client;
// }
