import './global.css';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
    const appContent = (
        <SafeAreaProvider>
            <AppNavigator />
        </SafeAreaProvider>
    );

    if (Platform.OS !== 'web') {
        return appContent;
    }

    return (
        <View style={styles.webRoot}>
            <View pointerEvents="none" style={styles.webGlowTop} />
            <View pointerEvents="none" style={styles.webGlowBottom} />
            <View style={styles.webShell}>{appContent}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    webRoot: {
        flex: 1,
        backgroundColor: '#02070D',
        paddingHorizontal: 18,
        paddingVertical: 18,
    },
    webShell: {
        flex: 1,
        width: '100%',
        maxWidth: 980,
        alignSelf: 'center',
        overflow: 'hidden',
        borderRadius: 34,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#050A10',
        shadowColor: '#000000',
        shadowOpacity: 0.35,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 18 },
    },
    webGlowTop: {
        position: 'absolute',
        top: -120,
        right: -70,
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
    },
    webGlowBottom: {
        position: 'absolute',
        bottom: -140,
        left: -80,
        width: 340,
        height: 340,
        borderRadius: 170,
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
    },
});
