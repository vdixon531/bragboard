export interface Profile {
  id: string;
  display_name: string;
  avatar: string;
  color: string;
  onboarded: boolean;
}

export interface League {
  id: string;
  name: string;
  invite_code: string;
  theme: string;
  games: string[];
  created_by: string;
  created_at: string;
}

export interface Member {
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile: Profile;
}

export interface Score {
  id: number;
  user_id: string;
  game_id: string;
  day: string;
  score: number;
  points: number;
  display: string;
  failed: boolean;
  puzzle: string | null;
  meta: Record<string, unknown>;
  source: string;
  created_at: string;
}
