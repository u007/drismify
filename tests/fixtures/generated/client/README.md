# Drismify Client

This is a generated client for interacting with your database using Drismify.

## Usage

```typescript
import { PrismaClient } from './index';

const prisma = new PrismaClient();

async function main() {
  // Connect to the database
  await prisma.connect();

  // Use the client
  const users = await prisma.user.findMany();
  console.log(users);

  // Disconnect from the database
  await prisma.disconnect();
}

main().catch(console.error);
```
