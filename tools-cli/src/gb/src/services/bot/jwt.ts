import crypto from 'crypto';

/**
 * Base64URL encoding helper (RFC 7515).
 */
function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export interface AppJwtPayload {
  readonly iat: number;
  readonly exp: number;
  readonly iss: string;
}

/**
 * Generates an RS256-signed JWT for GitHub App authentication.
 * Backdates `iat` by 60 seconds to prevent clock drift issues on GitHub's side.
 * Lifetime: 120 seconds (2 minutes).
 */
export function signAppJwt(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload: AppJwtPayload = {
    iat: now - 60,
    exp: now + 120,
    iss: appId,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(dataToSign);
  const signature = signer.sign(privateKeyPem);
  const signatureEncoded = base64UrlEncode(signature);

  return `${dataToSign}.${signatureEncoded}`;
}
