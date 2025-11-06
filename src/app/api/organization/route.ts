/**
 * Organization API Routes
 *
 * Example API routes demonstrating how to access and update organization data
 * with proper authentication and authorization checks.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentOrganization,
  getCurrentOrganizationData,
  getMetadataSizeInfo,
} from '@/lib/organization'

/**
 * GET /api/organization
 * Get the current user's active organization data
 */
export async function GET(request: NextRequest) {
  try {
    // Get organization context
    const context = await getCurrentOrganization()

    if (!context) {
      return NextResponse.json(
        { error: 'No organization context' },
        { status: 403 }
      )
    }

    // Get organization data
    const org = await getCurrentOrganizationData()

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get metadata size info for monitoring
    const sizeInfo = await getMetadataSizeInfo(context.orgId)

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        imageUrl: org.imageUrl,
        role: context.orgRole,
        publicMetadata: org.publicMetadata,
        // Don't expose private metadata to client
      },
      metadata: {
        size: sizeInfo,
      },
    })
  } catch (error) {
    console.error('Error fetching organization:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
