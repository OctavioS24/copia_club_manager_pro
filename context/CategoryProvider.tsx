import React, { useState, useEffect } from 'react';
import { CategoryContext } from './CategoryContext';

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(() => {
    return localStorage.getItem('selectedDiscipline');
  });
  const [selectedGender, setSelectedGender] = useState<string | null>(() => {
    return localStorage.getItem('selectedGender');
  });
  const [selectedDivision, setSelectedDivision] = useState<string | null>(() => {
    return localStorage.getItem('selectedDivision');
  });

  useEffect(() => {
    if (selectedDiscipline) localStorage.setItem('selectedDiscipline', selectedDiscipline);
    else localStorage.removeItem('selectedDiscipline');
  }, [selectedDiscipline]);

  useEffect(() => {
    if (selectedGender) localStorage.setItem('selectedGender', selectedGender);
    else localStorage.removeItem('selectedGender');
  }, [selectedGender]);

  useEffect(() => {
    if (selectedDivision) localStorage.setItem('selectedDivision', selectedDivision);
    else localStorage.removeItem('selectedDivision');
  }, [selectedDivision]);

  return (
    <CategoryContext.Provider
      value={{
        selectedDiscipline,
        selectedGender,
        selectedDivision,
        setSelectedDiscipline,
        setSelectedGender,
        setSelectedDivision,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
};
