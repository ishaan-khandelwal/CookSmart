import { useColorScheme } from 'react-native';

export default function useAppColorScheme() {
    const colorScheme = useColorScheme();
    return colorScheme === 'dark' ? 'dark' : 'light';
}