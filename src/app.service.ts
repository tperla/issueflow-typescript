import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { UsersService } from './users/users.service';
import { UserRole } from './common/enums/user-role.enum';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly usersService: UsersService) {}

  async onApplicationBootstrap(): Promise<void> {
    const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
    try {
      const existing = await this.usersService.findByUsername(username);
      if (!existing) {
        await this.usersService.create({
          username,
          email: process.env.SEED_ADMIN_EMAIL ?? 'admin@issueflow.dev',
          fullName: 'System Administrator',
          role: UserRole.ADMIN,
          password: process.env.SEED_ADMIN_PASSWORD ?? 'admin123',
        });
        this.logger.log(`Seeded admin user: ${username}`);
      }
    } catch (err: any) {
      // 23505 = unique_violation: another instance seeded concurrently, safe to ignore
      if (err?.code !== '23505') throw err;
    }
  }
}
