# API Routes Security

All API routes in this directory are **automatically protected** by Clerk middleware.

## Security Guarantees

### 1. Authentication Check (Automatic)
All API routes are protected by `clerkMiddleware()` which:
- Validates JWT tokens
- Rejects unauthenticated requests
- Ensures valid user session

### 2. Organization Context (Manual)
API routes that need organization context should use:

```typescript
import { requireOrganization } from "@/lib/organization";

export async function POST(req: Request) {
  const { userId, orgId, orgRole } = await requireOrganization();

  // Your logic here - orgId is guaranteed to exist
}
```

### 3. Permission Checks (Manual)
For role-based or permission-based access:

```typescript
import { requireOrganizationAdmin, hasPermission } from "@/lib/organization";

export async function DELETE(req: Request) {
  // Require admin role
  await requireOrganizationAdmin();

  // OR check specific permission
  if (!(await hasPermission('contacts:delete'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Your logic here
}
```

## Data Scoping Best Practices

### ✅ Always Scope by Organization

```typescript
// Good - uses verified orgId from server
const { orgId } = await requireOrganization();
const contacts = await db.contacts.findMany({
  where: { organizationId: orgId }
});
```

### ❌ Never Trust Client-Provided IDs

```typescript
// Bad - client can manipulate this!
const orgId = req.headers.get('x-org-id');

// Bad - client can manipulate this!
const { organizationId } = await req.json();
```

## Current API Routes

### `/api/chat` - Prospector AI Chat
- ✅ Authentication required
- ✅ Organization context required
- 🔒 Secured with `requireOrganization()`
- Streams AI responses from Mastra agent

### `/api/organization` - Organization Data
- ✅ Authentication required
- ✅ Organization context required
- Returns current organization data and metadata

### `/api/organization/metadata` - Update Metadata
- ✅ Authentication required
- ✅ Organization context required
- ✅ Admin role required
- Updates organization public metadata

### `/api/example/protected` - Example Routes
- ✅ Authentication required
- ✅ Organization context required
- ✅ Role checks implemented
- Example implementation for reference

## Adding New API Routes

When creating new API routes, follow this pattern:

```typescript
// app/api/your-route/route.ts
import { requireOrganization } from "@/lib/organization";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // 1. Require auth & org context
    const { userId, orgId } = await requireOrganization();

    // 2. (Optional) Check permissions
    // await requireOrganizationAdmin();

    // 3. Fetch data scoped by organization
    const data = await fetchData({ organizationId: orgId });

    // 4. Return response
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Security Checklist

When creating or reviewing API routes, verify:

- [ ] Route is covered by middleware matcher
- [ ] Uses `requireOrganization()` or `getCurrentOrganization()`
- [ ] Never trusts client-provided organization IDs
- [ ] All data queries include `organizationId` filter
- [ ] Sensitive operations check admin role or permissions
- [ ] Error handling doesn't leak sensitive information
- [ ] Input validation implemented
- [ ] Rate limiting considered (for production)

## Testing Security

### Test Authentication
```bash
# Should fail with 401
curl http://localhost:3000/api/chat -X POST

# Should succeed with valid session
curl http://localhost:3000/api/chat \
  -X POST \
  -H "Cookie: __session=..." \
  -d '{"messages":[]}'
```

### Test Organization Isolation
1. Create two organizations (Org A, Org B)
2. Add data to Org A
3. Switch to Org B
4. Verify Org A's data is not accessible

### Test Role-Based Access
1. Create organization as admin
2. Invite user as member
3. Try admin-only endpoints as member
4. Should receive 403 Forbidden

## Production Considerations

Before deploying to production:

1. **Rate Limiting**: Add rate limiting to prevent abuse
   ```typescript
   // Consider using @upstash/ratelimit or similar
   ```

2. **Request Validation**: Use Zod or similar for input validation
   ```typescript
   import { z } from 'zod';
   const schema = z.object({ messages: z.array(...) });
   ```

3. **Logging**: Log security events
   ```typescript
   console.log(`User ${userId} accessed ${endpoint} for org ${orgId}`);
   ```

4. **Monitoring**: Set up alerts for:
   - High rate of 401/403 errors
   - Unusual access patterns
   - Failed permission checks

5. **CORS**: Configure CORS if needed for external clients

6. **Webhooks**: Implement webhook signature verification
   ```typescript
   import { Webhook } from 'svix';
   const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
   ```

## Resources

- [Clerk Next.js SDK](https://clerk.com/docs/reference/nextjs/overview)
- [Organization Context](../lib/organization.ts)
- [Security Architecture](../../CLERK_ARCHITECTURE.md)
- [Technical Debt](../../TECHNICAL_DEBT.md)
