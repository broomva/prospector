/**
 * Example Protected Component
 *
 * This demonstrates how to create a component that:
 * 1. Requires authentication
 * 2. Requires organization context
 * 3. Accesses organization metadata
 * 4. Implements role-based access control
 */

'use client'

import { useCurrentOrganization, useIsOrganizationAdmin } from '@/lib/hooks/use-organization'
import { SignInButton } from '@clerk/nextjs'

export function ProtectedComponent() {
  const { organization, isLoaded } = useCurrentOrganization()
  const isAdmin = useIsOrganizationAdmin()

  // Loading state
  if (!isLoaded) {
    return <div className="p-4">Loading...</div>
  }

  // Not signed in
  if (!organization) {
    return (
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
        <p className="text-muted-foreground mb-4">
          Please sign in and select an organization to continue.
        </p>
        <SignInButton mode="modal">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Sign In
          </button>
        </SignInButton>
      </div>
    )
  }

  // Signed in and has organization context
  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Organization Information</h2>
        <p className="text-sm text-muted-foreground">
          You are viewing data for: {organization.name}
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <span className="font-medium">Organization ID:</span>{' '}
          <code className="text-sm bg-muted px-2 py-1 rounded">{organization.id}</code>
        </div>
        <div>
          <span className="font-medium">Slug:</span>{' '}
          <code className="text-sm bg-muted px-2 py-1 rounded">{organization.slug}</code>
        </div>
        <div>
          <span className="font-medium">Your Role:</span>{' '}
          <span className="text-sm font-medium text-primary">
            {isAdmin ? 'Admin' : 'Member'}
          </span>
        </div>
      </div>

      {/* Display branding from metadata */}
      {organization.publicMetadata.branding && (
        <div className="space-y-2">
          <h3 className="font-medium">Branding Settings</h3>
          <div className="text-sm space-y-1">
            {organization.publicMetadata.branding.companyName && (
              <div>
                Company: {organization.publicMetadata.branding.companyName}
              </div>
            )}
            {organization.publicMetadata.branding.primaryColor && (
              <div className="flex items-center gap-2">
                Primary Color:
                <div
                  className="w-6 h-6 rounded border"
                  style={{
                    backgroundColor:
                      organization.publicMetadata.branding.primaryColor,
                  }}
                />
                <code className="text-xs">
                  {organization.publicMetadata.branding.primaryColor}
                </code>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Display feature flags from metadata */}
      {organization.publicMetadata.features && (
        <div className="space-y-2">
          <h3 className="font-medium">Enabled Features</h3>
          <div className="text-sm space-y-1">
            {organization.publicMetadata.features.advancedAnalytics && (
              <div className="text-green-600">✓ Advanced Analytics</div>
            )}
            {organization.publicMetadata.features.apiAccess && (
              <div className="text-green-600">✓ API Access</div>
            )}
            {organization.publicMetadata.features.exportContacts && (
              <div className="text-green-600">✓ Export Contacts</div>
            )}
          </div>
        </div>
      )}

      {/* Admin-only section */}
      {isAdmin && (
        <div className="border-t pt-4 mt-4">
          <h3 className="font-medium text-amber-600">Admin Section</h3>
          <p className="text-sm text-muted-foreground">
            This section is only visible to organization admins.
          </p>
          <button className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
            Manage Organization
          </button>
        </div>
      )}
    </div>
  )
}
