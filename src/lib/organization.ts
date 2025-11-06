/**
 * Organization Data Access Layer
 *
 * This module provides utilities for accessing organization data from Clerk.
 * It serves as an abstraction layer that will make it easier to migrate
 * to a proper database in the future.
 *
 * IMPORTANT: This is using Clerk metadata as a temporary data store.
 * See TECHNICAL_DEBT.md for limitations and migration plans.
 */

import { auth, clerkClient } from '@clerk/nextjs/server'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Organization Public Metadata Structure
 * Stored in Clerk and accessible client-side via JWT tokens
 */
export interface OrganizationPublicMetadata {
  branding?: {
    primaryColor?: string
    logoUrl?: string
    companyName?: string
  }
  features?: {
    advancedAnalytics?: boolean
    apiAccess?: boolean
    exportContacts?: boolean
  }
  settings?: {
    timezone?: string
    locale?: string
  }
}

/**
 * Organization Private Metadata Structure
 * Only accessible server-side
 */
export interface OrganizationPrivateMetadata {
  subscription?: {
    tier?: 'free' | 'pro' | 'enterprise'
    stripeCustomerId?: string
    monthlyContactLimit?: number
    expiresAt?: string
  }
  internal?: {
    accountManagerId?: string
    notes?: string
  }
}

/**
 * Combined organization data with metadata
 */
