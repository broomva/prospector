/**
 * Example Protected API Route
 *
 * Demonstrates how to create a protected API route that:
 * 1. Requires authentication
 * 2. Requires organization context
 * 3. Scopes data by organization
 * 4. Implements permission checks
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  requireOrganization,
  getCurrentOrganizationData,
  isOrganizationAdmin,
} from '@/lib/organization'

/**
 * GET /api/example/protected
 * Example protected endpoint that returns organization-scoped data
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication and organization context
    // This will throw an error if user is not authenticated or has no org
    const { userId, orgId, orgRole } = await requireOrganization()

    // Get organization data
    const org = await getCurrentOrganizationData()

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Example: Return organization-scoped data
    // In a real app, this would query your database filtered by orgId
    const exampleData = {
      // Always include orgId to ensure data is scoped
      organizationId: orgId,

      // Example data that would come from your database
      contacts: [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
      ],

      // Include metadata from organization
      settings: org.publicMetadata.settings,
    }

    return NextResponse.json({
      success: true,
      data: exampleData,
      user: {
        id: userId,
        role: orgRole,
      },
    })
  } catch (error) {
    console.error('Error in protected route:', error)

    if (error instanceof Error) {
      // Handle specific error cases
      if (error.message.includes('required')) {
        return NextResponse.json(
          { error: 'Authentication or organization context required' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/example/protected
 * Example endpoint that requires admin role
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication and organization context
    const { userId, orgId } = await requireOrganization()

    // Check if user is admin
    const isAdmin = await isOrganizationAdmin()

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()

    // Example: Create a new resource scoped to this organization
    // In a real app, you would:
    // 1. Validate the input
    // 2. Insert into database with organizationId
    // 3. Return the created resource

    return NextResponse.json({
      success: true,
      message: 'Resource created',
      data: {
        ...body,
        organizationId: orgId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in protected route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/example/protected
 * Example endpoint with granular permission check
 */
export async function DELETE(request: NextRequest) {
  try {
    const { orgId } = await requireOrganization()

    // Example: Check for specific permission
    // Note: Requires custom permissions to be set up in Clerk Dashboard
    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('id')

    if (!resourceId) {
      return NextResponse.json(
        { error: 'Resource ID required' },
        { status: 400 }
      )
    }

    // In a real app:
    // 1. Check permission (e.g., has({ permission: 'resource:delete' }))
    // 2. Verify resource belongs to this organization
    // 3. Delete from database

    // Example verification that resource belongs to organization
    // const resource = await db.resources.findUnique({
    //   where: { id: resourceId }
    // })
    //
    // if (resource.organizationId !== orgId) {
    //   return NextResponse.json(
    //     { error: 'Resource not found or access denied' },
    //     { status: 404 }
    //   )
    // }

    return NextResponse.json({
      success: true,
      message: 'Resource deleted',
      deletedId: resourceId,
    })
  } catch (error) {
    console.error('Error in protected route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
