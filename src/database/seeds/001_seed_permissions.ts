import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Check if permissions already exist
  const existingPermissions = await knex('permissions').count('* as count').first();
  const hasPermissions = existingPermissions && parseInt(existingPermissions.count as string) > 0;

  if (!hasPermissions) {
    // Define permissions
    const permissions = [
      // Student permissions
      { name: 'student:create', resource: 'student', action: 'create', description: 'Create students' },
      { name: 'student:read', resource: 'student', action: 'read', description: 'View students' },
      { name: 'student:update', resource: 'student', action: 'update', description: 'Update students' },
      { name: 'student:delete', resource: 'student', action: 'delete', description: 'Delete students' },
      
      // Bus permissions
      { name: 'bus:create', resource: 'bus', action: 'create', description: 'Create buses' },
      { name: 'bus:read', resource: 'bus', action: 'read', description: 'View buses' },
      { name: 'bus:update', resource: 'bus', action: 'update', description: 'Update buses' },
      { name: 'bus:delete', resource: 'bus', action: 'delete', description: 'Delete buses' },
      
      // Route permissions
      { name: 'route:create', resource: 'route', action: 'create', description: 'Create routes' },
      { name: 'route:read', resource: 'route', action: 'read', description: 'View routes' },
      { name: 'route:update', resource: 'route', action: 'update', description: 'Update routes' },
      { name: 'route:delete', resource: 'route', action: 'delete', description: 'Delete routes' },
      
      // Trip permissions
      { name: 'trip:create', resource: 'trip', action: 'create', description: 'Start trips' },
      { name: 'trip:read', resource: 'trip', action: 'read', description: 'View trips' },
      { name: 'trip:update', resource: 'trip', action: 'update', description: 'Update trips' },
      { name: 'trip:delete', resource: 'trip', action: 'delete', description: 'Cancel trips' },
      
      // Location permissions
      { name: 'location:read', resource: 'location', action: 'read', description: 'View bus locations' },
      { name: 'location:update', resource: 'location', action: 'update', description: 'Update bus location' },
      
      // Organization permissions
      { name: 'organization:read', resource: 'organization', action: 'read', description: 'View organization' },
      { name: 'organization:update', resource: 'organization', action: 'update', description: 'Update organization' },
      
      // User permissions
      { name: 'user:create', resource: 'user', action: 'create', description: 'Create users' },
      { name: 'user:read', resource: 'user', action: 'read', description: 'View users' },
      { name: 'user:update', resource: 'user', action: 'update', description: 'Update users' },
      { name: 'user:delete', resource: 'user', action: 'delete', description: 'Delete users' },
    ];

    // Insert permissions
    await knex('permissions').insert(permissions);
    console.log('Permissions created');
  } else {
    console.log('Permissions already exist, skipping');
  }

  // Get permission IDs
  const permissionMap: Record<string, string> = {};
  const allPermissions = await knex('permissions').select('id', 'name');
  allPermissions.forEach((p: any) => {
    permissionMap[p.name] = p.id;
  });

  // Define role permissions
  const rolePermissions = [
    // Admin - all permissions
    ...Object.values(permissionMap).map((permissionId) => ({
      role: 'admin',
      permission_id: permissionId,
    })),
    
    // Driver - limited permissions
    { role: 'driver', permission_id: permissionMap['trip:create'] },
    { role: 'driver', permission_id: permissionMap['trip:read'] },
    { role: 'driver', permission_id: permissionMap['trip:update'] },
    { role: 'driver', permission_id: permissionMap['location:update'] },
    { role: 'driver', permission_id: permissionMap['location:read'] },
    { role: 'driver', permission_id: permissionMap['route:read'] },
    { role: 'driver', permission_id: permissionMap['bus:read'] },
    
    // Parent - read-only permissions
    { role: 'parent', permission_id: permissionMap['trip:read'] },
    { role: 'parent', permission_id: permissionMap['location:read'] },
    { role: 'parent', permission_id: permissionMap['route:read'] },
    { role: 'parent', permission_id: permissionMap['bus:read'] },
    { role: 'parent', permission_id: permissionMap['student:read'] },
  ];

  // Check if role permissions already exist
  const existingRolePermissions = await knex('role_permissions').count('* as count').first();
  if (!existingRolePermissions || parseInt(existingRolePermissions.count as string) === 0) {
    await knex('role_permissions').insert(rolePermissions);
    console.log('Role permissions created');
  } else {
    console.log('Role permissions already exist, skipping');
  }
  
  console.log('Permissions seed completed');
}

