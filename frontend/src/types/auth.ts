export interface User {
  id: string;
  email: string;
  role: 'player' | 'instructor' | 'admin';
  firstName: string;
  lastName: string;
}

export type RegisterData = Omit<User, 'id' | 'role'> & {
  password: string;
};

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
}
