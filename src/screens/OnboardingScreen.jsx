import { StyleSheet, Text, View } from 'react-native';

export default function OnboardingScreen() {
    return (
        <View style={styles.container}>
            <Text>Onboarding Screen</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
