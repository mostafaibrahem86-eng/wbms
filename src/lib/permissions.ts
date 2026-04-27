// Role permissions matrix for WhatsApp Business Management System
export const ROLE_PERMISSIONS: Record<string, {
  label: { en: string; ar: string };
  color: string;
  icon: string;
  permissions: string[];
}> = {
  admin: {
    label: { en: 'Administrator', ar: 'مسؤول النظام' },
    color: '#00a884',
    icon: 'fa-crown',
    permissions: [
      'dashboard.view',
      'inbox.view', 'inbox.send', 'inbox.manage',
      'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete',
      'templates.view', 'templates.create', 'templates.edit',
      'campaigns.view', 'campaigns.create', 'campaigns.manage',
      'automation.view', 'automation.create', 'automation.edit',
      'users.view', 'users.create', 'users.edit', 'users.delete',
      'settings.view', 'settings.edit',
    ],
  },
  agent: {
    label: { en: 'Agent', ar: 'وكيل' },
    color: '#3b82f6',
    icon: 'fa-headset',
    permissions: [
      'dashboard.view',
      'inbox.view', 'inbox.send',
      'contacts.view', 'contacts.create', 'contacts.edit',
      'templates.view',
      'campaigns.view',
      'automation.view',
      'settings.view',
    ],
  },
  viewer: {
    label: { en: 'Viewer', ar: 'مشاهد' },
    color: '#94a3b8',
    icon: 'fa-eye',
    permissions: [
      'dashboard.view',
      'inbox.view',
      'contacts.view',
      'templates.view',
      'campaigns.view',
      'automation.view',
      'settings.view',
    ],
  },
};

/**
 * Check if a user with a given role has a specific permission
 */
export function hasPermission(userRole: string, permission: string): boolean {
  const role = ROLE_PERMISSIONS[userRole];
  return role ? role.permissions.includes(permission) : false;
}

/**
 * Check if the user role is admin
 */
export function isAdmin(userRole: string): boolean {
  return userRole === 'admin';
}
