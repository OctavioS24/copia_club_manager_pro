import { createContext } from 'react';

export interface CategoryContextType {
  selectedDiscipline: string | null;
  selectedGender: string | null;
  selectedDivision: string | null;
  setSelectedDiscipline: (id: string | null) => void;
  setSelectedGender: (gender: string | null) => void;
  setSelectedDivision: (division: string | null) => void;
}

export const CategoryContext = createContext<CategoryContextType | undefined>(undefined);
