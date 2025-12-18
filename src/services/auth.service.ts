import bcrypt from 'bcryptjs';
import { DatabaseService } from './database.service';
import { User } from '../types';
import { logger } from '../config/logger';

export class AuthService {
  private databaseService: DatabaseService;

  constructor() {
    this.databaseService = new DatabaseService();
  }

  async login(
    email: string,
    password: string,
    organizationId?: string,
    organizationCode?: string
  ): Promise<{ user: User; token: string }> {
    try {
      let user: User | null = null;

      const hasOrganizationId = organizationId && organizationId.trim() !== '';

      // Organization code is always required (no main database superadmin)
      if (!hasOrganizationId || !organizationCode) {
        throw new Error('Organization code is required');
      }

      if (organizationCode) {
          const orgDb = this.databaseService.getOrganizationDatabase(organizationCode);
          try {
            logger.debug({
              message: 'Attempting login in organization database',
              email,
              organizationCode,
              dbName: `smartroutehub_${organizationCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            });
            
            user = await orgDb('users')
              .where({ email })
              .first() || null;
            
            logger.debug({
              message: 'User lookup result',
              email,
              found: !!user,
              userId: user?.id,
              isActive: user?.is_active,
            });
          } catch (dbError: any) {
            logger.error({
              message: 'Database error during login',
              error: dbError.message,
              email,
              organizationCode,
            });
            throw new Error('Database connection failed');
          } finally {
            await orgDb.destroy();
          }
        }

      if (!user) {
        logger.warn({
          message: 'User not found',
          email,
          organizationCode,
          organizationId,
        });
        throw new Error('Invalid credentials');
      }

      if (!user.is_active) {
        logger.warn({
          message: 'User account is inactive',
          email,
          userId: user.id,
        });
        throw new Error('Account is inactive');
      }

      // Verify password
      const isValid = await bcrypt.compare(password, (user as any).password_hash);
      if (!isValid) {
        logger.warn({
          message: 'Invalid password',
          email,
          userId: user.id,
        });
        throw new Error('Invalid credentials');
      }

      // Update last login in organization database
      if (organizationCode) {
        const orgDb = this.databaseService.getOrganizationDatabase(organizationCode);
        try {
          await orgDb('users')
            .where({ id: user.id })
            .update({ last_login: orgDb.fn.now() });
        } finally {
          await orgDb.destroy();
        }
      }

 

      return { user, token: '' }; 
    } catch (error: any) {
      logger.error({ error: error.message, email, organizationId, organizationCode });
      throw error;
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

