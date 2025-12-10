import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { DatabaseService } from './database.service';
import { User, JWTUser } from '../types';
import { logger } from '../config/logger';

export class AuthService {
  private userRepository: UserRepository;
  private databaseService: DatabaseService;

  constructor() {
    this.userRepository = new UserRepository();
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

      // For superadmin, organizationId is not required
      if (!organizationId) {
        // Try to find superadmin in main database
        user = await this.userRepository.findByEmail(email, '');
        if (user && user.role !== 'superadmin') {
          throw new Error('Organization code required');
        }
      } else {
        // Regular user login - check organization's database
        if (organizationCode) {
          // Connect to organization's database
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
        } else {
          // Fallback to main database (for backward compatibility)
          user = await this.userRepository.findByEmail(email, organizationId);
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
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        logger.warn({
          message: 'Invalid password',
          email,
          userId: user.id,
        });
        throw new Error('Invalid credentials');
      }

      // Update last login
      if (organizationCode && organizationId) {
        // Update in organization's database
        const orgDb = this.databaseService.getOrganizationDatabase(organizationCode);
        try {
          await orgDb('users')
            .where({ id: user.id })
            .update({ last_login: orgDb.fn.now() });
        } finally {
          await orgDb.destroy();
        }
      } else {
        // Update in main database
        await this.userRepository.updateLastLogin(user.id);
      }

      // Generate JWT payload
      // Note: Users in organization databases don't have organization_id field
      // Use the organizationId parameter instead
      const jwtUser: JWTUser = {
        id: user.id,
        organization_id: organizationId || (user as any).organization_id || null,
        email: user.email,
        role: user.role,
      };

      return { user, token: '' }; // Token will be generated in route
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

