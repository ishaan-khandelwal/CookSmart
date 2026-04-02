import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_RECIPE_MODE, RECIPE_MODE_STORAGE_KEY, getRecipeModeMeta } from '../constants/recipeModes';

const RecipeModeContext = createContext(null);

export function RecipeModeProvider({ children }) {
    const [selectedMode, setSelectedMode] = useState(DEFAULT_RECIPE_MODE);

    useEffect(() => {
        let isMounted = true;

        const loadStoredMode = async () => {
            try {
                const storedMode = await AsyncStorage.getItem(RECIPE_MODE_STORAGE_KEY);
                if (isMounted && storedMode) {
                    setSelectedMode(storedMode);
                }
            } catch {
                // Persisted mode is optional.
            }
        };

        loadStoredMode();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        AsyncStorage.setItem(RECIPE_MODE_STORAGE_KEY, selectedMode).catch(() => {});
    }, [selectedMode]);

    const value = useMemo(
        () => ({
            selectedMode,
            selectedModeMeta: getRecipeModeMeta(selectedMode),
            setSelectedMode,
        }),
        [selectedMode],
    );

    return (
        <RecipeModeContext.Provider value={value}>
            {children}
        </RecipeModeContext.Provider>
    );
}

export function useRecipeMode() {
    const value = useContext(RecipeModeContext);

    if (!value) {
        throw new Error('useRecipeMode must be used within a RecipeModeProvider');
    }

    return value;
}
