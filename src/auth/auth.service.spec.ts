import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

const mockUsersService = {
  findByUsername: jest.fn(),
  findOne: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('returns token on valid credentials', async () => {
      const hash = await bcrypt.hash('correctpass', 10);
      mockUsersService.findByUsername.mockResolvedValue({
        id: 1,
        username: 'john',
        role: UserRole.DEVELOPER,
        passwordHash: hash,
      } as User);
      mockJwtService.sign.mockReturnValue('signed-token');

      const result = await service.login({ username: 'john', password: 'correctpass' });

      expect(result).toEqual({ accessToken: 'signed-token', tokenType: 'Bearer', expiresIn: 3600 });
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: 1, username: 'john', role: UserRole.DEVELOPER });
    });

    it('throws 401 for wrong password', async () => {
      const hash = await bcrypt.hash('correctpass', 10);
      mockUsersService.findByUsername.mockResolvedValue({
        id: 1,
        username: 'john',
        passwordHash: hash,
      } as User);

      await expect(service.login({ username: 'john', password: 'wrongpass' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 for unknown username', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'nobody', password: 'pass' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout / blacklist', () => {
    it('marks token as blacklisted after logout', () => {
      expect(service.isTokenBlacklisted('mytoken')).toBe(false);
      service.logout('mytoken');
      expect(service.isTokenBlacklisted('mytoken')).toBe(true);
    });

    it('non-blacklisted token is not blocked', () => {
      service.logout('token-a');
      expect(service.isTokenBlacklisted('token-b')).toBe(false);
    });
  });

  describe('getMe', () => {
    it('delegates to usersService.findOne', async () => {
      const user = { id: 1, username: 'john', role: UserRole.DEVELOPER } as User;
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await service.getMe(1);
      expect(result).toEqual(user);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
    });
  });
});
