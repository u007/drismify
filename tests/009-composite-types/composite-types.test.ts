import { parseSchema } from '../../src/parser';
import { translatePslToDrizzleSchema } from '../../src/translator/pslToDrizzle';
import { ClientGenerator } from '../../src/generator/client-generator';
import * as fs from 'fs';
import * as path from 'path';
import { getFixture, createTestSchema, cleanupTestFiles } from '../utils/test-utils';

describe('Composite Types', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = path.join(__dirname, '../../temp/composite-types-test');
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('Schema Parsing', () => {
    it('should parse composite type definitions', () => {
      const schema = getFixture('composite-types-schema.prisma');
      const ast = parseSchema(schema);

      // Find composite types in AST
      const compositeTypes = ast.filter(node => node.type === 'type');
      expect(compositeTypes).toHaveLength(4); // Address, ContactInfo, Coordinates, PersonalInfo

      // Check Address type
      const addressType = compositeTypes.find(t => t.name === 'Address');
      expect(addressType).toBeDefined();
      expect(addressType?.fields).toHaveLength(5);
      expect(addressType?.fields.map(f => f.name)).toEqual(['street', 'city', 'state', 'zip', 'country']);

      // Check ContactInfo type
      const contactType = compositeTypes.find(t => t.name === 'ContactInfo');
      expect(contactType).toBeDefined();
      expect(contactType?.fields).toHaveLength(3);
      expect(contactType?.fields[1].type.optional).toBe(true); // phone is optional
      expect(contactType?.fields[2].type.optional).toBe(true); // website is optional

      // Check PersonalInfo type (nested composite)
      const personalInfoType = compositeTypes.find(t => t.name === 'PersonalInfo');
      expect(personalInfoType).toBeDefined();
      expect(personalInfoType?.fields).toHaveLength(5);

      // Check that address field uses Address composite type
      const addressField = personalInfoType?.fields.find(f => f.name === 'address');
      expect(addressField?.type.name).toBe('Address');
    });

    it('should parse models using composite types', () => {
      const schema = getFixture('composite-types-schema.prisma');
      const ast = parseSchema(schema);

      // Find models in AST
      const models = ast.filter(node => node.type === 'model');
      expect(models).toHaveLength(2); // User, Business

      // Check User model
      const userModel = models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();

      const personalInfoField = userModel?.fields.find(f => f.name === 'personalInfo');
      expect(personalInfoField).toBeDefined();
      expect(personalInfoField?.type.name).toBe('PersonalInfo');
      expect(personalInfoField?.type.optional).toBe(false);

      // Check Business model
      const businessModel = models.find(m => m.name === 'Business');
      expect(businessModel).toBeDefined();

      const addressField = businessModel?.fields.find(f => f.name === 'address');
      expect(addressField?.type.name).toBe('Address');

      const coordinatesField = businessModel?.fields.find(f => f.name === 'coordinates');
      expect(coordinatesField?.type.name).toBe('Coordinates');
      expect(coordinatesField?.type.optional).toBe(true);
    });
  });

  describe('Schema Translation', () => {
    it('should generate TypeScript types for composite types', () => {
      const schema = getFixture('composite-types-schema.prisma');
      const ast = parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that composite types are generated
      expect(drizzleSchema).toContain('export type Address = {');
      expect(drizzleSchema).toContain('  street: string;');
      expect(drizzleSchema).toContain('  city: string;');
      expect(drizzleSchema).toContain('  country: string;');

      expect(drizzleSchema).toContain('export type ContactInfo = {');
      expect(drizzleSchema).toContain('  email: string;');
      expect(drizzleSchema).toContain('  phone: string | null;');
      expect(drizzleSchema).toContain('  website: string | null;');

      expect(drizzleSchema).toContain('export type Coordinates = {');
      expect(drizzleSchema).toContain('  latitude: number;');
      expect(drizzleSchema).toContain('  longitude: number;');

      expect(drizzleSchema).toContain('export type PersonalInfo = {');
      expect(drizzleSchema).toContain('  address: Address;');
      expect(drizzleSchema).toContain('  contact: ContactInfo;');
    });

    it('should store composite type fields as JSON in database schema', () => {
      const schema = getFixture('composite-types-schema.prisma');
      const ast = parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that composite type fields are stored as JSON
      expect(drizzleSchema).toContain("personalInfo: text('personal_info', { mode: 'json' }).$type<PersonalInfo>()");
      expect(drizzleSchema).toContain("address: text('address', { mode: 'json' }).$type<Address>()");
      expect(drizzleSchema).toContain("contact: text('contact', { mode: 'json' }).$type<ContactInfo>()");
      expect(drizzleSchema).toContain("coordinates: text('coordinates', { mode: 'json' }).$type<Coordinates>()");
    });

    it('should handle enum types alongside composite types', () => {
      const schema = getFixture('composite-types-schema.prisma');
      const ast = parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that enums are still generated correctly
      expect(drizzleSchema).toContain('export type UserRole = ');
      expect(drizzleSchema).toContain("'USER' | 'ADMIN' | 'MODERATOR'");

      // Check that enum fields are handled correctly
      expect(drizzleSchema).toContain("role: text('role').$type<UserRole>().default(\"USER\")");
    });
  });

  describe('Client Generation', () => {
    it('should generate client with composite type support', async () => {
      const schema = getFixture('composite-types-schema.prisma');
      const schemaPath = createTestSchema(schema);

      const generator = new ClientGenerator({
        outputDir,
        generateTypes: true,
        generateJs: false,
        generatePackageJson: false,
        generateReadme: false
      });

      await generator.generateFromSchemaFile(schemaPath);

      // Check that types file was generated
      const typesPath = path.join(outputDir, 'types.ts');
      expect(fs.existsSync(typesPath)).toBe(true);

      const typesContent = fs.readFileSync(typesPath, 'utf-8');

      // Check composite types are in types file
      expect(typesContent).toContain('export type Address = {');
      expect(typesContent).toContain('export type ContactInfo = {');
      expect(typesContent).toContain('export type PersonalInfo = {');

      // Check model types use composite types
      expect(typesContent).toContain('export type User = {');
      expect(typesContent).toContain('personalInfo: PersonalInfo;');

      expect(typesContent).toContain('export type Business = {');
      expect(typesContent).toContain('address: Address;');
      expect(typesContent).toContain('contact: ContactInfo;');
      expect(typesContent).toContain('coordinates?: Coordinates;');

      // Check input types are generated for composite types
      expect(typesContent).toContain('export type UserCreateInput = {');
      expect(typesContent).toContain('personalInfo: PersonalInfo;');
    });

    it('should generate model files that handle composite types', async () => {
      const schema = getFixture('composite-types-schema.prisma');
      const schemaPath = createTestSchema(schema);

      const generator = new ClientGenerator({
        outputDir,
        generateTypes: true,
        generateJs: false,
        generatePackageJson: false,
        generateReadme: false
      });

      await generator.generateFromSchemaFile(schemaPath);

      // Check that model files were generated
      const userModelPath = path.join(outputDir, 'models/user.ts');
      const businessModelPath = path.join(outputDir, 'models/business.ts');

      expect(fs.existsSync(userModelPath)).toBe(true);
      expect(fs.existsSync(businessModelPath)).toBe(true);

      // Check that model files are generated correctly
      const userContent = fs.readFileSync(userModelPath, 'utf-8');
      expect(userContent).toContain('export class User extends BaseModelClient');

      const businessContent = fs.readFileSync(businessModelPath, 'utf-8');
      expect(businessContent).toContain('export class Business extends BaseModelClient');
    });
  });

  describe('Runtime Usage', () => {
    it('should handle composite types in create operations', () => {
      const schema = getFixture('composite-types-schema.prisma');
      const ast = parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Verify that the schema includes composite types as JSON fields
      expect(drizzleSchema).toContain("text('personal_info', { mode: 'json' }).$type<PersonalInfo>()");
      expect(drizzleSchema).toContain("text('address', { mode: 'json' }).$type<Address>()");

      // This test verifies the schema generation is correct for runtime usage
      // The actual runtime testing would require a full client setup with database
    });

    it('should support nested composite types', () => {
      const schema = getFixture('composite-types-schema.prisma');
      const ast = parseSchema(schema);

      // Find PersonalInfo type which contains nested Address and ContactInfo
      const personalInfoType = ast.find(node => node.type === 'type' && node.name === 'PersonalInfo');
      expect(personalInfoType).toBeDefined();

      const addressField = personalInfoType?.fields.find(f => f.name === 'address');
      expect(addressField?.type.name).toBe('Address');

      const contactField = personalInfoType?.fields.find(f => f.name === 'contact');
      expect(contactField?.type.name).toBe('ContactInfo');
    });
  });
});
