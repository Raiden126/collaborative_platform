export interface JwtPayload {
  sub: number;
  email: string;
}

// Shape attached to req.user after access-token validation.
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}
