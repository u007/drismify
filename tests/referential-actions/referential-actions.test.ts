import { parseSchema } from '../../src/parser';
import { translatePslToDrizzleSchema } from '../../src/translator/pslToDrizzle';
import { SchemaDiffer } from '../../src/migrations/schema-differ';

describe('Referential Actions Support', () => {
  describe('Parser', () => {
    it('should parse onDelete referential action', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const postModel = ast.find(item => item.type === 'model' && item.name === 'Post');
      const authorField = postModel.fields.find((field: any) => field.name === 'author');
      const relationAttr = authorField.attributes.find((attr: any) => attr.name === 'relation');

      expect(relationAttr.args.onDelete).toBe('Cascade');
    });

    it('should parse onUpdate referential action', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onUpdate: Restrict)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const postModel = ast.find(item => item.type === 'model' && item.name === 'Post');
      const authorField = postModel.fields.find((field: any) => field.name === 'author');
      const relationAttr = authorField.attributes.find((attr: any) => attr.name === 'relation');

      expect(relationAttr.args.onUpdate).toBe('Restrict');
    });

    it('should parse both onDelete and onUpdate referential actions', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: SetNull)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const postModel = ast.find(item => item.type === 'model' && item.name === 'Post');
      const authorField = postModel.fields.find((field: any) => field.name === 'author');
      const relationAttr = authorField.attributes.find((attr: any) => attr.name === 'relation');

      expect(relationAttr.args.onDelete).toBe('Cascade');
      expect(relationAttr.args.onUpdate).toBe('SetNull');
    });

    it('should parse all supported referential actions', () => {
      const actions = ['Cascade', 'Restrict', 'SetNull', 'SetDefault', 'NoAction'];
      
      actions.forEach(action => {
        const schema = `
          model User {
            id    Int    @id @default(autoincrement())
            posts Post[]
          }

          model Post {
            id       Int  @id @default(autoincrement())
            author   User @relation(fields: [authorId], references: [id], onDelete: ${action})
            authorId Int
          }
        `;

        const ast = parseSchema(schema);
        const postModel = ast.find(item => item.type === 'model' && item.name === 'Post');
        const authorField = postModel.fields.find((field: any) => field.name === 'author');
        const relationAttr = authorField.attributes.find((attr: any) => attr.name === 'relation');

        expect(relationAttr.args.onDelete).toBe(action);
      });
    });
  });

  describe('Translator', () => {
    it('should translate onDelete referential action to Drizzle format', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that the generated schema includes the onDelete action
      expect(drizzleSchema).toContain('onDelete: \'cascade\'');
      expect(drizzleSchema).toContain('.references(() => user.id, { onDelete: \'cascade\' })');
    });

    it('should translate onUpdate referential action to Drizzle format', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onUpdate: Restrict)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that the generated schema includes the onUpdate action
      expect(drizzleSchema).toContain('onUpdate: \'restrict\'');
      expect(drizzleSchema).toContain('.references(() => user.id, { onUpdate: \'restrict\' })');
    });

    it('should translate both onDelete and onUpdate referential actions', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: SetNull)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that the generated schema includes both actions
      expect(drizzleSchema).toContain('onDelete: \'cascade\'');
      expect(drizzleSchema).toContain('onUpdate: \'set null\'');
      expect(drizzleSchema).toContain('.references(() => user.id, { onDelete: \'cascade\', onUpdate: \'set null\' })');
    });
  });

  describe('Migration System', () => {
    it('should generate SQL with ON DELETE clause', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const differ = new SchemaDiffer();
      const changes = differ.diffSchemas([], ast);

      // Find the CREATE TABLE statement for Post
      const createPostTable = changes.find(change => 
        change.type === 'CREATE_TABLE' && 
        change.tableName === 'post'
      );

      expect(createPostTable).toBeDefined();
      expect(createPostTable!.sql).toContain('ON DELETE CASCADE');
      expect(createPostTable!.sql).toContain('FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE');
    });

    it('should generate SQL with ON UPDATE clause', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onUpdate: Restrict)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const differ = new SchemaDiffer();
      const changes = differ.diffSchemas([], ast);

      // Find the CREATE TABLE statement for Post
      const createPostTable = changes.find(change => 
        change.type === 'CREATE_TABLE' && 
        change.tableName === 'post'
      );

      expect(createPostTable).toBeDefined();
      expect(createPostTable!.sql).toContain('ON UPDATE RESTRICT');
      expect(createPostTable!.sql).toContain('FOREIGN KEY ("author_id") REFERENCES "user"("id") ON UPDATE RESTRICT');
    });

    it('should generate SQL with both ON DELETE and ON UPDATE clauses', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }

        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: SetNull)
          authorId Int
        }
      `;

      const ast = parseSchema(schema);
      const differ = new SchemaDiffer();
      const changes = differ.diffSchemas([], ast);

      // Find the CREATE TABLE statement for Post
      const createPostTable = changes.find(change => 
        change.type === 'CREATE_TABLE' && 
        change.tableName === 'post'
      );

      expect(createPostTable).toBeDefined();
      expect(createPostTable!.sql).toContain('ON DELETE CASCADE');
      expect(createPostTable!.sql).toContain('ON UPDATE SET NULL');
      expect(createPostTable!.sql).toContain('FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE SET NULL');
    });

    it('should map all referential actions correctly', () => {
      const actionMappings = [
        { prisma: 'Cascade', sql: 'CASCADE' },
        { prisma: 'Restrict', sql: 'RESTRICT' },
        { prisma: 'SetNull', sql: 'SET NULL' },
        { prisma: 'SetDefault', sql: 'SET DEFAULT' },
        { prisma: 'NoAction', sql: 'NO ACTION' }
      ];

      actionMappings.forEach(({ prisma, sql }) => {
        const schema = `
          model User {
            id    Int    @id @default(autoincrement())
            posts Post[]
          }

          model Post {
            id       Int  @id @default(autoincrement())
            author   User @relation(fields: [authorId], references: [id], onDelete: ${prisma})
            authorId Int
          }
        `;

        const ast = parseSchema(schema);
        const differ = new SchemaDiffer();
        const changes = differ.diffSchemas([], ast);

        const createPostTable = changes.find(change => 
          change.type === 'CREATE_TABLE' && 
          change.tableName === 'post'
        );

        expect(createPostTable).toBeDefined();
        expect(createPostTable!.sql).toContain(`ON DELETE ${sql}`);
      });
    });
  });
});
