export type StaffPublicProfile = {
  title: string;
  bio: string;
  photoUrl: string | null;
  languages: string[];
  portfolio: { title: string; imageUrl: string; caption: string }[];
  reviews: { author: string; rating: number; text: string }[];
};
export const emptyStaffProfile = (): StaffPublicProfile => ({ title: "Salon professional", bio: "", photoUrl: null, languages: [], portfolio: [], reviews: [] });
