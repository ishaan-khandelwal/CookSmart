import { StyleSheet, Text, View } from 'react-native';

export default function CameraScanScreen() {
    return (
        <View style={styles.container}>
            <Text>Camera Scan Screen</Text>
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
