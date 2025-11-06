/**
 * Organization Metadata API Routes
 *
 * Routes for updating organization metadata (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  requireOrganization,
  requireOrganizationAdmin,
  updateOrganizationPublicMetadata,
  checkMetadataSize,
  type OrganizationPublicMetadata,
} from '@/lib/organization'

/**
 * PATCH /api/organization/metadata
 * Update organization public metadata (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    // Require authentication and organization context
    const context = await requireOrganization()

    // Require admin role
    await requireOrganizationAdmin()

    // Parse request body
    const body = await request.json()
    const { publicMetadata } = body as {
      publicMetadata: Partial<OrganizationPublicMetadata>
    }

    if (!publicMetadata) {
      return NextResponse.json(
        { error: 'publicMetadata is required' },
        { status: 400 }
      )
    }

    // Check metadata size before updating
    const sizeCheck = checkMetadataSize(publicMetadata, 'public')

    if (sizeCheck.isCritical) {
      return NextResponse.json(
        {
          error:
            'Metadata size exceeds critical threshold. Please migrate to database.',
          size: sizeCheck.size,
          threshold: 8000,
        },
        { status: 400 }
      )
    }

    // Update metadata
    await updateOrganizationPublicMetadata(context.orgId, publicMetadata)

    return NextResponse.json({
      success: true,
      metadata: publicMetadata,
      size: sizeCheck.size,
      warning: sizeCheck.isWarning,
    })
  } catch (error) {
    console.error('Error updating organization metadata:', error)

    if (error instanceof Error) {
      if (error.message.includes('required')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
