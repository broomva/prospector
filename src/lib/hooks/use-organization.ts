/**
 * Client-side hooks for accessing organization data
 *
 * These hooks provide easy access to organization context and metadata
 * from React components.
 */

'use client'

import { useOrganization, useUser } from '@clerk/nextjs'
import type { OrganizationPublicMetadata } from '../organization'

/**
 * Hook to access the current organization context with typed metadata
 */
export function useCurrentOrganization() {
  const { organization, isLoaded } = useOrganization()

  return {
    organization: organization
      ? {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          imageUrl: organization.imageUrl,
          publicMetadata:
            (organization.publicMetadata as OrganizationPublicMetadata) || {},
        }
      : null,
    isLoaded,
  }
}

/**
 * Hook to access organization branding settings
 */
export function useOrganizationBranding() {
  const { organization } = useCurrentOrganization()
  return organization?.publicMetadata?.branding || {}
}

/**
 * Hook to access organization feature flags
 */
export function useOrganizationFeatures() {
  const { organization } = useCurrentOrganization()
  return organization?.publicMetadata?.features || {}
}

/**
 * Hook to access organization settings
 */
export function useOrganizationSettings() {
  const { organization } = useCurrentOrganization()
  return organization?.publicMetadata?.settings || {}
}

/**
 * Hook to check if user is an admin of the current organization
 */
export function useIsOrganizationAdmin() {
  const { membership } = useOrganization()
  return membership?.role === 'org:admin'
}

/**
 * Hook to access the current user's information
 */
export function useCurrentUser() {
  const { user, isLoaded } = useUser()

  return {
    user: user
      ? {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          imageUrl: user.imageUrl,
        }
      : null,
    isLoaded,
  }
}
