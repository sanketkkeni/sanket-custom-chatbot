import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  GetUserCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.NEXT_PUBLIC_USER_POOL_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '';

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

export interface User {
  username: string;
  email: string;
  email_verified: boolean;
}

export async function signUp(email: string, password: string, username?: string): Promise<{ userConfirmed: boolean; userId: string }> {
  const command = new SignUpCommand({
    ClientId: CLIENT_ID,
    Username: username || email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  });
  const response = await cognitoClient.send(command);
  return {
    userConfirmed: response.UserConfirmed || false,
    userId: response.UserSub || '',
  };
}

export async function confirmSignUp(email: string, confirmationCode: string): Promise<boolean> {
  const command = new ConfirmSignUpCommand({
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  });
  await cognitoClient.send(command);
  return true;
}

export async function resendVerificationCode(email: string): Promise<boolean> {
  const command = new ResendConfirmationCodeCommand({
    ClientId: CLIENT_ID,
    Username: email,
  });
  await cognitoClient.send(command);
  return true;
}

export async function signIn(email: string, password: string): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
  const command = new InitiateAuthCommand({
    ClientId: CLIENT_ID,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });
  const response = await cognitoClient.send(command);
  return {
    accessToken: response.AuthenticationResult?.AccessToken || '',
    idToken: response.AuthenticationResult?.IdToken || '',
    refreshToken: response.AuthenticationResult?.RefreshToken || '',
  };
}

export async function getUser(accessToken: string): Promise<User> {
  const command = new GetUserCommand({ AccessToken: accessToken });
  const response = await cognitoClient.send(command);
  const attributes: Record<string, string> = {};
  response.UserAttributes?.forEach((attr) => {
    if (attr.Name && attr.Value) attributes[attr.Name] = attr.Value;
  });
  return {
    username: response.Username || '',
    email: attributes.email || '',
    email_verified: attributes.email_verified === 'true',
  };
}

export async function signOut(accessToken: string): Promise<void> {
  const command = new GlobalSignOutCommand({ AccessToken: accessToken });
  await cognitoClient.send(command);
}

export async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
  const command = new InitiateAuthCommand({
    ClientId: CLIENT_ID,
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  const response = await cognitoClient.send(command);
  return {
    accessToken: response.AuthenticationResult?.AccessToken || '',
    idToken: response.AuthenticationResult?.IdToken || '',
    refreshToken: response.AuthenticationResult?.RefreshToken || refreshToken,
  };
}

export function storeTokens(accessToken: string, idToken: string, refreshToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('idToken', idToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
}

export function getStoredTokens(): { accessToken: string; idToken: string; refreshToken: string } | null {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem('accessToken');
  const idToken = localStorage.getItem('idToken');
  const refreshToken = localStorage.getItem('refreshToken');
  if (!accessToken || !idToken || !refreshToken) return null;
  return { accessToken, idToken, refreshToken };
}

export function clearTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
  }
}

export function storeUserId(userId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userId', userId);
  }
}

export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userId');
}
