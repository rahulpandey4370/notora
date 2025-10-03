import { createHash } from 'crypto';

function hashPassword(password: string): string {
  const sha256 = createHash('sha256');
  sha256.update(password);
  return sha256.digest('hex');
}

export const users = [
  {
    username: 'Rahul',
    email: 'rahul@example.com',
    passwordHash: hashPassword('Rahul123'),
    avatarUrl: 'https://placehold.co/100x100/E68A59/FFFFFF.png?text=R',
  },
  {
    username: 'Shivangi',
    email: 'shivangi@example.com',
    passwordHash: hashPassword('Shivangi123'),
    avatarUrl: 'https://placehold.co/100x100/FFDA63/000000.png?text=S',
  },
];
