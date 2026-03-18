import { StyleSheet, Text, View } from 'react-native';

export default function PlannerScreen() {
    return (
        <View style={styles.container}>
            <Text>Planner Screen</Text>
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