export interface OrganizationData {
  id: string
  name: string
  slug: string
  imageUrl: string
  createdAt: number
  publicMetadata: OrganizationPublicMetadata
  privateMetadata: OrganizationPrivateMetadata
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Get the current authenticated user's organization context
 * Returns null if user is not authenticated or has no organization selected
 */
export async function getCurrentOrganization(): Promise<{
  userId: string
  orgId: string
  orgRole: string
  orgSlug: string | null
} | null> {
  const { userId, orgId, orgRole, orgSlug } = await auth()

  if (!userId || !orgId) {
    return null
  }

  return {
    userId,
    orgId,
    orgRole: orgRole || 'org:member',
    orgSlug: orgSlug ?? null,
  }
}

/**
 * Require authentication and organization context
 * Throws error if user is not authenticated or has no organization
 */
export async function requireOrganization(): Promise<{
  userId: string
  orgId: string
  orgRole: string
  orgSlug: string | null
}> {
  const context = await getCurrentOrganization()

  if (!context) {
    throw new Error('Authentication or organization context required')
  }

  return context
}

// ============================================================================
// Organization Data Access
// ============================================================================

/**
 * Get organization by ID with metadata
 * Returns null if organization not found
 */
export async function getOrganization(
  organizationId: string
): Promise<OrganizationData | null> {
  try {
    const clerk = await clerkClient()
    const org = await clerk.organizations.getOrganization({
      organizationId,
    })

    if (!org) {
      return null
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      imageUrl: org.imageUrl,
      createdAt: org.createdAt,
      publicMetadata: (org.publicMetadata as OrganizationPublicMetadata) || {},
      privateMetadata:
        (org.privateMetadata as OrganizationPrivateMetadata) || {},
    }
  } catch (error) {
    console.error('Error fetching organization:', error)
    return null
  }
}

/**
 * Get the current user's active organization data
 * Returns null if no active organization
 */
export async function getCurrentOrganizationData(): Promise<OrganizationData | null> {
  const context = await getCurrentOrganization()

  if (!context) {
    return null
  }

  return getOrganization(context.orgId)
}

/**
 * Require the current user's active organization data
 * Throws error if no active organization
 */
export async function requireCurrentOrganizationData(): Promise<OrganizationData> {
  const org = await getCurrentOrganizationData()

  if (!org) {
    throw new Error('Organization context required')
  }

  return org
}

// ============================================================================
// Metadata Access Helpers
// ============================================================================

/**
 * Get organization public metadata
 * Public metadata is accessible client-side and included in JWT tokens
 */
export async function getOrganizationPublicMetadata(
  organizationId: string
): Promise<OrganizationPublicMetadata> {
  const org = await getOrganization(organizationId)
  return org?.publicMetadata || {}
}

/**
 * Get organization private metadata
 * Private metadata is only accessible server-side
 */
export async function getOrganizationPrivateMetadata(
  organizationId: string
): Promise<OrganizationPrivateMetadata> {
  const org = await getOrganization(organizationId)
  return org?.privateMetadata || {}
}

// ============================================================================
// Metadata Update Helpers
// ============================================================================

/**
 * Update organization public metadata
 * WARNING: This replaces the entire public metadata object
 */
export async function updateOrganizationPublicMetadata(
  organizationId: string,
  metadata: Partial<OrganizationPublicMetadata>
): Promise<void> {
  try {
    const clerk = await clerkClient()
    await clerk.organizations.updateOrganizationMetadata(organizationId, {
      publicMetadata: metadata,
    })
  } catch (error) {
    console.error('Error updating public metadata:', error)
    throw new Error('Failed to update organization metadata')
  }
}

/**
 * Update organization private metadata
 * WARNING: This replaces the entire private metadata object
 */
export async function updateOrganizationPrivateMetadata(
  organizationId: string,
  metadata: Partial<OrganizationPrivateMetadata>
): Promise<void> {
  try {
    const clerk = await clerkClient()
    await clerk.organizations.updateOrganizationMetadata(organizationId, {
      privateMetadata: metadata,
    })
  } catch (error) {
    console.error('Error updating private metadata:', error)
    throw new Error('Failed to update organization metadata')
  }
}

/**
 * Update both public and private metadata atomically
 * Note: This is still not a true transaction, see TECHNICAL_DEBT.md
 */
export async function updateOrganizationMetadata(
  organizationId: string,
  publicMetadata?: Partial<OrganizationPublicMetadata>,
  privateMetadata?: Partial<OrganizationPrivateMetadata>
): Promise<void> {
  const clerk = await clerkClient()

  try {
    // Update public metadata if provided
    if (publicMetadata) {
      await clerk.organizations.updateOrganizationMetadata(organizationId, {
        publicMetadata,
      })
    }

    // Update private metadata if provided
    if (privateMetadata) {
      await clerk.organizations.updateOrganizationMetadata(organizationId, {
        privateMetadata,
      })
    }
  } catch (error) {
    console.error('Error updating organization metadata:', error)
    throw new Error('Failed to update organization metadata')
  }
}

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if the current user is an admin of the current organization
 */
export async function isOrganizationAdmin(): Promise<boolean> {
  const context = await getCurrentOrganization()

  if (!context) {
    return false
  }

  return context.orgRole === 'org:admin'
}

/**
 * Require admin role for the current organization
 * Throws error if user is not an admin
 */
export async function requireOrganizationAdmin(): Promise<void> {
  const isAdmin = await isOrganizationAdmin()

  if (!isAdmin) {
    throw new Error('Admin access required')
  }
}

/**
 * Check if user has a specific permission
 * Note: Requires permissions to be set up in Clerk Dashboard
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const authResult = await auth()

  if (!authResult.has) {
    return false
  }

  return authResult.has({ permission })
}

/**
 * Require a specific permission
 * Throws error if user doesn't have the permission
 */
export async function requirePermission(permission: string): Promise<void> {
  const permitted = await hasPermission(permission)

  if (!permitted) {
    throw new Error(`Permission required: ${permission}`)
  }
}

// ============================================================================
// Monitoring and Limits
// ============================================================================

/**
 * Check metadata size and warn if approaching limits
 * Clerk recommends keeping metadata under 10KB
 */
export function checkMetadataSize(
  metadata: Record<string, any>,
  type: 'public' | 'private'
): { size: number; isWarning: boolean; isCritical: boolean } {
  const size = JSON.stringify(metadata).length
  const warningThreshold = 5000 // 5KB
  const criticalThreshold = 8000 // 8KB

  if (size > criticalThreshold) {
    console.error(
      `CRITICAL: ${type} metadata size (${size} bytes) exceeds ${criticalThreshold} bytes. Migration to database required!`
    )
  } else if (size > warningThreshold) {
    console.warn(
      `WARNING: ${type} metadata size (${size} bytes) approaching limit`
    )
  }

  return {
    size,
    isWarning: size > warningThreshold,
    isCritical: size > criticalThreshold,
  }
}

/**
 * Get metadata size information for an organization
 */
export async function getMetadataSizeInfo(organizationId: string): Promise<{
  publicSize: number
  privateSize: number
  publicWarning: boolean
  privateWarning: boolean
  publicCritical: boolean
  privateCritical: boolean
}> {
  const org = await getOrganization(organizationId)

  if (!org) {
    return {
      publicSize: 0,
      privateSize: 0,
      publicWarning: false,
      privateWarning: false,
      publicCritical: false,
      privateCritical: false,
    }
  }

  const publicInfo = checkMetadataSize(org.publicMetadata, 'public')
  const privateInfo = checkMetadataSize(org.privateMetadata, 'private')

  return {
    publicSize: publicInfo.size,
    privateSize: privateInfo.size,
    publicWarning: publicInfo.isWarning,
    privateWarning: privateInfo.isWarning,
    publicCritical: publicInfo.isCritical,
    privateCritical: privateInfo.isCritical,
  }
}
