import { parseSchema } from '../src/parser';

describe('Parser', () => {
  it('should parse a simple schema', async () => {
    const schema = `
      datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      generator client {
        provider = "drismify"
      }

      model User {
        id        Int      @id @default(autoincrement())
        email     String   @unique
        name      String?
        posts     Post[]
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
      }

      model Post {
        id        Int      @id @default(autoincrement())
        title     String
        content   String?
        published Boolean  @default(false)
        author    User     @relation(fields: [authorId], references: [id])
        authorId  Int
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
      }
    `;

    const ast = await parseSchema(schema);

    // Check that the AST has the expected structure
    expect(ast).toBeInstanceOf(Array);
    expect(ast.length).toBe(4);

    // Check datasource
    const datasource = ast.find(node => node.type === 'datasource');
    expect(datasource).toBeDefined();
    expect(datasource?.name).toBe('db');
    expect(datasource?.assignments.provider).toBe('sqlite');
    expect(datasource?.assignments.url).toBe('file:./dev.db');

    // Check generator
    const generator = ast.find(node => node.type === 'generator');
    expect(generator).toBeDefined();
    expect(generator?.name).toBe('client');
    expect(generator?.assignments.provider).toBe('drismify');

    // Check User model
    const userModel = ast.find(node => node.type === 'model' && node.name === 'User');
    expect(userModel).toBeDefined();
    expect(userModel?.fields.length).toBe(6);

    // Check id field
    const idField = userModel?.fields.find(field => field.name === 'id');
    expect(idField).toBeDefined();
    expect(idField?.type.name).toBe('Int');
    expect(idField?.type.optional).toBe(false);
    expect(idField?.attributes.length).toBe(2);
    expect(idField?.attributes[0].name).toBe('id');
    expect(idField?.attributes[1].name).toBe('default');
    expect(idField?.attributes[1].args.function).toBe('autoincrement');

    // Check Post model
    const postModel = ast.find(node => node.type === 'model' && node.name === 'Post');
    expect(postModel).toBeDefined();
    expect(postModel?.fields.length).toBe(8);

    // Check relation field
    const authorField = postModel?.fields.find(field => field.name === 'author');
    expect(authorField).toBeDefined();
    expect(authorField?.type.name).toBe('User');
    expect(authorField?.type.optional).toBe(false);
    expect(authorField?.attributes.length).toBe(1);
    expect(authorField?.attributes[0].name).toBe('relation');
    expect(authorField?.attributes[0].args.fields).toEqual(['authorId']);
    expect(authorField?.attributes[0].args.references).toEqual(['id']);
  });

  it('should parse enums', async () => {
    const schema = `
      enum Role {
        USER
        ADMIN
      }

      model User {
        id   Int  @id @default(autoincrement())
        role Role @default(USER)
      }
    `;

    const ast = await parseSchema(schema);

    // Check that the AST has the expected structure
    expect(ast).toBeInstanceOf(Array);
    expect(ast.length).toBe(2);

    // Check enum
    const enumNode = ast.find(node => node.type === 'enum');
    expect(enumNode).toBeDefined();
    expect(enumNode?.name).toBe('Role');
    expect(enumNode?.values).toEqual(['USER', 'ADMIN']);

    // Check User model
    const userModel = ast.find(node => node.type === 'model' && node.name === 'User');
    expect(userModel).toBeDefined();

    // Check role field
    const roleField = userModel?.fields.find(field => field.name === 'role');
    expect(roleField).toBeDefined();
    expect(roleField?.type.name).toBe('Role');
    expect(roleField?.attributes.length).toBe(1);
    expect(roleField?.attributes[0].name).toBe('default');
    expect(roleField?.attributes[0].args).toBe('USER');
  });

  it('should parse model attributes', async () => {
    const schema = `
      model User {
        id    Int    @id
        email String @unique
        name  String

        @@index([name])
        @@unique([email, name])
      }
    `;

    const ast = await parseSchema(schema);

    // Check User model
    const userModel = ast.find(node => node.type === 'model' && node.name === 'User');
    expect(userModel).toBeDefined();
    expect(userModel?.attributes.length).toBe(2);

    // Check index attribute
    const indexAttr = userModel?.attributes.find(attr => attr.name === 'index');
    expect(indexAttr).toBeDefined();
    expect(indexAttr?.args.fields).toEqual(['name']);

    // Check unique attribute
    const uniqueAttr = userModel?.attributes.find(attr => attr.name === 'unique');
    expect(uniqueAttr).toBeDefined();
    expect(uniqueAttr?.args.fields).toEqual(['email', 'name']);
  });
});
