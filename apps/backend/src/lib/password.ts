import { pbkdf2 as pbkdf2Callback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { verifyPassword as verifyBetterAuthPassword } from 'better-auth/crypto';

const pbkdf2 = promisify(pbkdf2Callback);

const isDjangoPbkdf2Sha256Hash = (hash: string): boolean => {
  return hash.startsWith('pbkdf2_sha256$');
};

const verifyDjangoPbkdf2Sha256Password = async (params: {
  hash: string;
  password: string;
}): Promise<boolean> => {
  const [algorithm, iterationsText, salt, digest] = params.hash.split('$');
  const iterations = Number(iterationsText);

  if (
    algorithm !== 'pbkdf2_sha256' ||
    !Number.isSafeInteger(iterations) ||
    iterations <= 0 ||
    !salt ||
    !digest
  ) {
    return false;
  }

  const expected = Buffer.from(digest, 'base64');
  const actual = await pbkdf2(params.password, salt, iterations, expected.length, 'sha256');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export const verifyPassword = async (params: {
  hash: string;
  password: string;
}): Promise<boolean> => {
  if (isDjangoPbkdf2Sha256Hash(params.hash)) {
    return verifyDjangoPbkdf2Sha256Password(params);
  }

  return verifyBetterAuthPassword(params);
};
